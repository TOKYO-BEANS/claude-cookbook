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
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { VERSION_COMMANDS } from "./tables.mjs";
import { ghFile } from "./feeds.mjs";

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
const unreadable = (message) => ({ state: "unreadable", message: String(message).slice(0, 180) });
const notFound = (message) => ({ state: "not-found", message });

// "v0.8.0" -> "0.8.0"; "boat 1.0.97" -> "1.0.97"; "git version 2.56.1.windows.1" ->
// "2.56.1.windows.1". Returns "" when the text holds no version.
export function normalizeVersion(text) {
  const m = /\d+(?:\.\d+)+(?:\.[A-Za-z0-9]+)*(?:-[0-9A-Za-z.]+)?/.exec(String(text ?? ""));
  return m ? m[0] : "";
}

// The real `run`: `(argv, { timeoutMs, maxBytes }) -> { code, stdout, stderr }`.
// No shell: on Windows a command must be a real executable (a `.exe` found on
// PATH); a `.cmd` or `.bat` shim cannot be started this way and comes back as
// a spawn failure (code -1). Output past `maxBytes` is dropped and the process
// is stopped. A timeout returns code null.
export function defaultRun(argv, { timeoutMs = COMMAND_TIMEOUT_MS, maxBytes = OUTPUT_LIMIT } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let out = "", err = "", timedOut = false;
    const finish = (code, extra = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout: out, stderr: (extra || err).slice(0, maxBytes) });
    };
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      return resolve({ code: -1, stdout: "", stderr: cause(e) });
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      finish(null, `timed out after ${Math.round(timeoutMs / 1000)} s`);
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      if (out.length < maxBytes) out += d.toString("utf8").slice(0, maxBytes - out.length);
      else child.kill();
    });
    child.stderr.on("data", (d) => {
      if (err.length < maxBytes) err += d.toString("utf8").slice(0, maxBytes - err.length);
    });
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

async function readPlugin(installed, home) {
  if (!PLUGIN_ID.test(String(installed.id))) return unreadable("the plugin id must be plugin@marketplace");
  const reg = await readJson(join(home, ".claude", "plugins", "installed_plugins.json"));
  if (reg.missing) return notFound("installed_plugins.json does not exist");
  const entries = isObject(reg.value?.plugins) ? reg.value.plugins[installed.id] : undefined;
  if (!Array.isArray(entries) || entries.length === 0) return notFound(`${installed.id} is not in the plugin registry`);
  const entry = entries.find((e) => e?.scope === "user") ?? entries[0];
  if (typeof entry?.version !== "string" || !entry.version) return unreadable(`${installed.id} has no version in the registry`);
  const out = { state: "read", version: entry.version };
  if (typeof entry.gitCommitSha === "string" && entry.gitCommitSha) out.commit = entry.gitCommitSha;
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
  if (typeof version !== "string" || !version) return unreadable(`${installed.package} has no version in the lockfile`);
  return { state: "read", version };
}

async function readCommand(key, run) {
  const entry = Object.hasOwn(VERSION_COMMANDS, key) ? VERSION_COMMANDS[key] : undefined;
  if (!entry) return unreadable(`no version command is listed for ${key}`);
  let result;
  try {
    result = await run(entry.argv, { timeoutMs: COMMAND_TIMEOUT_MS });
  } catch (e) {
    return unreadable(`${entry.argv[0]} could not run: ${cause(e)}`);
  }
  const first = (s) => String(s ?? "").trim().split("\n")[0].slice(0, 120);
  if (result?.code !== 0)
    return unreadable(result?.code == null ? `${entry.argv[0]}: ${first(result?.stderr) || "timed out"}` : `${entry.argv[0]} exited with exit ${result.code}: ${first(result.stderr)}`);
  const stdout = String(result.stdout ?? "").slice(0, OUTPUT_LIMIT);
  const m = entry.pattern.exec(stdout);
  const version = m ? normalizeVersion(m[1] ?? m[0]) : "";
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
  if (typeof version !== "string" || !version) return unreadable(`${installed.package} has no version in that lockfile`);
  return { state: "read", version };
}

// `Installed = { state: "read" | "not-found" | "unreadable" | "hosted" | "none",
// version?, commit?, message? }`. Never throws.
export async function readInstalled(installed, key, { home, run, gh } = {}) {
  try {
    switch (installed?.kind) {
      case "plugin": return await readPlugin(installed, home);
      case "pinned": return await readPinned(installed, home);
      case "command": return await readCommand(key, run);
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
    sets.binWords.add(norm(t.name));
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
        sets.binWords.add(norm(i.folder));
        sets.binWords.add(norm(String(i.folder).replace(/-cli$/, "")));
      }
      if (i.kind === "hosted" && i.server) sets.servers.add(norm(i.server));
      if (i.kind === "command") {
        const cmd = VERSION_COMMANDS[`${t.id}/${p.name}`]?.argv[0];
        if (cmd) sets.binWords.add(norm(cmd));
      }
    }
  }
  return sets;
}

const covers = (words, stem) => {
  const s = norm(stem);
  for (const w of words) if (w && (s === w || s.startsWith(`${w}-`))) return true;
  return false;
};

// Parse `claude mcp list` lines ("<name>: <target> - <status>") into names.
function mcpNames(text) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const m = /^([^\s:][^:]*?): \S/.exec(line.trim());
    if (m) out.push(m[1]);
  }
  return out;
}

// Everything found on the PC that no part and no `ignored` entry names. The
// returned array also carries `unreadable`: sources that could not be read.
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
    mcp = await run(["claude", "mcp", "list"], { timeoutMs: COMMAND_TIMEOUT_MS, maxBytes: MCP_LIST_LIMIT });
  } catch (e) {
    mcp = { code: -1, stdout: "", stderr: cause(e) };
  }
  if (mcp?.code !== 0) {
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
        (connector && sets.toolWords.has(norm(connector[1])));
      if (!covered) add("mcp", name);
    }
  }
  found.unreadable = unreadableSources;
  return found;
}
