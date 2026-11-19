// The model budget: which model a thread runs on, and when a banked reset is redeemed
// (skills/cookbook/scripts/model-budget.mjs), and the hook that tells a session.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULES, advice, decide, line, parseT3, parseUsage, readUsage, sealCache } from "../plugins/cookbook/skills/cookbook/scripts/model-budget.mjs";

const HOOK = fileURLToPath(new URL("../plugins/cookbook/hooks/model-budget-note.mjs", import.meta.url));
const HOOKS_JSON = fileURLToPath(new URL("../plugins/cookbook/hooks/hooks.json", import.meta.url));
const GATE = fileURLToPath(new URL("../plugins/cookbook/hooks/model-budget-gate.sh", import.meta.url));
const SCRIPT = fileURLToPath(new URL("../plugins/cookbook/skills/cookbook/scripts/model-budget.mjs", import.meta.url));

const HOUR = 3600000;
const RESET = Date.parse("2026-11-19T10:00:00Z");
const at = (hoursBeforeReset) => RESET - hoursBeforeReset * HOUR;
// 70 hours before the reset is 58% of the week: the reading this was built on.
const NOW = at(70);

// The shape the usage endpoint answered with on 16 November 2026, without the unused keys.
const raw = ({ week = 37, fable = 59, session = null, grants = null, credits = false, reset = RESET } = {}) => ({
  five_hour: session === null ? null : { utilization: session, resets_at: new Date(NOW + 3 * HOUR).toISOString() },
  seven_day: { utilization: week, resets_at: new Date(reset).toISOString() },
  cedar_ember: grants === null ? null : { eligible: true, grants, next_grant_id: grants[0]?.id ?? null },
  extra_usage: { is_enabled: credits },
  limits: [
    { kind: "weekly_all", group: "weekly", percent: week, resets_at: new Date(reset).toISOString(), scope: null },
    ...(fable === null ? [] : [{ kind: "weekly_scoped", group: "weekly", percent: fable, resets_at: new Date(reset).toISOString(), scope: { model: { id: null, display_name: "Fable" }, surface: null } }]),
  ],
  weekly_scoped_shares: fable === null ? [] : [{ limit_index: 1, used_percent_of_weekly: fable / 2, allowance_percent_of_weekly: 50 }],
});
const grant = (over = {}) => ({ id: "g1", resets_left: 1, ends_at: "2026-12-10T22:00:00Z", paused: false, usable_now: true, clears: ["seven_day"], gives_back_weekly: true, ...over });
const usage = (opts) => parseUsage(raw(opts));
const pick = (opts, now = NOW) => decide(usage(opts), now);

const tmp = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "model-budget-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test("parseUsage reads the week, the Fable share, the session window and usage credits", () => {
  const u = usage({ session: 12 });
  assert.equal(u.week.used, 37);
  assert.equal(u.week.resetsAt, RESET);
  assert.deepEqual({ used: u.fable.used, usedOfWeek: u.fable.usedOfWeek, allowanceOfWeek: u.fable.allowanceOfWeek }, { used: 59, usedOfWeek: 29.5, allowanceOfWeek: 50 });
  assert.equal(u.session.used, 12);
  assert.equal(u.credits, false);
  assert.deepEqual(u.grants, []);
});

test("parseUsage: no Fable limit and no session window are null, not zero", () => {
  const u = usage({ fable: null });
  assert.equal(u.fable, null);
  assert.equal(u.session, null);
});

test("parseUsage refuses an answer with no weekly limit", () => {
  assert.throws(() => parseUsage({}), /weekly limit/);
  assert.throws(() => parseUsage({ limits: [{ kind: "weekly_all", percent: "37", resets_at: "x" }] }), /weekly limit/);
  assert.throws(() => parseUsage(null), /weekly limit/);
});

test("parseUsage keeps only grants that can be used now, with their kind", () => {
  const u = usage({ grants: [
    grant({ id: "fable1" }),
    grant({ id: "week1", gives_back_weekly: false, type: "weekly" }),
    grant({ id: "full1", gives_back_weekly: false, type: undefined, clears: ["five_hour", "seven_day"] }),
    grant({ id: "sess1", gives_back_weekly: false, type: undefined, clears: ["five_hour"] }),
    grant({ id: "paused", paused: true }),
    grant({ id: "later", usable_now: false }),
    grant({ id: "spent", resets_left: 0 }),
    grant({ id: "BAD ID" }),
  ] });
  assert.deepEqual(u.grants.map((g) => [g.id, g.kind]), [["fable1", "fable"], ["week1", "weekly"], ["full1", "full"], ["sess1", "session"]]);
  assert.equal(u.grants[0].endsAt, Date.parse("2026-12-10T22:00:00Z"));
});

test("on pace: Fable", () => {
  const d = pick();
  assert.equal(d.model, "fable");
  assert.equal(d.redeem, null);
  assert.equal(d.wait, null);
  assert.equal(Math.round(d.pace), 58);
});

test("Fable ahead of pace by more than the margin: Opus, and back to Fable inside it", () => {
  assert.equal(pick({ fable: 70 }).model, "opus");
  assert.equal(pick({ fable: 68 }).model, "fable");
});

test("the week ahead of pace: Opus, whatever Fable has left", () => {
  assert.equal(pick({ week: 70, fable: 20 }).model, "opus");
});

test("Fable nearly spent: Opus, so a turn is never held on the Fable limit", () => {
  assert.equal(RULES.fableSwitch, 90);
  assert.equal(pick({ week: 50, fable: 90 }, at(10)).model, "opus");
  assert.equal(pick({ week: 50, fable: 89 }, at(10)).model, "fable");
});

test("no separate Fable limit reported: Fable, by the week's pace alone", () => {
  assert.equal(pick({ fable: null }).model, "fable");
  assert.equal(pick({ fable: null, week: 70 }).model, "opus");
});

test("the week spent with nothing banked: wait for the weekly reset", () => {
  const d = pick({ week: 99, fable: 100 });
  assert.equal(d.model, "wait");
  assert.equal(d.wait.until, RESET);
  assert.equal(d.redeem, null);
});

test("the session window spent: wait for it, not for the week", () => {
  const d = pick({ session: 100 });
  assert.equal(d.model, "wait");
  assert.equal(d.wait.until, NOW + 3 * HOUR);
});

test("a banked Fable reset lifts the pace rule: spend Fable first", () => {
  assert.equal(pick({ fable: 75, grants: [grant()] }).model, "fable");
  assert.equal(pick({ fable: 75, grants: [grant()] }).redeem, null);
});

test("a Fable reset is redeemed when the Fable share is spent, with time left to use it", () => {
  const d = pick({ week: 60, fable: 96, grants: [grant()] });
  assert.deepEqual(d.redeem, { id: "g1", kind: "fable" });
  assert.equal(d.model, "fable");
});

test("a Fable reset is held when the weekly reset is close: Opus until then", () => {
  const d = pick({ week: 60, fable: 96, grants: [grant()] }, at(11));
  assert.equal(d.redeem, null);
  assert.equal(d.model, "opus");
});

test("a weekly reset waits until the Opus half is spent too", () => {
  const weekly = grant({ id: "w1", gives_back_weekly: false, type: "weekly" });
  const early = pick({ week: 52, fable: 100, grants: [weekly] });
  assert.equal(early.redeem, null);
  assert.equal(early.model, "opus");
  const late = pick({ week: 96, fable: 100, grants: [weekly] });
  assert.deepEqual(late.redeem, { id: "w1", kind: "weekly" });
});

test("a reset about to expire is redeemed once half of what it clears is spent", () => {
  const soon = new Date(NOW + 6 * HOUR).toISOString();
  assert.deepEqual(pick({ fable: 55, grants: [grant({ ends_at: soon })] }).redeem, { id: "g1", kind: "fable" });
  assert.equal(pick({ fable: 40, grants: [grant({ ends_at: soon })] }).redeem, null);
});

test("an expired reset is not offered", () => {
  const past = new Date(NOW - HOUR).toISOString();
  assert.equal(pick({ week: 60, fable: 96, grants: [grant({ ends_at: past })] }).redeem, null);
});

test("a session reset is redeemed only for a spent session window", () => {
  const sess = grant({ id: "s1", gives_back_weekly: false, type: "session", clears: ["five_hour"] });
  assert.deepEqual(pick({ session: 97, grants: [sess] }).redeem, { id: "s1", kind: "session" });
  assert.equal(pick({ session: 60, grants: [sess] }).redeem, null);
  assert.equal(pick({ grants: [sess] }).redeem, null);
});

