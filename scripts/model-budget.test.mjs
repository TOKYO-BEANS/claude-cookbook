// The model budget: which model a thread runs on, and when a banked reset is redeemed
// (skills/cookbook/scripts/model-budget.mjs), and the hook that tells a session.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULES, advice, decide, line, parseUsage, readUsage, sealCache } from "../plugins/cookbook/skills/cookbook/scripts/model-budget.mjs";

const HOOK = fileURLToPath(new URL("../plugins/cookbook/hooks/model-budget-note.mjs", import.meta.url));
const HOOKS_JSON = fileURLToPath(new URL("../plugins/cookbook/hooks/hooks.json", import.meta.url));
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
  const u = usage();
  const text = line(u, decide(u, NOW), NOW, "UTC");
  assert.equal(text, "Model budget (16 Nov 12:00): week 37% used, Fable 59% of its share, pace 58%; weekly reset Thu 19 Nov 10:00. Use Fable 5.2 high: Fable is on pace. Banked resets: none.");
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

test("readUsage: reads started together call the endpoint once; a dead process's lock is taken over", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetchImpl = async () => { calls++; await gate; return answer(200, raw()); };
  const first = readUsage({ home, stateDir, now: NOW, fetchImpl });
  const second = await readUsage({ home, stateDir, now: NOW, fetchImpl });
  assert.equal(second.usage, undefined);
  assert.match(second.error, /in progress/);
  release();
  assert.equal((await first).source, "live");
  assert.equal(calls, 1);
  assert.ok(!existsSync(join(stateDir, "usage.lock")), "the lock is removed after the read");
  writeFileSync(join(stateDir, "usage.lock"), "old");
  const { utimesSync } = await import("node:fs");
  const past = new Date(Date.now() - 60000);
  utimesSync(join(stateDir, "usage.lock"), past, past);
  const after = await readUsage({ home, stateDir, now: NOW + RULES.cacheMs + 1, fetchImpl });
  assert.equal(after.source, "live");
  assert.equal(calls, 2);
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

test("readUsage: the lock is removed only by its owner, and a dead lock is taken over by one process", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  seedHome(home);
  const lock = join(stateDir, "usage.lock");
  let calls = 0;
  // Another process's lock appears while this read runs: this read must leave it in place.
  const fetchImpl = async () => { calls++; writeFileSync(lock, "other-process"); return answer(200, raw()); };
  assert.equal((await readUsage({ home, stateDir, now: NOW, fetchImpl })).source, "live");
  assert.equal(readFileSync(lock, "utf8"), "other-process");
  // That lock is now old: two reads started together take it over once, and one reads.
  const { utimesSync } = await import("node:fs");
  const past = new Date(Date.now() - 60000);
  utimesSync(lock, past, past);
  let release;
  const gate = new Promise((r) => { release = r; });
  const slow = async () => { calls++; await gate; return answer(200, raw()); };
  const later = NOW + RULES.cacheMs + 1;
  const first = readUsage({ home, stateDir, now: later, fetchImpl: slow });
  const second = await readUsage({ home, stateDir, now: later, fetchImpl: slow });
  assert.equal(second.source, "stale", "the second process uses the saved reading");
  release();
  assert.equal((await first).source, "live");
  assert.equal(calls, 2);
  assert.ok(!existsSync(lock), "the owner removed its own lock");
  assert.deepEqual(readdirSync(stateDir).filter((n) => n.includes("takeover")), [], "no gate file is left");
});

test("readUsage: a takeover gate left by a dead process does not block the takeover for good", async (t) => {
  const home = tmp(t);
  const stateDir = join(home, "state");
  mkdirSync(stateDir, { recursive: true });
  seedHome(home);
  const { utimesSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const lock = join(stateDir, "usage.lock");
  const gate = `${lock}.takeover-${createHash("sha256").update("dead-process").digest("hex").slice(0, 16)}`;
  const past = new Date(Date.now() - 60000);
  writeFileSync(lock, "dead-process");
  utimesSync(lock, past, past);
  writeFileSync(gate, "dead-taker");
  let calls = 0;
  const fetchImpl = async () => { calls++; return answer(200, raw()); };
  // A gate that is fresh belongs to a takeover in progress: this read stands back.
  assert.match((await readUsage({ home, stateDir, now: NOW, fetchImpl })).error, /in progress/);
  assert.equal(calls, 0);
  // The same gate, old: it is cleared and the takeover goes through.
  utimesSync(gate, past, past);
  assert.equal((await readUsage({ home, stateDir, now: NOW, fetchImpl })).source, "live");
  assert.equal(calls, 1);
  assert.deepEqual(readdirSync(stateDir).filter((n) => n.includes("takeover") || n === "usage.lock"), []);
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
const runHook = (home, input, { cache = live(), cachedAt = Date.now(), signedIn = true } = {}) => {
  const stateDir = join(home, ".local", "share", "model-budget");
  mkdirSync(stateDir, { recursive: true });
  if (signedIn) seedHome(home, { expiresAt: Date.now() + HOUR });
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

test("hooks.json runs the note at session start, on a prompt and after a tool", () => {
  const { hooks } = JSON.parse(readFileSync(HOOKS_JSON, "utf8"));
  for (const event of ["SessionStart", "UserPromptSubmit", "PostToolUse"]) {
    const commands = hooks[event].flatMap((g) => g.hooks.map((h) => h.command));
    assert.ok(commands.some((c) => c.includes("${CLAUDE_PLUGIN_ROOT}/hooks/model-budget-note.mjs")), event);
    for (const g of hooks[event]) for (const h of g.hooks) assert.ok(h.timeout <= 10, `${event} timeout`);
  }
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
