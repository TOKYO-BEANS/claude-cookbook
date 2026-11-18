#!/usr/bin/env node
// The Codex start check: may Claude start Codex in this checkout? See recipes/codex.md.
//
//   node codex-start-check.mjs <repo> [<folder>]
//
// <repo> is the repository's name from the task, never read from the checkout. Codex loads
// every AGENTS.md and AGENTS.override.md on its path by itself, so the answer is yes only when
// every AGENTS.md, AGENTS.override.md and CLAUDE.md on disk, at any depth and in any spelling
// of the name, is byte for byte (line endings aside) the file at GitHub's default head of
// TOKYO-BEANS/<repo>, and the checkout's object files name that head. The same holds for every
// file under a folder named .codex or .agents, where Codex can find project settings, hooks
// and skills. It also compares the commit of the marketplace clone Codex reads the Cookbook
// from with main's head: the plugin has no version number, its commit is its version.
//
// The checkout may be hostile, so nothing of it is run and its Git is never asked: no `git`
// command (a checkout's Git configuration can run programs), and `gh` is taken from an
// absolute folder of PATH that is not inside the checkout. The files are read from disk, the
// head's tree and files from GitHub, and the head is looked up in `.git`'s object files.
//
// Exit 0: yes. Exit 3: yes, and the clone is not on main's version. Exit 1: no. Any step that
// fails or cannot run is a no. The output is fixed phrases only.
import { spawnSync } from "node:child_process";
import { accessSync, closeSync, constants, lstatSync, openSync, readFileSync, readSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "TOKYO-BEANS";
const COOKBOOK = "claude-cookbook";
const CLONE = [".claude", "plugins", "marketplaces", COOKBOOK];
const MAX_PACKED_REFS = 1024 * 1024;
const INSTRUCTION_FILES = new Set(["agents.md", "agents.override.md", "claude.md"]);
const SETTINGS_FOLDERS = new Set([".codex", ".agents"]);
const MAX_FOLDERS = 200_000;
const MAX_FILES = 60;
const MAX_BYTES = 1024 * 1024;
// The whole check, below the 150 seconds its hook is given.
const MAX_MS = 100_000;
const RAW = ["-H", "Accept: application/vnd.github.raw+json"];
const HEX = /^[0-9a-f]{40}$/;
const WINDOWS = process.platform === "win32";
// Where gh is when the PATH of a hook does not hold it.
const ELSEWHERE = WINDOWS ? ["C:\\Program Files\\GitHub CLI"] : [];

export const PHRASES = {
  yes: "start Codex here: yes",
  no: "start Codex here: no",
  same: "Cookbook Codex reads: main's version",
  differs: "Cookbook Codex reads: not main's version; do not lean on a page changed since",
};

export const REASONS = {
  usage: "the call takes a repository name and at most one folder",
  name: "the repository name is not a plain name",
  checkout: "the folder is not in a Git checkout",
  "head-unread": "GitHub's default head could not be read",
  "head-missing": "GitHub's default head is not in the checkout's object files; after git fetch origin there, check again",
  differs: "an instruction file on disk is not the one at GitHub's default head",
  "compare-failed": "the instruction files could not be compared",
  "cookbook-unread": "the Cookbook's commit could not be read, in the clone or on main",
  "too-slow": "the check ran out of time",
  failed: "the check could not run",
};

// Letters, digits, dot, underscore and hyphen. No slash, no leading hyphen (an option), not
// "." or "..": the name is one path segment of one argument.
export function plainRepoName(name) {
  return typeof name === "string" && name.length <= 100 && /^[A-Za-z0-9._][A-Za-z0-9._-]*$/.test(name) && name !== "." && name !== "..";
}

// Is `path` the folder `dir` or inside it? Windows and macOS disks do not tell case apart.
const fold = (path) => (WINDOWS || process.platform === "darwin" ? path.toLowerCase() : path);
const within = (path, dir) => fold(path) === fold(dir) || fold(path).startsWith(fold(dir) + sep);

// The program's full path: the first absolute folder of PATH that holds it and is not inside
// `avoid`. A bare name is never handed to the system, which on Windows looks in the current
// folder first.
export function locate(name, { path, avoid = null } = {}) {
  const file = WINDOWS ? `${name}.exe` : name;
  // A path that is given is the whole search; the PATH of the session gets the fallback.
  const dirs = typeof path === "string" ? path.split(delimiter) : [...(process.env.PATH ?? "").split(delimiter), ...ELSEWHERE];
  for (const dir of dirs) {
    if (!isAbsolute(dir)) continue;
    try {
      const real = realpathSync(join(dir, file));
      if (!statSync(real).isFile() || (avoid !== null && (within(real, avoid) || within(join(dir, file), avoid)))) continue;
      if (!WINDOWS) accessSync(real, constants.X_OK);
      return real;
    } catch {
      // not in this folder
    }
  }
  return null;
}

// The session's environment without the variables that send gh to another host or repository.
function ghEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (!["GH_HOST", "GH_REPO", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"].includes(key.toUpperCase())) env[key] = value;
  return { ...env, GH_PROMPT_DISABLED: "1", NoDefaultCurrentDirectoryInExePath: "1" };
}

// One program with its arguments as an array: no shell reads them. Never throws.
export function run(file, args, { cwd, timeoutMs = 20_000 } = {}) {
  try {
    // the absolute gh path found on PATH, argument array, no shell (owner's dismissal 18 Nov 2026)
    // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
    const r = spawnSync(file, args, {
      cwd,
      shell: false,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: ghEnv(),
    });
    if (r.error) return { status: null, stdout: Buffer.alloc(0) };
    return { status: r.status, stdout: r.stdout ?? Buffer.alloc(0) };
  } catch {
    return { status: null, stdout: Buffer.alloc(0) };
  }
}

// `gh` from outside the checkout, run in its own folder: never in the checkout.
function realGh(top, path) {
  const program = locate("gh", { avoid: top, path });
  return (args, timeoutMs) => (program === null ? { status: null, stdout: Buffer.alloc(0) } : run(program, args, { cwd: dirname(program), timeoutMs }));
}

class TooSlow extends Error {}

const no = (reason) => ({ start: false, reason });
const text = (r) => r.stdout.toString("utf8");
const sameText = (a, b) => a.toString("latin1").replace(/\r\n/g, "\n") === b.toString("latin1").replace(/\r\n/g, "\n");


// The folder that holds `.git`, from `folder` upwards: where Codex starts reading instruction
// files.
function topOf(folder) {
  let dir;
  try {
    dir = realpathSync(folder);
    if (!lstatSync(dir).isDirectory()) return null;
  } catch {
    return null;
  }
  for (;;) {
    try {
      lstatSync(join(dir, ".git"));
      return dir;
    } catch {
      const up = dirname(dir);
      if (up === dir) return null;
      dir = up;
    }
  }
}

// A pointer file of `.git` is a line or two: more than 4 KB is not read, and neither is
// anything that is not a plain file (a link to a large file, a pipe that never answers).
function plainFile(file) {
  const entry = lstatSync(file);
  if (!entry.isFile()) throw new Error("not a plain file");
  return entry;
}
function smallFile(file) {
  if (plainFile(file).size > 4096) throw new Error("too large");
  return readFileSync(file, "utf8");
}

// The commit a plain clone is on, read from its files without Git: HEAD, then the branch's
// own file, then packed-refs. null when the files do not say. Only a branch under
// refs/heads with plain name parts is followed, so a HEAD cannot point this at another file.
function headOf(top) {
  const gitDir = join(top, ".git");
  if (!lstatSync(gitDir).isDirectory()) return null;
  const head = smallFile(join(gitDir, "HEAD")).trim();
  if (HEX.test(head)) return head;
  const ref = /^ref: (refs\/heads\/[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*)$/.exec(head)?.[1];
  if (!ref) return null;
  let own = null;
  try {
    own = smallFile(join(gitDir, ...ref.split("/"))).trim();
  } catch {
    own = null; // not a loose ref: look in packed-refs
  }
  if (own !== null) return HEX.test(own) ? own : null;
  const packed = join(gitDir, "packed-refs");
  if (plainFile(packed).size > MAX_PACKED_REFS) return null;
  for (const line of readFileSync(packed, "utf8").split(/\r?\n/)) {
    const [sha, name, ...more] = line.split(" ");
    if (name === ref && more.length === 0) return HEX.test(sha) ? sha : null;
  }
  return null;
}

// The folder a pointer in `.git` names, or null for one on another machine (\\host\share):
// a hostile pointer must not make this script open a network path.
function localFolder(from, pointer) {
  if (/^[\\/]{2}/.test(pointer) || (from !== null && /^[\\/]{2}/.test(from))) return null;
  const folder = from === null ? null : resolve(from, pointer);
  return folder === null || /^[\\/]{2}/.test(folder) ? null : folder;
}

// Is `sha` in this pack index (version 2: a table of counts by first byte, then the sorted ids)?
function inPackIndex(file, sha) {
  plainFile(file);
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(8 + 1024);
    if (readSync(fd, head, 0, head.length, 0) !== head.length || head.readUInt32BE(0) !== 0xff744f63 || head.readUInt32BE(4) !== 2) return false;
    const first = Number.parseInt(sha.slice(0, 2), 16);
    let low = first === 0 ? 0 : head.readUInt32BE(8 + 4 * (first - 1));
    let high = head.readUInt32BE(8 + 4 * first);
    const wanted = Buffer.from(sha, "hex");
    const id = Buffer.alloc(20);
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (readSync(fd, id, 0, 20, head.length + 20 * middle) !== 20) return false;
      const order = Buffer.compare(id, wanted);
      if (order === 0) return true;
      if (order < 0) low = middle + 1;
      else high = middle;
    }
    return false;
  } finally {
    closeSync(fd);
  }
}

// Does the checkout's object store name `sha`? Read from the files, without Git: a loose
// object, a pack index, or the same in a store this one borrows from (a worktree's shared
// folder, an alternate). It shows that an honest checkout is a clone of the repository; the
// comparison of the files does not lean on it.
function holdsObject(top, sha) {
  let gitDir = join(top, ".git");
  const marker = lstatSync(gitDir);
  if (marker.isFile()) {
    const pointer = /^gitdir: (.+)$/.exec(smallFile(gitDir).trim());
    if (!pointer) return false;
    gitDir = localFolder(top, pointer[1]);
  } else if (!marker.isDirectory()) return false;
  let shared = null;
  try {
    shared = smallFile(join(gitDir, "commondir")).trim();
  } catch {
    // not a linked worktree
  }
  if (shared !== null) gitDir = localFolder(gitDir, shared);
  if (gitDir === null) return false;
  const stores = [join(gitDir, "objects")];
  for (let i = 0; i < stores.length && i < 8; i += 1) {
    const store = stores[i];
    try {
      if (lstatSync(join(store, sha.slice(0, 2), sha.slice(2))).isFile()) return true;
    } catch {
      // not a loose object here
    }
    let packs = [];
    try {
      packs = readdirSync(join(store, "pack")).filter((name) => name.endsWith(".idx"));
    } catch {
      packs = [];
    }
    for (const name of packs) {
      try {
        if (inPackIndex(join(store, "pack", name), sha)) return true;
      } catch {
        // an index that cannot be read holds nothing
      }
    }
    let borrowed = "";
    try {
      borrowed = smallFile(join(store, "info", "alternates"));
    } catch {
      // no alternates
    }
    for (const line of borrowed.split(/\r?\n/)) {
      const other = line.trim() === "" ? null : localFolder(store, line.trim());
      if (other !== null) stores.push(other);
    }
  }
  return false;
}

// Every file or folder with an instruction file's name, in any spelling, and everything
// under a folder with a settings folder's name. `found` holds the paths under `top`;
// `outside` is true when one is reached through a link that leads out of the checkout or
// into its `.git`. A link to a folder inside the checkout is not entered: that folder is
// walked under its own path. The checkout's own `.git` is not entered.
function onDisk(top, inTime) {
  const found = [];
  let outside = false;
  const seen = new Set();
  const todo = [{ dir: top, rel: "", settings: false }];
  let folders = 0;
  while (todo.length > 0) {
    const { dir, rel, settings } = todo.pop();
    folders += 1;
    if (folders > MAX_FOLDERS) return null;
    if (folders % 500 === 0) inTime();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (rel === "" && entry.name === ".git") continue;
      const path = rel === null ? null : rel === "" ? entry.name : `${rel}/${entry.name}`;
      const name = entry.name.toLowerCase();
      const inSettings = settings || SETTINGS_FOLDERS.has(name);
      if (INSTRUCTION_FILES.has(name) || (inSettings && !entry.isDirectory())) {
        if (path === null) outside = true;
        else found.push(path);
      } else if (entry.isDirectory()) todo.push({ dir: join(dir, entry.name), rel: path, settings: inSettings });
      else if (entry.isSymbolicLink()) {
        let target;
        try {
          target = realpathSync(join(dir, entry.name));
          if (!statSync(target).isDirectory()) continue;
        } catch {
          continue; // a link that leads nowhere has nothing to read
        }
        if (fold(target) === fold(join(dir, entry.name))) {
          todo.push({ dir: target, rel: path, settings: inSettings }); // a folder that only looks like a link
          continue;
        }
        if (within(target, top) && !within(target, join(top, ".git"))) continue;
        if (seen.has(fold(target))) continue;
        seen.add(fold(target));
        todo.push({ dir: target, rel: null, settings: false });
      }
    }
  }
  return { found, outside };
}

