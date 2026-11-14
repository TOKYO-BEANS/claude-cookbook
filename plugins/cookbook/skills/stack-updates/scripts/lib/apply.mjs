// Which updates are routine: the fixed rules of "install without asking".
//
// `decideAll` sorts every part that is behind into `routine` (a session installs it
// without asking), `waiting` (it becomes routine by itself: the release is too new,
// or today's limit is used up) and `ask` (it needs the owner's yes, with the reason).
// A part that is never installed from here (a project dependency, a hosted service, a
// tool that is only followed or that updates itself) is in none of them.
//
// The rules use versions, dates, the catalog's kinds and one word check on the release
// notes (`isRisky`, done by the caller). No model takes part, and nothing a release
// note says can make a decision looser.
import { compareNumeric } from "./feeds.mjs";

export const SOAK_DAYS = 3; // a release is routine only after it has been seen this long
export const DAILY_LIMIT = 5; // routine installs offered in one day
// `command` parts a session may install: pinned binaries whose recipe downloads the
// release and compares it with the published checksum. Every other `command` part
// needs an admin prompt or an elevated shell outside Claude's container.
export const ROUTINE_COMMAND_PARTS = Object.freeze(["boat/cli", "proton-pass-cli/cli"]);
const SESSION_KINDS = ["plugin", "pinned", "skill", "command"];
const NEVER_KINDS = ["project", "hosted", "none"];

export const REASONS = Object.freeze({
  failed: "an earlier install of this version failed",
  outside: "it is installed outside a session (an admin prompt or an elevated shell)",
  localPort: "it is a local port with its own steps",
  major: "major version",
  risky: "its notes say breaking, deprecated or removed",
  noNotes: "no release notes, and more than a patch release",
});
export const NOTES = Object.freeze(["clean", "risky", "none"]);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isDay = (v) => {
  if (typeof v !== "string" || !DAY.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v; // "2026-02-31" is no day
};
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const core = (v) => /^v?(\d+)\.(\d+)\.(\d+)/.exec(typeof v === "string" ? v : "")?.slice(1) ?? null;

/** "major", "minor" or "patch" for two x.y.z versions where `to` is higher; null when they cannot be compared that way. */
export function levelOf(from, to) {
  const a = core(from), b = core(to);
  if (!a || !b) return null;
  for (const [i, level] of ["major", "minor", "patch"].entries()) {
    const c = compareNumeric(a[i], b[i]);
    if (c < 0) return level;
    if (c > 0) return null; // `to` is lower: not an update
  }
  return null;
}

/**
 * One behind part: `{ decision: "none" | "ask" | "waiting" | "routine", reason?, until? }`.
 * `behind`: `{ key, installed, latest, latestSince, applyFailed }`.
 * `facts`: `{ kind, lifecycle, selfUpdating, localPort, notes, today }`; `notes` is
 * "clean", "risky", "none" or null (not known, which counts as "none").
 */
export function decide(behind, { kind, lifecycle, selfUpdating = false, localPort = false, notes = null, today } = {}) {
  if (!isObject(behind) || NEVER_KINDS.includes(kind) || !SESSION_KINDS.includes(kind) || lifecycle === "watching" || selfUpdating) return { decision: "none" };
  if (typeof behind.applyFailed === "string" && behind.applyFailed === behind.latest) return { decision: "ask", reason: REASONS.failed };
  if (kind === "command" && !ROUTINE_COMMAND_PARTS.includes(behind.key)) return { decision: "ask", reason: REASONS.outside };
  if (localPort) return { decision: "ask", reason: REASONS.localPort }; // a plugin ported by hand: never a plain update
  const level = levelOf(behind.installed, behind.latest);
  if (level === "major") return { decision: "ask", reason: REASONS.major };
  if (notes === "risky") return { decision: "ask", reason: REASONS.risky };
  if (notes !== "clean" && level !== "patch") return { decision: "ask", reason: REASONS.noNotes };
  if (!isDay(today)) return { decision: "waiting", until: null };
  const since = isDay(behind.latestSince) && behind.latestSince <= today ? behind.latestSince : today;
  if (daysBetween(since, today) < SOAK_DAYS) return { decision: "waiting", until: addDays(since, SOAK_DAYS) };
  return { decision: "routine" };
}

/**
 * Every behind part sorted into `{ routine, waiting, ask }`, each entry
 * `{ key, from, to, kind }` plus `reason` (ask) or `until` (waiting). `factsOf(key)`
 * gives `decide`'s facts for a part. At most DAILY_LIMIT are routine, the longest
 * seen first; the rest wait until tomorrow.
 */
export function decideAll(behind, factsOf, today) {
  const out = { routine: [], waiting: [], ask: [] };
  const ready = [];
  for (const b of Array.isArray(behind) ? behind : []) {
    if (!isObject(b) || typeof b.key !== "string") continue;
    const facts = factsOf(b.key);
    if (!isObject(facts)) continue;
    const d = decide(b, { ...facts, today });
    const entry = { key: b.key, from: b.installed ?? null, to: b.latest ?? null, kind: facts.kind };
    if (d.decision === "ask") out.ask.push({ ...entry, reason: d.reason });
    else if (d.decision === "waiting") out.waiting.push({ ...entry, until: d.until });
    else if (d.decision === "routine") ready.push({ entry, since: isDay(b.latestSince) ? b.latestSince : today });
  }
  ready.sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : a.entry.key < b.entry.key ? -1 : 1));
  for (const [i, r] of ready.entries()) {
    if (i < DAILY_LIMIT) out.routine.push(r.entry);
    else out.waiting.push({ ...r.entry, until: isDay(today) ? addDays(today, 1) : null });
  }
  return out;
}
