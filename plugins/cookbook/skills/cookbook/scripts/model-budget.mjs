#!/usr/bin/env node
// Which model a thread should run on now, and whether a banked limit reset should be
// redeemed. It reads the owner's Claude usage (the week, the Fable share, the session
// window, banked resets) with the sign-in Claude Code already stores, and applies the fixed
// rules below: the script decides, not a model. It only reads. It never prints or stores
// the sign-in, calls the one address below and nothing else, and redeems nothing.
// Usage: node model-budget.mjs [--json]     exit code 1 when the reading is unknown
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage?cedar_ember=1";
const HOUR = 3600000;
const WEEK_HOURS = 168;

export const RULES = Object.freeze({
  fableSwitch: 90, // % of the Fable share used: from here a thread runs on Opus
  paceMargin: 10, // points ahead of the week's pace before Opus takes over
  redeemAt: 95, // % spent of what a reset clears before the reset is redeemed
  redeemMinHours: 12, // a weekly or Fable reset is held when the weekly reset is closer
  sessionMinHours: 1, // a session reset is held when the session window reopens sooner
  expiryHours: 12, // a reset this close to its end is redeemed at expiryFloor
  expiryFloor: 50,
  stopAt: 99, // % used: nothing runs
  cacheMs: 10 * 60000, // one read serves every session for this long
  retryMs: 2 * 60000, // pause after a failed read
  staleMs: 60 * 60000, // a failed read falls back to a reading younger than this
  timeoutMs: 4000,
});

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const time = (v) => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};
const GRANT_ID = /^[a-z0-9_-]{1,40}$/;
const KINDS = ["session", "fable", "weekly", "full"]; // smallest first

// A reset that gives weekly usage back is a Fable reset; else its declared type; else what it clears.
const grantKind = (g) => {
  if (g.gives_back_weekly === true) return "fable";
  if (["session", "weekly", "full"].includes(g.type)) return g.type;
  const clears = Array.isArray(g.clears) ? g.clears : [];
  const session = clears.includes("five_hour");
  const other = clears.some((c) => c !== "five_hour");
  return session && !other ? "session" : other && !session ? "weekly" : "full";
};

export function parseUsage(json) {
  const limits = Array.isArray(json?.limits) ? json.limits : [];
  const all = limits.find((l) => l?.kind === "weekly_all");
  const week = {
    used: num(all?.percent) ?? num(json?.seven_day?.utilization),
    resetsAt: time(all?.resets_at) ?? time(json?.seven_day?.resets_at),
  };
  if (week.used === null || week.resetsAt === null) throw new Error("the usage answer has no weekly limit");

  const index = limits.findIndex((l) => l?.kind === "weekly_scoped" && /fable/i.test(String(l?.scope?.model?.display_name ?? "")));
  const fableUsed = index < 0 ? null : num(limits[index].percent);
  const shares = Array.isArray(json?.weekly_scoped_shares) ? json.weekly_scoped_shares : [];
  const share = shares.find((s) => s?.limit_index === index);
  const allowanceOfWeek = num(share?.allowance_percent_of_weekly) ?? 50;
  const fable = fableUsed === null ? null : {
    used: fableUsed,
    usedOfWeek: num(share?.used_percent_of_weekly) ?? (fableUsed * allowanceOfWeek) / 100,
    allowanceOfWeek,
  };

  const five = json?.five_hour;
  const session = num(five?.utilization) === null || time(five?.resets_at) === null ? null : { used: five.utilization, resetsAt: time(five.resets_at) };

  const banked = json?.cedar_ember?.eligible === true && Array.isArray(json.cedar_ember.grants) ? json.cedar_ember.grants : [];
  const grants = banked
    .filter((g) => g && typeof g === "object" && typeof g.id === "string" && GRANT_ID.test(g.id) && Number.isInteger(g.resets_left) && g.resets_left > 0 && g.paused !== true && g.usable_now === true)
    .map((g) => ({ id: g.id, kind: grantKind(g), left: g.resets_left, endsAt: time(g.ends_at) }));

  return { week, fable, session, grants, credits: json?.extra_usage?.is_enabled === true };
}

