// The sanitized copy the AgentShield scan reads (recipes/agent-audit.md). The scanner never
// sees the live configuration: this module copies a fixed list of configuration files into
// a new folder, takes credential values out on the way, and then checks the whole folder
// again. Nothing here reads a credential store, a session transcript or an .env file: a
// file is copied only when the list below names it.
//
// The layout is the one AgentShield 1.6.0 discovers. It reads a skill only as a file directly
// inside a `skills` folder, and never walks into `.claude`, so every skill gets a folder of
// its own (`<skill>/.claude/skills/SKILL.md`) and plugins sit outside `.claude`:
//   home/.claude/{CLAUDE.md,settings*.json,agents,commands,rules,hooks}   home/.claude.json
//   home/.claude/mcp-configs/local-<project>.json      (servers added for one project)
//   skills/personal/<skill>/.claude/skills/SKILL.md
//   plugins/<marketplace>/<plugin>/...                 (manifest, .mcp.json, hooks, agents, commands, skills)
//   projects/<folder>/...                              (instruction files, .mcp.json, .claude settings)
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync,
} from "node:fs";
import path from "node:path";

export const REDACTED = "<redacted>";
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 5000;
const TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".json", ".jsonc", ".sh", ".bash", ".zsh", ".js", ".cjs", ".mjs", ".ts", ".cts", ".mts",
  ".py", ".rb", ".toml", ".yaml", ".yml", ".txt", ".mdc", ".cmd", ".ps1", "",
]);
// Never copied, whatever names them: a credential store, an .env file, a key file.
const DENIED_NAME = /^(\.credentials\.json|credentials(\.json)?|auth\.json|\.secrets|\.env(\..*)?|\.npmrc|\.netrc|\.pgpass|.*\.dpapi|.*\.pem|.*\.key|.*\.p12|.*\.pfx|id_[a-z0-9]+)$/i;
const DENIED_PATH = /[\\/](\.ssh|\.gnupg|\.aws|\.kube|\.docker|\.config|keyrings|sessions|session-env|file-history|shell-snapshots|\.claude[\\/]projects)[\\/]/i;

