// Inventory for the daily update check: what is installed on this PC.
//
// `readInstalled` reads the installed version of one catalog part; `findUnlisted`
// lists what is on the PC but named by no part and no `ignored` entry.
//
// Node built-ins only. Everything that touches the disk or a process takes
// `{ home, run, gh }`: tests pass a fixture profile and fakes.
//
// Safety rules kept here:
// - Only `~/.claude/plugins/installed_plugins.json`, `known_marketplaces.json`,
//   the folder names and SKILL.md under `~/.claude/skills`, `~/.local/share`
//   and `~/.local/bin` are read. No credential file, no `.env`, nothing else.
// - The only commands that run are the fixed table's version commands (and
//   `claude mcp list` from `findUnlisted`), never with a shell.
// - A version that cannot be read is "unreadable" with a message: never "up to
//   date", never a guess.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { CONNECTION_CHECKS, VERSION_COMMANDS } from "./tables.mjs";
import { ghFile } from "./feeds.mjs";

// Also the timeout of `claude mcp list`, which checks every server's health: on
// 13 November 2026 it took 4.7 to 5.0 s on the owner's PC with nine servers.
export const COMMAND_TIMEOUT_MS = 15_000;
export const OUTPUT_LIMIT = 2_000; // bytes of a version command's output that are read
const MCP_LIST_LIMIT = 20_000;

const FOLDER = /^[a-zA-Z0-9._-]{1,80}$/;
const NPM_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const PLUGIN_ID = /^[a-zA-Z0-9._-]{1,80}@[a-zA-Z0-9._-]{1,80}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SCRIPT_EXT = /\.(exe|cmd|bat|com|ps1|mjs|js|sh)$/i;

const cause = (e) => String(e?.message ?? e).split("\n")[0].slice(0, 180) || "unreadable";
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// A version or commit read from disk: at most 100 characters, no control characters.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;
const cleanText = (v) => (typeof v === "string" && v.length > 0 && v.length <= 100 && !CONTROL.test(v) ? v : null);
const unreadable = (message) => ({ state: "unreadable", message: String(message).slice(0, 180) });
const notFound = (message) => ({ state: "not-found", message });

// "v0.8.0" -> "0.8.0"; "boat 1.0.97" -> "1.0.97"; "git version 2.56.1.windows.1" ->
// "2.56.1.windows.1". Returns "" when the text holds no version.
export function normalizeVersion(text) {
  const m = /\d+(?:\.\d+)+(?:\.[A-Za-z0-9]+)*(?:-[0-9A-Za-z.]+)?/.exec(String(text ?? ""));
  return m ? m[0] : "";
}

// The real `run`: `(argv, { timeoutMs, maxBytes, home, input?, env? }) -> { code, stdout, stderr,
// timedOut?, truncated? }`.
// - No shell: on Windows a command must be a real executable (a `.exe` found on
//   PATH); a `.cmd` or `.bat` shim cannot be started this way and comes back as
//   a spawn failure (code -1).
// - It always runs in `<home>/.local/share/stack-updates` (created if missing),
//   never the caller's folder, and with the process environment minus every
//   `GIT_*` variable and `NODE_OPTIONS`.
// - `env` (optional) changes that environment for this child only: a name set
//   to null is removed (in any letter case), a string value is set. Any other
//   value (undefined, a number, an object) throws a TypeError.
// - `input` (optional) is written to the child's stdin, which is then closed.
//   Without it the child's stdin is empty.
// - Each of stdout and stderr is read up to `maxBytes` bytes. More output stops
//   the process and sets `truncated: true` (not a timeout).
// - A timeout stops the process (on Windows its whole tree) and returns
//   `code: null, timedOut: true`.
export function runEnv(env = process.env, extra = {}) {
  extra = extra ?? {};
  for (const [k, v] of Object.entries(extra)) {
    if (v !== null && typeof v !== "string") throw new TypeError(`env ${k}: a string or null, not ${typeof v}`);
  }
  const changed = new Set(Object.keys(extra).map((k) => k.toUpperCase()));
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    const up = k.toUpperCase();
    if (up.startsWith("GIT_") || up === "NODE_OPTIONS" || changed.has(up)) continue;
    out[k] = v;
  }
  for (const [k, v] of Object.entries(extra)) if (typeof v === "string") out[k] = v;
  return out;
}

