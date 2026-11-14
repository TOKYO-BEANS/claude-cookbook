// The report of the daily update check: report.md, the Markdown the owner reads
// each morning, and the one line printed on a quiet day.
//
// Pure: no clock, no disk, no network. `renderReport(result)` and
// `quietLine(result)` read only the Result that updates.mjs writes to result.json.
//
// Every string that came from outside is untrusted text: the three answers about
// release notes, versions, links, error texts and the names of unlisted things.
// `inert` prints each on one line with Markdown and HTML made inert: never as a
// link and never inside a code fence (the report has none). A release link is
// printed only when `safeLink` accepts it, otherwise "no link".
import { ALL_FEEDS, READ_LIMIT } from "./compare.mjs";
import { INVISIBLE } from "./read.mjs";
import { CHANGELOG_HOSTS } from "./tables.mjs";

const TEXT_LIMIT = 400; // code points of one outside string in the report
const GROUP_OVER = 3; // more "could not check" entries than this with one message print as one line
const LINK_HOSTS = Object.freeze(["github.com", "www.npmjs.com", "nodejs.org"]);
// A plain https link: a lower-case host, a path of safe characters, no query, fragment, port or user.
const LINK_SHAPE = /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9._@%+/-]*$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
const cutPoints = (s, n) => [...s].slice(0, n).join("");
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const count = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const isAre = (n) => (n === 1 ? "is" : "are");
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString("en-US");
const own = (o, k) => (isObject(o) && Object.hasOwn(o, k) ? o[k] : undefined);

/**
 * One untrusted string as inert Markdown on one line: control characters and line
 * breaks become spaces; invisible characters (read.mjs's INVISIBLE: format
 * characters such as bidi overrides and zero-width spaces, private-use and
 * unassigned code points) are removed and a lone surrogate becomes U+FFFD;
 * backslash, backtick, asterisk, underscore, tilde, brackets, angle brackets and pipe
 * are escaped; every "://" (any scheme, any letter case) becomes "[://]", and
 * "www." and the "@" of an address are bracketed, so nothing renders as a link; a
 * leading #, - or + is escaped (a leading > already is). At most 400 code points.
 * "" for a non-string.
 */