// The same files at the head, as GitHub lists them: path to blob id, or to null for an
// entry that is not a file. A folder is listed too; only one with an instruction file's name
// is kept (as null).
function atHeadOf(json) {
  let listing;
  try {
    listing = JSON.parse(json);
  } catch {
    return null;
  }
  if (listing?.truncated !== false || !Array.isArray(listing.tree)) return null;
  const files = new Map();
  for (const entry of listing.tree) {
    if (typeof entry?.path !== "string") return null;
    const parts = entry.path.toLowerCase().split("/");
    const named = INSTRUCTION_FILES.has(parts.at(-1));
    if (!named && (entry.type === "tree" || !parts.some((part) => SETTINGS_FOLDERS.has(part)))) continue;
    files.set(entry.path, entry.type === "blob" && HEX.test(entry.sha) ? entry.sha : null);
  }
  return files;
}

function inner({ repo, checkout, home, gh, path, now, maxMs }) {
  if (!plainRepoName(repo)) return no("name");
  if (typeof checkout !== "string" || checkout === "") return no("checkout");
  const top = topOf(checkout);
  if (top === null) return no("checkout");
  const ask = gh ?? realGh(top, path);
  // One time limit for the whole check: each call gets what is left of it, 20 seconds at most.
  const end = now() + maxMs;
  const inTime = () => {
    const left = end - now();
    if (left <= 0) throw new TooSlow();
    return left;
  };
  const api = (route, more = []) => ask(["api", `repos/${OWNER}/${route}`, ...more, "--hostname", "github.com"], Math.min(20_000, inTime()));

  const head = api(`${repo}/commits/HEAD`, ["--jq", ".sha"]);
  const sha = head.status === 0 ? text(head).trim() : "";
  if (!HEX.test(sha)) return no("head-unread");

  let held;
  try {
    held = holdsObject(top, sha);
  } catch {
    held = false;
  }
  if (!held) return no("head-missing");

  const listing = api(`${repo}/git/trees/${sha}?recursive=1`);
  const atHead = listing.status === 0 ? atHeadOf(text(listing)) : null;
  if (atHead === null || atHead.size > MAX_FILES) return no("compare-failed");

  let disk;
  try {
    disk = onDisk(top, inTime);
  } catch (error) {
    if (error instanceof TooSlow) throw error;
    disk = null;
  }
  if (disk === null) return no("compare-failed");
  if (disk.outside || disk.found.length !== atHead.size) return no("differs");
  for (const path of disk.found) {
    const oid = atHead.get(path);
    if (!oid) return no("differs");
    const stat = lstatSync(join(top, path));
    if (!stat.isFile() || stat.size > MAX_BYTES) return no("differs");
    const blob = api(`${repo}/git/blobs/${oid}`, RAW);
    if (blob.status !== 0) return no("compare-failed");
    if (!sameText(readFileSync(join(top, path)), blob.stdout)) return no("differs");
  }

  let clone = null;
  try {
    clone = headOf(join(home, ...CLONE));
  } catch {
    clone = null;
  }
  const remote = api(`${COOKBOOK}/commits/main`, ["--jq", ".sha"]);
  const main = remote.status === 0 ? text(remote).trim() : "";
  if (clone === null || !HEX.test(main)) return no("cookbook-unread");
  return { start: true, cookbook: clone === main ? "same" : "differs" };
}

