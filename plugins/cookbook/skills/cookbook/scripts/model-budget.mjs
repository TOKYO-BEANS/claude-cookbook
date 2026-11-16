#!/usr/bin/env node
// Which model a thread should run on now, and whether a banked limit reset should be
// redeemed. It reads the owner's Claude usage (the week, the Fable share, the session
// window, banked resets) with the sign-in Claude Code already stores, and applies the fixed
// rules below: the script decides, not a model. It only reads. It never prints or stores
// the sign-in, calls the one address below and nothing else, and redeems nothing.
// Usage: node model-budget.mjs [--json]     exit code 1 when the reading is unknown
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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

  // What is left spent after a reset of each kind: a reset that leaves the week or the session
  // window spent lets nothing run, so it is never the one to redeem.
  const blocked = (s, w) => (s ?? 0) >= RULES.stopAt || w >= RULES.stopAt;
  const after = {
    session: () => blocked(0, W),
    fable: () => blocked(0, W - (u.fable?.usedOfWeek ?? 0)), // it also refills the session window
    weekly: () => blocked(S, 0),
    full: () => blocked(0, 0),
  };

  // A reset is worth what it clears: redeem it when that is spent, or when it is about to expire.
  let redeem = null;
  for (const kind of KINDS) {
    const g = grants.find((x) => x.kind === kind);
    if (!g || spent[kind] === null || after[kind]()) continue;
    const expiring = g.endsAt !== null && g.endsAt - now <= RULES.expiryHours * HOUR;
    if ((spent[kind] >= RULES.redeemAt && timeLeft(kind)) || (expiring && spent[kind] >= RULES.expiryFloor)) {
      redeem = { id: g.id, kind };
      break;
    }
  }

  const warn = u.credits ? ["usage credits are on: a limit hit would be billed"] : [];
  // Whether a limit every model shares is spent now: then nothing runs until a reset is redeemed.
  const held = (S ?? 0) >= RULES.stopAt || W >= RULES.stopAt;
  const out = (model, why, wait = null) => ({ model, why, redeem, wait, pace, warn, held });
  if (redeem && redeem.kind !== "session") return out("fable", `the ${redeem.kind} reset refills Fable`);
  if (W >= RULES.stopAt) return out("wait", "the week is spent", { until: u.week.resetsAt });
  if (S !== null && S >= RULES.stopAt && !redeem) return out("wait", "the session window is spent", { until: u.session.resetsAt });
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

// What a hook may put into a session: the action only, with no figures, times or counts.
export function advice(d) {
  const then = d.model === "wait" ? "nothing runs until the reset" : `use ${NAMES[d.model]}`;
  const until = d.held ? "until then nothing runs: stop at a safe point" : `until then use ${NAMES.opus}`;
  if (d.redeem) return `Model budget: a banked ${KIND_LABEL[d.redeem.kind]} reset is worth using now: ask the owner to redeem it, and ${until}; after it, ${then}.`;
  if (d.model === "wait") return "Model budget: nothing left until the reset. Stop at a safe point.";
  return `Model budget: use ${NAMES[d.model]}.`;
}

export const unknownLine =(error) => `Model budget: unknown (${error}). Keep this thread's model.`;

const validUsage = (u) =>
  num(u?.week?.used) !== null && num(u?.week?.resetsAt) !== null && Array.isArray(u?.grants) &&
  (u.fable === null || num(u.fable?.used) !== null) && (u.session === null || (num(u.session?.used) !== null && num(u.session?.resetsAt) !== null));