test("a reset that would leave another limit spent is passed over for one that lets work run", () => {
  const sess = grant({ id: "s1", gives_back_weekly: false, type: "session", clears: ["five_hour"] });
  const weekly = grant({ id: "w1", gives_back_weekly: false, type: "weekly" });
  const full = grant({ id: "x1", gives_back_weekly: false, type: "full" });
  // session nearly spent, week spent: the weekly reset, not the session one (the review's case).
  assert.deepEqual(pick({ session: 97, week: 99, fable: 100, grants: [sess, weekly] }).redeem, { id: "w1", kind: "weekly" });
  // session and week both spent: neither single reset lets anything run; a full one does.
  assert.equal(pick({ session: 100, week: 99, fable: 100, grants: [sess, weekly] }).redeem, null);
  assert.equal(pick({ session: 100, week: 99, fable: 100, grants: [sess, weekly] }).model, "wait");
  assert.equal(pick({ session: 100, week: 99, fable: 100, grants: [sess, weekly] }).wait.until, RESET, "the later of the two limits");
  assert.deepEqual(pick({ session: 100, week: 99, fable: 100, grants: [sess, weekly, full] }).redeem, { id: "x1", kind: "full" });
  // session spent and the week not: the session reset is enough.
  assert.deepEqual(pick({ session: 97, week: 60, grants: [sess, weekly] }).redeem, { id: "s1", kind: "session" });
  // week spent, session fine: the weekly reset, never the session one, even when it expires.
  const soon = new Date(NOW + 6 * HOUR).toISOString();
  assert.deepEqual(pick({ session: 60, week: 99, fable: 100, grants: [grant({ ...sess, ends_at: soon }), weekly] }).redeem, { id: "w1", kind: "weekly" });
  // a Fable reset that gives back too little of the week is passed over.
  assert.deepEqual(pick({ week: 99, fable: 4, grants: [grant(), weekly] }).redeem, { id: "w1", kind: "weekly" });
});

test("the smallest reset that clears the spent limit is chosen", () => {
  const weekly = grant({ id: "w1", gives_back_weekly: false, type: "weekly" });
  const d = pick({ week: 97, fable: 100, grants: [weekly, grant({ id: "f1" })] });
  assert.equal(d.redeem.id, "f1");
});

test("the week spent but a reset to redeem: the model after it, not wait", () => {
  const d = pick({ week: 99, fable: 100, grants: [grant()] });
  assert.equal(d.redeem.kind, "fable");
  assert.equal(d.model, "fable");
  assert.equal(d.wait, null);
});

test("usage credits switched on is a warning: a limit hit would be billed", () => {
  assert.deepEqual(pick().warn, []);
  assert.match(pick({ credits: true }).warn.join(" "), /usage credits are on/);
});

test("line says the reading, the model and the banked resets", () => {
  const u = usage({ grants: [] });
  const text = line(u, decide(u, NOW), NOW, "UTC");
  assert.equal(text, "Model budget (16 Nov 12:00): week 37% used, Fable 59% of its share, pace 58%; weekly reset Thu 19 Nov 10:00. Use Fable 5.2 high: Fable is on pace. Banked resets: none.");
});

test("line: banked resets the reading does not hold are \"not read\", never \"none\"", () => {
  // The endpoint answered "not eligible" to the script's own read on 16 November 2026 while T3 Code showed two resets.
  const refused = parseUsage({ ...raw(), cedar_ember: { eligible: false, ineligible_reason: "x", grants: [] } });
  assert.equal(refused.resetsRead, false);
  assert.equal(usage({ grants: [] }).resetsRead, true);
  for (const u of [usage(), refused, parseT3(t3(), NOW).usage]) assert.match(line(u, decide(u, NOW), NOW, "UTC"), /Banked resets: not read \(see T3 Code: Usage, Limits\)\.$/);
});

test("line rounds a time to the nearest minute", () => {
  const u = parseUsage(raw({ reset: RESET - 100 }));
  assert.match(line(u, decide(u, NOW), NOW, "UTC"), /weekly reset Thu 19 Nov 10:00\./);
});

test("line names the reset to redeem and where", () => {
  const u = usage({ week: 60, fable: 96, grants: [grant()] });
  const text = line(u, decide(u, NOW), NOW, "UTC");
  assert.match(text, /Redeem the Fable reset now \(T3 Code: Usage, Limits, Use reset\), then use Fable 5\.2 high/);
  assert.match(text, /Banked resets: 1 Fable \(expires 10 Dec\)\./);
});

test("line for a wait names the time", () => {
  const u = usage({ week: 100, fable: 100 });
  assert.match(line(u, decide(u, NOW), NOW, "UTC"), /Nothing left: wait for Thu 19 Nov 10:00\./);
});

const seedHome = (dir, { token = "tok-secret-1", expiresAt = NOW + HOUR } = {}) => {
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(join(dir, ".claude", ".credentials.json"), JSON.stringify({ claudeAiOauth: { accessToken: token, expiresAt } }));
};
const answer = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test("readUsage asks the usage endpoint with the stored sign-in and caches the reading", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url: String(url), init }); return answer(200, raw()); };
  const first = await readUsage({ home, stateDir, now: NOW, fetchImpl });
  assert.equal(first.source, "live");
  assert.equal(first.usage.week.used, 37);
  assert.equal(calls[0].url, "https://api.anthropic.com/api/oauth/usage?cedar_ember=1");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok-secret-1");
  const cached = readFileSync(join(stateDir, "usage.json"), "utf8");
  assert.ok(!cached.includes("tok-secret-1"), "the cache never holds the token");
  const second = await readUsage({ home, stateDir, now: NOW + RULES.cacheMs - 1, fetchImpl });
  assert.equal(second.source, "cache");
  assert.equal(calls.length, 1);
  const third = await readUsage({ home, stateDir, now: NOW + RULES.cacheMs + 1, fetchImpl });
  assert.equal(third.source, "live");
  assert.equal(calls.length, 2);
});

test("readUsage: a failed read falls back to a reading under an hour old, and does not hammer", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  let status = 200;
  let calls = 0;
  const fetchImpl = async () => { calls++; return answer(status, raw()); };
  await readUsage({ home, stateDir, now: NOW, fetchImpl });
  status = 429;
  const later = NOW + RULES.cacheMs + 1;
  const stale = await readUsage({ home, stateDir, now: later, fetchImpl });
  assert.equal(stale.source, "stale");
  assert.equal(stale.usage.week.used, 37);
  assert.equal(calls, 2);
  await readUsage({ home, stateDir, now: later + 1000, fetchImpl });
  assert.equal(calls, 2, "no second try inside the retry pause");
  const old = await readUsage({ home, stateDir, now: NOW + RULES.staleMs + 1, fetchImpl });
  assert.equal(old.usage, undefined);
  assert.match(old.error, /429/);
});

test("readUsage: two reads at the same moment keep no lock, and the one that fails never replaces a reading", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  // The first read is held open; the second is answered 429 while it is.
  const fetchImpl = async () => { if (++calls > 1) return answer(429, {}); await gate; return answer(200, raw()); };
  const first = readUsage({ home, stateDir, now: NOW, fetchImpl });
  const second = await readUsage({ home, stateDir, now: NOW, fetchImpl });
  assert.match(second.error, /429/);
  release();
  assert.equal((await first).source, "live");
  const again = await readUsage({ home, stateDir, now: NOW + 1000, fetchImpl });
  assert.equal(again.source, "cache", "the reading is there beside the mark of the failed read");
  assert.equal(calls, 2);
  assert.deepEqual(readdirSync(stateDir).sort(), ["usage-tried.json", "usage.json"], "no lock, gate or part file is left");
});

test("readUsage: a read that fails while another session's read succeeds gets that reading", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  mkdirSync(stateDir, { recursive: true });
  seedHome(home);
  // The other session's reading lands while this read is on its way to a 429.
  const fetchImpl = async () => {
    writeFileSync(join(stateDir, "usage.json"), sealCache("tok-secret-1", { at: NOW + 5, usage: parseUsage(raw({ week: 41 })) }));
    return answer(429, {});
  };
  const r = await readUsage({ home, stateDir, now: NOW, fetchImpl });
  assert.equal(r.source, "cache");
  assert.equal(r.usage.week.used, 41);
  const kept = await readUsage({ home, stateDir, now: NOW + 10, fetchImpl: async () => { throw new Error("must not be called"); } });
  assert.equal(kept.usage.week.used, 41, "the failed read left the reading alone");
});

