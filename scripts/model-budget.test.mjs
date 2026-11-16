// The model budget: which model a thread runs on, and when a banked reset is redeemed
// (skills/cookbook/scripts/model-budget.mjs), and the hook that tells a session.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULES, decide, line, parseUsage, readUsage } from "../plugins/cookbook/skills/cookbook/scripts/model-budget.mjs";

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
const runHook = (home, input, { cache = live(), cachedAt = Date.now() } = {}) => {
  const stateDir = join(home, ".local", "share", "model-budget");
  mkdirSync(stateDir, { recursive: true });
  if (cache) writeFileSync(join(stateDir, "usage.json"), JSON.stringify({ at: cachedAt, tried: cachedAt, usage: parseUsage(cache) }));
  const run = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, USERPROFILE: home, HOME: home } });
  return { ...run, context: run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput : null };
};

test("hook: a session start gets the budget line", (t) => {
  const home = tmp(t);
  const r = runHook(home, { hook_event_name: "SessionStart", session_id: "s-1" });
  assert.equal(r.status, 0);
  assert.equal(r.context.hookEventName, "SessionStart");
  assert.match(r.context.additionalContext, /^Model budget \(.*week 37% used, Fable 59% of its share/);
  assert.match(r.context.additionalContext, /model-budget/);
});

test("hook: later events are silent until the advice changes, then speak once", (t) => {
  const home = tmp(t);
  runHook(home, { hook_event_name: "SessionStart", session_id: "s-2" });
  const same = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-2" });
  assert.equal(same.stdout, "");
  const changed = runHook(home, { hook_event_name: "PostToolUse", session_id: "s-2" }, { cache: live({ week: 50, fable: 93 }) });
  assert.equal(changed.context.hookEventName, "PostToolUse");
  assert.match(changed.context.additionalContext, /^Model budget changed\. .*Use Opus 5\.5 high/);
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

test("hook: a session it has not seen gets the line on its first event", (t) => {
  const home = tmp(t);
  const r = runHook(home, { hook_event_name: "UserPromptSubmit", session_id: "s-3" });
  assert.match(r.context.additionalContext, /^Model budget \(/);
});

test("hook: an unknown reading is said at session start and is never a change", (t) => {
  const home = tmp(t);
  const start = runHook(home, { hook_event_name: "SessionStart", session_id: "s-4" }, { cache: null });
  assert.match(start.context.additionalContext, /^Model budget: unknown \(no Claude sign-in/);
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
  writeFileSync(join(stateDir, "usage.json"), JSON.stringify({ at: Date.now(), tried: Date.now(), usage: parseUsage(live()) }));
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