// `gh`, `path`, `now` and `maxMs` are for the tests: a function that takes gh's arguments and
// answers { status, stdout }, the folders to look for gh in, the clock and the time limit.
export function checkStart({ repo, checkout, home = homedir(), gh, path, now = Date.now, maxMs = MAX_MS } = {}) {
  try {
    return inner({ repo, checkout, home, gh, path, now, maxMs });
  } catch (error) {
    return no(error instanceof TooSlow ? "too-slow" : "failed");
  }
}

export function exitCode(result) {
  if (result?.start !== true) return 1;
  if (result.cookbook === "same") return 0;
  return result.cookbook === "differs" ? 3 : 1;
}

export function lines(result) {
  if (exitCode(result) === 1) return [PHRASES.no, Object.hasOwn(REASONS, result?.reason) ? REASONS[result.reason] : REASONS.failed];
  return [PHRASES.yes, result.cookbook === "same" ? PHRASES.same : PHRASES.differs];
}

const invoked = () => {
  try {
    return Boolean(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};

if (invoked()) {
  const args = process.argv.slice(2);
  const result = args.length === 1 || args.length === 2 ? checkStart({ repo: args[0], checkout: args[1] ?? process.cwd() }) : no("usage");
  process.stdout.write(`${lines(result).join("\n")}\n`);
  process.exitCode = exitCode(result);
}
