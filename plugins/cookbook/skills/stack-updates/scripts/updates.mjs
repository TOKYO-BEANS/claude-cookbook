#!/usr/bin/env node
// The daily update check: `node updates.mjs <command> [options]`.
//
//   run [--out <dir>] [--no-read]    inventory, compare, connect, read and report
//   inventory | compare | connect | read | report [--out <dir>]
//                                    one stage on one run folder
//   record <part key> <commit>       after an update: the commit now installed
//   page <n>                         page n of today's report.md (see below)
//
// Options: --home <dir> (the profile to read, for tests), --state <dir> (state and
// runs somewhere other than ~/.local/share/stack-updates, for a trial run that must
// not create the real baseline), --out <dir> (the run folder, default
// <state>/runs/<today>), --today YYYY-MM-DD (only with --state, never earlier than
// the last run; default: this PC's local date), --no-read (no release notes are
// fetched or read).
//
// The run folder holds inventory.json, latest.json, result.json, next-state.json
// (the state this run keeps once it has reported), report.md and
// texts/<part key with / as ->.txt. result.json lists the stages that ran. The state
// is loaded at the start and saved only by `report`, after result.json and report.md
// are written, and only for today's folder once compare and connect ran; it is merged
// with the state on disk at that moment (a later run is never overwritten, a commit
// recorded meanwhile is kept). A run that fails before that saves nothing, so the
// next run reports again. Run folders older than 30 days are removed at the start of
// `run`. `run` and every stage hold run.lock in the state folder: one run at a time.
// The paid connection check runs at most once per real local day (paid-check.json).
//
// On a quiet day it prints exactly one line; otherwise the path of report.md and its
// text, or, when that is longer than PAGE_BYTES, page 1 headed "Page 1 of N: <path>";
// `page 2` to `page N` print the rest. Exit code 0, or 1 when the script itself
// failed, 2 for a usage error.
//
// Safety: nothing is installed, updated or committed. Release text is written to
// texts/ and passed to one thing only, readChange's request with no tools; every
// outside string in the report goes through report.mjs's `inert`. No credential is
// read, stored or printed: tools that need a key run through their shims.
// Every stage that touches the disk, the network or a process gets `{ home, fetcher,
// gh, run }` from `main`, so tests pass a fixture profile and fakes.
import { randomBytes } from "node:crypto";
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, rmdirSync, statSync, unlinkSync, writeFileSync, writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { READ_LIMIT, compare, isQuiet, isRisky, loadState, saveState } from "./lib/compare.mjs";
import { dueDates, runChecks } from "./lib/connect.mjs";
import { RESPONSE_LIMIT, readLatest, releaseNotes } from "./lib/feeds.mjs";
import { defaultRun, findUnlisted, readInstalled } from "./lib/inventory.mjs";
import { readChange } from "./lib/read.mjs";
import { quietLine, renderReport } from "./lib/report.mjs";
import { CONNECTION_CHECKS } from "./lib/tables.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// The catalog and the Cookbook skill of the plugin version this script belongs to.
export const CATALOG_PATH = join(HERE, "..", "..", "..", "catalog.json");
export const COOKBOOK_SKILL_PATH = join(HERE, "..", "..", "cookbook", "SKILL.md");
export const KEEP_DAYS = 30; // run folders older than this are removed
export const LOCK_FILE = "run.lock";
export const LOCK_MAX_AGE_MS = 30 * 60_000; // an older lock was left by a run that died
export const PAID_MARKER = "paid-check.json";
const FEED_WORKERS = 6; // feeds read at the same time
const GH_TIMEOUT_MS = 30_000;
const ERROR_LIMIT = 200;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const COMMIT = /^[0-9a-f]{40}$/;
const NPM_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const VERSION = /^\d+(?:\.\d+)+$/;
const DAY_MS = 86_400_000;
const STAGES = ["inventory", "compare", "connect", "read", "report"];
const USAGE = "usage: updates.mjs run [--out <dir>] [--no-read] | inventory|compare|connect|read|report [--out <dir>] | record <part key> <commit> | page <n>; options --home <dir>, --state <dir>, --today YYYY-MM-DD (with --state)";

class UsageError extends Error {}
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const cmpText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const firstLine = (e) => String(e?.message ?? e).split("\n")[0].slice(0, 300);
const own = (o, k) => (isObject(o) && Object.hasOwn(o, k) ? o[k] : undefined);