function stopTree(child) {
  try {
    if (process.platform === "win32" && child.pid) {
      const k = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
      k.on("error", () => {});
    }
  } catch { /* fall through to the plain kill */ }
  try { child.kill(); } catch { /* already gone */ }
}

export function defaultRun(argv, { timeoutMs = COMMAND_TIMEOUT_MS, maxBytes = OUTPUT_LIMIT, home = homedir(), input, env } = {}) {
  return new Promise((resolve) => {
    let cwd;
    try {
      cwd = join(home, ".local", "share", "stack-updates");
      mkdirSync(cwd, { recursive: true });
    } catch (e) {
      return resolve({ code: -1, stdout: "", stderr: `cannot create the working folder: ${cause(e)}` });
    }
    let settled = false, timedOut = false, truncated = false;
    const bufs = { out: [], err: [] };
    const sizes = { out: 0, err: 0 };
    const finish = (code, extra = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const text = (k) => Buffer.concat(bufs[k]).toString("utf8");
      const result = { code, stdout: text("out"), stderr: extra || text("err") };
      if (timedOut) result.timedOut = true;
      if (truncated) result.truncated = true;
      resolve(result);
    };
    let child;
    try {
      const stdin = typeof input === "string" ? "pipe" : "ignore";
      child = spawn(argv[0], argv.slice(1), { shell: false, windowsHide: true, cwd, env: runEnv(process.env, env), stdio: [stdin, "pipe", "pipe"] });
    } catch (e) {
      return resolve({ code: -1, stdout: "", stderr: cause(e) });
    }
    if (child.stdin) {
      child.stdin.on("error", () => {}); // a child that exits without reading its input is not an error here
      child.stdin.end(input, "utf8");
    }
    const timer = setTimeout(() => {
      timedOut = true;
      stopTree(child);
      finish(null, `timed out after ${Math.round(timeoutMs / 1000)} s`);
    }, timeoutMs);
    const take = (k) => (d) => {
      const room = maxBytes - sizes[k];
      if (d.length > room) {
        truncated = true;
        if (room > 0) { bufs[k].push(d.subarray(0, room)); sizes[k] += room; }
        stopTree(child);
      } else {
        bufs[k].push(d);
        sizes[k] += d.length;
      }
    };
    child.stdout.on("data", take("out"));
    child.stderr.on("data", take("err"));
    child.on("error", (e) => finish(-1, cause(e)));
    child.on("close", (code) => finish(timedOut ? null : code));
  });
}

// ---- small readers ---------------------------------------------------------

async function readJson(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    if (e?.code === "ENOENT" || e?.code === "ENOTDIR") return { missing: true };
    throw e;
  }
  return { value: JSON.parse(text) };
}
const exists = (path) => stat(path).then(() => true, () => false);
const isDir = (path) => stat(path).then((s) => s.isDirectory(), () => false);

async function names(dir) {
  try {
    return await readdir(dir);
  } catch (e) {
    if (e?.code === "ENOENT" || e?.code === "ENOTDIR") return [];
    throw e;
  }
}

// ---- readInstalled ---------------------------------------------------------

// `{share}` in a table argv element means <home>/.local/share. It is the only
// substitution, and it exists only in the fixed table, never in the catalog.
export const expandShare = (argv, home) => argv.map((a) => (a.includes("{share}") ? normalize(a.replaceAll("{share}", join(home, ".local", "share"))) : a));

// The connection checks add two tokens: `{bin}` is <home>/.local/bin and `{lib}` is
// the plugin's scripts/lib folder (passed in by the caller). Same rule: fixed
// tables only, never the catalog.
const LIB = dirname(fileURLToPath(import.meta.url));
export const expandTokens = (argv, home, lib) =>
  expandShare(argv, home).map((a) => (/{(bin|lib)}/.test(a) ? normalize(a.replaceAll("{bin}", join(home, ".local", "bin")).replaceAll("{lib}", lib ?? "{lib}")) : a));