// Credential shapes. Each is replaced by `<masked:name>`; checkCopy() looks for the same
// shapes in the finished folder, and one that is still there stops the scan. Every pattern
// reads a text in one pass: none has an open-ended part before its fixed start.
export const SECRET_PATTERNS = [
  ["private-key", /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]{0,40}PRIVATE KEY-----|$)/g],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ["sk-key", /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{24,}/g],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g],
  ["gitlab-token", /\bglpat-[A-Za-z0-9_-]{20,}/g],
  ["huggingface-token", /\bhf_[A-Za-z0-9]{30,}/g],
  ["aws-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/g],
  ["google-key", /\bAIza[0-9A-Za-z_-]{35}/g],
  ["stripe-key", /\b[sr]k_(?:live|test)_[A-Za-z0-9]{20,}/g],
  ["sendgrid-key", /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g],
  ["npm-token", /\bnpm_[A-Za-z0-9]{36}\b/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ["bearer", /\bBearer\s{1,4}[A-Za-z0-9._~+/-]{24,}=*/g],
  ["url-credentials", /(?<![A-Za-z0-9+.-])[a-z][a-z0-9+.-]{0,20}:\/\/[^\s/:@"'<>]{1,200}:[^\s/@"'<>]{1,200}@/gi],
];
// `name = value` where the name says it is a secret and the value is long and mixed.
const ASSIGNED = /((?:api[_-]?key|secret|token|passw(?:or)?d|credential|[_-]key|\bkey|auth)[A-Za-z0-9_-]{0,40})(["']?\s{0,4}[:=]\s{0,4}["']?)([A-Za-z0-9+/_.=-]{16,})/gi;
const mixed = (v) => /[0-9]/.test(v) && /[A-Za-z]/.test(v) && !/^[a-z]+(?:[._/-][a-z0-9]+)+$/.test(v);
// Any other long run of key characters that looks random: digits with both cases of
// letters, or a long hexadecimal number. Words joined by `-` or `_` are left alone.
const LONG = /(?<![A-Za-z0-9_+-])[A-Za-z0-9_+-]{24,}(?![A-Za-z0-9_+-])/g;
const random = (v) => {
  if (/^[a-f0-9]{32,}$/i.test(v)) return /[0-9]/.test(v) && /[a-f]/i.test(v);
  if (!(/[0-9]/.test(v) && /[a-z]/.test(v) && /[A-Z]/.test(v))) return false;
  return !v.split(/[-_]/).every((part) => part.length <= 16 && (/^[A-Za-z]*$/.test(part) || /^[0-9]*$/.test(part)));
};
const SECRET_KEY = /(token|secret|passw(or)?d|api[_-]?key|authorization|credential|cookie|private[_-]?key|(^|[_-])key$|(^|[_-])auth$)/i;
const CAMEL_KEY = /[a-z](Key|Auth)$/;
const secretName = (key) => SECRET_KEY.test(key) || CAMEL_KEY.test(key);
const SECRET_FLAG = /^--?[A-Za-z0-9-]*(?:key|token|secret|passw(?:or)?d|auth|credential)[A-Za-z0-9-]*$/i;
const SECRET_FLAG_VALUE = /^(--?[A-Za-z0-9-]*(?:key|token|secret|passw(?:or)?d|auth|credential)[A-Za-z0-9-]*=)./i;

// Text with every credential shape replaced. `counts` gets one entry per shape found.
export function maskText(text, counts = {}) {
  const count = (name) => { counts[name] = (counts[name] ?? 0) + 1; return `<masked:${name}>`; };
  const once = (input) => {
    let out = input;
    for (const [name, pattern] of SECRET_PATTERNS) out = out.replace(new RegExp(pattern.source, pattern.flags), () => count(name));
    out = out.replace(ASSIGNED, (all, key, sep, value) => (mixed(value) ? `${key}${sep}${count("assigned-secret")}` : all));
    return out.replace(LONG, (value) => (random(value) ? count("long-random") : value));
  };
  // A second pass only when a replacement left a new shape behind (what is left of a value).
  let out = once(text);
  for (let pass = 0; pass < 3 && shapesIn(out).length; pass += 1) out = once(out);
  return out;
}

// The credential shapes still present in a text: the names, empty when it is clean.
export function shapesIn(text) {
  const found = [];
  for (const [name, pattern] of SECRET_PATTERNS) if (new RegExp(pattern.source, pattern.flags).test(text)) found.push(name);
  for (const m of text.matchAll(ASSIGNED)) if (mixed(m[3])) { found.push("assigned-secret"); break; }
  for (const m of text.matchAll(LONG)) if (random(m[0])) { found.push("long-random"); break; }
  return found;
}

// A URL without its user, password, query and fragment, and without a key in its path.
const cleanUrl = (value, counts) => {
  try {
    const u = new URL(value);
    u.username = ""; u.password = ""; u.search = ""; u.hash = "";
    u.pathname = u.pathname.split("/").map((part) => {
      if (part.length < 16 || !mixed(part)) return part;
      counts["url-path-key"] = (counts["url-path-key"] ?? 0) + 1;
      return "masked-url-path-key";
    }).join("/");
    return u.toString();
  } catch { return value; }
};

// A parsed JSON value with the credential values taken out. Every `env` and `headers`
// entry keeps its name and loses its value (a plain number or true/false stays); a key
// whose name says it is a secret loses its value; an argument after a flag that names a
// secret loses its value; every other string goes through maskText.
export function redactJson(value, counts = {}, key = "") {
  const hit = (name) => { counts[name] = (counts[name] ?? 0) + 1; return REDACTED; };
  if (typeof value === "string") {
    if (key && secretName(key)) return hit("secret-key-name");
    const masked = key === "url" || /^https?:\/\//i.test(value) ? maskText(cleanUrl(value, counts), counts) : maskText(value, counts);
    // The second look reads the file as text, where a name and its value stand together.
    return key && shapesIn(JSON.stringify({ [key]: masked })).length ? hit("assigned-secret") : masked;
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => {
      if (typeof v !== "string") return redactJson(v, counts, "");
      if (i > 0 && typeof value[i - 1] === "string" && SECRET_FLAG.test(value[i - 1])) return hit("secret-flag-value");
      const flag = SECRET_FLAG_VALUE.exec(v);
      if (flag) { hit("secret-flag-value"); return `${flag[1]}${REDACTED}`; }
      return redactJson(v, counts, "");
    });
  }
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if ((k === "env" || k === "headers") && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = Object.fromEntries(Object.entries(v).map(([name, held]) =>
        [maskText(name, counts), typeof held === "string" && !/^(\d{1,12}|true|false)$/i.test(held) ? hit(`${k}-value`) : redactJson(held, counts, name)]));
    } else {
      out[maskText(k, counts)] = redactJson(v, counts, k);
    }
  }
  return out;
}

// A file's text as it goes into the copy, or null when it must not go in. JSON is redacted
// by structure, and a .json file that cannot be parsed is left out: as plain text it
// would keep the values its structure hides. Every other file is masked by shape.
export function sanitizeText(name, text, counts = {}) {
  if (/\.jsonc?$/i.test(name)) {
    try { return JSON.stringify(redactJson(JSON.parse(text), counts), null, 2) + "\n"; } catch { return null; }
  }
  return maskText(text, counts);
}

const safeName = (name) => String(name).replace(/[^A-Za-z0-9._@+-]/g, "_").replace(/^\.+$/, "_").slice(0, 80) || "_";
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const list = (p) => { try { return readdirSync(p).sort(); } catch { return []; } };

// Builds the copy in `dest` (which must not exist yet) and returns what it did:
// { files, masked: [{ file, counts }], skipped: [{ file, why }] }.
export function buildCopy({ home, projectRoots = [], dest }) {
  if (existsSync(dest)) throw new Error(`the copy folder already exists: ${dest}`);
  mkdirSync(dest, { recursive: true });
  const result = { files: 0, masked: [], skipped: [] };

  const write = (target, text, counts) => {
    if (result.files >= MAX_FILES) throw new Error(`more than ${MAX_FILES} files to copy: the list of sources is wrong`);
    const full = path.join(dest, target);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
    result.files += 1;
    if (Object.keys(counts).length) result.masked.push({ file: target.split(path.sep).join("/"), counts });
  };
  const within = (base, real) => { const rel = path.relative(base, real); return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)); };
  const real = (p) => { try { return realpathSync(p); } catch { return null; } };
  // One file. A link is followed only to a file of the same name, and, where `base` is
  // given, only inside that folder: a link never brings in another kind of file.
  const put = (source, target, { transform, base } = {}) => {
    const rel = target.split(path.sep).join("/");
    const file = real(source);
    if (!file || !isFile(file)) return;
    const skip = (why) => { result.skipped.push({ file: rel, why }); };
    if (DENIED_NAME.test(path.basename(file)) || DENIED_NAME.test(path.basename(source)) || DENIED_PATH.test(file)) return skip("a credential or session path");
    if (path.basename(file) !== path.basename(source)) return skip("a link to a file of another name");
    if (base && !within(real(base) ?? base, file)) return skip("a link out of its folder");
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) return skip("not a text file");
    if (statSync(file).size > MAX_FILE_BYTES) return skip("larger than 512 KB");
    const counts = {};
    const raw = readFileSync(file, "utf8");
    if (raw.includes("\0")) return skip("not a text file");
    const text = transform ? transform(raw, counts) : sanitizeText(path.basename(target), raw, counts);
    if (text === null) return skip("not valid JSON");
    write(target, text, counts);
  };
  // The files directly in a folder, and with `deep` the folders below it (a hooks folder).
  // The folder and everything read from it stay inside `base`; a linked folder is not entered.
  const putDir = (source, target, base, deep = false, depth = 0) => {
    if (!isDir(source) || depth > 6) return;
    const dir = real(source);
    if (!dir || !within(real(base) ?? base, dir) || DENIED_PATH.test(dir + path.sep)) { result.skipped.push({ file: target.split(path.sep).join("/"), why: "a linked folder" }); return; }
    for (const name of list(source)) {
      const from = path.join(source, name);
      if (isDir(from)) {
        if (!deep || name === "node_modules" || name === ".git") continue;
        if (lstatSync(from).isSymbolicLink()) { result.skipped.push({ file: path.join(target, safeName(name)).split(path.sep).join("/"), why: "a linked folder" }); continue; }
        putDir(from, path.join(target, safeName(name)), base, true, depth + 1);
      } else put(from, path.join(target, safeName(name)), { base });
    }
  };
  // Every `<name>/SKILL.md` below a skills folder, each as a root of its own. A skill folder
  // may be a link (a shared skill); only its SKILL.md is read.
  const putSkills = (source, target) => {
    for (const name of list(source)) put(path.join(source, name, "SKILL.md"), path.join(target, safeName(name), ".claude", "skills", "SKILL.md"));
  };
  const putAgentFolders = (source, target) => {
    for (const sub of ["agents", "commands", "rules"]) putDir(path.join(source, sub), path.join(target, sub), source);
    putDir(path.join(source, "hooks"), path.join(target, "hooks"), source, true);
  };

  // 1. The user's own configuration.
  const claude = path.join(home, ".claude");
  for (const name of ["CLAUDE.md", "settings.json", "settings.local.json"]) put(path.join(claude, name), path.join("home", ".claude", name));
  putAgentFolders(claude, path.join("home", ".claude"));
  putSkills(path.join(claude, "skills"), path.join("skills", "personal"));
  // ~/.claude.json holds the account and usage data too: only the MCP servers are kept.
  const local = [];
  put(path.join(home, ".claude.json"), path.join("home", ".claude.json"), { transform: (raw, counts) => {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return null; }
    for (const [dir, entry] of Object.entries(parsed.projects ?? {})) {
      if (entry?.mcpServers && Object.keys(entry.mcpServers).length) local.push([dir, entry.mcpServers]);
    }
    return JSON.stringify(redactJson({ mcpServers: parsed.mcpServers ?? {} }, counts), null, 2) + "\n";
  } });
  local.forEach(([dir, servers], i) => {
    const counts = {};
    const text = JSON.stringify(redactJson({ mcpServers: servers }, counts), null, 2) + "\n";
    write(path.join("home", ".claude", "mcp-configs", `local-${i + 1}-${safeName(path.basename(dir))}.json`), text, counts);
  });

  // 2. The installed plugins: what loads from each (manifest, MCP servers, hooks, agents,
  //    commands, skills). The install list names the folder; one outside the plugins
  //    folder is not read.
  const pluginsDir = path.join(claude, "plugins");
  let installed = {};
  try { installed = JSON.parse(readFileSync(path.join(pluginsDir, "installed_plugins.json"), "utf8")).plugins ?? {}; } catch { /* no plugins */ }
  for (const id of Object.keys(installed).sort()) {
    const entries = Array.isArray(installed[id]) ? installed[id] : [installed[id]];
    const [plugin, marketplace = "unknown"] = id.split("@");
    for (const entry of entries) {
      const root = entry?.installPath;
      if (typeof root !== "string" || !isDir(root)) continue;
      if (!within(real(pluginsDir) ?? pluginsDir, real(root) ?? root)) { result.skipped.push({ file: `plugins/${id}`, why: "installed outside the plugins folder" }); continue; }
      const target = path.join("plugins", safeName(marketplace), safeName(plugin));
      for (const name of ["plugin.json", "marketplace.json"]) put(path.join(root, ".claude-plugin", name), path.join(target, ".claude-plugin", name));
      for (const name of [".mcp.json", "CLAUDE.md"]) put(path.join(root, name), path.join(target, name));
      putAgentFolders(root, target);
      putSkills(path.join(root, "skills"), path.join(target, "skills"));
      // A hook that starts a file elsewhere in the plugin: that file is copied too.
      let hooksText = "";
      try { hooksText = readFileSync(path.join(root, "hooks", "hooks.json"), "utf8"); } catch { /* none */ }
      for (const m of hooksText.matchAll(/\$\{?CLAUDE_PLUGIN_ROOT\}?[\\/]+([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)/g)) {
        const rel = path.normalize(m[1]);
        if (rel.startsWith("..") || path.isAbsolute(rel) || rel.startsWith("hooks" + path.sep)) continue;
        put(path.join(root, rel), path.join(target, rel), { base: root });
      }
    }
  }

  // 3. Each project folder: its instruction files, MCP servers and Claude settings.
  for (const rootDir of projectRoots) {
    for (const name of list(rootDir)) {
      const project = path.join(rootDir, name);
      if (name.startsWith(".") || !isDir(project)) continue;
      const target = path.join("projects", safeName(name));
      for (const file of ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", ".mcp.json"]) put(path.join(project, file), path.join(target, file));
      const dot = path.join(project, ".claude");
      for (const file of ["CLAUDE.md", "settings.json", "settings.local.json"]) put(path.join(dot, file), path.join(target, ".claude", file));
      putAgentFolders(dot, path.join(target, ".claude"));
      putSkills(path.join(dot, "skills"), path.join(target, "skills"));
    }
  }
  return result;
}

// The second look: every file of the finished copy, read again. Returns the problems
// ({ file, problem }); the scan runs only when there are none. No value is returned.
export function checkCopy(dest) {
  const problems = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(dest, full).split(path.sep).join("/");
      if (lstatSync(full).isSymbolicLink()) { problems.push({ file: rel, problem: "a link" }); continue; }
      if (entry.isDirectory()) { walk(full); continue; }
      if (DENIED_NAME.test(entry.name)) { problems.push({ file: rel, problem: "a credential file name" }); continue; }
      if (statSync(full).size > MAX_FILE_BYTES) { problems.push({ file: rel, problem: "larger than 512 KB" }); continue; }
      for (const name of shapesIn(readFileSync(full, "utf8"))) problems.push({ file: rel, problem: `credential-shaped content (${name})` });
    }
  };
  walk(dest);
  return problems;
}