// ---- dates ---------------------------------------------------------------------

const isDay = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
};
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
/** This PC's local date as YYYY-MM-DD. */
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---- one run at a time -------------------------------------------------------------

// Milliseconds since a lock's start time (its file time when that cannot be read). A
// start in the future, or a lock that is already gone, counts as old.
function lockAge(path) {
  let started = Number.NaN;
  try {
    started = Date.parse(JSON.parse(readFileSync(path, "utf8")).started);
  } catch {
    // not readable yet or not JSON: the file time decides
  }
  if (!Number.isFinite(started)) {
    try {
      started = statSync(path).mtimeMs;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
  const age = Date.now() - started;
  return age < 0 ? Number.POSITIVE_INFINITY : age;
}

/**
 * Takes `<stateDir>/run.lock`, created exclusively and holding this process's pid
 * and start time. A lock younger than 30 minutes means another run is going: this
 * one stops. An older lock is replaced. Returns the function that removes the lock
 * again, and only while it is still this run's.
 */
export function takeLock(stateDir) {
  mkdirSync(stateDir, { recursive: true });
  const path = join(stateDir, LOCK_FILE);
  const token = JSON.stringify({ pid: process.pid, started: new Date().toISOString(), id: randomBytes(8).toString("hex") });
  for (let attempt = 0; attempt < 2; attempt++) {
    let fd;
    try {
      fd = openSync(path, "wx");
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
      if (lockAge(path) < LOCK_MAX_AGE_MS) break;
      try {
        unlinkSync(path);
      } catch {
        // already removed by its owner or another run
      }
      continue;
    }
    try {
      writeSync(fd, token);
    } finally {
      closeSync(fd);
    }
    return () => {
      try {
        if (readFileSync(path, "utf8") === token) unlinkSync(path);
      } catch {
        // already gone
      }
    };
  }
  throw new Error(`another run is in progress (${LOCK_FILE} in ${stateDir})`);
}

// ---- run folders -----------------------------------------------------------------

// Removes a folder the script built under runs/. A link (a symbolic link or a
// junction) is removed itself and never followed; nothing deeper than 4 levels.
function removeTree(path, depth) {
  const st = lstatSync(path);
  if (st.isDirectory() && !st.isSymbolicLink()) {
    if (depth > 4) throw new Error("the folder is deeper than a run folder");
    for (const name of readdirSync(path)) removeTree(join(path, name), depth + 1);
    rmdirSync(path);
  } else {
    unlinkSync(path);
  }
}

/** Removes `<stateDir>/runs/<date>` folders older than 30 days; returns the dates removed. A runs folder that is a link is left alone. */
export function pruneRuns(stateDir, today) {
  const runs = join(stateDir, "runs");
  let st;
  try {
    st = lstatSync(runs);
  } catch {
    return [];
  }
  if (!st.isDirectory() || st.isSymbolicLink()) return [];
  const removed = [];
  for (const name of readdirSync(runs)) {
    if (!isDay(name) || daysBetween(name, today) <= KEEP_DAYS) continue;
    try {
      removeTree(join(runs, name), 0);
      removed.push(name);
    } catch {
      // left for the next run; a folder that cannot be removed never fails the check
    }
  }
  return removed;
}

const runFile = (ctx, name) => join(ctx.out, name);
function writeJson(ctx, name, value) {
  mkdirSync(ctx.out, { recursive: true });
  writeFileSync(runFile(ctx, name), `${JSON.stringify(value, null, 2)}\n`);
  return runFile(ctx, name);
}
function readJson(ctx, name) {
  let text;
  try {
    text = readFileSync(runFile(ctx, name), "utf8");
  } catch (e) {
    if (e?.code === "ENOENT") throw new Error(`${name} is missing in ${ctx.out}: run the stage before this one first`);
    throw e;
  }
  return JSON.parse(text);
}
// result.json of today's run; a folder from another day is refused.
function readResult(ctx) {
  const result = readJson(ctx, "result.json");
  if (!isObject(result) || result.date !== ctx.today) {
    throw new Error(`result.json in ${ctx.out} is for ${String(result?.date).slice(0, 20)}, not ${ctx.today}: run the stages for ${ctx.today} first; nothing was saved`);
  }
  return result;
}
// Records that a stage finished (once, at the end).
const addStage = (result, name) => {
  result.stages = [...(Array.isArray(result.stages) ? result.stages : []).filter((s) => s !== name), name];
};

// ---- the catalog -------------------------------------------------------------------

function partsOf(catalog) {
  const out = [];
  for (const tool of Array.isArray(catalog?.tools) ? catalog.tools : []) {
    if (!isObject(tool)) continue;
    for (const part of Array.isArray(tool.parts) ? tool.parts : []) if (isObject(part)) out.push({ key: `${tool.id}/${part.name}`, tool, part });
  }
  return out;
}

// How a part is named in the report: the tool's name, plus the part's when the tool has several.
// A tool with several parts reads "<tool> <part>"; a single part named after the package
// it tracks, which is not the tool itself (agent-browser's playwright-core), reads
// "<tool> / <package>"; any other single part reads as the tool.
export const labelOf = ({ tool, part }) => {
  const name = String(tool.name ?? tool.id);
  if (Array.isArray(tool.parts) && tool.parts.length > 1) return `${name} ${part.name}`;
  const pkg = part?.installed?.package;
  return typeof pkg === "string" && pkg === part.name && pkg !== tool.id && pkg !== tool.name ? `${name} / ${pkg}` : name;
};

// ---- pages: what one call prints stays under context-mode's cut ---------------------

// The owner's sessions run the context-mode plugin, whose PostToolUse hook replaces
// any tool output over 4,096 bytes (REPLACE_TRIGGER_BYTES, context-mode 2.1.0
// README "Run, then replace" and hook.mjs) with a few chunks and a search pointer.
// So `run` and `page` never print more than PAGE_BYTES: a report that does not fit
// is printed in pages, page 1 by `run` and the others by `page <n>`.
export const PAGE_BYTES = 3_500;
export const MAX_PAGES = 99;
const utf8Bytes = (s) => Buffer.byteLength(s, "utf8");

// One line in pieces of at most `limit` UTF-8 bytes, cut between characters.
function cutLine(line, limit) {
  if (utf8Bytes(line) <= limit) return [line];
  const pieces = [];
  let piece = "";
  for (const ch of line) {
    if (piece && utf8Bytes(piece) + utf8Bytes(ch) > limit) {
      pieces.push(piece);
      piece = "";
    }
    piece += ch;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/**
 * What `run` and `page` print for a report: `[<file>\n<text>]` when that fits in
 * PAGE_BYTES, as before; otherwise pages cut at line ends, the first headed
 * "Page 1 of N: <file>" and the others "Page k of N", each at most PAGE_BYTES.
 * The page bodies joined in order are the report.
 */
export function reportPages(file, text) {
  const whole = `${file}\n${text}`;
  if (utf8Bytes(whole) <= PAGE_BYTES) return [whole];
  const firstHead = utf8Bytes(`Page ${MAX_PAGES} of ${MAX_PAGES}: ${file}\n`);
  const head = utf8Bytes(`Page ${MAX_PAGES} of ${MAX_PAGES}\n`);
  const lines = (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
  const bodies = [];
  let page = [], size = 0;
  for (const raw of lines) {
    for (const line of cutLine(raw, PAGE_BYTES - firstHead - 1)) {
      const add = utf8Bytes(line) + 1; // the line and its line end
      if (page.length && size + add > PAGE_BYTES - (bodies.length === 0 ? firstHead : head)) {
        bodies.push(page);
        page = [];
        size = 0;
      }
      page.push(line);
      size += add;
    }
  }
  if (page.length) bodies.push(page);
  if (bodies.length > MAX_PAGES) throw new Error(`the report needs more than ${MAX_PAGES} pages`);
  return bodies.map((b, i) => `${i === 0 ? `Page 1 of ${bodies.length}: ${file}` : `Page ${i + 1} of ${bodies.length}`}\n${b.join("\n")}\n`);
}

// `page <n>`: page n of today's report.md in the state folder. It reads that one file,
// never texts/ and never a folder named on the command line.
function pageOf(ctx, n) {
  const file = join(ctx.stateDir, "runs", ctx.today, "report.md");
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    if (e?.code === "ENOENT") throw new Error(`no report.md for ${ctx.today} in the state folder: run the check first`);
    throw e;
  }
  const pages = reportPages(file, text);
  if (n > pages.length) throw new UsageError(`the report for ${ctx.today} has ${pages.length} page${pages.length === 1 ? "" : "s"}`);
  return pages[n - 1];
}

/**
 * The section of the Cookbook skill whose heading is `heading` (any level), up to the
 * next heading of the same or a higher level; headings inside code fences do not
 * count. "" when there is none.
 */
export function recipeSection(skillText, heading) {
  if (typeof skillText !== "string" || typeof heading !== "string" || !heading.trim()) return "";
  const lines = skillText.split(/\r?\n/);
  let fence = false, start = -1, level = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s{0,3}(```|~~~)/.test(lines[i])) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const m = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(lines[i]);
    if (!m) continue;
    if (start >= 0 && m[1].length <= level) return lines.slice(start, i).join("\n").trim();
    if (start < 0 && m[2] === heading.trim()) {
      start = i;
      level = m[1].length;
    }
  }
  return start >= 0 ? lines.slice(start).join("\n").trim() : "";
}

// The page of release `to` for a change already installed: the feed's newest source
// when it names `to`, otherwise the version's own page, or "" when there is none.
function linkFor(feed, change) {
  const source = typeof change.source === "string" ? change.source : "";
  const tail = source.split("/").pop();
  if (source && [change.to, `v${change.to}`, change.toRef].some((v) => typeof v === "string" && v === tail)) return source;
  const to = String(change.to ?? "");
  switch (feed?.kind) {
    case "npm": return NPM_NAME.test(String(feed.package)) && VERSION.test(to) ? `https://www.npmjs.com/package/${feed.package}/v/${to}` : "";
    case "nodeDist": return VERSION.test(to) ? `https://nodejs.org/en/blog/release/v${to}` : "";
    case "github": return REPO.test(String(feed.repository)) ? `https://github.com/${feed.repository}/releases` : "";
    case "gitForWindows": return "https://github.com/git-for-windows/git/releases";
    case "marketplace":
    case "commit": {
      const repo = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/commit\/[0-9a-f]{40}$/.exec(source)?.[1];
      return repo && COMMIT.test(String(change.toRef)) ? `https://github.com/${repo}/commit/${change.toRef}` : "";
    }
    default: return source; // a changelog page or the models page: the same page
  }
}

// ---- state -------------------------------------------------------------------------

function loadStateInfo(ctx) {
  const existed = existsSync(join(ctx.stateDir, "state.json"));
  const { state, fresh } = loadState(ctx.home, { folder: ctx.stateDir });
  return { state, fresh, existed };
}

// The state on disk now. Refuses when it already holds a run later than `next`;
// null when there is no readable state.
function storedNow(ctx, next) {
  const { state, fresh } = loadStateInfo(ctx);
  if (fresh) return null;
  if (state.lastRun !== null && state.lastRun > next.lastRun) {
    throw new Error(`state.json already holds a later run (${state.lastRun}); this run is for ${next.lastRun}: nothing was saved`);
  }
  return state;
}

// ---- the paid check: at most once per real local day --------------------------------

// paid-check.json in the state folder: `{ on: <real local date>, results: { <tool id>:
// { service, outcome: "working" } | { service, outcome: "broken", error } } }`. It is
// written right after each paid call and keyed by the PC's real date, never --today.
const markerPath = (ctx) => join(ctx.stateDir, PAID_MARKER);
function readPaidMarker(ctx) {
  let m;
  try {
    m = JSON.parse(readFileSync(markerPath(ctx), "utf8"));
  } catch {
    return null;
  }
  return isObject(m) && m.on === ctx.realDay && isObject(m.results) ? m.results : null;
}
function writePaidMarker(ctx, results) {
  mkdirSync(ctx.stateDir, { recursive: true });
  writeFileSync(markerPath(ctx), `${JSON.stringify({ on: ctx.realDay, results }, null, 2)}\n`);
}
// A stored outcome as `{ error: string | null }`, or null when none is stored.
function storedOutcome(entry) {
  if (!isObject(entry)) return null;
  if (entry.outcome === "working") return { error: null };
  if (entry.outcome === "broken") return { error: (typeof entry.error === "string" && entry.error ? entry.error : "no error text").slice(0, ERROR_LIMIT) };
  return null;
}

// A paid check's outcome folded into the free results for its service: an error is
// broken (added to a server error, if any); a pass counts as working unless a server
// failed; with no stored outcome the service is unchecked (unless a server failed).
function mergePaid(checks, name, outcome) {
  const drop = (listName) => { checks[listName] = checks[listName].filter((n) => n !== name); };
  const isBroken = checks.broken.some((x) => x.service === name);
  if (outcome === null) {
    if (isBroken) return;
    drop("working");
    if (!checks.unchecked.includes(name)) checks.unchecked.push(name);
  } else if (typeof outcome.error === "string") {
    const b = checks.broken.find((x) => x.service === name);
    if (b) b.error = `${outcome.error}; ${b.error}`.slice(0, ERROR_LIMIT);
    else checks.broken.push({ service: name, error: outcome.error.slice(0, ERROR_LIMIT) });
    drop("working");
    drop("unchecked");
  } else if (!isBroken) {
    if (!checks.working.includes(name)) checks.working.push(name);
    drop("unchecked");
  }
}

// ---- stages ------------------------------------------------------------------------

async function pool(items, workers, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, worker));
}

async function stageInventory(ctx) {
  const installed = {};
  for (const e of ctx.entries) installed[e.key] = await readInstalled(e.part.installed, e.key, { home: ctx.home, run: ctx.run, gh: ctx.gh });
  const unlisted = await findUnlisted(ctx.catalog, { home: ctx.home, run: ctx.run });
  const inventory = { date: ctx.today, installed, unlisted };
  return { inventory, file: writeJson(ctx, "inventory.json", inventory) };
}

async function stageCompare(ctx, loaded = loadStateInfo(ctx)) {
  const inventory = readJson(ctx, "inventory.json");
  if (!isObject(inventory) || inventory.date !== ctx.today) {
    throw new Error(`inventory.json in ${ctx.out} is for ${String(inventory?.date).slice(0, 20)}, not ${ctx.today}: run inventory first`);
  }
  const latest = {};
  await pool(ctx.entries, FEED_WORKERS, async (e) => {
    latest[e.key] = await readLatest(e.part.feed, { fetcher: ctx.fetcher, gh: ctx.gh });
  });
  writeJson(ctx, "latest.json", { date: ctx.today, latest });
  const { result, state } = compare({
    catalog: ctx.catalog, installed: inventory.installed, latest, unlisted: inventory.unlisted, state: loaded.state, today: ctx.today,
  });
  // What the report needs and the catalog alone knows.
  const keys = new Set([...result.changes, ...result.stillBehind, ...result.couldNotCheck, ...result.missing].map((x) => x.key));
  result.names = Object.fromEntries(ctx.entries.filter((e) => keys.has(e.key)).map((e) => [e.key, labelOf(e)]));
  for (const c of result.changes) {
    const e = ctx.byKey.get(c.key);
    c.name = e ? labelOf(e) : c.key;
    c.watching = e?.tool.lifecycle === "watching";
    if (e?.part.installed?.kind === "project") c.repository = e.part.installed.repository;
    if (c.kind === "installed-changed") c.source = linkFor(e?.part.feed, c);
  }
  result.stateReset = loaded.fresh && loaded.existed;
  result.unreadableSources = Array.isArray(inventory.unlisted?.unreadable) ? inventory.unlisted.unreadable : [];
  result.working = [];
  result.paidChecks = [];
  result.reads = null;
  result.stages = ["inventory", "compare"];
  writeJson(ctx, "next-state.json", state);
  return { file: writeJson(ctx, "result.json", result) };
}

async function stageConnect(ctx) {
  const result = readResult(ctx);
  const deps = { run: ctx.run, home: ctx.home, now: ctx.now };
  const free = Object.fromEntries(Object.entries(CONNECTION_CHECKS).filter(([, c]) => !c.paid));
  const checks = await runChecks(ctx.catalog, { ...deps, checks: free });
  // The paid check: at most once per real local day; later runs that day reuse its outcome.
  const marker = readPaidMarker(ctx);
  const ran = {}, paidNames = [];
  const tools = (Array.isArray(ctx.catalog?.tools) ? ctx.catalog.tools : []).filter((t) => isObject(t) && (t.lifecycle === "active" || t.lifecycle === "trial"));
  for (const [id, entry] of Object.entries(CONNECTION_CHECKS).filter(([, c]) => c.paid)) {
    const tool = tools.find((t) => t.id === id);
    if (!tool) continue;
    let outcome;
    if (marker) {
      outcome = storedOutcome(own(marker, id));
    } else {
      // The tool alone, with no parts, so only its table entry runs.
      const one = await runChecks({ tools: [{ id, name: tool.name, lifecycle: tool.lifecycle, parts: [] }] }, { ...deps, checks: { [id]: entry } });
      const error = one.broken[0]?.error ?? null;
      ran[id] = error === null ? { service: tool.name, outcome: "working" } : { service: tool.name, outcome: "broken", error };
      writePaidMarker(ctx, ran); // right after the paid call, before anything else can fail
      outcome = { error };
      paidNames.push(tool.name);
    }
    mergePaid(checks, tool.name, outcome);
  }
  result.broken = checks.broken;
  result.unchecked = checks.unchecked;
  result.working = checks.working;
  result.dates = dueDates(ctx.catalog, ctx.today);
  result.paidChecks = paidNames;
  result.quiet = isQuiet(result);
  addStage(result, "connect");
  return { file: writeJson(ctx, "result.json", result) };
}

const textFileName = (key) => `${String(key).replaceAll("/", "-").replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\./, "_")}.txt`;

function skillText(ctx) {
  if (ctx.skillText === undefined) {
    try {
      ctx.skillText = readFileSync(COOKBOOK_SKILL_PATH, "utf8");
    } catch {
      ctx.skillText = ""; // the request then says the Cookbook has no recipe
    }
  }
  return ctx.skillText;
}

// owner/name, or exactly https://github.com/<owner>/<name> with an optional trailing
// slash or ".git": that repository's owner/name; anything else null.
const GITHUB_ADDRESS = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git|\/)?$/;
function repositoryName(value) {
  if (typeof value !== "string") return null;
  const address = GITHUB_ADDRESS.exec(value)?.[1];
  const name = REPO.test(value) ? value : address && !address.endsWith(".git") ? address : null; // not ".git/"
  return name && REPO.test(name) && !name.split("/").some((s) => /^\.+$/.test(s)) ? name : null;
}

/**
 * The GitHub repository whose releases hold a part's notes when its feed has none:
 * the part's own `notes` source when it names one, otherwise the tool's
 * `repository` (owner/name or its github.com address). null when there is none.
 */
export function notesRepository(tool, part) {
  if (isObject(part) && Object.hasOwn(part, "notes")) return part.notes?.kind === "github" ? repositoryName(part.notes.repository) : null;
  return repositoryName(tool?.repository);
}

// A change's release notes: from its feed, else (when the feed gave none) from the
// repository `notesRepository` names. `{ text }`, or `{ text: "", error }` when a
// source that was tried failed and no text was found.
async function notesFor(ctx, c) {
  const e = ctx.byKey.get(c.key);
  const deps = { fetcher: ctx.fetcher, gh: ctx.gh };
  const notes = await releaseNotes(e?.part.feed, c.fromRef ?? c.from, c.toRef ?? c.to, deps);
  if (notes.text.trim()) return notes;
  const repo = e ? notesRepository(e.tool, e.part) : null;
  if (!repo || (e.part.feed?.kind === "github" && e.part.feed.repository === repo)) return notes;
  const fallback = await releaseNotes({ kind: "github", repository: repo }, c.from, c.to, deps);
  if (fallback.text.trim()) return fallback;
  const error = notes.error ?? fallback.error;
  return error ? { text: "", error } : { text: "" };
}

async function stageRead(ctx) {
  const result = readResult(ctx);
  const changes = Array.isArray(result.changes) ? result.changes : [];
  if (ctx.noRead) {
    for (const c of changes) if (!isObject(c.answers)) c.notRead = "read skipped";
    addStage(result, "read");
    return { file: writeJson(ctx, "result.json", result) };
  }
  // Fetch the notes of every change not yet answered first: they decide the order (risky first).
  const texts = new Map();
  for (const c of changes) {
    if (isObject(c.answers)) continue; // read before (the stage run again): kept as it is
    const notes = await notesFor(ctx, c);
    c.textFile = null;
    c.notesError = null;
    if (notes.text.trim()) {
      const file = `texts/${textFileName(c.key)}`;
      mkdirSync(join(ctx.out, "texts"), { recursive: true });
      writeFileSync(join(ctx.out, file), notes.text);
      c.textFile = file;
      texts.set(c, notes.text);
    } else if (notes.error) {
      c.notesError = String(notes.error).slice(0, 180);
    }
    c.risky = isRisky(c.from, c.to, notes.text);
  }
  const nameOf = (c) => String(ctx.toolById.get(c.tool)?.name ?? c.tool).toLowerCase();
  changes.sort((a, b) => Number(b.risky) - Number(a.risky) || cmpText(nameOf(a), nameOf(b)) || cmpText(String(a.part), String(b.part)));
  // Reads made in this run folder so far: a second read stage adds to them.
  const prev = isObject(result.reads) ? result.reads : {};
  const n = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
  const reads = { count: n(prev.count), failed: n(prev.failed), input: n(prev.input), output: n(prev.output), missingUsage: n(prev.missingUsage) };
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    if (isObject(c.answers)) continue;
    if (!texts.has(c)) {
      c.answers = null;
      c.notRead = c.notesError ? `release notes could not be fetched (${c.notesError})` : "no release notes found";
      continue;
    }
    if (reads.count + reads.failed >= READ_LIMIT) {
      Object.assign(c, { answers: null, notRead: "cap" });
      continue;
    }
    const tool = ctx.toolById.get(c.tool) ?? { id: c.tool };
    const recipe = typeof tool.recipe === "string" ? recipeSection(skillText(ctx), tool.recipe) : "";
    const done = await readChange(c, tool, recipe, texts.get(c), { run: ctx.run, home: ctx.home });
    if (isObject(done.answers)) {
      reads.count += 1;
      if (isObject(done.readUsage)) {
        reads.input += n(done.readUsage.input);
        reads.output += n(done.readUsage.output);
      } else reads.missingUsage += 1;
    } else reads.failed += 1;
    changes[i] = done;
  }
  result.changes = changes;
  result.reads = reads;
  addStage(result, "read");
  return { file: writeJson(ctx, "result.json", result) };
}