async function readPlugin(installed, home) {
  if (!PLUGIN_ID.test(String(installed.id))) return unreadable("the plugin id must be plugin@marketplace");
  const reg = await readJson(join(home, ".claude", "plugins", "installed_plugins.json"));
  if (reg.missing) return notFound("installed_plugins.json does not exist");
  const entries = isObject(reg.value?.plugins) ? reg.value.plugins[installed.id] : undefined;
  if (!Array.isArray(entries) || entries.length === 0) return notFound(`${installed.id} is not in the plugin registry`);
  const entry = entries.find((e) => e?.scope === "user") ?? entries[0];
  const version = cleanText(entry?.version);
  if (!version) return unreadable(`${installed.id} has no usable version in the registry`);
  const out = { state: "read", version };
  if (entry.gitCommitSha !== undefined) {
    const commit = cleanText(entry.gitCommitSha);
    if (!commit) return unreadable(`${installed.id} has an unusable commit in the registry`);
    out.commit = commit;
  }
  return out;
}

async function readPinned(installed, home) {
  if (!FOLDER.test(String(installed.folder)) || installed.folder === "." || installed.folder === "..")
    return unreadable("the pinned folder must be a plain folder name");
  if (!NPM_NAME.test(String(installed.package))) return unreadable("the pinned package must be an npm package name");
  const lock = await readJson(join(home, ".local", "share", installed.folder, "package-lock.json"));
  if (lock.missing) return notFound(`no package-lock.json in ~/.local/share/${installed.folder}`);
  const version = lock.value?.packages?.[`node_modules/${installed.package}`]?.version;
  if (version === undefined) return notFound(`${installed.package} is not in that lockfile`);
  if (!cleanText(version)) return unreadable(`${installed.package} has no usable version in the lockfile`);
  return { state: "read", version };
}

async function readCommand(key, run, home) {
  const entry = Object.hasOwn(VERSION_COMMANDS, key) ? VERSION_COMMANDS[key] : undefined;
  if (!entry) return unreadable(`no version command is listed for ${key}`);
  let result;
  try {
    result = await run(expandTokens(entry.argv, home, LIB), { timeoutMs: COMMAND_TIMEOUT_MS, home });
  } catch (e) {
    return unreadable(`${entry.argv[0]} could not run: ${cause(e)}`);
  }
  const first = (s) => String(s ?? "").trim().split("\n")[0].slice(0, 120);
  if (result?.timedOut) return unreadable(`${entry.argv[0]} timed out after ${COMMAND_TIMEOUT_MS / 1000} s`);
  if (result?.truncated && result?.code !== 0 && !entry.pattern.test(String(result.stdout ?? "").slice(0, OUTPUT_LIMIT)))
    return unreadable(`the output of ${entry.argv[0]} was cut at ${OUTPUT_LIMIT} bytes before a version`);
  if (result?.code !== 0 && !result?.truncated)
    return unreadable(result?.code == null ? `${entry.argv[0]}: ${first(result?.stderr) || "timed out"}` : `${entry.argv[0]} exited with exit ${result.code}: ${first(result.stderr)}`);
  const stdout = String(result.stdout ?? "").slice(0, OUTPUT_LIMIT);
  const m = entry.pattern.exec(stdout);
  const version = m ? normalizeVersion(m[1] ?? m[0]) : "";
  // A 40-character hex id is a git commit, not a version.
  if (/^[0-9a-f]{40}$/.test(m?.[1] ?? "")) return { state: "read", commit: m[1] };
  return version ? { state: "read", version } : unreadable(`no version found in the output of ${entry.argv[0]}`);
}

async function readSkill(installed, home) {
  if (!FOLDER.test(String(installed.folder)) || installed.folder === "." || installed.folder === "..")
    return unreadable("the skill folder must be a plain folder name");
  let body;
  try {
    body = await readFile(join(home, ".claude", "skills", installed.folder, "SKILL.md"));
  } catch (e) {
    if (e?.code === "ENOENT" || e?.code === "ENOTDIR") return notFound(`no SKILL.md in ~/.claude/skills/${installed.folder}`);
    throw e;
  }
  return { state: "read", version: createHash("sha256").update(body).digest("hex").slice(0, 16) };
}

