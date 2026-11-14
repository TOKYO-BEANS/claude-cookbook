// Compare stage of the daily update check, and its state file.
//
// `compare` is pure: no clock, no disk, no network. From the catalog, what is
// installed, what is newest, what is installed but unlisted, yesterday's state
// and today's date it decides what today's report says and which state to keep.
// Only `loadState` and `saveState` touch the disk, under
// `<home>/.local/share/stack-updates/`.
//
// What is reported when (the spec's "What is reported when"):
// - A new release: in full once, the day it is first seen after the baseline.
//   One that is already installed by then is reported once as "installed-changed".
// - Still behind afterwards: one line on the first run on or after each Monday,
//   from the values last read when the feed fails that day. A part whose newest
//   release is known only as a page hash is never behind: nothing can say it is
//   not, so its change is reported once and no reminder follows.
// - A self-updating tool (SELF_UPDATING_TOOLS) whose installed version is read:
//   a change when that version moves ("installed-changed"), never twice for one
//   version; a newer release that has not arrived is neither a change nor "still behind".
// - Unlisted and missing: the first day, then the first run on or after each Monday.
// - Could not check (a feed or an installed version that could not be read):
//   the first day, then again every 7 days while it lasts. The part's state is
//   left as it was, so nothing unread is ever marked seen. When every feed
//   failed, one line with the count, on every such run.
// - The first run records a baseline and reports only what is already behind,
//   unlisted, missing or could not be checked. So does a part whose feed changed
//   (a different kind or source, by `feedFingerprint`): what the old feed left in
//   the state is dropped, apart from a recorded installed commit.
// - What a rule holds back because it is not its day is counted in
//   `result.suppressed`, so a quiet day can still say what it did not show.
// - A day is quiet when no list but `unchecked` has an entry.
// A new release on a marketplace or commit feed carries `fromRef` and `toRef`
// (commit ids) beside the human-readable `from` and `to`, when they are known.
// Broken connections, unchecked services and dates are filled in later (connect.mjs).
import { createHash, randomBytes } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from "node:fs";
import { join } from "node:path";
import { compareNumeric } from "./feeds.mjs";
import { normalizeVersion } from "./inventory.mjs";
import { SELF_UPDATING_TOOLS } from "./tables.mjs";

export const READ_LIMIT = 10; // changes whose release text is read in one run
export const ALL_FEEDS = "all feeds"; // the couldNotCheck key of the line that stands for every feed
const RESHOW_DAYS = 7; // a lasting "could not check" is shown again after this many days
const DAY_MS = 86_400_000;
// The lists that make a day not quiet. `unchecked` is not one: a service with no
// check is a standing fact, not news. `suppressed` counts and `weekly` are not either.
const NEWS = ["changes", "stillBehind", "broken", "dates", "couldNotCheck", "unlisted", "missing"];
const COMMIT = /^[0-9a-f]{40}$/;
const PAGE_HASH = /^[0-9a-f]{64}$/; // feeds.mjs's sha256 of a changelog page
// `latestSince` (the day the newest release was first seen), `notes` ("<latest> clean",
// "... risky" or "... none": the word check of its release notes) and `applyFailed` (a
// version whose install failed) serve the routine-update rules in apply.mjs.
const PART_FIELDS = ["installed", "latest", "reported", "behindSince", "feedErrorSince", "feedErrorShown", "installedCommit", "feed",
  "latestSince", "notes", "applyFailed"];
// The fields that say which source a feed reads (not `updater` or `reason`).
const FEED_SOURCE = { npm: ["package", "tag"], github: ["repository"], marketplace: ["repository", "plugin"], commit: ["repository", "path"], changelog: ["url"] };
const INSTALLED_STATES = ["read", "not-found", "unreadable", "hosted", "none"];

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" && v.length > 0 && v.length <= 200 ? v : null);
const cmpText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---- dates (YYYY-MM-DD, UTC) -------------------------------------------------

const validDay = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
};
const daysBetween = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS;
function mondayOf(day) {
  const t = Date.parse(`${day}T00:00:00Z`);
  return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}

// ---- versions ------------------------------------------------------------------