async function stageReport(ctx) {
  const result = readResult(ctx);
  const next = readJson(ctx, "next-state.json");
  const stages = Array.isArray(result.stages) ? result.stages : [];
  const missing = ["compare", "connect"].filter((s) => !stages.includes(s));
  if (missing.length) throw new Error(`the ${missing.join(" and ")} stage has not run in ${ctx.out}: nothing was saved`);
  if (!isObject(next) || next.lastRun !== ctx.today) throw new Error(`next-state.json in ${ctx.out} is not for ${ctx.today}: nothing was saved`);
  storedNow(ctx, next); // refuse before writing anything when a later run already saved
  result.quiet = isQuiet(result); // from the lists, never a stored value
  const text = renderReport(result);
  writeFileSync(runFile(ctx, "report.md"), text);
  addStage(result, "report");
  writeJson(ctx, "result.json", result);
  // Read the state again just before saving: a commit recorded while this run was
  // going differs from the one the run started with (next's) and wins.
  const stored = storedNow(ctx, next);
  if (stored) {
    for (const [key, part] of Object.entries(isObject(next.parts) ? next.parts : {})) {
      const recorded = isObject(own(stored.parts, key)) ? stored.parts[key].installedCommit : null;
      if (recorded !== null && isObject(part) && recorded !== part.installedCommit) part.installedCommit = recorded;
    }
  }
  saveState(ctx.home, next, { folder: ctx.stateDir });
  return { printed: result.quiet ? `${quietLine(result)}\n` : reportPages(runFile(ctx, "report.md"), text)[0] };
}