// T3 Code's saved reading, in the shape its file had on 16 November 2026, without the unused keys.
const t3 = ({ week = 43, fable = 69, session = null, credits = false, options = null, checkedAt = NOW - 60000, reset = RESET, unavailable = null } = {}) => ({
  displayName: "Claude",
  usageLimits: {
    checkedAt: new Date(checkedAt).toISOString(),
    windows: [
      ...(session === null ? [] : [{ id: "five_hour", kind: "session", label: "Session", windowDurationMins: 300, usedPercent: session, resetsAt: new Date(NOW + 3 * HOUR).toISOString() }]),
      ...(week === null ? [] : [{ id: "seven_day", kind: "weekly", label: "Weekly", windowDurationMins: 10080, usedPercent: week, resetsAt: new Date(reset).toISOString() }]),
      ...(fable === null ? [] : [{ id: "seven_day_fable", kind: "weekly", label: "Weekly · Fable", windowDurationMins: 10080, usedPercent: fable, resetsAt: new Date(reset).toISOString() }]),
      ...(credits ? [{ id: "monthly_spend", kind: "monthly", label: "Monthly spend", usedPercent: 3 }] : []),
    ],
    ...(options === null ? {} : { resetCredits: { availableCount: options.reduce((n, o) => n + (Number.isInteger(o?.availableCount) ? o.availableCount : 0), 0), options } }),
    ...(unavailable === null ? {} : { unavailable: { reason: unavailable } }),
  },
});
const option = (over = {}) => ({ creditId: "g1", label: "Fable reset", description: "Refills your Fable allowance.", availableCount: 1, expiresAt: "2026-12-10T22:00:00Z", ...over });
const seedT3 = (home, json) => {
  mkdirSync(join(home, ".t3", "caches"), { recursive: true });
  // Written for the user alone, whatever the umask of the machine the tests run on.
  writeFileSync(join(home, ".t3", "caches", "claudeAgent.json"), typeof json === "string" ? json : JSON.stringify(json), { mode: 0o600 });
};
const never = async () => { throw new Error("must not be called"); };
const FABLE_RESET = { id: "g1", kind: "fable", left: 1, endsAt: Date.parse("2026-12-10T22:00:00Z") };

test("parseT3 reads the week, the Fable share, the session window and credits, and gives the banked resets beside the reading", () => {
  const r = parseT3(t3({ session: 12, credits: true, options: [option(), option({ creditId: "g2", label: "5-hour reset", availableCount: 2, expiresAt: undefined })] }), NOW);
  assert.equal(r.at, NOW - 60000);
  assert.deepEqual(r.usage.week, { used: 43, resetsAt: RESET });
  assert.deepEqual(r.usage.fable, { used: 69, usedOfWeek: 34.5, allowanceOfWeek: 50 });
  assert.deepEqual(r.usage.session, { used: 12, resetsAt: NOW + 3 * HOUR });
  // T3 Code's file holds the banked resets only every other minute: the reading itself never has them,
  // so a minute with the list and a minute without give the same reading. readUsage keeps the list.
  assert.deepEqual([r.usage.grants, r.usage.resetsRead], [[], false]);
  assert.deepEqual(r.resets, [
    { id: "g1", kind: "fable", left: 1, endsAt: Date.parse("2026-12-10T22:00:00Z") },
    { id: "g2", kind: "session", left: 2, endsAt: null },
  ]);
  assert.deepEqual(parseT3(t3({ fable: 80 }), NOW).usage, parseT3(t3({ fable: 80, options: [option()] }), NOW).usage);
  assert.equal(r.usage.credits, true);
  const plain = parseT3(t3({ fable: null }), NOW).usage;
  assert.deepEqual([plain.fable, plain.session, plain.grants, plain.credits], [null, null, [], false]);
  assert.equal(parseT3(t3({ checkedAt: NOW + 2000 }), NOW).at, NOW + 2000, "written while this run started: still a reading");
  assert.equal(decide(parseT3(t3({ fable: 95 }), NOW).usage, NOW).model, "opus", "the rules read it like a reading from the endpoint");
});

test("parseT3: the reset list is null when the file has none, empty when T3 Code read none, and null when it is not fully understood", () => {
  const withCredits = (resetCredits) => { const json = t3(); json.usageLimits.resetCredits = resetCredits; return json; };
  const resets = (resetCredits) => parseT3(withCredits(resetCredits), NOW).resets;
  // T3 Code leaves the key out in a minute its own read was refused: that is "not read", not "none".
  assert.equal(parseT3(t3(), NOW).resets, null);
  for (const odd of [null, "2", 2, [option()]]) assert.equal(resets(odd), null, JSON.stringify(odd));
  // What T3 Code writes when the account holds no reset: a count of 0 and no options.
  assert.deepEqual(resets({ availableCount: 0 }), []);
  assert.deepEqual(resets({ availableCount: 0, options: [] }), []);
  const kinds = parseT3(t3({ options: ["5-hour reset", "Fable reset", "Weekly reset", "Full reset"].map((label, i) => option({ creditId: `g${i}`, label })) }), NOW).resets;
  assert.deepEqual(kinds.map((g) => g.kind), ["session", "fable", "weekly", "full"]);
  assert.deepEqual(resets({ availableCount: 3, options: [option({ availableCount: 3 })] }), [{ ...FABLE_RESET, left: 3 }]);
  // A list that is not understood in full is "not read", never a shorter list and never "none":
  // T3 Code may rename a label or change the shape in an update.
  const good = option();
  const notRead = [
    { availableCount: 2 },
    { options: [] },
    { availableCount: "0" },
    { availableCount: 1, options: "none" },
    { availableCount: 1, options: [] },
    { availableCount: 0, options: [good] },
    { availableCount: 2, options: [good] },
    { options: [good] },
    { availableCount: 1, options: [option({ label: "Fable refill" })] },
    { availableCount: 1, options: [option({ label: "constructor" })] },
    { availableCount: 2, options: [good, option({ creditId: "g2", label: "Mystery reset" })] },
    { availableCount: 1, options: [option({ creditId: "../x" })] },
    { availableCount: 1, options: [good, option({ creditId: "g2", label: "Weekly reset", availableCount: 0 })] },
    { availableCount: 1, options: [option({ availableCount: 1.5 })] },
    { availableCount: 1, options: [good, null] },
    { availableCount: 1, options: [good, "g1"] },
    { availableCount: 2, options: [good, option({ creditId: "g2" })] },
    { availableCount: 1, options: [option({ expiresAt: "soon" })] },
    { availableCount: 30, options: Array.from({ length: 30 }, (_, i) => option({ creditId: `g${i}` })) },
  ];
  for (const odd of notRead) assert.equal(resets(odd), null, JSON.stringify(odd).slice(0, 140));
});

test("parseT3: a file that is odd in any way is no reading", () => {
  const edit = (change) => { const json = t3(); change(json.usageLimits); return json; };
  const odd = [
    {},
    { usageLimits: null },
    t3({ unavailable: "probeFailed" }),
    t3({ week: null }),
    t3({ week: 143 }),
    t3({ week: -1 }),
    t3({ week: "43" }),
    t3({ fable: 101 }),
    t3({ checkedAt: NOW + 60000 }),
    t3({ reset: NOW - 1000 }),
    t3({ reset: NOW + 30 * 24 * HOUR }),
    edit((l) => { l.checkedAt = "soon"; }),
    edit((l) => { l.windows = { seven_day: { usedPercent: 1 } }; }),
    edit((l) => { delete l.windows[0].resetsAt; }),
  ];
  for (const json of odd) assert.equal(parseT3(json, NOW), null, JSON.stringify(json).slice(0, 120));
});

test("readUsage: a signed reading always comes before T3 Code's, which stands in only when there is none", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  seedT3(home, t3());
  // A prompt or a tool event: no network, so T3 Code's reading stands in.
  const quiet = await readUsage({ home, stateDir, now: NOW, fetchImpl: never, cacheOnly: true });
  assert.equal(quiet.source, "t3");
  assert.equal(quiet.at, NOW - 60000);
  assert.equal(quiet.usage.fable.used, 69);
  assert.ok(!existsSync(stateDir), "T3 Code's reading is never copied into the signed files");
  // A session start reads first, however fresh T3 Code's reading is; a 429 leaves T3 Code's.
  let calls = 0;
  const limited = await readUsage({ home, stateDir, now: NOW, fetchImpl: async () => { calls++; return answer(429, {}); } });
  assert.equal(limited.source, "t3");
  assert.equal(calls, 1);
  assert.deepEqual(readdirSync(stateDir), ["usage-tried.json"]);
  const paused = await readUsage({ home, stateDir, now: NOW + RULES.retryMs - 1, fetchImpl: never });
  assert.equal(paused.source, "t3", "no second read inside the pause");
  // A read that gets through is signed and wins, for as long as it is fresh.
  const live1 = await readUsage({ home, stateDir, now: NOW + RULES.retryMs + 1, fetchImpl: async () => answer(200, raw()) });
  assert.equal(live1.source, "live");
  seedT3(home, t3({ checkedAt: NOW + RULES.retryMs + 2000 }));
  const own = await readUsage({ home, stateDir, now: NOW + RULES.retryMs + 5000, fetchImpl: never, cacheOnly: true });
  assert.equal(own.source, "cache");
  assert.equal(own.usage.week.used, 37);
});

