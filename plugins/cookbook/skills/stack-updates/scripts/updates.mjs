#!/usr/bin/env node
// The daily update check: `node updates.mjs <command> [options]`.
//
//   run [--out <dir>] [--no-read]    inventory, compare, connect, read and report
//   inventory | compare | connect | read | report [--out <dir>]
//                                    one stage on one run folder
//   record <part key> <commit>       after an update: the commit now installed
//
// Options: --home <dir> (the profile to read, for tests), --state <dir> (state and
// runs somewhere other than ~/.local/share/stack-updates, for a trial run that must
// not create the real baseline), --out <dir> (the run folder, default
// <state>/runs/<today>), --today YYYY-MM-DD (default: this PC's local date),
// --no-read (no release notes are fetched or read).
//
// The run folder holds inventory.json, latest.json, result.json, next-state.json
// (the state this run keeps once it has reported), report.md and
// texts/<part key with / as ->.txt. The state is loaded at the start and saved only
// after result.json and report.md are written: a run that fails before that saves
// nothing, so the next run reports again. Run folders older than 30 days are removed
// at the start of `run`.
//
// On a quiet day it prints exactly one line; otherwise the path of report.md and its
// text. Exit code 0, or 1 when the script itself failed, 2 for a usage error.
//
// Safety: nothing is installed, updated or committed. Release text is written to
// texts/ and passed to one thing only, readChange's request with no tools; every
// outside string in the report goes through report.mjs's `inert`. No credential is
// read, stored or printed: tools that need a key run through their shims.
// Every stage that touches the disk, the network or a process gets `{ home, fetcher,
// gh, run }` from `main`, so tests pass a fixture profile and fakes.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { READ_LIMIT, compare, isQuiet, isRisky, loadState, saveState } from "./lib/compare.mjs";
import { dueDates, runChecks } from "./lib/connect.mjs";
import { RESPONSE_LIMIT, readLatest, releaseText } from "./lib/feeds.mjs";
import { defaultRun, findUnlisted, readInstalled } from "./lib/inventory.mjs";
import { readChange } from "./lib/read.mjs";
import { quietLine, renderReport } from "./lib/report.mjs";
import { CONNECTION_CHECKS } from "./lib/tables.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// The catalog and the Cookbook skill of the plugin version this script belongs to.
export const CATALOG_PATH = join(HERE, "..", "..", "..", "catalog.json");
export const COOKBOOK_SKILL_PATH = join(HERE, "..", "..", "cookbook", "SKILL.md");
export const KEEP_DAYS = 30; // run folders older than this are removed
const FEED_WORKERS = 6; // feeds read at the same time
const GH_TIMEOUT_MS = 30_000;
const ERROR_LIMIT = 200;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const COMMIT = /^[0-9a-f]{40}$/;
const NPM_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const VERSION = /^\d+(?:\.\d+)+$/;
const DAY_MS = 86_400_000;
const STAGES = ["inventory", "compare", "connect", "read", "report"];
const USAGE = "usage: updates.mjs run [--out <dir>] [--no-read] | inventory|compare|connect|read|report [--out <dir>] | record <part key> <commit>; options --home <dir>, --state <dir>, --today YYYY-MM-DD";

class UsageError extends Error {}
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const cmpText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const firstLine = (e) => String(e?.message ?? e).split("\n")[0].slice(0, 300);

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
const labelOf = ({ tool, part }) =>
  (Array.isArray(tool.parts) && tool.parts.length > 1 ? `${tool.name ?? tool.id} ${part.name}` : String(tool.name ?? tool.id));

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
  writeJson(ctx, "next-state.json", state);
  return { file: writeJson(ctx, "result.json", result) };
}

// A paid check's outcome folded into the free results for its service: an error is
// broken (added to a server error, if any); a pass counts as working unless a server
// failed; with no stored outcome the service is left out rather than unchecked.
function mergePaid(checks, name, outcome) {
  const drop = (listName) => { checks[listName] = checks[listName].filter((n) => n !== name); };
  if (outcome === null) return drop("unchecked");
  if (typeof outcome.error === "string") {
    const b = checks.broken.find((x) => x.service === name);
    if (b) b.error = `${outcome.error}; ${b.error}`.slice(0, ERROR_LIMIT);
    else checks.broken.push({ service: name, error: outcome.error.slice(0, ERROR_LIMIT) });
    drop("working");
    drop("unchecked");
  } else if (!checks.broken.some((x) => x.service === name)) {
    if (!checks.working.includes(name)) checks.working.push(name);
    drop("unchecked");
  }
}