async function record(ctx, key, commit) {
  const e = ctx.byKey.get(key);
  if (!e) throw new UsageError(`no catalog part has the key ${String(key).slice(0, 120)}`);
  if (!COMMIT.test(String(commit))) throw new UsageError("the commit must be a 40-character commit id");
  const { state, fresh, existed } = loadStateInfo(ctx);
  if (fresh && existed) throw new Error("state.json could not be read: run the check once before recording");
  state.parts[key] = { ...(isObject(state.parts[key]) ? state.parts[key] : {}), installedCommit: commit };
  saveState(ctx.home, state, { folder: ctx.stateDir });
  return { printed: `Recorded ${commit.slice(0, 7)} as the installed commit of ${labelOf(e)} (${key}).\n` };
}

// ---- the command line -------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { positional: [], noRead: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-read") opts.noRead = true;
    else if (["--out", "--home", "--state", "--today"].includes(a)) {
      const v = argv[++i];
      if (typeof v !== "string" || v === "" || v.startsWith("--")) throw new UsageError(`${a} needs a value`);
      opts[a.slice(2)] = v;
    } else if (a.startsWith("--")) throw new UsageError(`unknown option ${a.slice(0, 40)}`);
    else opts.positional.push(a);
  }
  const [command, ...rest] = opts.positional;
  if (command === undefined) throw new UsageError("no command");
  if (command === "page") {
    if (rest.length !== 1 || !/^[1-9][0-9]?$/.test(rest[0])) throw new UsageError(`page needs one page number from 1 to ${MAX_PAGES}`);
    if (opts.out !== undefined) throw new UsageError("page reads today's run folder in the state folder; it takes no --out");
  } else if (command === "record" ? rest.length !== 2 : !(command === "run" || STAGES.includes(command)) || rest.length) {
    throw new UsageError(command === "record" ? "record needs a part key and a commit" : `unknown command ${String(command).slice(0, 40)}`);
  }
  if (opts.today !== undefined && !isDay(opts.today)) throw new UsageError("--today must be a YYYY-MM-DD date");
  if (opts.today !== undefined && opts.state === undefined) throw new UsageError("--today needs --state, so a made-up date never touches the real state");
  return { command, rest, opts };
}