test("readUsage: a signed reading under an hour old stands in before T3 Code's, however new T3 Code's is", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  mkdirSync(stateDir, { recursive: true });
  seedHome(home);
  const sign = (at) => writeFileSync(join(stateDir, "usage.json"), sealCache("tok-secret-1", { at, usage: parseUsage(raw()) }));
  const read = () => readUsage({ home, stateDir, now: NOW, fetchImpl: never, cacheOnly: true });
  seedT3(home, t3({ checkedAt: NOW - 1000 }));
  sign(NOW - 50 * 60000);
  const signed = await read();
  assert.equal(signed.source, "stale", "the unsigned file cannot pass over a signed reading by being newer");
  assert.equal(signed.usage.week.used, 37);
  sign(NOW - RULES.staleMs - 1);
  const stand = await read();
  assert.equal(stand.source, "t3", "with no signed reading under an hour old, T3 Code's stands in");
  assert.equal(stand.usage.week.used, 43);
  seedT3(home, t3({ checkedAt: NOW - RULES.staleMs - 1 }));
  const gone = await read();
  assert.equal(gone.usage, undefined);
  assert.match(gone.error, /no fresh reading/);
});

const payload = (file) => JSON.parse(JSON.parse(readFileSync(file, "utf8")).payload);

test("readUsage: the reset list in T3 Code's file goes with every reading while that file shows it, and is saved nowhere", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  seedT3(home, t3({ options: [option()] }));
  const quiet = await readUsage({ home, stateDir, now: NOW, fetchImpl: never, cacheOnly: true });
  assert.deepEqual([quiet.source, quiet.usage.grants, quiet.usage.resetsRead, quiet.resetsSeen], ["t3", [FABLE_RESET], true, NOW - 60000]);
  // The script's own read is told nothing about resets (cedar_ember: not eligible): the list still goes with it.
  const refused = { ...raw(), cedar_ember: { eligible: false, ineligible_reason: "surface", grants: [] } };
  const read = await readUsage({ home, stateDir, now: NOW, fetchImpl: async () => answer(200, refused) });
  assert.deepEqual([read.source, read.usage.week.used, read.usage.grants, read.usage.resetsRead], ["live", 37, [FABLE_RESET], true]);
  const cached = await readUsage({ home, stateDir, now: NOW + 1000, fetchImpl: never });
  assert.deepEqual([cached.source, cached.usage.grants, cached.usage.resetsRead], ["cache", [FABLE_RESET], true]);
  const stale = await readUsage({ home, stateDir, now: NOW + RULES.cacheMs + 1, fetchImpl: never, cacheOnly: true });
  assert.deepEqual([stale.source, stale.usage.grants], ["stale", [FABLE_RESET]]);
  // Nothing T3 Code's file said is saved: the script's folder holds its own signed reading, which
  // has only what the endpoint said.
  assert.deepEqual(readdirSync(stateDir).sort(), ["usage.json"]);
  assert.deepEqual([payload(join(stateDir, "usage.json")).usage.grants, payload(join(stateDir, "usage.json")).usage.resetsRead], [[], false]);
  // T3 Code's file no longer shows the list: the very same signed reading now has none.
  seedT3(home, t3());
  const without = await readUsage({ home, stateDir, now: NOW + 2000, fetchImpl: never });
  assert.deepEqual([without.source, without.usage.grants, without.usage.resetsRead, without.resetsSeen], ["cache", [], false, undefined]);
  assert.deepEqual(readdirSync(stateDir).sort(), ["usage.json"]);
});

test("readUsage: the list is used only in the readings T3 Code's file has it, and the script writes nothing for it", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  // Fable ahead of pace: Opus by the pace rule, Fable while a Fable reset is banked. T3 Code's file
  // has the list only in the minutes its own read got through, so the reading differs from one
  // minute to the next; the hook is what keeps a session's advice (its own tests, below).
  const minute = (n, options) => {
    seedT3(home, t3({ fable: 80, options, checkedAt: NOW + n * 60000 }));
    return readUsage({ home, stateDir, now: NOW + n * 60000 + 20000, fetchImpl: never, cacheOnly: true });
  };
  for (const [n, options] of [[0, [option()]], [1, null], [2, [option()]], [3, null], [4, null]]) {
    const r = await minute(n, options);
    const now = NOW + n * 60000 + 20000;
    assert.deepEqual([r.source, r.usage.grants, r.usage.resetsRead, r.resetsSeen], options ? ["t3", [FABLE_RESET], true, NOW + n * 60000] : ["t3", [], false, undefined], `minute ${n}`);
    assert.equal(advice(decide(r.usage, now)), options ? "Model budget: use Fable 5.2 high." : "Model budget: use Opus 5.5 high.", `minute ${n}`);
    if (!options) assert.match(line(r.usage, decide(r.usage, now), now, "UTC"), /Use Opus 5\.5 high: Fable is ahead of pace\. Banked resets: not read/);
    assert.equal(existsSync(stateDir), false, "no file of the script's own: T3 Code's list is never saved");
  }
});

test("readUsage: the list is what T3 Code's file shows at that read: a newer one, none, or one not understood", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  const read = async (now, json) => {
    seedT3(home, json);
    return (await readUsage({ home, stateDir, now, fetchImpl: never, cacheOnly: true })).usage;
  };
  assert.deepEqual((await read(NOW, t3({ options: [option()], checkedAt: NOW - 1000 }))).grants, [FABLE_RESET]);
  // The owner used the Fable reset: T3 Code's next read shows what is left.
  const weekly = await read(NOW + 120000, t3({ options: [option({ creditId: "w1", label: "Weekly reset" })], checkedAt: NOW + 119000 }));
  assert.deepEqual(weekly.grants.map((g) => [g.id, g.kind]), [["w1", "weekly"]]);
  // A list in a shape that is not understood (a renamed label, a count with no entries) is "not read", never "none".
  const count = t3({ checkedAt: NOW + 149000 });
  count.usageLimits.resetCredits = { availableCount: 2 };
  for (const [now, json] of [[NOW + 150000, count], [NOW + 180000, t3({ options: [option({ label: "Fable refill" })], checkedAt: NOW + 179000 })]]) {
    const odd = await read(now, json);
    assert.deepEqual([odd.grants, odd.resetsRead], [[], false]);
    assert.match(line(odd, decide(odd, now), now, "UTC"), /Banked resets: not read/);
  }
  const none = t3({ checkedAt: NOW + 239000 });
  none.usageLimits.resetCredits = { availableCount: 0 };
  const empty = await read(NOW + 240000, none);
  assert.deepEqual([empty.grants, empty.resetsRead], [[], true]);
  assert.match(line(empty, decide(empty, NOW + 240000), NOW + 240000, "UTC"), /Banked resets: none\.$/);
  assert.equal(existsSync(stateDir), false);
});

test("readUsage: the list's time is the file's own checkedAt, and a list an hour old is not read", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  // As on 16 November 2026: T3 Code rewrites the file, reset list included, every minute (the top
  // checkedAt), and asks Claude Code for the limits less often (usageLimits.checkedAt stays).
  const file = (fileCheckedAt, options, limitsAt = NOW - 4 * 60000) => ({ ...t3({ options, checkedAt: limitsAt }), checkedAt: new Date(fileCheckedAt).toISOString() });
  const read = async (now, json) => {
    seedT3(home, json);
    return readUsage({ home, stateDir, now, fetchImpl: never, cacheOnly: true });
  };
  const first = await read(NOW, file(NOW - 1000, [option()]));
  assert.deepEqual([first.usage.grants, first.resetsSeen, first.at], [[FABLE_RESET], NOW - 1000, NOW - 4 * 60000]);
  // The owner used the Fable reset; a minute later the file shows what is left, with the same limits probe.
  const next = await read(NOW + 60000, file(NOW + 59000, [option({ creditId: "w1", label: "Weekly reset" })]));
  assert.deepEqual([next.usage.grants.map((g) => g.id), next.resetsSeen, next.at], [["w1"], NOW + 59000, NOW - 4 * 60000]);
  // A file T3 Code stopped rewriting: its list stands while the file's time is under an hour old
  // (the figures here are the script's own signed reading, so only the list's age is in question).
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "usage.json"), sealCache("tok-secret-1", { at: NOW, usage: usage() }));
  const young = await read(NOW + 1000, file(NOW + 1000 - RULES.staleMs + 1, [option()], NOW - 2 * HOUR));
  assert.deepEqual([young.source, young.usage.grants, young.usage.resetsRead], ["cache", [FABLE_RESET], true]);
  const old = await read(NOW + 1000, file(NOW + 1000 - RULES.staleMs, [option()], NOW - 2 * HOUR));
  assert.deepEqual([old.source, old.usage.grants, old.usage.resetsRead, old.resetsSeen], ["cache", [], false, undefined]);
  rmSync(join(stateDir, "usage.json"));
  // A file time that is odd or ahead of the clock: its list is not taken, its figures still are.
  const later = NOW + RULES.staleMs + 5 * 60000;
  for (const odd of ["soon", 7, null, new Date(later + 60000).toISOString()]) {
    const r = await read(later, { ...t3({ options: [option()], checkedAt: later - 60000 }), checkedAt: odd });
    assert.deepEqual([r.source, r.usage.week.used, r.usage.grants, r.usage.resetsRead], ["t3", 43, [], false], String(odd));
  }
});