async function readProject(installed, gh) {
  if (!REPO.test(String(installed.repository))) return unreadable("the repository must be owner/name");
  if (!NPM_NAME.test(String(installed.package))) return unreadable("the package must be an npm package name");
  const text = await ghFile(gh, installed.repository, "package-lock.json");
  const version = JSON.parse(text)?.packages?.[`node_modules/${installed.package}`]?.version;
  if (version === undefined) return notFound(`${installed.package} is not in the lockfile of ${installed.repository}`);
  if (!cleanText(version)) return unreadable(`${installed.package} has no usable version in that lockfile`);
  return { state: "read", version };
}

// `Installed = { state: "read" | "not-found" | "unreadable" | "hosted" | "none",
// version?, commit?, message? }`. Never throws.
export async function readInstalled(installed, key, { home, run, gh } = {}) {
  try {
    switch (installed?.kind) {
      case "plugin": return await readPlugin(installed, home);
      case "pinned": return await readPinned(installed, home);
      case "command": return await readCommand(key, run, home);
      case "skill": return await readSkill(installed, home);
      case "project": return await readProject(installed, gh);
      case "hosted": return { state: "hosted" };
      case "none": return { state: "none" };
      default: return unreadable(`unknown installed kind ${String(installed?.kind).slice(0, 40)}`);
    }
  } catch (e) {
    return unreadable(cause(e));
  }
}

// ---- findUnlisted ----------------------------------------------------------

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");
const stemOf = (file) => file.replace(SCRIPT_EXT, "");

function named(catalog) {
  const sets = {
    pluginIds: new Set(), pluginNames: new Set(), marketplaces: new Set(), skills: new Set(),
    pinned: new Set(), servers: new Set(), toolWords: new Set(), binWords: new Set(),
    ignored: new Set((catalog.ignored ?? []).map((g) => norm(g.name))),
  };
  for (const t of catalog.tools ?? []) {
    sets.toolWords.add(norm(t.id));
    sets.toolWords.add(norm(t.name));
    sets.binWords.add(norm(t.id));
    for (const p of t.parts ?? []) {
      const i = p.installed ?? {};
      if (i.kind === "plugin" && typeof i.id === "string") {
        sets.pluginIds.add(i.id);
        const [name, market] = i.id.split("@");
        sets.pluginNames.add(norm(name));
        sets.marketplaces.add(norm(market));
      }
      if (i.kind === "skill") sets.skills.add(i.folder);
      if (i.kind === "pinned") {
        sets.pinned.add(i.folder);
        if (i.package) sets.binWords.add(norm(i.package));
      }
      if (i.kind === "hosted" && i.server) sets.servers.add(norm(i.server));
    }
  }
  // Every executable the fixed table runs counts as listed (base name, no extension).
  for (const { argv } of Object.values(VERSION_COMMANDS)) {
    // A `{share}/<folder>/...` binary makes that ~/.local/share folder listed.
    for (const a of argv) {
      const m = /^\{share\}[\\/]+([^\\/]+)/.exec(a);
      if (m) sets.pinned.add(m[1]);
    }
    sets.binWords.add(norm(stemOf(argv[0].split(/[\/]/).pop())));
  }
  // So does every shim a connection check starts through `cmd.exe /d /c {bin}/<name>.cmd`
  // (the `google` launcher of gws). A check's other argv[0] (gh, depot, node) is already
  // a version-table executable; a test keeps it that way.
  for (const { argv } of Object.values(CONNECTION_CHECKS)) {
    if (argv[0] === "cmd.exe") sets.binWords.add(norm(stemOf(String(argv[3]).split(/[\/]/).pop())));
  }
  return sets;
}

// A bin is listed only on an exact match of its base name: a tool id, a pinned
// part's package, or the executable of a table command.
const covers = (words, stem) => words.has(norm(stem));

// Parse `claude mcp list` lines ("<name>: <target> - <status>") into names. The name
// ends at the first ": " (colon and space): a plugin's server is "plugin:<plugin>:<server>".
function mcpNames(text) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const t = line.trim();
    const colon = t.indexOf(": ");
    if (colon > 0 && /\S/.test(t.charAt(colon + 2))) out.push(t.slice(0, colon));
  }
  return out;
}

