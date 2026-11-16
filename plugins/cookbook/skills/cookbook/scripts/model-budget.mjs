#!/usr/bin/env node
// Which model a thread should run on now, and whether a banked limit reset should be
// redeemed. It reads the owner's Claude usage (the week, the Fable share, the session
// window) with the sign-in Claude Code already stores, and takes T3 Code's saved reading when
// that read gives nothing. The banked resets are the list in T3 Code's file, used only while
// that file shows it and saved nowhere: the endpoint shows them to Claude Code only, not to
// this script. It applies the fixed rules below: the
// script decides, not a model. It only reads. It never prints or stores the sign-in, calls
// the one address below and nothing else, and redeems nothing.
// Usage: node model-budget.mjs [--json]     exit code 1 when the reading is unknown
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage?cedar_ember=1";
const HOUR = 3600000;
const WEEK_HOURS = 168;
const FABLE_OF_WEEK = 50; // % of the week Fable may take, when the reading does not say

export const RULES = Object.freeze({
  fableSwitch: 90, // % of the Fable share used: from here a thread runs on Opus
  paceMargin: 10, // points ahead of the week's pace before Opus takes over
  redeemAt: 95, // % spent of what a reset clears before the reset is redeemed
  redeemMinHours: 12, // a weekly or Fable reset is held when the weekly reset is closer
  sessionMinHours: 1, // a session reset is held when the session window reopens sooner
  expiryHours: 12, // a reset this close to its end is redeemed at expiryFloor
  expiryFloor: 50,
  stopAt: 99, // % used: nothing runs
  cacheMs: 10 * 60000, // a signed reading serves every session for this long
  retryMs: 10 * 60000, // pause after a failed read: with the line above, one read per ten minutes at most
  staleMs: 60 * 60000, // with no fresh signed reading, one younger than this stands in
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
  const allowanceOfWeek = num(share?.allowance_percent_of_weekly) ?? FABLE_OF_WEEK;
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

  // The endpoint lists banked resets only for a client it calls eligible, and it does not call this
  // script one (ineligible_reason "surface", 16 November 2026): then they are not read, which is not "none".
  return { week, fable, session, grants, resetsRead: json?.cedar_ember?.eligible === true, credits: json?.extra_usage?.is_enabled === true };
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
  return `Model budget (${stamp(now, timeZone)}): ${reading}; weekly reset ${weekday(u.week.resetsAt, timeZone)}. ${act} Banked resets: ${banked.join(", ") || (u.resetsRead === true ? "none" : "not read (see T3 Code: Usage, Limits)")}.${warn}`;
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

// The script's own files are signed with the sign-in token: one written by anything that does
// not hold the token (a tampered or hand-made one) is ignored, and a new token simply means a
// fresh read.
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
const readSigned = (file, token) => {
  try {
    return openCache(readFileSync(file, "utf8"), token);
  } catch {
    return null;
  }
};
const writeSigned = (stateDir, file, value, token) => {
  const part = `${file}.${randomUUID()}.tmp`;
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(part, sealCache(token, value));
    renameSync(part, file);
  } catch {
    // no saved file is slower, never wrong
    rmSync(part, { force: true });
  }
};
// usage.json holds the last reading and usage-tried.json the mark of the last failed read. They
// are two files so that a failed read can never replace a reading, whatever else runs at the
// same moment; each is written whole, by a rename.
const readSaved = (file, token) => {
  const c = readSigned(file, token);
  return num(c?.at) !== null && validUsage(c.usage) ? { usage: c.usage, at: c.at } : null;
};
const readMark = (file, token) => {
  const c = readSigned(file, token);
  return num(c?.tried) !== null ? { tried: c.tried, error: typeof c.error === "string" ? c.error : null } : null;
};
const readToken = (home) => {
  try {
    const token = JSON.parse(readFileSync(join(home, ".claude", ".credentials.json"), "utf8"))?.claudeAiOauth?.accessToken;
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
};

// T3 Code's own saved reading, the one behind its Usage page. T3 Code asks Claude Code for the
// limits every five minutes and rewrites this file every minute. The file is not signed and
// T3 Code may change its shape: its figures are used only when no signed reading can be had,
// every value is checked, anything odd means "no reading", no figure from it is stored, and
// all it can change is which of the fixed lines of advice is said.
//
// Its list of banked resets is the one source of them (the owner's decision, 16 November 2026):
// T3 Code reads as Claude Code and is shown them, this script is not. The list goes with every
// reading, signed or not, in the minutes this file shows it, and like the figures it is never
// stored (the owner's second decision that day, on the security review of #80: "Hold the
// advice").
const T3_MAX_BYTES = 4000000;
const T3_AHEAD_MS = 5000;
const T3_RESETS = Object.freeze({ "5-hour reset": "session", "Fable reset": "fable", "Weekly reset": "weekly", "Full reset": "full" }); // T3 Code's labels
const percent = (v) => (num(v) !== null && v >= 0 && v <= 100 ? v : null);
const validGrant = (g) =>
  g !== null && typeof g === "object" && typeof g.id === "string" && GRANT_ID.test(g.id) && KINDS.includes(g.kind) && Number.isInteger(g.left) && g.left > 0 && (g.endsAt === null || num(g.endsAt) !== null);

// The banked resets in T3 Code's file: null when the file has no list (T3 Code leaves it out in
// every minute its own read of them was refused, about every other one), else one entry per
// kind, an empty list when T3 Code read that there are none (a count of 0). A list that is not
// understood in full is null as well, "not read": an entry with a label this script does not
// know (T3 Code may rename one) or an odd value, two entries of one kind, or entries that do
// not add up to the file's own count. It is never read as a shorter list or as "none".
const t3Resets = (credits) => {
  if (credits === null || typeof credits !== "object" || Array.isArray(credits) || !Number.isInteger(credits.availableCount) || credits.availableCount < 0) return null;
  if (credits.options === undefined) return credits.availableCount === 0 ? [] : null;
  if (!Array.isArray(credits.options) || credits.options.length > KINDS.length) return null;
  const grants = [];
  for (const o of credits.options) {
    if (o === null || typeof o !== "object" || typeof o.label !== "string" || !Object.hasOwn(T3_RESETS, o.label)) return null;
    if (o.expiresAt !== undefined && time(o.expiresAt) === null) return null;
    const g = { id: o.creditId, kind: T3_RESETS[o.label], left: o.availableCount, endsAt: time(o.expiresAt) };
    if (!validGrant(g) || grants.some((x) => x.kind === g.kind)) return null;
    grants.push(g);
  }
  return grants.reduce((n, g) => n + g.left, 0) === credits.availableCount ? grants : null;
};

export function parseT3(json, now) {
  const limits = json?.usageLimits;
  const at = time(limits?.checkedAt);
  // T3 Code may write between this run reading the clock and reading the file: a few seconds ahead is still now.
  if (at === null || at > now + T3_AHEAD_MS || limits.unavailable !== undefined || !Array.isArray(limits.windows)) return null;
  const windows = limits.windows.filter((w) => w && typeof w === "object" && typeof w.id === "string");
  const all = windows.find((w) => w.id === "seven_day");
  const week = { used: percent(all?.usedPercent), resetsAt: time(all?.resetsAt) };
  if (week.used === null || week.resetsAt === null || week.resetsAt <= now || week.resetsAt > now + (WEEK_HOURS + 24) * HOUR) return null;

  const scoped = windows.find((w) => /^seven_day_\w*fable/i.test(w.id));
  if (scoped && percent(scoped.usedPercent) === null) return null;
  // T3 Code does not keep Fable's part of the week: Fable may take FABLE_OF_WEEK of it.
  const fable = scoped ? { used: scoped.usedPercent, usedOfWeek: (scoped.usedPercent * FABLE_OF_WEEK) / 100, allowanceOfWeek: FABLE_OF_WEEK } : null;

  const five = windows.find((w) => w.id === "five_hour");
  const session = percent(five?.usedPercent) === null || time(five?.resetsAt) === null || time(five.resetsAt) <= now ? null : { used: five.usedPercent, resetsAt: time(five.resetsAt) };

  // The banked resets are kept out of the reading and given beside it. T3 Code's file holds them
  // (resetCredits) only in the minutes its own read of them got through: readUsage adds the list
  // to a reading when the file shows one, and the hook keeps a session's advice when it does not.
  // The list's time is the file's own checkedAt, which T3 Code moves each time it rewrites the
  // file, about every minute; usageLimits.checkedAt moves only when it asks for the limits. A
  // file with no time of its own has the limits' time; an odd one or one ahead of the clock has no list.
  const resetsAt = json.checkedAt === undefined ? at : time(json.checkedAt);
  const resets = resetsAt === null || resetsAt > now + T3_AHEAD_MS ? null : t3Resets(limits.resetCredits);
  return { usage: { week, fable, session, grants: [], resetsRead: false, credits: windows.some((w) => w.id === "monthly_spend") }, at, resets, resetsAt };
}

// The text of a plain file of this user's, or null: no link, and where the system can say so
// (not on Windows), owned by the user and writable by no one else. The file is opened once, and
// every check and the read are made on that one descriptor, so the file checked is the file
// read. Where a link cannot be refused at the open (Windows), the opened file must be the one
// lstat saw.
const readOwnFile = (file) => {
  const seen = lstatSync(file, { throwIfNoEntry: false });
  if (!seen || !seen.isFile()) return null;
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const s = fstatSync(fd);
    if (!s.isFile() || s.size > T3_MAX_BYTES || s.ino !== seen.ino || s.dev !== seen.dev) return null;
    if (typeof process.getuid === "function" && (s.uid !== process.getuid() || (s.mode & 0o022) !== 0)) return null;
    const buf = Buffer.alloc(s.size);
    let got = 0;
    while (got < buf.length) {
      const n = readSync(fd, buf, got, buf.length - got, got);
      if (n === 0) break;
      got += n;
    }
    return buf.toString("utf8", 0, got);
  } finally {
    closeSync(fd);
  }
};

const readT3 = (file, now) => {
  // Two tries: a read that lands in the middle of T3 Code's own write finds half a file.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = readOwnFile(file);
      return text === null ? null : parseT3(JSON.parse(text), now);
    } catch (e) {
      if (!(e instanceof SyntaxError) || attempt) return null;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  return null;
};

// The reading, with the banked resets: the figures from readFigures, and with them the list of
// resets T3 Code's file shows at this read (resetsSeen: that file's own time), whatever the
// source of the figures, unless the endpoint itself listed the resets. The list is used as it
// stands and saved nowhere: T3 Code's file is not signed, so nothing it says goes into a file
// the script signs. In the minutes that file has no list, and when its list is an hour old, the
// resets are "not read"; the hook keeps a session's advice through those minutes
// (hooks/model-budget-note.mjs). A failure is { error }; it is never a made-up reading and never
// the cause's text.
export async function readUsage({ home = homedir(), stateDir = join(home, ".local", "share", "model-budget"), t3File = join(home, ".t3", "caches", "claudeAgent.json"), now = Date.now(), fetchImpl = fetch, cacheOnly = false } = {}) {
  const token = readToken(home);
  if (!token) return { error: "no Claude sign-in found" };
  const t3 = readT3(t3File, now);
  const r = await readFigures({ stateDir, token, t3, now, fetchImpl, cacheOnly });
  if (!r.usage || r.usage.resetsRead === true || !t3 || t3.resets === null || now - t3.resetsAt >= RULES.staleMs) return r;
  return { ...r, usage: { ...r.usage, grants: t3.resets, resetsRead: true }, resetsSeen: t3.resetsAt };
}

// The figures: the script's own signed reading while it is under ten minutes old, else a read
// over the network (never with cacheOnly, and at most one per ten minutes, failed or not). When
// that gives nothing, a reading under an hour old stands in: the script's own older one
// ("stale"), and T3 Code's ("t3") only when the script has none. T3 Code's file is not signed,
// so its figures are never taken ahead of a signed reading under an hour old, however new its
// own is.
//
// A read that succeeds closes the endpoint to this sign-in for about two minutes, and T3 Code
// reads it every minute: while T3 Code runs, a read from here mostly answers 429 and T3 Code's
// reading is the one used. No lock: two sessions started in the same second may both read; the
// second gets the first one's reading or a 429, and no reading is lost.
async function readFigures({ stateDir, token, t3, now, fetchImpl, cacheOnly }) {
  const file = join(stateDir, "usage.json");
  const markFile = join(stateDir, "usage-tried.json");
  const fresh = (r) => r !== null && now - r.at < RULES.cacheMs;
  const own = readSaved(file, token);
  // A reading from before the weekly reset says nothing about this week.
  const saved = own && own.at <= now && own.usage.week.resetsAt > now ? own : null;
  if (fresh(saved)) return { ...saved, source: "cache" };
  // Second best, for when there is no fresh signed reading and none can be read: the script's
  // own signed reading while it is under an hour old, and T3 Code's only when there is none.
  const young = (r) => r !== null && now - r.at < RULES.staleMs;
  const old = young(saved) ? { ...saved, source: "stale" } : young(t3) ? { usage: t3.usage, at: t3.at, source: "t3" } : null;
  const fall = (error) => old ?? { error };
  if (cacheOnly) return fall("no fresh reading saved");
  const mark = readMark(markFile, token);
  if (mark && mark.tried <= now && now - mark.tried < RULES.retryMs) return fall(mark.error ?? "the usage read failed");

  const fail = (error) => {
    writeSigned(stateDir, markFile, { tried: now, error }, token);
    // Another session may have read while this one did: its reading serves this one too.
    const other = readSaved(file, token);
    return other && other.usage.week.resetsAt > now && Math.abs(now - other.at) < RULES.cacheMs ? { ...other, source: "cache" } : fall(error);
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
  writeSigned(stateDir, file, { at: now, usage }, token);
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
    const from = { t3: " Source: T3 Code's saved reading.", stale: " Source: the script's own reading, over ten minutes old." }[r.source] ?? "";
    const resets = r.resetsSeen === undefined ? "" : " The banked resets are T3 Code's list, as its file shows it now.";
    console.log(json ? JSON.stringify({ source: r.source, at: r.at, resetsSeen: r.resetsSeen ?? null, usage: r.usage, decision }) : line(r.usage, decision, now) + from + resets);
  }
}