test("readUsage: a resets.json left by 0.38.0 is not read and not written, however well it is signed", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  mkdirSync(stateDir, { recursive: true });
  seedHome(home);
  seedT3(home, t3());
  const file = join(stateDir, "resets.json");
  const left = sealCache("tok-secret-1", { seen: NOW - 60000, grants: [FABLE_RESET] });
  writeFileSync(file, left);
  const read = async () => (await readUsage({ home, stateDir, now: NOW, fetchImpl: never, cacheOnly: true })).usage;
  const u = await read();
  assert.deepEqual([u.grants, u.resetsRead], [[], false], "T3 Code's file has no list now: not read");
  seedT3(home, t3({ options: [option({ creditId: "w1", label: "Weekly reset" })] }));
  assert.deepEqual((await read()).grants.map((g) => g.id), ["w1"], "the list is T3 Code's, as its file shows it now");
  assert.equal(readFileSync(file, "utf8"), left);
  assert.deepEqual(readdirSync(stateDir), ["resets.json"]);
});

test("readUsage: a T3 Code file that is broken, changed or far too large is ignored", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  for (const text of ["{ not json", JSON.stringify(t3({ week: 250 })), JSON.stringify(t3({ unavailable: "probeFailed" })), `${JSON.stringify(t3()).slice(0, -1)},"pad":"${"x".repeat(4000000)}"}`]) {
    seedT3(home, text);
    const r = await readUsage({ home, stateDir, now: NOW, fetchImpl: never, cacheOnly: true });
    assert.equal(r.usage, undefined, text.slice(0, 60));
    assert.match(r.error, /no fresh reading/);
  }
});

test("readUsage: a cache not signed with the current sign-in is ignored", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  mkdirSync(stateDir, { recursive: true });
  seedHome(home);
  let calls = 0;
  const fetchImpl = async () => { calls++; return answer(200, raw()); };
  const forged = { at: NOW, tried: NOW, usage: parseUsage(raw({ week: 99, fable: 100 })) };
  for (const text of [JSON.stringify(forged), sealCache("another-token", forged), JSON.stringify({ payload: JSON.stringify(forged), sig: "0".repeat(64) })]) {
    writeFileSync(join(stateDir, "usage.json"), text);
    assert.equal((await readUsage({ home, stateDir, now: NOW, fetchImpl, cacheOnly: true })).usage, undefined);
  }
  const live1 = await readUsage({ home, stateDir, now: NOW, fetchImpl });
  assert.equal(live1.source, "live");
  assert.equal(live1.usage.week.used, 37);
  assert.equal(calls, 1);
  const text = readFileSync(join(stateDir, "usage.json"), "utf8");
  const box = JSON.parse(text);
  writeFileSync(join(stateDir, "usage.json"), JSON.stringify({ ...box, payload: box.payload.replace('"used":37', '"used":99') }));
  assert.equal((await readUsage({ home, stateDir, now: NOW + 1, fetchImpl, cacheOnly: true })).usage, undefined, "an edited payload fails the signature");
});

test("readUsage with cacheOnly never calls the network", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  const never = async () => { throw new Error("must not be called"); };
  const empty = await readUsage({ home, stateDir, now: NOW, fetchImpl: never, cacheOnly: true });
  assert.match(empty.error, /no fresh reading/);
  await readUsage({ home, stateDir, now: NOW, fetchImpl: async () => answer(200, raw()) });
  const stale = await readUsage({ home, stateDir, now: NOW + RULES.cacheMs + 1, fetchImpl: never, cacheOnly: true });
  assert.equal(stale.source, "stale");
});

test("readUsage: no sign-in, or an answer it cannot read, is an error and never a reading", async (t) => {
  const home = tmp(t);
  const none = await readUsage({ home, stateDir: join(home, "state"), now: NOW, fetchImpl: async () => { throw new Error("must not be called"); } });
  assert.match(none.error, /no Claude sign-in/);
  seedHome(home);
  const odd = await readUsage({ home, stateDir: join(home, "state"), now: NOW, fetchImpl: async () => answer(200, { hello: 1 }) });
  assert.match(odd.error, /weekly limit/);
  const down = await readUsage({ home, stateDir: join(home, "state2"), now: NOW, fetchImpl: async () => { throw new Error("getaddrinfo ENOTFOUND tok-secret-1"); } });
  assert.equal(down.error, "the usage read failed");
});

// The hook runs as its own process with a home folder of ours and a fresh cached reading,
// so it never reaches the network. It reads the real clock, so its week ends 70 hours from now.
const live = (opts) => raw({ ...opts, reset: Date.now() + 70 * HOUR });
const runHook = (home, input, { cache = live(), cachedAt = Date.now(), signedIn = true, token = "tok-secret-1" } = {}) => {
  const stateDir = join(home, ".local", "share", "model-budget");
  mkdirSync(stateDir, { recursive: true });
  if (signedIn) seedHome(home, { token, expiresAt: Date.now() + HOUR });
  else rmSync(join(home, ".claude"), { recursive: true, force: true });
  if (cache) writeFileSync(join(stateDir, "usage.json"), sealCache("tok-secret-1", { at: cachedAt, tried: cachedAt, usage: parseUsage(cache) }));
  const run = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, USERPROFILE: home, HOME: home } });
  return { ...run, context: run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput : null };
};

test("hook: a session start gets the advice and no usage figures, times or counts", (t) => {
  const home = tmp(t);
  const r = runHook(home, { hook_event_name: "SessionStart", session_id: "s-1" }, { cache: live({ grants: [grant({ id: "g9" })] }) });
  assert.equal(r.status, 0);
  assert.equal(r.context.hookEventName, "SessionStart");
  const text = r.context.additionalContext;
  assert.match(text, /^Model budget: use Fable 5\.2 high\. /);
  assert.match(text, /model-budget/);
  assert.doesNotMatch(text, /\d+%|\d{1,2}:\d{2}|week|share|pace|Banked|g9|expires/);
});

test("advice: with a shared limit spent, nothing runs until the reset is redeemed", () => {
  const sess = grant({ id: "s1", gives_back_weekly: false, type: "session", clears: ["five_hour"] });
  assert.equal(advice(pick({ session: 100, grants: [sess] })), "Model budget: a banked session reset is worth using now: ask the owner to redeem it, and until then nothing runs: stop at a safe point; after it, use Fable 5.2 high.");
  const weekly = grant({ id: "w1", gives_back_weekly: false, type: "weekly" });
  assert.match(advice(pick({ week: 99, fable: 100, grants: [weekly] })), /until then nothing runs: stop at a safe point/);
});

test("advice names the action only", () => {
  assert.equal(advice(pick()), "Model budget: use Fable 5.2 high.");
  assert.equal(advice(pick({ fable: 70 })), "Model budget: use Opus 5.5 high.");
  assert.equal(advice(pick({ week: 100, fable: 100 })), "Model budget: nothing left until the reset. Stop at a safe point.");
  assert.equal(advice(pick({ week: 60, fable: 96, grants: [grant()] })), "Model budget: a banked Fable reset is worth using now: ask the owner to redeem it, and until then use Opus 5.5 high; after it, use Fable 5.2 high.");
});

test("hook: later events are silent until the advice changes, then speak once", (t) => {
  const home = tmp(t);
  runHook(home, { hook_event_name: "SessionStart", session_id: "s-2" });
  const same = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-2" });
  assert.equal(same.stdout, "");
  const changed = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-2" }, { cache: live({ week: 50, fable: 93 }) });
  assert.equal(changed.context.hookEventName, "PostToolUse");
  assert.match(changed.context.additionalContext, /^Model budget changed\. Model budget: use Opus 5\.5 high\./);
  const again = runHook(home, { hook_event_name: "UserPromptSubmit", session_id: "s-2" }, { cache: live({ week: 50, fable: 93 }) });
  assert.equal(again.stdout, "");
});

test("hook: a subagent's event is not told and does not use up the change", (t) => {
  const home = tmp(t);
  runHook(home, { hook_event_name: "SessionStart", session_id: "s-6" });
  const spent = live({ week: 50, fable: 93 });
  const sub = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-6", agent_id: "a1" }, { cache: spent });
  assert.equal(sub.stdout, "");
  const main = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-6" }, { cache: spent });
  assert.match(main.context.additionalContext, /^Model budget changed\./);
});

test("hook: a session told to use Opus until a reset is redeemed is told to stop when the limit is spent", (t) => {
  const home = tmp(t);
  const weekly = grant({ id: "w1", gives_back_weekly: false, type: "weekly" });
  const start = runHook(home, { hook_event_name: "SessionStart", session_id: "s-8" }, { cache: live({ week: 96, fable: 100, grants: [weekly] }) });
  assert.match(start.context.additionalContext, /until then use Opus 5\.5 high/);
  const spent = live({ week: 99, fable: 100, grants: [weekly] });
  const told = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-8" }, { cache: spent });
  assert.match(told.context.additionalContext, /^Model budget changed\. .*until then nothing runs: stop at a safe point/);
  const again = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-8" }, { cache: spent });
  assert.equal(again.stdout, "");
});