// The numeric core of a version and whether it is a prerelease: "v0.8.0" -> 0.8.0;
// "boat 1.0.97" -> 1.0.97; "2.56.1.windows.1" -> 2.56.1; "1.0.0-beta.1" -> 1.0.0,
// prerelease. null for text with no dotted version (a commit, a hash, "nightly").
function versionParts(v) {
  if (typeof v !== "string" || v.length > 200) return null;
  const m = /^(\d+(?:\.\d+)*)(.*)$/.exec(normalizeVersion(v));
  return m ? { core: m[1], pre: m[2].startsWith("-") } : null;
}

/** Negative, 0 or positive by number after normalising; null when the two cannot be ordered. Never throws. */
export function compareVersions(a, b) {
  if (typeof a === "string" && a === b) return 0;
  const x = versionParts(a), y = versionParts(b);
  if (!x || !y) return null;
  const c = compareNumeric(x.core, y.core);
  if (c !== 0) return c;
  if (x.pre !== y.pre) return x.pre ? -1 : 1; // a prerelease comes before its release
  return 0; // build and platform suffixes (".windows.1") do not order
}

// Is `a` newer than `b`? By number when both are versions, otherwise by inequality.
const newer = (a, b) => {
  const c = compareVersions(a, b);
  return c === null ? a !== b : c > 0;
};

/** A higher major version, or release text with "breaking", "deprecated" or "removed" as whole words. */
export function isRisky(from, to, text) {
  const x = versionParts(from), y = versionParts(to);
  if (x && y && compareNumeric(x.core.split(".")[0], y.core.split(".")[0]) < 0) return true;
  return /\b(?:breaking|deprecated|removed)\b/i.test(String(text ?? ""));
}

/** True when no list but `unchecked` has an entry. The week count and `suppressed` do not count. */
export const isQuiet = (result) => NEWS.every((k) => (result?.[k] ?? []).length === 0)
  // Something a session should install, or an install to tell the owner about, is news too.
  && (result?.apply?.routine ?? []).length === 0 && (result?.applied ?? []).length === 0;

// ---- state ---------------------------------------------------------------------

const emptyPart = () => Object.fromEntries(PART_FIELDS.map((k) => [k, null]));
const emptyState = () => ({ version: 1, parts: {}, unlisted: {}, missing: {}, lastRun: null, lastMonday: null, week: { runs: 0, changes: 0 } });

// A version 1 state with every field checked, or null when it is not one.
// Object.fromEntries keeps a "__proto__" key an ordinary property.
function normalizeState(raw) {
  if (!isObject(raw) || raw.version !== 1 || !isObject(raw.parts)) return null;
  const day = (v) => (validDay(v) ? v : null);
  const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
  const parts = Object.fromEntries(
    Object.entries(raw.parts)
      .filter(([, p]) => isObject(p))
      .map(([key, p]) => [key, {
        installed: str(p.installed), latest: str(p.latest), reported: str(p.reported),
        behindSince: day(p.behindSince), feedErrorSince: day(p.feedErrorSince), feedErrorShown: day(p.feedErrorShown),
        installedCommit: str(p.installedCommit), feed: str(p.feed),
        latestSince: day(p.latestSince), notes: str(p.notes), applyFailed: str(p.applyFailed),
      }]),
  );
  const firstSeen = (o) => Object.fromEntries(Object.entries(isObject(o) ? o : {}).filter(([, d]) => validDay(d)));
  const week = isObject(raw.week) ? raw.week : {};
  return {
    version: 1, parts, unlisted: firstSeen(raw.unlisted), missing: firstSeen(raw.missing),
    lastRun: day(raw.lastRun), lastMonday: day(raw.lastMonday), week: { runs: count(week.runs), changes: count(week.changes) },
  };
}

// `<home>/.local/share/stack-updates`, or `folder` when one is given (`--state`, a trial run).
const stateFolder = (home, folder) => {
  if (folder !== undefined) {
    if (typeof folder !== "string" || !folder) throw new TypeError("folder must be a folder");
    return folder;
  }
  if (typeof home !== "string" || !home) throw new TypeError("home must be a folder");
  return join(home, ".local", "share", "stack-updates");
};

/**
 * `loadState(home, { folder }?) -> { state, fresh }`; `fresh` (an empty state, so a
 * first run) when the file is missing, empty or not a valid state. The file is
 * `<home>/.local/share/stack-updates/state.json`, or `<folder>/state.json`.
 */