async function stageConnect(ctx) {
  const result = readJson(ctx, "result.json");
  const next = readJson(ctx, "next-state.json");
  const deps = { run: ctx.run, home: ctx.home, now: ctx.now };
  const free = Object.fromEntries(Object.entries(CONNECTION_CHECKS).filter(([, c]) => !c.paid));
  const checks = await runChecks(ctx.catalog, { ...deps, checks: free });
  // The paid check runs once a day: a second run that day reuses its outcome.
  const paidToday = isObject(next.paidCheck) && next.paidCheck.on === ctx.today;
  const stored = paidToday && isObject(next.paidCheck.results) ? next.paidCheck.results : {};
  const ran = {}, paidNames = [];
  const tools = (Array.isArray(ctx.catalog?.tools) ? ctx.catalog.tools : []).filter((t) => isObject(t) && (t.lifecycle === "active" || t.lifecycle === "trial"));
  for (const [id, entry] of Object.entries(CONNECTION_CHECKS).filter(([, c]) => c.paid)) {
    const tool = tools.find((t) => t.id === id);
    if (!tool) continue;
    let outcome;
    if (paidToday) {
      outcome = Object.hasOwn(stored, id) ? stored[id] : null;
    } else {
      // The tool alone, with no parts, so only its table entry runs.
      const one = await runChecks({ tools: [{ id, name: tool.name, lifecycle: tool.lifecycle, parts: [] }] }, { ...deps, checks: { [id]: entry } });
      outcome = { error: one.broken[0]?.error ?? null };
      ran[id] = outcome;
      paidNames.push(tool.name);
    }
    mergePaid(checks, tool.name, outcome);
  }
  if (!paidToday) next.paidCheck = { on: ctx.today, results: ran };
  result.broken = checks.broken;
  result.unchecked = checks.unchecked;
  result.working = checks.working;
  result.dates = dueDates(ctx.catalog, ctx.today);
  result.paidChecks = paidNames;
  result.quiet = isQuiet(result);
  writeJson(ctx, "next-state.json", next);
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

async function stageRead(ctx) {
  const result = readJson(ctx, "result.json");
  const changes = Array.isArray(result.changes) ? result.changes : [];
  if (ctx.noRead) {
    for (const c of changes) if (!isObject(c.answers)) c.notRead = "read skipped";
    return { file: writeJson(ctx, "result.json", result) };
  }
  // Fetch every change's notes first: they decide the order (risky first).
  const texts = new Map();
  for (const c of changes) {
    const e = ctx.byKey.get(c.key);
    const deps = { fetcher: ctx.fetcher, gh: ctx.gh };
    let text = await releaseText(e?.part.feed, c.fromRef ?? c.from, c.toRef ?? c.to, deps);
    const repo = e?.tool.repository;
    if (!text.trim() && REPO.test(String(repo)) && !(e.part.feed?.kind === "github" && e.part.feed.repository === repo)) {
      text = await releaseText({ kind: "github", repository: repo }, c.from, c.to, deps);
    }
    c.textFile = null;
    if (text.trim()) {
      const file = `texts/${textFileName(c.key)}`;
      mkdirSync(join(ctx.out, "texts"), { recursive: true });
      writeFileSync(join(ctx.out, file), text);
      c.textFile = file;
      texts.set(c, text);
    }
    c.risky = isRisky(c.from, c.to, texts.get(c) ?? "");
  }
  const nameOf = (c) => String(ctx.toolById.get(c.tool)?.name ?? c.tool).toLowerCase();
  changes.sort((a, b) => Number(b.risky) - Number(a.risky) || cmpText(nameOf(a), nameOf(b)) || cmpText(String(a.part), String(b.part)));
  const reads = { count: 0, input: 0, output: 0, missingUsage: 0 };
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    if (!texts.has(c)) {
      Object.assign(c, { answers: null, notRead: "no release notes published" });
      continue;
    }
    if (reads.count >= READ_LIMIT) {
      Object.assign(c, { answers: null, notRead: "cap" });
      continue;
    }
    const tool = ctx.toolById.get(c.tool) ?? { id: c.tool };
    const recipe = typeof tool.recipe === "string" ? recipeSection(skillText(ctx), tool.recipe) : "";
    const done = await readChange(c, tool, recipe, texts.get(c), { run: ctx.run, home: ctx.home });
    reads.count += 1;
    if (isObject(done.readUsage)) {
      reads.input += done.readUsage.input;
      reads.output += done.readUsage.output;
    } else reads.missingUsage += 1;
    changes[i] = done;
  }
  result.changes = changes;
  result.reads = reads;
  return { file: writeJson(ctx, "result.json", result) };
}

async function stageReport(ctx) {
  const result = readJson(ctx, "result.json");
  const text = renderReport(result);
  writeFileSync(runFile(ctx, "report.md"), text);
  saveState(ctx.home, readJson(ctx, "next-state.json"), { folder: ctx.stateDir });
  return { printed: result.quiet ? `${quietLine(result)}\n` : `${runFile(ctx, "report.md")}\n${text}` };
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
  if (command === "record" ? rest.length !== 2 : !(command === "run" || STAGES.includes(command)) || rest.length) {
    throw new UsageError(command === "record" ? "record needs a part key and a commit" : `unknown command ${String(command).slice(0, 40)}`);
  }
  if (opts.today !== undefined && !isDay(opts.today)) throw new UsageError("--today must be a YYYY-MM-DD date");
  return { command, rest, opts };
}

/**
 * `main(argv, deps?) -> exit code`. `deps` (all optional, for tests): `home`,
 * `fetcher`, `gh` (`(args) -> { code, stdout, stderr }`), `run` (inventory.mjs's
 * shape), `now`, `catalog`, `skillText`, `stdout`, `stderr` (write functions).
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
    const today = opts.today ?? localDate(now);
    const catalog = deps.catalog ?? JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
    const entries = partsOf(catalog);
    const ctx = {
      catalog, entries, home, stateDir, today, now, noRead: opts.noRead,
      byKey: new Map(entries.map((e) => [e.key, e])),
      toolById: new Map((Array.isArray(catalog?.tools) ? catalog.tools : []).filter(isObject).map((t) => [t.id, t])),
      out: opts.out ? resolve(opts.out) : join(stateDir, "runs", today),
      fetcher: deps.fetcher ?? globalThis.fetch,
      gh: deps.gh ?? ((args) => defaultRun(["gh", ...args], { home, timeoutMs: GH_TIMEOUT_MS, maxBytes: RESPONSE_LIMIT + 1 })),
      run: deps.run ?? defaultRun,
      skillText: deps.skillText,
    };
    let done;
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
      case "record": done = await record(ctx, rest[0], rest[1]); break;
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