test("hook: when a session's saved reading goes stale it says unknown once", (t) => {
  const home = tmp(t);
  runHook(home, { hook_event_name: "SessionStart", session_id: "s-7" });
  const old = Date.now() - RULES.staleMs - 1000;
  const stale = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-7" }, { cachedAt: old });
  assert.equal(stale.context.additionalContext, "Model budget: unknown. Keep this thread's model.");
  const again = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-7" }, { cachedAt: old });
  assert.equal(again.stdout, "");
  const back = runHook(home, { hook_event_name: "UserPromptSubmit", session_id: "s-7" });
  assert.match(back.context.additionalContext, /^Model budget changed. Model budget: use /);
});

test("hook: a session it has not seen gets the line on its first event", (t) => {
  const home = tmp(t);
  const r = runHook(home, { hook_event_name: "UserPromptSubmit", session_id: "s-3" });
  assert.match(r.context.additionalContext, /^Model budget: use /);
});

test("hook: an unknown reading is said at session start and is never a change", (t) => {
  const home = tmp(t);
  const start = runHook(home, { hook_event_name: "SessionStart", session_id: "s-4" }, { cache: null, signedIn: false });
  assert.match(start.context.additionalContext, /^Model budget: unknown\. Keep this thread's model\.$/);
  const tool = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-4" }, { cache: null });
  assert.equal(tool.stdout, "");
});

test("hook: bad input ends in silence and exit code 0, and writes nothing outside its folder", (t) => {
  const home = tmp(t);
  for (const input of [{}, { hook_event_name: "SessionStart", session_id: "../../evil" }, { hook_event_name: "Nope", session_id: "s-5" }]) {
    const r = runHook(home, input);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  }
  assert.ok(!existsSync(join(home, "evil.json")));
  const bad = spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8", env: { ...process.env, USERPROFILE: home, HOME: home } });
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, "");
});

test("hooks.json runs the note at session start and on a prompt, and after a tool through the gate", () => {
  const { hooks } = JSON.parse(readFileSync(HOOKS_JSON, "utf8"));
  for (const event of ["SessionStart", "UserPromptSubmit", "PostToolUse"]) {
    const commands = hooks[event].flatMap((g) => g.hooks.map((h) => h.command));
    if (event === "PostToolUse") {
      // Run with bash (a hook command runs in /bin/sh on Linux, which cannot run the gate); no matcher, so every tool call reaches it.
      const group = hooks[event].find((g) => g.hooks.some((h) => h.command.includes("model-budget-gate.sh")));
      assert.equal(group.matcher, undefined);
      assert.equal(group.hooks[0].command, 'bash "${CLAUDE_PLUGIN_ROOT}/hooks/model-budget-gate.sh" "${CLAUDE_PLUGIN_ROOT}"');
      assert.ok(!commands.some((c) => c.includes("model-budget-note.mjs")), "no ungated note after a tool");
    } else assert.ok(commands.some((c) => c.includes("${CLAUDE_PLUGIN_ROOT}/hooks/model-budget-note.mjs")), event);
    for (const g of hooks[event]) for (const h of g.hooks) assert.ok(h.timeout <= 10, `${event} timeout`);
  }
  assert.match(readFileSync(GATE, "utf8"), /\| node "\$mb_root\/hooks\/model-budget-note\.mjs"/);
});

// The gate runs in Git Bash on Windows, as Claude Code's hooks do, and in bash elsewhere.
const BASH = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const noBash = process.platform === "win32" && !existsSync(BASH) ? "Git Bash is not installed" : false;
// A stub plugin root whose note only logs its input, so a test sees when Node started and what it read.
const stubRoot = (home) => {
  const root = join(home, "plugin");
  mkdirSync(join(root, "hooks"), { recursive: true });
  writeFileSync(join(root, "hooks", "model-budget-note.mjs"), 'import { appendFileSync } from "node:fs";\nlet s = "";\nfor await (const c of process.stdin) s += c;\nappendFileSync(process.env.MB_TEST_LOG, JSON.stringify(s) + "\\n");\n');
  return root;
};
const runGate = (home, root, input) => {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  const log = join(home, "runs.log");
  // As hooks.json runs it: bash with the gate file and the plugin root as arguments.
  const run = spawnSync(BASH, [GATE.replaceAll("\\", "/"), root.replaceAll("\\", "/")], { input: text, encoding: "utf8", env: { ...process.env, USERPROFILE: home, HOME: home, MB_TEST_LOG: log } });
  const runs = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  return { ...run, runs };
};
const gateFile = (home, id) => join(home, ".local", "share", "model-budget", "sessions", `${id}.gate`);

test("gate: Node starts once per five minutes per session, with the hook input whole", { skip: noBash }, (t) => {
  const home = tmp(t);
  const root = stubRoot(home);
  mkdirSync(join(home, ".local", "share", "model-budget", "sessions"), { recursive: true });
  // Longer than the 1,024 characters the gate reads, with text that is not ASCII past that point.
  const input = { session_id: "s-g1", transcript_path: "C:/t.jsonl", hook_event_name: "PostToolUse", tool_name: "Bash", tool_response: `${"x".repeat(1500)} æøå “quoted” \\ end` };
  const first = runGate(home, root, input);
  assert.equal(first.status, 0);
  assert.deepEqual(first.runs, [JSON.stringify(input)]);
  const next = Number(readFileSync(gateFile(home, "s-g1"), "utf8"));
  assert.ok(Math.abs(next - (Date.now() / 1000 + 300)) < 30, "the gate opens again in five minutes");
  assert.equal(runGate(home, root, input).runs.length, 1, "within the window Node does not start");
  assert.equal(runGate(home, root, { ...input, session_id: "s-g2" }).runs.length, 2, "another session has its own gate");
  writeFileSync(gateFile(home, "s-g1"), `${Math.floor(Date.now() / 1000) - 1}\n`);
  assert.equal(runGate(home, root, input).runs.length, 3, "after the window Node starts again");
  writeFileSync(gateFile(home, "s-g1"), `${Math.floor(Date.now() / 1000) + 3600}\n`);
  assert.equal(runGate(home, root, input).runs.length, 4, "a gate more than one window ahead counts as none");
  writeFileSync(gateFile(home, "s-g1"), "not a time\n");
  assert.equal(runGate(home, root, input).runs.length, 5, "an unreadable gate starts Node");
  // Review of #130: a leading zero would be octal to bash ("08" fails), so it counts as no gate.
  writeFileSync(gateFile(home, "s-g1"), "08\n");
  const octal = runGate(home, root, input);
  assert.equal(octal.runs.length, 6, "a gate with a leading zero starts Node");
  assert.equal(octal.stderr, "");
  assert.match(readFileSync(gateFile(home, "s-g1"), "utf8"), /^[1-9]\d+\n$/, "and is written again");
});

test("gate: an agent_id inside a main session's tool input is not a subagent", { skip: noBash }, (t) => {
  const home = tmp(t);
  const root = stubRoot(home);
  const input = { session_id: "s-g6", transcript_path: "C:/t.jsonl", hook_event_name: "PostToolUse", tool_name: "mcp__x__send", tool_input: { agent_id: "worker-1" } };
  assert.equal(runGate(home, root, input).runs.length, 1);
});

test("gate: a subagent's tool call starts no Node; without a session id or a state folder, Node starts", { skip: noBash }, (t) => {
  const home = tmp(t);
  const root = stubRoot(home);
  const sub = runGate(home, root, { session_id: "s-g3", transcript_path: "C:/t.jsonl", agent_id: "a1", agent_type: "general-purpose", hook_event_name: "PostToolUse" });
  assert.equal(sub.status, 0);
  assert.deepEqual(sub.runs, []);
  // No state folder yet: the gate cannot be written, so every call starts Node until the note makes the folder.
  const main = { session_id: "s-g3", hook_event_name: "PostToolUse", tool_name: "Read" };
  assert.equal(runGate(home, root, main).runs.length, 1);
  assert.equal(runGate(home, root, main).runs.length, 2);
  assert.ok(!existsSync(gateFile(home, "s-g3")));
  // With the folder there, a gate could be written: an input whose session id the gate does not
  // accept still starts Node every time and writes no gate (review of #130: on Windows a path
  // through a missing folder resolves by text, so `sessions/../evil.gate` would land beside it).
  const sessions = join(home, ".local", "share", "model-budget", "sessions");
  mkdirSync(sessions, { recursive: true });
  let n = runGate(home, root, main).runs.length;
  for (const odd of [{ hook_event_name: "PostToolUse", session_id: "s-g4" }, { session_id: "../evil", hook_event_name: "PostToolUse" }, "not json"]) {
    for (let i = 0; i < 2; i++) {
      const r = runGate(home, root, odd);
      assert.equal(r.runs.length, n + 1, `no gate for ${JSON.stringify(odd)}`);
      n = r.runs.length;
    }
  }
  assert.deepEqual(readdirSync(sessions).filter((f) => f.endsWith(".gate")), ["s-g3.gate"]);
  assert.ok(!existsSync(join(home, ".local", "share", "model-budget", "evil.gate")));
});