export function loadState(home, { folder } = {}) {
  let text;
  try {
    text = readFileSync(join(stateFolder(home, folder), "state.json"), "utf8");
  } catch (e) {
    if (e?.code === "ENOENT" || e?.code === "ENOTDIR") return { state: emptyState(), fresh: true };
    throw e;
  }
  let raw = null;
  try {
    raw = JSON.parse(text);
  } catch {
    // half-written or not JSON: a first run
  }
  const state = normalizeState(raw);
  return state ? { state, fresh: false } : { state: emptyState(), fresh: true };
}

/** `saveState(home, state, { folder }?)`: writes a temp file beside state.json, flushes it and renames it over the old one. */
export function saveState(home, state, { folder: where } = {}) {
  const folder = stateFolder(home, where);
  const clean = normalizeState(state);
  if (!clean) throw new TypeError("saveState needs a version 1 state");
  mkdirSync(folder, { recursive: true });
  const tmp = join(folder, `state.json.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    const fd = openSync(tmp, "wx");
    try {
      writeSync(fd, `${JSON.stringify(clean, null, 2)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, join(folder, "state.json"));
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

// ---- compare -------------------------------------------------------------------

/**
 * A short id of the source a feed reads: 16 hex characters of a hash of its kind
 * and the fields that name the source (an npm tag defaults to latest). Stored per
 * part, so values a part's old feed left in the state are never compared with a
 * new feed's. null for a part with no feed.
 */
export function feedFingerprint(feed) {
  if (!isObject(feed)) return null;
  const fields = Object.hasOwn(FEED_SOURCE, feed.kind) ? FEED_SOURCE[feed.kind] : [];
  const source = fields.map((k) => String(feed.kind === "npm" && k === "tag" ? (feed.tag ?? "latest") : (feed[k] ?? "")));
  return createHash("sha256").update(JSON.stringify([String(feed.kind), ...source])).digest("hex").slice(0, 16);
}

// For a state written before feeds were remembered: could this feed have produced
// that stored value? A page hash comes only from a changelog page, a commit only
// from a commit feed, and a version from the others.
function fitsFeed(feed, value) {
  if (feed?.kind === "changelog") return PAGE_HASH.test(value);
  if (feed?.kind === "commit") return COMMIT.test(value);
  return !PAGE_HASH.test(value) && !COMMIT.test(value);
}

// Today's records for one part. An absent record was not read: "could not check",
// except where nothing needs reading (a hosted or none installed kind, a none feed).
function installedOf(installed, key, part) {
  const r = isObject(installed) && Object.hasOwn(installed, key) ? installed[key] : undefined;
  if (isObject(r) && INSTALLED_STATES.includes(r.state))
    return r.state === "unreadable" ? { state: "unreadable", message: String(r.message || "the installed version could not be read").slice(0, 180) } : r;
  if (r === undefined && (part.installed?.kind === "hosted" || part.installed?.kind === "none")) return { state: part.installed.kind };
  return { state: "unreadable", message: "the installed version was not read" };
}
function latestOf(latest, key, part) {
  const r = isObject(latest) && Object.hasOwn(latest, key) ? latest[key] : undefined;
  if (isObject(r) && r.ok === true) return r;
  if (isObject(r) && r.ok === false) return { ok: false, message: String(r.message || "the feed could not be read").slice(0, 180) };
  if (r === undefined && part.feed?.kind === "none") return { ok: true, source: "" };
  return { ok: false, message: "the feed was not read" };
}

// Is the installed part behind the newest release? true, false, or null when that
// cannot be known: a hosted or none part, a page hash, or a commit feed with no
// recorded installed commit (a skill copy's version is a content hash).
function behindOf(inst, lat, ps) {
  if (inst.state !== "read") return null;
  if (str(lat.version)) return str(inst.version) ? newer(lat.version, inst.version) : null;
  if (str(lat.commit)) {
    if (ps.installedCommit) return ps.installedCommit !== lat.commit;
    return inst.commit === lat.commit ? false : null;
  }
  return null;
}

// The version a new release is compared from: the installed one when it is known
// in the feed's terms, otherwise the last release seen.
function fromOf(inst, lat, ps) {
  if (inst.state === "read" && str(lat.version) && str(inst.version)) return inst.version;
  if (inst.state === "read" && str(lat.commit) && ps.installedCommit) return ps.installedCommit;
  return ps.latest;
}

// Is the installed part exactly at the newest release (not merely newer)?
function atRelease(inst, lat, ps) {
  if (str(lat.version)) return compareVersions(inst.version, lat.version) === 0;
  if (str(lat.commit)) return (ps.installedCommit ?? inst.commit) === lat.commit;
  return false;
}

// For a release that arrived already installed: the newest value the owner knew
// before it (last reported, last installed or last seen), never the release itself.
// A commit feed has no order, so the last reported commit, else the last seen.
function knownBefore(lv, lat, ps) {
  if (!str(lat.version)) return [ps.reported, ps.latest].find((v) => v !== null && v !== lv) ?? null;
  const older = [ps.reported, ps.installed, ps.latest].filter((v) => v !== null && compareVersions(v, lv) < 0);
  return older.sort(compareVersions).at(-1) ?? null;
}

// The commits a new release is compared between, for the release text of
// marketplace and commit feeds: from the recorded installed commit, the installed
// commit, or (a commit feed) the last commit seen; to the newest commit. Only
// 40-character commit ids; a ref that is not known is left out.
function refsOf(inst, lat, ps) {
  const toRef = COMMIT.test(String(lat.commit)) ? lat.commit : null;
  if (!toRef) return {};
  const seen = str(lat.version) ? null : ps.latest; // a commit feed remembers commits as seen
  const fromRef = [ps.installedCommit, inst.state === "read" ? inst.commit : null, seen].find((c) => COMMIT.test(String(c)));
  return fromRef ? { fromRef, toRef } : { toRef };
}

const changeOf = (tool, part, key, kind, from, to, lat, refs = {}) => ({
  key, tool: tool.id, part: part.name, kind, from, to, ...refs, installedKind: part.installed?.kind ?? null,
  risky: isRisky(from, to, ""), source: typeof lat.source === "string" ? lat.source : "",
  textFile: null, answers: null, notRead: null,
});

function mostCommon(messages) {
  const counts = new Map();
  for (const m of messages) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts].reduce((best, e) => (e[1] > best[1] ? e : best))[0];
}

/**
 * `compare({ catalog, installed, latest, unlisted, state, today }) -> { result, state }`.
 * `installed` and `latest` map part keys to Installed and Latest records; `unlisted`
 * is findUnlisted's `{ items, unreadable }`; `today` is YYYY-MM-DD. Pure: the
 * inputs are not changed and the returned state is new.
 */
export function compare({ catalog, installed, latest, unlisted, state, today } = {}) {
  if (!validDay(today)) throw new TypeError("today must be a YYYY-MM-DD date");
  const prev = normalizeState(state) ?? emptyState();
  const firstRun = prev.lastRun === null;
  const monday = mondayOf(today);
  const newWeek = !firstRun && prev.lastMonday !== monday; // the first run on or after this Monday
  const mondaySections = firstRun || newWeek;
  const selfUpdating = new Set(SELF_UPDATING_TOOLS);
  const tools = Array.isArray(catalog?.tools) ? catalog.tools.filter(isObject) : [];
  const next = { version: 1, parts: {}, unlisted: {}, missing: {}, lastRun: today, lastMonday: monday, week: null };
  const changes = [], stillBehind = [], couldNotCheck = [], missing = [], allFailedParts = [], behindAll = [];
  // Entries a rule held back today because it is not their day, so a quiet day can say so.
  const suppressed = { couldNotCheck: 0, stillBehind: 0, unlisted: 0, missing: 0 };

  const entries = tools.flatMap((t) => (Array.isArray(t.parts) ? t.parts.filter(isObject) : []).map((p) => {
    const key = `${t.id}/${p.name}`;
    return { t, p, key, inst: installedOf(installed, key, p), lat: latestOf(latest, key, p) };
  }));
  const feeds = entries.filter((e) => e.p.feed?.kind !== "none");
  const allFailed = feeds.length > 1 && feeds.every((e) => !e.lat.ok);

  for (const { t, p, key, inst, lat } of entries) {
    let ps = Object.hasOwn(prev.parts, key) ? { ...prev.parts[key] } : emptyPart();
    // A changed feed (or, in a state from before feeds were remembered, a stored value
    // this feed could not have produced): a new baseline; a recorded commit stays.
    const feedId = feedFingerprint(p.feed);
    if (ps.feed !== null ? ps.feed !== feedId : ps.latest !== null && !fitsFeed(p.feed, ps.latest))
      ps = { ...emptyPart(), installedCommit: ps.installedCommit, applyFailed: ps.applyFailed }; // a failed install stays failed
    ps.feed = feedId;
    next.parts[key] = ps;
    const firstMissing = Object.hasOwn(prev.missing, key) ? prev.missing[key] : null;

    // Missing: a catalog part that is not installed (never a watching tool). Nothing else is compared.
    if (inst.state === "not-found" && t.lifecycle !== "watching") {
      next.missing[key] = firstMissing ?? today;
      if (!firstMissing || mondaySections) missing.push({ key });
      else suppressed.missing += 1;
      continue;
    }

    // Could not check: only when the error began and was last shown change.
    const feedFailed = !lat.ok, installedFailed = inst.state === "unreadable";
    if (feedFailed || installedFailed) {
      const message = [feedFailed ? lat.message : "", installedFailed ? inst.message : ""].filter(Boolean).join("; ");
      if (firstMissing) next.missing[key] = firstMissing; // unknown, so still remembered
      ps.feedErrorSince ??= today;
      if (feedFailed && allFailed) {
        // One line stands for every feed and names no part, so no part counts as shown.
        allFailedParts.push({ since: ps.feedErrorSince, message: lat.message });
      } else if (ps.feedErrorShown === null || daysBetween(ps.feedErrorShown, today) >= RESHOW_DAYS) {
        ps.feedErrorShown = today;
        couldNotCheck.push({ key, message, since: ps.feedErrorSince });
      } else suppressed.couldNotCheck += 1;
      // A failing feed does not hide a remembered "still behind" on its Monday: the line uses what was last read.
      // A page hash never is (a state saved before that rule may still hold one).
      if (feedFailed && ps.behindSince !== null && ps.latest !== null && !PAGE_HASH.test(ps.latest)) {
        const installedThen = COMMIT.test(ps.latest) ? (ps.installedCommit ?? ps.installed) : ps.installed;
        if (mondaySections) stillBehind.push({ key, installed: installedThen, latest: ps.latest, since: ps.behindSince });
        else suppressed.stillBehind += 1;
      }
      continue;
    }
    ps.feedErrorSince = null;
    ps.feedErrorShown = null;

    const lv = str(lat.version) ?? str(lat.commit) ?? str(lat.hash);
    const iv = inst.state === "read" ? (str(inst.version) ?? str(inst.commit)) : null;
    const self = selfUpdating.has(t.id) && inst.state === "read";
    const behind = behindOf(inst, lat, ps);
    const baseline = firstRun || ps.latest === null; // this part has no release seen before

    // A self-updating tool moved by itself; a version already reported (a rollback undone) is not news.
    if (self && ps.installed !== null && iv !== null && iv !== ps.installed && newer(iv, ps.installed)
      && (ps.reported === null || newer(iv, ps.reported))) {
      changes.push(changeOf(t, p, key, "installed-changed", ps.installed, iv, lat));
      ps.reported = iv;
    }
    let reportedNew = false;
    const isNew = !baseline && lv !== null && lv !== ps.latest && newer(lv, ps.latest) && lv !== ps.reported;
    if (isNew && !self && behind !== false) {
      changes.push(changeOf(t, p, key, "new-release", fromOf(inst, lat, ps), lv, lat, refsOf(inst, lat, ps)));
      ps.reported = lv;
      reportedNew = true;
    } else if (isNew && !self && behind === false && atRelease(inst, lat, ps)) {
      // Installed before the check first saw it: still news once, as already installed.
      const from = knownBefore(lv, lat, ps);
      const refs = COMMIT.test(String(lat.commit)) ? { ...(COMMIT.test(String(from)) ? { fromRef: from } : {}), toRef: lat.commit } : {};
      changes.push(changeOf(t, p, key, "installed-changed", from, lv, lat, refs));
      ps.reported = lv;
    }

    // Behind: known from the versions, or (position unknown) since a new release was reported.
    // Never from a page hash: nothing could ever clear it.
    const hashOnly = !str(lat.version) && !str(lat.commit) && str(lat.hash) !== null;
    if (inst.state === "read" && !self && !hashOnly) {
      if (behind === true || (behind === null && reportedNew)) ps.behindSince ??= today;
      else if (behind === false) ps.behindSince = null;
    } else ps.behindSince = null;
    if (ps.behindSince !== null && lv !== null && !reportedNew) {
      if (mondaySections || baseline)
        stillBehind.push({ key, installed: str(lat.version) ? inst.version : (ps.installedCommit ?? iv), latest: lv, since: ps.behindSince });
      else suppressed.stillBehind += 1;
    }

    ps.installed = iv;
    if (lv !== null) {
      // A newer release restarts its waiting days and forgets the old notes check.
      if (lv !== ps.latest) Object.assign(ps, { latestSince: today, notes: null });
      // A state from before this field starts the wait today: `behindSince` may be older
      // than the day this newest release was first seen.
      else ps.latestSince ??= today;
      ps.latest = lv;
    }
    // Every part known to be behind, every day: what apply.mjs decides about.
    if (ps.behindSince !== null && lv !== null) {
      behindAll.push({
        key, installed: str(lat.version) ? inst.version : (ps.installedCommit ?? iv), latest: lv,
        since: ps.behindSince, latestSince: ps.latestSince, applyFailed: ps.applyFailed,
      });
    }
  }

  if (allFailedParts.length) {
    couldNotCheck.unshift({
      key: ALL_FEEDS,
      message: `all ${feeds.length} feeds failed: ${mostCommon(allFailedParts.map((f) => f.message))}`,
      since: allFailedParts.map((f) => f.since).sort()[0],
      count: feeds.length,
    });
  }

  // Unlisted: keyed "<kind>:<name>". A scan with an unreadable source keeps what it could not see.
  // A name over 200 characters is cut to 200 (never inside a surrogate pair), not dropped.
  const shownUnlisted = [];
  for (const it of Array.isArray(unlisted?.items) ? unlisted.items : []) {
    if (!isObject(it) || !str(it.kind) || typeof it.name !== "string" || !it.name) continue;
    const high = it.name.length > 200 && /[\uD800-\uDBFF]/.test(it.name[199]);
    const name = it.name.length > 200 ? it.name.slice(0, high ? 199 : 200) : it.name;
    const id = `${it.kind}:${name}`;
    if (Object.hasOwn(next.unlisted, id)) continue;
    const first = Object.hasOwn(prev.unlisted, id) ? prev.unlisted[id] : null;
    next.unlisted[id] = first ?? today;
    if (!first || mondaySections) shownUnlisted.push({ kind: it.kind, name });
    else suppressed.unlisted += 1;
  }
  if (Array.isArray(unlisted?.unreadable) && unlisted.unreadable.length)
    for (const [id, first] of Object.entries(prev.unlisted)) if (!Object.hasOwn(next.unlisted, id)) next.unlisted[id] = first;

  // The week's count: runs on different days, and changes reported.
  let weekly = null;
  if (firstRun) next.week = { runs: 1, changes: changes.length };
  else if (newWeek) {
    weekly = { ...prev.week, from: prev.lastMonday }; // the Monday the counted week began
    next.week = { runs: 1, changes: changes.length };
  } else next.week = { runs: prev.week.runs + (prev.lastRun === today ? 0 : 1), changes: prev.week.changes + changes.length };

  // Risky first, then by tool name; past the cap a change is listed but not read.
  const nameOf = new Map(tools.map((t) => [t.id, String(t.name ?? t.id).toLowerCase()]));
  changes.sort((a, b) => Number(b.risky) - Number(a.risky) || cmpText(nameOf.get(a.tool), nameOf.get(b.tool)) || cmpText(a.part, b.part));
  changes.forEach((c, i) => { c.notRead = i < READ_LIMIT ? null : "cap"; });
  const byKey = (a, b) => cmpText(a.key, b.key);
  const firstCouldNot = allFailedParts.length ? 1 : 0;

  const result = {
    date: today,
    quiet: false,
    firstRun,
    changes,
    behind: behindAll.sort(byKey),
    stillBehind: stillBehind.sort(byKey),
    broken: [],
    unchecked: [],
    dates: [],
    couldNotCheck: [...couldNotCheck.slice(0, firstCouldNot), ...couldNotCheck.slice(firstCouldNot).sort(byKey)],
    unlisted: shownUnlisted.sort((a, b) => cmpText(`${a.kind}:${a.name}`, `${b.kind}:${b.name}`)),
    missing: missing.sort(byKey),
    suppressed,
    weekly,
  };
  result.quiet = isQuiet(result);
  return { result, state: next };
}