/**
 * `main(argv, deps?) -> exit code`. `deps` (all optional, for tests): `home`,
 * `fetcher`, `gh` (`(args) -> { code, stdout, stderr }`), `run` (inventory.mjs's
 * shape), `now` (the real clock: the local date and the paid check's day), `catalog`,
 * `skillText`, `stdout`, `stderr` (write functions).
 */
export async function main(argv, deps = {}) {
  const stdout = deps.stdout ?? ((s) => process.stdout.write(s));
  const stderr = deps.stderr ?? ((s) => process.stderr.write(s));
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    stderr(`updates.mjs: ${firstLine(e)}\n${USAGE}\n`);
    return 2;
  }
  const { command, rest, opts } = parsed;
  try {
    const home = opts.home ? resolve(opts.home) : (deps.home ?? homedir());
    const stateDir = opts.state ? resolve(opts.state) : join(home, ".local", "share", "stack-updates");
    const now = deps.now ?? new Date();
    const realDay = localDate(now);
    const today = opts.today ?? realDay;
    const catalog = deps.catalog ?? JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
    const entries = partsOf(catalog);
    const ctx = {
      catalog, entries, home, stateDir, today, realDay, now, noRead: opts.noRead,
      byKey: new Map(entries.map((e) => [e.key, e])),
      toolById: new Map((Array.isArray(catalog?.tools) ? catalog.tools : []).filter(isObject).map((t) => [t.id, t])),
      out: opts.out ? resolve(opts.out) : join(stateDir, "runs", today),
      fetcher: deps.fetcher ?? globalThis.fetch,
      gh: deps.gh ?? ((args) => defaultRun(["gh", ...args], { home, timeoutMs: GH_TIMEOUT_MS, maxBytes: RESPONSE_LIMIT + 1 })),
      run: deps.run ?? defaultRun,
      skillText: deps.skillText,
    };
    if (command === "record") {
      stdout((await record(ctx, rest[0], rest[1])).printed);
      return 0;
    }
    if (command === "page") {
      stdout(pageOf(ctx, Number(rest[0])));
      return 0;
    }
    if (opts.today !== undefined) {
      const { state, fresh } = loadState(home, { folder: stateDir });
      if (!fresh && state.lastRun !== null && opts.today < state.lastRun) {
        throw new UsageError(`--today ${opts.today} is earlier than the last run (${state.lastRun})`);
      }
    }
    const release = takeLock(stateDir);
    let done;
    try {
      switch (command) {
        case "run": {
          pruneRuns(stateDir, today);
          const loaded = loadStateInfo(ctx);
          await stageInventory(ctx);
          await stageCompare(ctx, loaded);
          await stageConnect(ctx);
          await stageRead(ctx);
          done = await stageReport(ctx);
          break;
        }
        case "inventory": done = await stageInventory(ctx); break;
        case "compare": done = await stageCompare(ctx); break;
        case "connect": done = await stageConnect(ctx); break;
        case "read": done = await stageRead(ctx); break;
        case "report": done = await stageReport(ctx); break;
      }
    } finally {
      release();
    }
    stdout(done.printed ?? `${done.file}\n`);
    return 0;
  } catch (e) {
    if (e instanceof UsageError) {
      stderr(`updates.mjs: ${firstLine(e)}\n${USAGE}\n`);
      return 2;
    }
    stderr(`updates.mjs: ${firstLine(e)}\n`);
    return 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const ownPath = fileURLToPath(import.meta.url);
if (invokedPath && (process.platform === "win32" ? invokedPath.toLowerCase() === ownPath.toLowerCase() : invokedPath === ownPath)) {
  process.exitCode = await main(process.argv.slice(2));
}
