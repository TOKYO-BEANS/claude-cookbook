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
const SESSION_KINDS = ["plugin", "pinned", "command"];
const COMMIT = /^[0-9a-f]{40}$/;
const NEVER_KINDS = ["project", "hosted", "none"];

export const REASONS = Object.freeze({
  failed: "an earlier install of this version failed",
  outside: "it is installed outside a session (an admin prompt or an elevated shell)",
  localPort: "it is a local port with its own steps",
  skill: "a skill copy cannot be checked by the script after an install",
  unreadable: "its version change cannot be read",
  partial: "its notes are too long to check in full",
  unchecked: "its notes could not be checked yet",
  major: "major version",
  risky: "its notes say something breaks, is deprecated or is removed",
  noNotes: "no release notes, and more than a patch release",
});
// The word check of a release's notes: "clean" (read in full, no warning word), "risky"
// (a warning word), "none" (read, and there are none), "partial" (only part could be
// read). Anything else means the check has not been made.
export const NOTES = Object.freeze(["clean", "risky", "none", "partial"]);

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

/**
 * "major", "minor" or "patch" for two x.y.z versions where `to` is higher; null when
 * they cannot be compared that way. The level is how much may break, so a version
 * that starts with 0 is read one step up, as its makers mean it: for 0.y.z a change of
 * y is "major" and a change of z is "minor"; for 0.0.z any change is "major".
 */
export function levelOf(from, to) {
  const a = core(from), b = core(to);
  if (!a || !b) return null;
  const names = ["major", "minor", "patch"];
  // How many leading numbers of the installed version are 0: each shifts the names up.
  const shift = compareNumeric(a[0], "0") !== 0 ? 0 : compareNumeric(a[1], "0") !== 0 ? 1 : 2;
  for (let i = 0; i < 3; i++) {
    const c = compareNumeric(a[i], b[i]);
    if (c < 0) return names[Math.max(0, i - shift)];
    if (c > 0) return null; // `to` is lower: not an update
  }
  return null;
}

// Words in release notes that mean the update may need a change on our side. Wider
// than the report's own flag (`isRisky`), because here a miss installs something
// without asking: any form of break, deprecate or remove, dropped or ended support,
// "no longer", incompatible, and a migration.
const WARNING = /\b(?:break(?:s|ing|age)?|broke|broken|deprecat\w*|remov\w*|drop(?:s|ped|ping)?\s+(?:\w+\s+){0,2}support|end(?:s|ed|ing)?\s+(?:of\s+)?support|unsupported|no\s+longer|incompatib\w*|migrat\w*)\b/i;
/** True when release notes carry one of those words. A plain word test on untrusted text; it can only make a decision stricter. */
export const warnsOf = (text) => WARNING.test(String(text ?? ""));

/**
 * One behind part: `{ decision: "none" | "ask" | "waiting" | "routine", reason?, until? }`.
 * `behind`: `{ key, installed, latest, latestSince, applyFailed }`.
 * `facts`: `{ kind, lifecycle, selfUpdating, localPort, notes, today }`; `notes` is one
 * of NOTES, or null when the word check has not been made (a fetch that failed, a run
 * with --no-read): then the part waits, it is never routine.
 * Whatever cannot be read (a version that is not x.y.z, a day that is no day) counts
 * against the update, never for it.
 */
export function decide(behind, { kind, lifecycle, selfUpdating = false, localPort = false, notes = null, today } = {}) {
  const known = [...SESSION_KINDS, "skill"];
  if (!isObject(behind) || NEVER_KINDS.includes(kind) || !known.includes(kind) || lifecycle === "watching" || selfUpdating) return { decision: "none" };
  const ask = (reason) => ({ decision: "ask", reason });
  if (typeof behind.applyFailed === "string" && behind.applyFailed === behind.latest) return ask(REASONS.failed);
  if (kind === "skill") return ask(REASONS.skill); // nothing on disk says which commit a copy is
  if (kind === "command" && !ROUTINE_COMMAND_PARTS.includes(behind.key)) return ask(REASONS.outside);
  if (localPort) return ask(REASONS.localPort); // a plugin ported by hand: never a plain update
  const level = levelOf(behind.installed, behind.latest);
  if (level === "major") return ask(REASONS.major);
  // No x.y.z step to read: only two different commit ids are an update that can be judged.
  const commits = COMMIT.test(String(behind.installed)) && COMMIT.test(String(behind.latest)) && behind.installed !== behind.latest;
  if (level === null && !commits) return ask(REASONS.unreadable);
  if (notes === "risky") return ask(REASONS.risky);
  if (notes === "partial") return ask(REASONS.partial);
  if (!isDay(today)) return { decision: "waiting", until: null };
  if (notes !== "clean" && notes !== "none") return { decision: "waiting", until: addDays(today, 1), reason: REASONS.unchecked };
  if (notes === "none" && level !== "patch") return ask(REASONS.noNotes);
  const since = isDay(behind.latestSince) && behind.latestSince <= today ? behind.latestSince : today;
  if (daysBetween(since, today) < SOAK_DAYS) return { decision: "waiting", until: addDays(since, SOAK_DAYS) };
  return { decision: "routine" };
}

/**
 * Every behind part sorted into `{ routine, waiting, ask }`, each entry
 * `{ key, from, to, kind }` plus `reason` (ask) or `until` (waiting, with a `reason`
 * when it waits for something other than its days). `factsOf(key)`
 * gives `decide`'s facts for a part. At most DAILY_LIMIT are routine, the longest
 * seen first; the rest wait until tomorrow. `used` is how many installs were already
 * attempted today: they count against the same limit.
 */
export function decideAll(behind, factsOf, today, { used = 0 } = {}) {
  const limit = Math.max(0, DAILY_LIMIT - (Number.isSafeInteger(used) && used > 0 ? used : 0));
  const out = { routine: [], waiting: [], ask: [] };
  const ready = [];
  for (const b of Array.isArray(behind) ? behind : []) {
    if (!isObject(b) || typeof b.key !== "string") continue;
    const facts = factsOf(b.key);
    if (!isObject(facts)) continue;
    const d = decide(b, { ...facts, today });
    const entry = { key: b.key, from: b.installed ?? null, to: b.latest ?? null, kind: facts.kind };
    if (d.decision === "ask") out.ask.push({ ...entry, reason: d.reason });
    else if (d.decision === "waiting") out.waiting.push({ ...entry, until: d.until, ...(d.reason ? { reason: d.reason } : {}) });
    else if (d.decision === "routine") ready.push({ entry, since: isDay(b.latestSince) ? b.latestSince : today });
  }
  ready.sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : a.entry.key < b.entry.key ? -1 : 1));
  for (const [i, r] of ready.entries()) {
    if (i < limit) out.routine.push(r.entry);
    else out.waiting.push({ ...r.entry, until: isDay(today) ? addDays(today, 1) : null });
  }
  return out;
}