export function inert(value, max = TEXT_LIMIT) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const clean = String(value).toWellFormed().replace(CONTROL, " ").replace(INVISIBLE, "");
  let s = cutPoints(clean.replace(/\s+/g, " ").trim(), max);
  s = s.replace(/[\\`*_~[\]<>|]/g, "\\$&");
  s = s.replace(/:\/\//g, "\\[://\\]");
  s = s.replace(/(www)\./gi, "$1\\[.\\]");
  s = s.replace(/([A-Za-z0-9._%+-])@(?=[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g, "$1\\[@\\]");
  if (/^[#+-]/.test(s)) s = `\\${s}`;
  return s;
}

/** The link itself when it is plain https on github.com, www.npmjs.com, nodejs.org or a changelog host; otherwise null. */
export function safeLink(url, hosts = CHANGELOG_HOSTS) {
  if (typeof url !== "string" || url.length > 300 || !LINK_SHAPE.test(url)) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.href !== url || parsed.username || parsed.password || parsed.port) return null;
  return [...LINK_HOSTS, ...hosts].includes(parsed.hostname) ? url : null;
}

// ---- small pieces ----------------------------------------------------------------

const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`));
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
// "2026-11-14" -> "14 Nov".
const shortDate = (iso) => (isDay(iso) ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}` : inert(iso) || "an unknown day");
// A version as shown: a commit or a page hash is cut to 7 characters.
const shown = (v) => (typeof v === "string" && /^[0-9a-f]{40,64}$/.test(v) ? v.slice(0, 7) : inert(v) || "unknown");
const nameOf = (result, key, fallback) => inert(own(result?.names, key) ?? fallback ?? key) || "unknown";

const KIND_WORDS = { plugin: "plugin", pinned: "pinned copy", command: "installed command", skill: "skill copy", hosted: "hosted", none: "not installed" };
// What "update <name>" involves, by installed kind (the spec's "After the owner says 'update X'").
const UPDATE_WORDS = {
  plugin: () => "read the diff from the installed commit, then update the marketplace and the plugin",
  pinned: () => "new lockfile in an empty folder, three scans, a clean install, one real call",
  command: () => "a checked download or winget in your elevated shell, then a version check",
  skill: () => "read the diff, copy the skill, record the commit",
  project: (c) => `the version pull request in ${inert(c.repository) || "its repository"}, which Dependabot opens`,
};

function kindWords(c) {
  if (c.watching) return "watching, not installed";
  if (c.installedKind === "project") return `dependency in ${inert(c.repository) || "a repository"}`;
  return own(KIND_WORDS, c.installedKind) ?? "installed";
}

function notReadLine(notRead) {
  if (notRead === "cap") return `- Not read today: more than ${READ_LIMIT} changes.`;
  if (notRead === "no release notes found") return "- No release notes found.";
  const why = inert(notRead).replace(/\.+$/, "");
  return why ? `- Not read: ${why}.` : "- Not read.";
}

function changeBlock(c, result) {
  const name = nameOf(result, c.key, c.name);
  const versions = /^[0-9a-f]{64}$/.test(String(c.to ?? "")) ? "changelog page changed" : `${c.from ? shown(c.from) : "unknown"} -> ${shown(c.to)}`;
  let head = `${name} ${versions}, ${kindWords(c)}`;
  if (c.kind === "installed-changed") head += ", already installed";
  if (c.risky === true) head += ", may need a change (major version or breaking notes)";
  const lines = [head];
  if (isObject(c.answers)) {
    lines.push(`- Changed: ${inert(c.answers.changed)}`, `- Affects us: ${inert(c.answers.affects)}`, `- Worth adopting: ${inert(c.answers.adopt)}`);
  } else {
    lines.push(notReadLine(c.notRead));
  }
  const update = own(UPDATE_WORDS, c.installedKind);
  if (c.kind === "new-release" && c.watching !== true && update) lines.push(`- To update: say "update ${name}" (${update(c)}).`);
  lines.push(`- Link: ${safeLink(c.source) ?? "no link"}`);
  return lines.join("\n");
}

const section = (title, lines) => (lines.length ? [`${title}\n${lines.join("\n")}`] : []);

function stillBehindLine(s, result) {
  const days = isDay(s.since) && isDay(result.date) ? daysBetween(s.since, result.date) : null;
  const counted = Number.isSafeInteger(days) && days > 0 ? ` (${plural(days, "day")})` : "";
  const since = days === 0 ? "since today" : `since ${shortDate(s.since)}${counted}`;
  return `- ${nameOf(result, s.key)}: ${shown(s.installed)} -> ${shown(s.latest)}, behind ${since}`;
}

// Entries sharing one message print as one line when more than 3 do; the line for
// every feed prints its own message ("all N feeds failed: ..."); then the inventory
// sources that could not be read.
function couldNotCheckLines(result) {
  const entries = list(result.couldNotCheck).filter(isObject);
  const sizes = new Map();
  for (const e of entries) if (e.key !== ALL_FEEDS) sizes.set(e.message, (sizes.get(e.message) ?? 0) + 1);
  const grouped = new Set();
  const lines = [];
  for (const e of entries) {
    if (e.key === ALL_FEEDS) lines.push(`- ${inert(e.message) || "all feeds failed"}`);
    else if (sizes.get(e.message) > GROUP_OVER) {
      if (!grouped.has(e.message)) lines.push(`- ${sizes.get(e.message)} parts: ${inert(e.message) || "unreadable"}`);
      grouped.add(e.message);
    } else lines.push(`- ${nameOf(result, e.key)}: ${inert(e.message) || "unreadable"} (since ${shortDate(e.since)})`);
  }
  for (const s of list(result.unreadableSources)) lines.push(`- ${inert(s) || "a source could not be read"}`);
  return lines;
}
// What could not be read: parts (the line for every feed counts each feed), the
// inventory sources, and changes whose release notes could not be fetched.
const notesFailed = (c) => isObject(c) && typeof c.notesError === "string" && c.notesError !== "";
const couldNotReadCount = (result) =>
  list(result.couldNotCheck).filter(isObject).reduce((n, e) => n + (e.key === ALL_FEEDS ? count(e.count) || 1 : 1), 0) +
  list(result.unreadableSources).length +
  list(result.changes).filter(notesFailed).length;

function warningLine(d) {
  const days = d.days;
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : Number.isSafeInteger(days) && days > 1 ? `in ${days} days` : "";
  return `Warning: ${inert(d.label) || "a dated fact"} (${shortDate(d.on)}${when ? `, ${when}` : ""}).`;
}

function headerItems(result) {
  const n = {
    changes: list(result.changes).length, behind: list(result.stillBehind).length, broken: list(result.broken).length,
    unread: couldNotReadCount(result), unlisted: list(result.unlisted).length, missing: list(result.missing).length, dates: list(result.dates).length,
  };
  return [
    n.changes && plural(n.changes, "change"),
    n.behind && `${n.behind} still behind`,
    n.broken && `${n.broken} broken`,
    n.unread && `${n.unread} could not be read`,
    n.unlisted && `${n.unlisted} not in the Cookbook`,
    n.missing && `${n.missing} missing`,
    n.dates && plural(n.dates, "warning"),
  ].filter(Boolean);
}

// What a rule held back today: "3 parts could not be checked, 2 are still behind;
// details on Monday." or null. The Monday sections come back on the next Monday;
// a lasting "could not check" comes back 7 days after it was last shown.
function heldSentence(result) {
  const s = isObject(result.suppressed) ? result.suppressed : {};
  const held = [];
  const unread = count(s.couldNotCheck), behind = count(s.stillBehind), unlisted = count(s.unlisted), missing = count(s.missing);
  if (unread) held.push(`${plural(unread, "part")} could not be checked`);
  if (behind) held.push(`${behind} ${isAre(behind)} still behind`);
  if (unlisted) held.push(`${plural(unlisted, "thing")} ${isAre(unlisted)} not in the Cookbook`);
  if (missing) held.push(`${plural(missing, "part")} ${isAre(missing)} missing`);
  if (!held.length) return null;
  return `${capitalize(held.join(", "))}; ${unread ? "each is shown again within a week" : "details on Monday"}.`;
}

function weekSentence(result) {
  const w = isObject(result.weekly) ? result.weekly : null;
  return w ? `Last week: ${plural(count(w.runs), "run")}, ${plural(count(w.changes), "change")} reported.` : null;
}

function costLine(result) {
  const r = isObject(result.reads) ? result.reads : null;
  const bits = [];
  // Only reads that returned answers count as read; a failed read is named apart.
  const read = count(r?.count), failed = count(r?.failed), missing = count(r?.missingUsage);
  const tokens = read ? `${fmt(r.input)} input and ${fmt(r.output)} output tokens${missing ? ` (${missing} without a token count)` : ""}` : "";
  if (failed) bits.push(`release notes on the Claude plan: ${read} read, ${failed} failed${tokens ? `; ${tokens}` : ""}`);
  else if (read) bits.push(`${plural(read, "release note")} read on the Claude plan: ${tokens}`);
  const paid = list(result.paidChecks).filter((s) => typeof s === "string").map((s) => inert(s));
  if (paid.length === 1) bits.push(`one paid ${paid[0]} check`);
  else if (paid.length > 1) bits.push(`${paid.length} paid checks (${paid.join(", ")})`);
  return bits.length ? `${capitalize(bits.join("; "))}.` : null;
}

// ---- the two outputs ---------------------------------------------------------------

/**
 * The line printed on a quiet day: "No changes, nothing broken.", then (each only
 * when it applies) the first-run or reset sentence, what was held back, the inventory
 * sources that could not be read and, on the first run of a week, the week's count
 * and how many services have no check.
 */
export function quietLine(result) {
  const out = ["No changes, nothing broken."];
  if (result?.stateReset) out.push("The state file could not be read, so this run is a new baseline.");
  else if (result?.firstRun) out.push("First run: baseline recorded.");
  const held = heldSentence(result ?? {});
  if (held) out.push(held);
  const sources = list(result?.unreadableSources).map((s) => inert(s)).filter(Boolean);
  if (sources.length) out.push(`Could not read: ${sources.join("; ")}.`);
  const week = weekSentence(result ?? {});
  if (week) {
    out.push(week);
    const unchecked = list(result.unchecked).length;
    if (unchecked) out.push(`${plural(unchecked, "service")} ${unchecked === 1 ? "has" : "have"} no check.`);
  }
  return out.join(" ");
}

/**
 * report.md for a Result. A quiet Result gives its one line. Otherwise: the header
 * ("Updates, 14 Nov: 1 change, 1 warning"), the first-run or reset note, each change
 * (tool line, the three answers or why they are missing, the update line, the link),
 * then the sections that have content, in the order Still behind, Broken, Could not
 * check, Not in the Cookbook, Missing, Unchecked, then the warnings, what was held
 * back, the week and the run's cost.
 */
export function renderReport(result) {
  if (!isObject(result)) throw new TypeError("renderReport needs a Result");
  if (result.quiet) return `${quietLine(result)}\n`;
  const blocks = [`Updates, ${shortDate(result.date)}: ${headerItems(result).join(", ") || "nothing new"}`];
  if (result.stateReset) blocks.push("The state file could not be read, so it was reset: this run is a new baseline and reports only what is already behind, unlisted, missing or broken.");
  else if (result.firstRun) blocks.push("First run: this run records the baseline and reports only what is already behind, unlisted, missing or broken.");
  for (const c of list(result.changes).filter(isObject)) blocks.push(changeBlock(c, result));
  blocks.push(
    ...section("Still behind", list(result.stillBehind).filter(isObject).map((s) => stillBehindLine(s, result))),
    ...section("Broken", list(result.broken).filter(isObject).map((b) => `- ${inert(b.service) || "unknown"}: ${inert(b.error) || "no error text"}`)),
    ...section("Could not check", couldNotCheckLines(result)),
    ...section("Not in the Cookbook", list(result.unlisted).filter(isObject).map((u) => `- ${inert(u.name) || "unnamed"} (${inert(u.kind) || "unknown"})`)),
    ...section("Missing", list(result.missing).filter(isObject).map((m) => `- ${nameOf(result, m.key)}`)),
  );
  const unchecked = list(result.unchecked).map((s) => inert(s)).filter(Boolean);
  if (unchecked.length) blocks.push(`Unchecked (no real call exists)\n- ${unchecked.join(", ")}`);
  for (const d of list(result.dates).filter(isObject)) blocks.push(warningLine(d));
  const held = heldSentence(result);
  if (held) blocks.push(`Held back: ${held.charAt(0).toLowerCase()}${held.slice(1)}`);
  const week = weekSentence(result);
  if (week) blocks.push(week);
  const cost = costLine(result);
  if (cost) blocks.push(cost);
  return `${blocks.join("\n\n")}\n`;
}