export function decide(u, now) {
  const hoursLeft = (u.week.resetsAt - now) / HOUR;
  const pace = Math.max(0, Math.min(100, (1 - hoursLeft / WEEK_HOURS) * 100));
  const W = u.week.used;
  const F = u.fable?.used ?? null;
  const S = u.session?.used ?? null;
  const grants = u.grants.filter((g) => g.endsAt === null || g.endsAt > now).sort((a, b) => (a.endsAt ?? Infinity) - (b.endsAt ?? Infinity));
  const spent = { session: S, fable: F, weekly: W, full: W };
  const timeLeft = (kind) => (kind === "session" ? (u.session.resetsAt - now) / HOUR >= RULES.sessionMinHours : hoursLeft >= RULES.redeemMinHours);

  // A reset is worth what it clears: redeem it when that is spent, or when it is about to expire.
  let redeem = null;
  for (const kind of KINDS) {
    const g = grants.find((x) => x.kind === kind);
    if (!g || spent[kind] === null) continue;
    const expiring = g.endsAt !== null && g.endsAt - now <= RULES.expiryHours * HOUR;
    if ((spent[kind] >= RULES.redeemAt && timeLeft(kind)) || (expiring && spent[kind] >= RULES.expiryFloor)) {
      redeem = { id: g.id, kind };
      break;
    }
  }

  const warn = u.credits ? ["usage credits are on: a limit hit would be billed"] : [];
  const out = (model, why, wait = null) => ({ model, why, redeem, wait, pace, warn });
  if (redeem && redeem.kind !== "session") return out("fable", `the ${redeem.kind} reset refills Fable`);
  if (S !== null && S >= RULES.stopAt && !redeem) return out("wait", "the session window is spent", { until: u.session.resetsAt });
  if (W >= RULES.stopAt) return out("wait", "the week is spent", { until: u.week.resetsAt });
  // With a Fable reset banked and time to use it, Fable is spent down to the redeem line.
  const fableReset = hoursLeft >= RULES.redeemMinHours && grants.some((g) => g.kind === "fable");
  if (F !== null && F >= RULES.fableSwitch && !fableReset) return out("opus", "the Fable share is nearly spent");
  if (W > pace + RULES.paceMargin) return out("opus", "the week is ahead of pace");
  if (F !== null && F > pace + RULES.paceMargin && !fableReset) return out("opus", "Fable is ahead of pace");
  return out("fable", F === null ? "the week is on pace" : fableReset ? "a Fable reset is banked" : "Fable is on pace");
}

const NAMES = { fable: "Fable 5.2 high", opus: "Opus 5.5 high" };
const KIND_LABEL = { session: "session", fable: "Fable", weekly: "weekly", full: "full" };
// To the nearest minute: a reset the answer gives as 09:59:59.9 is the 10:00 reset.
const parts = (ms, timeZone) =>
  Object.fromEntries(new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(Math.round(ms / 60000) * 60000).map((p) => [p.type, p.value]));
const day = (ms, tz) => { const p = parts(ms, tz); return `${p.day} ${p.month}`; };
const stamp = (ms, tz) => { const p = parts(ms, tz); return `${p.day} ${p.month} ${p.hour}:${p.minute}`; };
const weekday = (ms, tz) => `${parts(ms, tz).weekday} ${stamp(ms, tz)}`;

// One line for a session: the reading, what to do, what is banked. Times are local.
export function line(u, d, now, timeZone) {
  const pct = (n) => `${Math.floor(n)}%`;
  const reading = [`week ${pct(u.week.used)} used`, u.fable && `Fable ${pct(u.fable.used)} of its share`, u.session && `session ${pct(u.session.used)} used`, `pace ${pct(d.pace)}`].filter(Boolean).join(", ");
  const use = d.model === "wait" ? `Nothing left: wait for ${weekday(d.wait.until, timeZone)}.` : null;
  const act = d.redeem
    ? `Redeem the ${KIND_LABEL[d.redeem.kind]} reset now (T3 Code: Usage, Limits, Use reset), then ${use ?? `use ${NAMES[d.model]}.`}`
    : (use ?? `Use ${NAMES[d.model]}: ${d.why}.`);
  const live = u.grants.filter((g) => g.endsAt === null || g.endsAt > now);
  const banked = KINDS.flatMap((kind) => {
    const of = live.filter((g) => g.kind === kind);
    if (!of.length) return [];
    const ends = Math.min(...of.map((g) => g.endsAt ?? Infinity));
    return [`${of.reduce((n, g) => n + g.left, 0)} ${KIND_LABEL[kind]}${Number.isFinite(ends) ? ` (expires ${day(ends, timeZone)})` : ""}`];
  });
  const warn = d.warn.map((w) => ` Warning: ${w}.`).join("");
  return `Model budget (${stamp(now, timeZone)}): ${reading}; weekly reset ${weekday(u.week.resetsAt, timeZone)}. ${act} Banked resets: ${banked.join(", ") || "none"}.${warn}`;
}

export const unknownLine = (error) => `Model budget: unknown (${error}). Keep this thread's model.`;