test("note: a session start removes session and gate files older than 14 days, and keeps fresh ones", (t) => {
  const home = tmp(t);
  const sessions = join(home, ".local", "share", "model-budget", "sessions");
  mkdirSync(sessions, { recursive: true });
  const old = (Date.now() - 15 * 24 * HOUR) / 1000;
  for (const name of ["old.json", "old.gate", "fresh.json", "fresh.gate", "keep.txt"]) writeFileSync(join(sessions, name), "0\n");
  for (const name of ["old.json", "old.gate", "keep.txt"]) utimesSync(join(sessions, name), old, old);
  assert.equal(runHook(home, { hook_event_name: "SessionStart", session_id: "s-c1" }).status, 0);
  assert.deepEqual(readdirSync(sessions).sort(), ["fresh.gate", "fresh.json", "keep.txt", "s-c1.json"]);
});

test("gate: with the real note, a tool call after the window hears a changed advice", { skip: noBash }, (t) => {
  const home = tmp(t);
  const root = fileURLToPath(new URL("../plugins/cookbook", import.meta.url));
  const input = { session_id: "s-g5", hook_event_name: "PostToolUse", tool_name: "Bash" };
  const seedCache = (opts) => {
    const stateDir = join(home, ".local", "share", "model-budget");
    mkdirSync(stateDir, { recursive: true });
    seedHome(home, { expiresAt: Date.now() + HOUR });
    writeFileSync(join(stateDir, "usage.json"), sealCache("tok-secret-1", { at: Date.now(), tried: Date.now(), usage: parseUsage(live(opts)) }));
  };
  seedCache();
  const context = (r) => (r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : "");
  assert.match(context(runGate(home, root, input)), /^Model budget: use Fable 5\.2 high\./);
  assert.equal(context(runGate(home, root, input)), "", "same advice: silent, and the gate is now set");
  seedCache({ week: 50, fable: 93 });
  assert.equal(context(runGate(home, root, input)), "", "inside the window the change waits");
  writeFileSync(gateFile(home, "s-g5"), "0\n");
  assert.match(context(runGate(home, root, input)), /^Model budget changed\. Model budget: use Opus 5\.5 high\./);
});

test("the script prints the line, and --json the reading and the decision", (t) => {
  const home = tmp(t);
  const stateDir = join(home, ".local", "share", "model-budget");
  mkdirSync(stateDir, { recursive: true });
  seedHome(home);
  writeFileSync(join(stateDir, "usage.json"), sealCache("tok-secret-1", { at: Date.now(), tried: Date.now(), usage: parseUsage(live()) }));
  const env = { ...process.env, USERPROFILE: home, HOME: home };
  const plain = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env });
  assert.equal(plain.status, 0);
  assert.match(plain.stdout, /^Model budget \(/);
  const json = JSON.parse(spawnSync(process.execPath, [SCRIPT, "--json"], { encoding: "utf8", env }).stdout);
  assert.equal(json.usage.week.used, 37);
  assert.ok(["fable", "opus", "wait"].includes(json.decision.model));
  const none = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env: { ...env, USERPROFILE: join(home, "empty"), HOME: join(home, "empty") } });
  assert.equal(none.status, 1);
  assert.match(none.stdout, /^Model budget: unknown/);
});

const seedMark = (home, token = "tok-secret-1") => {
  const stateDir = join(home, ".local", "share", "model-budget");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "usage-tried.json"), sealCache(token, { tried: Date.now(), error: "the usage read answered 429" }));
  return stateDir;
};

// As in normal running: the session start's own read was just answered 429, so nothing here reaches the network.
test("hook: with its own read refused, T3 Code's saved reading gives every event the advice and no figures", (t) => {
  const home = tmp(t);
  seedHome(home, { expiresAt: Date.now() + HOUR });
  const stateDir = seedMark(home);
  const saved = (fable) => seedT3(home, t3({ fable, checkedAt: Date.now() - 60000, reset: Date.now() + 70 * HOUR }));
  saved(59);
  const start = runHook(home, { hook_event_name: "SessionStart", session_id: "s-9" }, { cache: null });
  assert.match(start.context.additionalContext, /^Model budget: use Fable 5\.2 high\. /);
  saved(95);
  const tool = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-9" }, { cache: null });
  assert.match(tool.context.additionalContext, /^Model budget changed\. Model budget: use Opus 5\.5 high\. /);
  for (const r of [start, tool]) assert.doesNotMatch(r.context.additionalContext, /\d+%|\d{1,2}:\d{2}|week|share|pace|Banked|expires|T3/);
  assert.deepEqual(readdirSync(stateDir), ["sessions", "usage-tried.json"], "nothing was read over the network or saved");
});

test("the script says when the line comes from T3 Code's saved reading", (t) => {
  const home = tmp(t);
  seedHome(home);
  seedMark(home);
  seedT3(home, t3({ checkedAt: Date.now() - 60000, reset: Date.now() + 70 * HOUR }));
  const env = { ...process.env, USERPROFILE: home, HOME: home };
  const plain = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env });
  assert.equal(plain.status, 0);
  assert.match(plain.stdout, /^Model budget \(.*week 43% used, Fable 69% of its share.* Source: T3 Code's saved reading\.\n$/);
  assert.equal(JSON.parse(spawnSync(process.execPath, [SCRIPT, "--json"], { encoding: "utf8", env }).stdout).source, "t3");
});

test("hook: the reset list coming and going in T3 Code's file changes nothing a session is told", (t) => {
  const home = tmp(t);
  seedHome(home, { expiresAt: Date.now() + HOUR });
  const stateDir = seedMark(home);
  const saved = (options) => seedT3(home, t3({ fable: 80, options, checkedAt: Date.now() - 1000, reset: Date.now() + 70 * HOUR }));
  saved([option({ expiresAt: new Date(Date.now() + 20 * 24 * HOUR).toISOString() })]);
  const start = runHook(home, { hook_event_name: "SessionStart", session_id: "s-10" }, { cache: null });
  assert.match(start.context.additionalContext, /^Model budget: use Fable 5\.2 high\. /);
  assert.doesNotMatch(start.context.additionalContext, /\d+%|\d{1,2}:\d{2}|week|share|pace|Banked|expires|T3|g1/);
  for (const options of [null, [option({ expiresAt: new Date(Date.now() + 20 * 24 * HOUR).toISOString() })], null, null]) {
    saved(options);
    for (const event of ["UserPromptSubmit", "PostToolUse"]) assert.equal(runHook(home, { hook_event_name: event, session_id: "s-10" }, { cache: null }).context, null, "silent: the session keeps its advice");
  }
  assert.deepEqual(readdirSync(stateDir).sort(), ["sessions", "usage-tried.json"], "the list is saved nowhere, no figure is saved and nothing was read over the network");
  // The session's file holds what was said and since when the list is missing: no list, no figure.
  const session = JSON.parse(readFileSync(join(stateDir, "sessions", "s-10.json"), "utf8"));
  assert.deepEqual(Object.keys(session).sort(), ["at", "key", "lostAt", "resets"]);
  assert.deepEqual([session.key, session.resets, typeof session.lostAt], ["fable|||", false, "number"]);
});