// The cache is signed with the sign-in token: a file written by anything that does not hold the
// token (a tampered or hand-made one) is ignored, and a new token simply means a fresh read.
const seal = (token, payload) => createHmac("sha256", token).update(payload).digest("hex");
export const sealCache = (token, value) => {
  const payload = JSON.stringify(value);
  return JSON.stringify({ payload, sig: seal(token, payload) });
};
const openCache = (text, token) => {
  const box = JSON.parse(text);
  if (typeof box?.payload !== "string" || typeof box?.sig !== "string" || !/^[0-9a-f]{64}$/.test(box.sig)) return null;
  const want = Buffer.from(seal(token, box.payload), "hex");
  return timingSafeEqual(want, Buffer.from(box.sig, "hex")) ? JSON.parse(box.payload) : null;
};
const readCache = (file, token) => {
  try {
    const c = openCache(readFileSync(file, "utf8"), token);
    if (num(c?.tried) === null) return null;
    return { at: num(c.at), tried: c.tried, usage: validUsage(c.usage) ? c.usage : null, error: typeof c.error === "string" ? c.error : null };
  } catch {
    return null;
  }
};
const writeCache = (stateDir, file, value, token) => {
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(`${file}.${process.pid}.tmp`, sealCache(token, value));
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
// With cacheOnly, nothing goes over the network: the saved reading or { error }.
export async function readUsage({ home = homedir(), stateDir = join(home, ".local", "share", "model-budget"), now = Date.now(), fetchImpl = fetch, cacheOnly = false } = {}) {
  const file = join(stateDir, "usage.json");
  const token = readToken(home);
  if (!token) return { error: "no Claude sign-in found" };
  const cache = readCache(file, token);
  // A reading from before the weekly reset says nothing about this week.
  const kept = cache?.usage && cache.at !== null && cache.at <= now && cache.usage.week.resetsAt > now ? cache : null;
  if (kept && now - kept.at < RULES.cacheMs) return { usage: kept.usage, at: kept.at, source: "cache" };
  const fall = (error) => (kept && now - kept.at < RULES.staleMs ? { usage: kept.usage, at: kept.at, source: "stale" } : { error });
  if (cacheOnly) return fall("no fresh reading saved");
  if (cache && cache.tried <= now && now - cache.tried < RULES.retryMs) return fall(cache.error ?? "the usage read failed");
  // One read at a time across every process: the one that creates the lock reads; the rest use
  // what is cached. The lock holds its owner's mark, and only the owner removes it. A lock older
  // than two timeouts is from a process that died: one process wins a gate file named after
  // that lock's mark (created with wx, so only one can), removes the lock only if it still holds
  // that mark, and claims it.
  const lock = join(stateDir, "usage.lock");
  const me = `${process.pid}-${randomUUID()}`;
  const busy = () => fall(cache?.error ?? "the usage read is in progress");
  const claim = () => {
    try {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(lock, me, { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  };
  const holder = () => {
    try {
      return readFileSync(lock, "utf8");
    } catch {
      return null;
    }
  };
  if (!claim()) {
    const stale = holder();
    let age = 0;
    try {
      age = Date.now() - statSync(lock).mtimeMs;
    } catch {
      // gone between the two calls: another process just finished
    }
    if (stale === null || age <= 2 * RULES.timeoutMs) return busy();
    const gate = `${lock}.takeover-${createHash("sha256").update(stale).digest("hex").slice(0, 16)}`;
    const enter = () => {
      try {
        writeFileSync(gate, me, { flag: "wx" });
        return true;
      } catch {
        return false;
      }
    };
    if (!enter()) {
      // A gate left by a process that died inside the takeover is old too: clear it, try once.
      let gateAge = 0;
      try {
        gateAge = Date.now() - statSync(gate).mtimeMs;
      } catch {
        // gone: the other process just finished its takeover
      }
      if (gateAge <= 2 * RULES.timeoutMs) return busy();
      rmSync(gate, { force: true });
      if (!enter()) return busy();
    }
    try {
      if (holder() === stale) rmSync(lock, { force: true });
    } finally {
      rmSync(gate, { force: true });
    }
    if (!claim()) return busy();
  }
  try {
    return await fetchAndStore({ token, stateDir, file, now, kept, fall, fetchImpl });
  } finally {
    if (holder() === me) rmSync(lock, { force: true });
  }
}

async function fetchAndStore({ token, stateDir, file, now, kept, fall, fetchImpl }) {
  const fail = (error) => {
    writeCache(stateDir, file, { at: kept?.at ?? null, tried: now, usage: kept?.usage ?? null, error }, token);
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
  writeCache(stateDir, file, { at: now, tried: now, usage }, token);
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