const validUsage = (u) =>
  num(u?.week?.used) !== null && num(u?.week?.resetsAt) !== null && Array.isArray(u?.grants) &&
  (u.fable === null || num(u.fable?.used) !== null) && (u.session === null || (num(u.session?.used) !== null && num(u.session?.resetsAt) !== null));

const readCache = (file) => {
  try {
    const c = JSON.parse(readFileSync(file, "utf8"));
    if (num(c?.tried) === null) return null;
    return { at: num(c.at), tried: c.tried, usage: validUsage(c.usage) ? c.usage : null, error: typeof c.error === "string" ? c.error : null };
  } catch {
    return null;
  }
};
const writeCache = (stateDir, file, value) => {
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(`${file}.${process.pid}.tmp`, JSON.stringify(value));
    renameSync(`${file}.${process.pid}.tmp`, file);
  } catch {
    // no cache is slower, never wrong
  }
};
const readToken = (home) => {
  try {
    const token = JSON.parse(readFileSync(join(home, ".claude", ".credentials.json"), "utf8"))?.claudeAiOauth?.accessToken;
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
};

// The reading, from the shared cache when it is fresh. A failure is { error }, or a reading
// under an hour old marked "stale"; it is never a made-up reading and never the cause's text.
export async function readUsage({ home = homedir(), stateDir = join(home, ".local", "share", "model-budget"), now = Date.now(), fetchImpl = fetch } = {}) {
  const file = join(stateDir, "usage.json");
  const cache = readCache(file);
  // A reading from before the weekly reset says nothing about this week.
  const kept = cache?.usage && cache.at !== null && cache.at <= now && cache.usage.week.resetsAt > now ? cache : null;
  if (kept && now - kept.at < RULES.cacheMs) return { usage: kept.usage, at: kept.at, source: "cache" };
  const fall = (error) => (kept && now - kept.at < RULES.staleMs ? { usage: kept.usage, at: kept.at, source: "stale" } : { error });
  if (cache && cache.tried <= now && now - cache.tried < RULES.retryMs) return fall(cache.error ?? "the usage read failed");
  const token = readToken(home);
  if (!token) return fall("no Claude sign-in found");
  // One read at a time across every process: the one that creates the lock reads; the rest use
  // what is cached. A lock older than two timeouts is from a process that died, and is taken over.
  const lock = join(stateDir, "usage.lock");
  const claim = () => {
    try {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(lock, String(now), { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  };
  if (!claim()) {
    let age = 0;
    try {
      age = Date.now() - statSync(lock).mtimeMs;
    } catch {
      // gone between the two calls: another process just finished
    }
    if (age <= 2 * RULES.timeoutMs) return fall(cache?.error ?? "the usage read is in progress");
    rmSync(lock, { force: true });
    if (!claim()) return fall(cache?.error ?? "the usage read is in progress");
  }
  try {
    return await fetchAndStore({ token, stateDir, file, now, kept, fall, fetchImpl });
  } finally {
    rmSync(lock, { force: true });
  }
}

async function fetchAndStore({ token, stateDir, file, now, kept, fall, fetchImpl }) {
  const fail = (error) => {
    writeCache(stateDir, file, { at: kept?.at ?? null, tried: now, usage: kept?.usage ?? null, error });
    return fall(error);
  };
  let res;
  try {
    res = await fetchImpl(USAGE_URL, {
      headers: { Authorization: `Bearer ${token}`, "anthropic-beta": "oauth-2025-04-20", "User-Agent": "claude-cookbook-model-budget" },
      redirect: "error",
      signal: AbortSignal.timeout(RULES.timeoutMs),
    });
  } catch {
    return fail("the usage read failed");
  }
  if (!res.ok) return fail(`the usage read answered ${Number(res.status) || "an error"}`);
  let usage;
  try {
    usage = parseUsage(await res.json());
  } catch (e) {
    return fail(e instanceof Error && e.message === "the usage answer has no weekly limit" ? e.message : "the usage answer was not readable");
  }
  writeCache(stateDir, file, { at: now, tried: now, usage });
  return { usage, at: now, source: "live" };
}

// realpath on both sides, so a run through a junction or symlink still prints.
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const json = process.argv.includes("--json");
  const now = Date.now();
  const r = await readUsage({ now });
  if (!r.usage) {
    console.log(json ? JSON.stringify({ error: r.error }) : unknownLine(r.error));
    process.exitCode = 1;
  } else {
    const decision = decide(r.usage, now);
    console.log(json ? JSON.stringify({ source: r.source, at: r.at, usage: r.usage, decision }) : line(r.usage, decision, now));
  }
}