test("hook: a change of advice that comes while T3 Code's file has no list waits for the list, for an hour at most", (t) => {
  const home = tmp(t);
  const stateDir = seedMark(home);
  const fableReset = () => [option({ expiresAt: new Date(Date.now() + 20 * 24 * HOUR).toISOString() })];
  const saved = (options, fable = 80) => seedT3(home, t3({ fable, options, checkedAt: Date.now() - 1000, reset: Date.now() + 70 * HOUR }));
  const event = (name) => runHook(home, { hook_event_name: name, session_id: "s-11" }, { cache: null }).context;
  const session = join(stateDir, "sessions", "s-11.json");
  const missingFor = (ms) => writeFileSync(session, JSON.stringify({ ...JSON.parse(readFileSync(session, "utf8")), lostAt: Date.now() - ms }));
  saved(fableReset());
  assert.match(event("SessionStart").additionalContext, /^Model budget: use Fable 5\.2 high\. /);
  // T3 Code's own read was refused: its file has no list. Without the list the rules say Opus;
  // the session is not told, and keeps the advice it has.
  saved(null);
  assert.equal(event("PostToolUse"), null);
  assert.equal(event("UserPromptSubmit"), null);
  assert.equal(typeof JSON.parse(readFileSync(session, "utf8")).lostAt, "number");
  // Still so after ten minutes without the list (seen on 16 November 2026), and after 59.
  for (const minutes of [10, 59]) {
    missingFor(minutes * 60000);
    assert.equal(event("PostToolUse"), null, `${minutes} minutes without the list`);
  }
  // The list is back in T3 Code's file: nothing changed, nothing is said.
  saved(fableReset());
  assert.equal(event("PostToolUse"), null);
  assert.equal(JSON.parse(readFileSync(session, "utf8")).lostAt, undefined);
  // A list that stays away for an hour is "not read", and the change is said.
  saved(null);
  assert.equal(event("PostToolUse"), null);
  missingFor(HOUR + 1000);
  assert.match(event("PostToolUse").additionalContext, /^Model budget changed\. Model budget: use Opus 5\.5 high\. /);
  // A change that comes with the list is said at once; a spent limit is never held back, and neither is a session start.
  saved(fableReset());
  assert.match(event("PostToolUse").additionalContext, /^Model budget changed\. Model budget: use Fable 5\.2 high\. /);
  seedT3(home, t3({ week: 100, fable: 100, options: null, checkedAt: Date.now() - 1000, reset: Date.now() + 70 * HOUR }));
  assert.match(event("PostToolUse").additionalContext, /^Model budget changed\. Model budget: nothing left until the reset\. /);
  saved(fableReset());
  assert.match(event("PostToolUse").additionalContext, /^Model budget changed\. Model budget: use Fable 5\.2 high\. /);
  saved(null);
  assert.equal(event("PostToolUse"), null);
  seedMark(home); // a session start may read over the network: its read was just refused
  assert.match(event("SessionStart").additionalContext, /^Model budget: use Opus 5\.5 high\. /);
  assert.deepEqual(readdirSync(stateDir).sort(), ["sessions", "usage-tried.json"]);
});

test("hook: a session that started without the list is held back too, once the list has come", (t) => {
  const home = tmp(t);
  const stateDir = seedMark(home);
  const fableReset = () => [option({ expiresAt: new Date(Date.now() + 20 * 24 * HOUR).toISOString() })];
  const saved = (options, fable) => seedT3(home, t3({ fable, options, checkedAt: Date.now() - 1000, reset: Date.now() + 70 * HOUR }));
  const event = (name) => runHook(home, { hook_event_name: name, session_id: "s-12" }, { cache: null }).context;
  const state = () => JSON.parse(readFileSync(join(stateDir, "sessions", "s-12.json"), "utf8"));
  // Fable ahead of pace and no list in T3 Code's file: Opus, and a session that never saw the list is not held back.
  saved(null, 80);
  assert.match(event("SessionStart").additionalContext, /^Model budget: use Opus 5\.5 high\. /);
  assert.deepEqual([state().resets, state().lostAt], [false, undefined]);
  saved(null, 59);
  assert.match(event("PostToolUse").additionalContext, /^Model budget changed\. Model budget: use Fable 5\.2 high\. /, "a change from the figures alone is said at once");
  saved(fableReset(), 59);
  assert.equal(event("PostToolUse"), null, "the list came and the advice is the same: nothing is said");
  assert.equal(state().resets, true, "but the session now knows the list");
  // Fable moves ahead of pace: only the banked Fable reset keeps the advice on Fable.
  saved(fableReset(), 80);
  assert.equal(event("PostToolUse"), null);
  saved(null, 80);
  assert.equal(event("PostToolUse"), null, "held back: the list is missing for under an hour");
  assert.deepEqual([state().resets, typeof state().lostAt], [false, "number"]);
  saved(fableReset(), 80);
  assert.equal(event("UserPromptSubmit"), null);
  assert.deepEqual([state().resets, state().lostAt], [true, undefined]);
  // The list goes missing while the advice is the same, and the advice changes later in the same gap: held back as well.
  saved(null, 59);
  assert.equal(event("PostToolUse"), null);
  assert.deepEqual([state().resets, typeof state().lostAt], [false, "number"]);
  saved(null, 80);
  assert.equal(event("PostToolUse"), null, "the gap began under an hour ago");
});

test("the script says that the banked resets are T3 Code's list", (t) => {
  const home = tmp(t);
  seedHome(home);
  seedMark(home);
  seedT3(home, t3({ options: [option({ expiresAt: new Date(Date.now() + 20 * 24 * HOUR).toISOString() }), option({ creditId: "w1", label: "Weekly reset", expiresAt: undefined })], checkedAt: Date.now() - 60000, reset: Date.now() + 70 * HOUR }));
  const env = { ...process.env, USERPROFILE: home, HOME: home };
  const plain = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env });
  assert.equal(plain.status, 0);
  assert.match(plain.stdout, / Banked resets: 1 Fable \(expires \d{1,2} \w{3}\), 1 weekly\. Source: T3 Code's saved reading\. The banked resets are T3 Code's list, as its file shows it now\.\n$/);
  const json = JSON.parse(spawnSync(process.execPath, [SCRIPT, "--json"], { encoding: "utf8", env }).stdout);
  assert.deepEqual([json.usage.resetsRead, json.usage.grants.map((g) => g.kind), typeof json.resetsSeen], [true, ["fable", "weekly"], "number"]);
});

test("readUsage: T3 Code's file is read only as a plain file of the user's own, never through a link", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  const real = join(home, "elsewhere.json");
  writeFileSync(real, JSON.stringify(t3()), { mode: 0o600 });
  const read = (t3File) => readUsage({ home, stateDir, t3File, now: NOW, fetchImpl: never, cacheOnly: true });
  assert.equal((await read(real)).source, "t3", "a plain file is read");
  assert.equal((await read(home)).usage, undefined, "a folder is no reading");
  const link = join(home, "link.json");
  const { symlinkSync, chmodSync } = await import("node:fs");
  let linked = true;
  try {
    symlinkSync(real, link);
  } catch {
    linked = false; // Windows without the right to make links
  }
  if (linked) assert.equal((await read(link)).usage, undefined, "a link is not followed");
  if (typeof process.getuid === "function") {
    chmodSync(real, 0o666);
    assert.equal((await read(real)).usage, undefined, "a file others can write is not read");
  }
});

// Ubuntu gives every user a group of their own and a umask of 002, so T3 Code writes its file
// as 664 there. Read as "others can write it", that left every Linux session with "unknown"
// whenever the script's own read was refused (20 November 2026).
test("readUsage: T3 Code's file may be writable by its group only when that group is the user's alone", { skip: typeof process.getuid !== "function" }, async (t) => {
  const { chmodSync, statSync } = await import("node:fs");
  const home = tmp(t);
  seedHome(home);
  const file = join(home, "claudeAgent.json");
  writeFileSync(file, JSON.stringify(t3()));
  const uid = process.getuid();
  const { gid } = statSync(file);
  const accounts = (passwd, group) => {
    const dir = mkdtempSync(join(home, "etc-"));
    if (passwd !== null) writeFileSync(join(dir, "passwd"), passwd);
    if (group !== null) writeFileSync(join(dir, "group"), group);
    return { passwd: join(dir, "passwd"), group: join(dir, "group") };
  };
  const source = async (mode, accountFiles) => {
    chmodSync(file, mode);
    return (await readUsage({ home, stateDir: join(home, "state"), t3File: file, accountFiles, now: NOW, fetchImpl: never, cacheOnly: true })).source;
  };
  const me = `me:x:${uid}:${gid}::/home/me:/bin/sh\n`;
  const other = `other:x:${uid + 1}:${gid + 1}::/home/other:/bin/sh\n`;
  const groups = `mine:x:${gid}:\ntheirs:x:${gid + 1}:\n`;
  const alone = accounts(other + me, groups);

  assert.equal(await source(0o664, alone), "t3", "the user's own group: no one else can write");
  assert.equal(await source(0o660, accounts(me, `mine:x:${gid}:me\n`)), "t3", "the user named as the group's one member");
  assert.equal(await source(0o664, accounts(other + me, `mine:x:${gid}:other\n`)), undefined, "another member of the group");
  assert.equal(await source(0o664, accounts(me + `other:x:${uid + 1}:${gid}::/home/other:/bin/sh\n`, groups)), undefined, "another user with this group as their own");
  assert.equal(await source(0o664, accounts(me + `twin:x:${uid}:${gid}::/home/twin:/bin/sh\n`, groups)), undefined, "a second name for the same user id");
  assert.equal(await source(0o664, accounts(other + me, `theirs:x:${gid + 1}:\n`)), undefined, "a group the system's file does not list");
  assert.equal(await source(0o664, accounts(other + me, `${groups}again:x:${gid}:\n`)), undefined, "a group listed twice");
  assert.equal(await source(0o664, accounts(other, groups)), undefined, "a user the system's file does not list");
  assert.equal(await source(0o664, accounts(other + me, null)), undefined, "no group file to ask");
  assert.equal(await source(0o664, accounts(null, groups)), undefined, "no user file to ask");
  assert.equal(await source(0o666, alone), undefined, "writable by everyone, whatever the group");
  assert.equal(await source(0o646, alone), undefined, "writable by everyone and not by the group");
  assert.equal(await source(0o644, accounts(null, null)), "t3", "not writable by the group: nothing is asked");
});