// Everything found on the PC that no part and no `ignored` entry names. The
// result is `{ items: { kind, name }[], unreadable: string[] }`; `unreadable` lists
// the sources that could not be read.
export async function findUnlisted(catalog, { home, run } = {}) {
  const sets = named(catalog);
  const found = [];
  const unreadableSources = [];
  const add = (kind, name, ...also) => {
    if (sets.ignored.has(norm(name)) || also.some((a) => sets.ignored.has(norm(a)))) return;
    found.push({ kind, name });
  };
  const guard = async (label, fn) => {
    try { await fn(); } catch (e) { unreadableSources.push(`${label}: ${cause(e)}`); }
  };

  await guard("plugin registry", async () => {
    const reg = await readJson(join(home, ".claude", "plugins", "installed_plugins.json"));
    for (const id of Object.keys(reg.value?.plugins ?? {}))
      if (!sets.pluginIds.has(id)) add("plugin", id, id.split("@")[0]);
  });
  await guard("marketplaces", async () => {
    const reg = await readJson(join(home, ".claude", "plugins", "known_marketplaces.json"));
    for (const name of Object.keys(reg.value ?? {}))
      if (!sets.marketplaces.has(norm(name))) add("marketplace", name);
  });
  await guard("skills", async () => {
    const dir = join(home, ".claude", "skills");
    for (const name of await names(dir))
      if (!sets.skills.has(name) && (await exists(join(dir, name, "SKILL.md")))) add("skill", name);
  });
  await guard("pinned folders", async () => {
    const dir = join(home, ".local", "share");
    for (const name of await names(dir)) {
      if (sets.pinned.has(name) || !(await isDir(join(dir, name)))) continue;
      const marked = (await Promise.all(["package-lock.json", "PROVENANCE", "SHA256SUMS"].map((f) => exists(join(dir, name, f))))).some(Boolean);
      if (marked) add("pinned", name);
    }
  });
  await guard("bin", async () => {
    const dir = join(home, ".local", "bin");
    const seen = new Set();
    for (const file of await names(dir)) {
      const stem = stemOf(file);
      if (seen.has(norm(stem)) || covers(sets.binWords, stem)) continue;
      if (sets.ignored.has(norm(file)) || sets.ignored.has(norm(stem))) continue;
      // Skip a twin of an ignored sibling file (an ignored `x.exe` also covers `x.cmd`).
      seen.add(norm(stem));
      found.push({ kind: "bin", name: stem });
    }
  });

  let mcp;
  try {
    mcp = await run(["claude", "mcp", "list"], { timeoutMs: COMMAND_TIMEOUT_MS, maxBytes: MCP_LIST_LIMIT, home });
  } catch (e) {
    mcp = { code: -1, stdout: "", stderr: cause(e) };
  }
  if (mcp?.timedOut) {
    unreadableSources.push("claude mcp list: timed out");
  } else if (mcp?.truncated) {
    unreadableSources.push(`claude mcp list: output cut at ${MCP_LIST_LIMIT} bytes`);
  } else if (mcp?.code !== 0) {
    unreadableSources.push(`claude mcp list: ${String(mcp?.stderr ?? "").trim().split("\n")[0].slice(0, 120) || (mcp?.code == null ? "timed out" : `exit ${mcp?.code}`)}`);
  } else {
    for (const name of mcpNames(mcp.stdout)) {
      const n = norm(name);
      const plugin = /^plugin:([^:]+):/.exec(name);
      const connector = /^claude\.ai (.+)$/.exec(name);
      const covered =
        sets.servers.has(n) ||
        sets.toolWords.has(n) ||
        (plugin && (sets.pluginNames.has(norm(plugin[1])) || sets.toolWords.has(norm(plugin[1])))) ||
        (connector && (sets.servers.has(norm(connector[1])) || sets.toolWords.has(norm(connector[1]))));
      if (!covered) add("mcp", name);
    }
  }
  return { items: found, unreadable: unreadableSources };
}
