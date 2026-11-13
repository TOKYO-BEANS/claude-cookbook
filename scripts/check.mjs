// Checks that plugins/cookbook/catalog.json and SKILL.md agree. No
// dependencies: run `node scripts/check.mjs` before every merge.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHANGELOG_HOSTS, CONNECTION_CHECKS, SELF_UPDATING_TOOLS, VERSION_COMMANDS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs";

export { CHANGELOG_HOSTS };

// The plugin's other skill and prompt bodies, checked for the dollar-sign rule like
// the cookbook skill (a scheduled task's prompt gets arguments too).
export const OTHER_TEXTS = Object.freeze([
  "plugins/cookbook/skills/stack-updates/SKILL.md",
  "plugins/cookbook/skills/stack-updates/daily-prompt.md",
]);
const dollarErrors = (name, text) =>
  text.replace(/\r/g, "").split("\n").flatMap((line, i) => (/\$\d/.test(line) ? [`${name} line ${i + 1}: dollar sign before a digit (write "\${1}" or USD 30)`] : []));

const CATEGORIES = ["Development", "Research", "Infrastructure", "Memory", "Security", "Productivity", "Workflows"];
const SOURCES = ["npm", "github", "vendor"];
const LIFECYCLES = ["active", "trial", "watching"];
const FIELDS = ["id", "name", "category", "purpose", "source", "repository", "package", "website", "lifecycle", "recipe", "uses", "parts"];
const OPTIONAL = ["dates"];
// Per kind, the fields beyond `kind` (and, for a feed, `updater`). The catalog
// names kinds and constants only: never a command line or a pattern.
const INSTALLED_FIELDS = Object.freeze({
  plugin: ["id"], pinned: ["folder", "package"], command: [], skill: ["folder"],
  project: ["repository", "package"], hosted: ["server"], none: [],
});
const INSTALLED_REQUIRED = Object.freeze({
  plugin: ["id"], pinned: ["folder", "package"], skill: ["folder"], project: ["repository", "package"],
});
const FEED_FIELDS = Object.freeze({
  npm: ["package", "tag"], github: ["repository"], marketplace: ["repository", "plugin"],
  commit: ["repository", "path"], changelog: ["url"], gitForWindows: [], jevModels: [], nodeDist: [], none: ["reason"],
});
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const PART = /^[a-z0-9-]{1,40}$/;
const FOLDER = /^[a-zA-Z0-9._-]{1,80}$/;
const PLUGIN_ID = /^[a-zA-Z0-9._-]{1,80}@[a-zA-Z0-9._-]{1,80}$/;
const SERVER = /^[a-zA-Z0-9_.-]{1,80}$/;
const SUBPATH = /^(?!.*\.\.)[A-Za-z0-9._\/-]{1,200}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NPM = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const httpsUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash && v.length <= 500;
  } catch {
    return false;
  }
};
const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const validDay = (v) => typeof v === "string" && DAY.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

function installedErrors(inst, at) {
  if (!isObject(inst)) return [`${at}: installed must be an object`];
  if (!Object.hasOwn(INSTALLED_FIELDS, inst.kind)) return [`${at}: installed kind must be plugin, pinned, command, skill, project, hosted or none`];
  const errors = [];
  for (const k of Object.keys(inst))
    if (k !== "kind" && !INSTALLED_FIELDS[inst.kind].includes(k)) errors.push(`${at}: installed field ${k} is not allowed for ${inst.kind}`);
  for (const k of INSTALLED_REQUIRED[inst.kind] ?? []) if (!(k in inst)) errors.push(`${at}: installed ${k} is missing`);
  if ("id" in inst && !PLUGIN_ID.test(String(inst.id))) errors.push(`${at}: installed id must be plugin@marketplace`);
  if ("folder" in inst && !FOLDER.test(String(inst.folder))) errors.push(`${at}: installed folder must be a plain folder name`);
  if ("package" in inst && !NPM.test(String(inst.package))) errors.push(`${at}: installed package`);
  if ("repository" in inst && !REPO.test(String(inst.repository))) errors.push(`${at}: installed repository must be owner/name`);
  if ("server" in inst && !SERVER.test(String(inst.server))) errors.push(`${at}: installed server`);
  return errors;
}

function feedErrors(feed, at) {
  if (!isObject(feed)) return [`${at}: feed must be an object`];
  if (!Object.hasOwn(FEED_FIELDS, feed.kind)) return [`${at}: feed kind must be one of ${Object.keys(FEED_FIELDS).join(", ")}`];
  const allowed = FEED_FIELDS[feed.kind];
  const errors = [];
  for (const k of Object.keys(feed))
    if (!["kind", "updater", ...allowed].includes(k)) errors.push(`${at}: feed field ${k} is not allowed for ${feed.kind}`);
  if (feed.kind === "npm" && !NPM.test(String(feed.package))) errors.push(`${at}: feed package`);
  if (feed.kind === "npm" && "tag" in feed && !["latest", "stable"].includes(feed.tag)) errors.push(`${at}: feed tag must be latest or stable`);
  if (["github", "marketplace", "commit"].includes(feed.kind) && !REPO.test(String(feed.repository)))
    errors.push(`${at}: feed repository must be owner/name`);
  if (feed.kind === "marketplace" && (typeof feed.plugin !== "string" || !ID.test(feed.plugin))) errors.push(`${at}: feed plugin must be the plugin name`);
  if (feed.kind === "commit" && "path" in feed && !SUBPATH.test(String(feed.path))) errors.push(`${at}: feed path`);
  if (feed.kind === "changelog") {
    if (!httpsUrl(feed.url)) errors.push(`${at}: feed url must be an https URL without credentials, query or fragment`);
    else if (!CHANGELOG_HOSTS.includes(new URL(feed.url).hostname))
      errors.push(`${at}: feed host ${new URL(feed.url).hostname} is not on the allow list`);
  }
  if (feed.kind === "none" && (typeof feed.reason !== "string" || !feed.reason.trim() || feed.reason.length > 200))
    errors.push(`${at}: feed none needs a reason of at most 200 characters`);
  if ("updater" in feed && (typeof feed.updater !== "string" || feed.updater.length > 200))
    errors.push(`${at}: feed updater must be text of at most 200 characters`);
  return errors;
}

function partsErrors(parts, at) {
  if (!Array.isArray(parts) || !parts.length) return [`${at}: needs at least one part`];
  const errors = [];
  const seen = new Set();
  parts.forEach((p, i) => {
    const pat = `${at} part ${isObject(p) && typeof p.name === "string" ? p.name : i}`;
    if (!isObject(p)) return errors.push(`${pat}: not an object`);
    for (const k of Object.keys(p)) if (!["name", "installed", "feed"].includes(k)) errors.push(`${pat}: unknown field ${k}`);
    if (typeof p.name !== "string" || !PART.test(p.name)) errors.push(`${pat}: part name must match [a-z0-9-], at most 40`);
    else if (seen.has(p.name)) errors.push(`${at}: duplicate part ${p.name}`);
    else seen.add(p.name);
    errors.push(...installedErrors(p.installed, pat), ...feedErrors(p.feed, pat));
  });
  return errors;
}

function datesErrors(dates, at) {
  if (!Array.isArray(dates)) return [`${at}: dates must be an array`];
  const errors = [];
  for (const d of dates) {
    if (!isObject(d) || Object.keys(d).sort().join(",") !== "label,on") errors.push(`${at}: a date is { label, on }`);
    else {
      if (typeof d.label !== "string" || !d.label.trim() || d.label.length > 200) errors.push(`${at}: date label`);
      if (!validDay(d.on)) errors.push(`${at}: date on must be YYYY-MM-DD`);
    }
  }
  return errors;
}

// The rules for a fixed-table argv (version commands and connection checks).
// argv[0] is a bare command name, `{share}/<relative path>`, `{bin}/<file name>`, or
// the one launcher shape `cmd.exe /d /c {bin}/<name>.cmd` that starts a shim without
// a shell. Every other element holds at most one token (`{share}`, `{bin}` or `{lib}`),
// only at its start and followed by `/`; no element holds `..`. Returns messages.
const SHELLS = /^(cmd|powershell|pwsh|bash|sh|wscript|cscript)(.exe)?$/i;
const NAME = "[A-Za-z0-9._-]+";
export function argvProblems(argv) {
  const problems = [];
  const list = Array.isArray(argv) ? argv : [];
  const cmd = list[0];
  let start = 1;
  if (cmd === "cmd.exe") {
    const shim = list[3];
    const shaped = list[1] === "/d" && list[2] === "/c" && typeof shim === "string" && new RegExp(`^\{bin\}/${NAME}\.cmd$`).test(shim) && !shim.includes("..");
    if (shaped) start = 4;
    else problems.push("argv[0] cmd.exe is allowed only as cmd.exe /d /c {bin}/<name>.cmd");
  } else {
    const bare = typeof cmd === "string" && new RegExp(`^${NAME}$`).test(cmd) && !SHELLS.test(cmd);
    const rel = (token, deep) => typeof cmd === "string" && new RegExp(`^\{${token}\}/${NAME}${deep ? `(/${NAME})*` : ""}$`).test(cmd) && !cmd.split("/").some((seg) => seg === ".." || seg === ".");
    if (!bare && !rel("share", true) && !rel("bin", false)) problems.push("argv[0] must be a bare command name (not a shell), {share}/ and a relative path without .., or {bin}/ and a file name");
  }
  const tokenOk = (a) => {
    if (typeof a !== "string" || a.includes("..")) return false;
    const tokens = a.match(/{[^}]*}/g) ?? [];
    if (tokens.length > 1 || tokens.some((t) => !["{share}", "{bin}", "{lib}"].includes(t))) return false;
    return tokens.length === 0 || a.startsWith(`${tokens[0]}/`);
  };
  if (list.slice(start).some((a) => !tokenOk(a))) problems.push("has an argument with an unknown token or ..");
  if (start === 4 && list.slice(4).some((a) => typeof a === "string" && /[{}]/.test(a))) problems.push("has a token after the shim: its arguments are constants");
  return problems;
}

export function checkCookbook({ catalogText, skillText, otherTexts = [], commands = VERSION_COMMANDS, selfUpdating = SELF_UPDATING_TOOLS, checks = CONNECTION_CHECKS }) {
  const skill = skillText.replace(/\r/g, "");
  let catalog;
  try {
    catalog = JSON.parse(catalogText);
  } catch {
    return ["catalog.json does not parse"];
  }
  if (
    !catalog || typeof catalog !== "object" || catalog.version !== 1 ||
    !Array.isArray(catalog.tools) || !catalog.tools.length ||
    Object.keys(catalog).sort().join(",") !== "ignored,tools,version"
  )
    return ["catalog.json needs exactly { \"version\": 1, \"tools\": [ …at least one… ], \"ignored\": [ … ] }"];
  const errors = [];
  if (!Array.isArray(catalog.ignored)) errors.push("ignored must be an array");
  else
    for (const g of catalog.ignored) {
      if (!isObject(g) || typeof g.name !== "string" || !g.name.trim()) errors.push("ignored entry needs a name");
      else if (typeof g.reason !== "string" || !g.reason.trim()) errors.push(`ignored entry needs a reason (${g.name})`);
    }
  // A skill called with arguments gets $0, $1 and so on replaced, prices included.
  errors.push(...dollarErrors("SKILL.md", skill));
  for (const { name, text } of otherTexts) errors.push(...dollarErrors(name, String(text)));
  const headings = new Set([...skill.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim()));
  const ids = new Set();
  catalog.tools.forEach((t, i) => {
    const at = `tools[${i}]${t && typeof t.id === "string" ? ` (${t.id})` : ""}`;
    if (!t || typeof t !== "object" || Array.isArray(t)) return errors.push(`${at}: not an object`);
    for (const k of Object.keys(t)) if (!FIELDS.includes(k) && !OPTIONAL.includes(k)) errors.push(`${at}: unknown field ${k}`);
    if ("parts" in t) errors.push(...partsErrors(t.parts, at));
    if ("dates" in t) errors.push(...datesErrors(t.dates, at));
    for (const k of FIELDS) if (!(k in t)) errors.push(`${at}: missing ${k}`);
    if (typeof t.id !== "string" || !ID.test(t.id)) errors.push(`${at}: id`);
    else if (ids.has(t.id)) errors.push(`${at}: duplicate id`);
    else ids.add(t.id);
    if (typeof t.name !== "string" || !t.name.trim() || t.name.length > 100) errors.push(`${at}: name`);
    if (!CATEGORIES.includes(t.category)) errors.push(`${at}: category`);
    if (typeof t.purpose !== "string" || t.purpose.length > 2000) errors.push(`${at}: purpose`);
    if (!SOURCES.includes(t.source)) errors.push(`${at}: source`);
    if (typeof t.package !== "string" || typeof t.repository !== "string") errors.push(`${at}: package and repository must be text`);
    if (t.source === "npm" && !NPM.test(String(t.package))) errors.push(`${at}: npm package name`);
    if (t.source === "github" && !REPO.test(String(t.repository))) errors.push(`${at}: repository must be owner/name`);
    if (t.website !== "" && !httpsUrl(t.website)) errors.push(`${at}: website must be an https URL without credentials, query or fragment`);
    if (!LIFECYCLES.includes(t.lifecycle)) errors.push(`${at}: lifecycle must be active, trial or watching`);
    if (t.recipe !== null && (typeof t.recipe !== "string" || !headings.has(t.recipe))) errors.push(`${at}: recipe heading not in SKILL.md`);
    if (!Array.isArray(t.uses) || t.uses.some((u) => typeof u !== "string" || !ID.test(u))) errors.push(`${at}: uses`);
    else if (t.uses.length && t.category !== "Workflows") errors.push(`${at}: only workflows list uses`);
    if (t.recipe !== null && typeof t.name === "string" && !skill.includes(t.name)) errors.push(`${at}: name not mentioned in SKILL.md`);
  });
  // The self-updating table names tools of the catalog.
  for (const id of selfUpdating) if (!ids.has(id)) errors.push(`self-updating tools: ${id} names no tool in catalog.json`);
  // The fixed version-command table and the catalog agree: a key names a part whose
  // installed kind is command, and every such part has a key.
  const commandParts = new Set();
  const allParts = new Set();
  for (const t of catalog.tools) for (const p of Array.isArray(t?.parts) ? t.parts : []) {
    allParts.add(`${t.id}/${p?.name}`);
    if (p?.installed?.kind === "command") commandParts.add(`${t.id}/${p.name}`);
  }
  for (const key of Object.keys(commands)) {
    if (!allParts.has(key)) errors.push(`version commands: ${key} names no part in catalog.json`);
    else if (!commandParts.has(key)) errors.push(`version commands: ${key} names a part whose installed kind is not command`);
  }
  for (const [key, c] of Object.entries(commands)) for (const e of argvProblems(c?.argv)) errors.push(`version commands: ${key} ${e}`);
  // The fixed connection-check table: keys name tools, argv follows the same rules,
  // ok is a RegExp, and at most one check is paid.
  for (const [key, c] of Object.entries(checks)) {
    if (!ids.has(key)) errors.push(`connection checks: ${key} names no tool in catalog.json`);
    for (const e of argvProblems(c?.argv)) errors.push(`connection checks: ${key} ${e}`);
    if (!(c?.ok instanceof RegExp)) errors.push(`connection checks: ${key} ok must be a RegExp`);
    if ("paid" in (c ?? {}) && c.paid !== true) errors.push(`connection checks: ${key} paid must be true when present`);
  }
  if (Object.values(checks).filter((c) => c?.paid === true).length > 1) errors.push("connection checks: at most one check may be paid");
  for (const key of commandParts) if (!Object.hasOwn(commands, key)) errors.push(`version commands: ${key} has no version command`);
  const names = catalog.tools.map((t) => String(t?.name ?? "").toLowerCase()).filter(Boolean);
  const table = skill.split(/^## /m).find((s) => s.startsWith("Choosing quickly")) ?? "";
  for (const line of table.split("\n")) {
    if (!line.startsWith("| ") || /^\| (Task|---) /.test(line)) continue;
    const cell = line.split(" | ")[1] ?? "";
    for (const [, raw] of cell.matchAll(/\*\*(.+?)\*\*/g)) {
      const text = raw.replace(/`/g, "").toLowerCase();
      const prefixes = [...text.matchAll(/([a-z0-9-]+-)\*/g)].map((m) => m[1]);
      if (!names.some((n) => text.includes(n) || prefixes.some((p) => n.startsWith(p))))
        errors.push(`table: "${raw}" names no tool in catalog.json`);
    }
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = new URL("../", import.meta.url);
  const errors = checkCookbook({
    catalogText: readFileSync(new URL("plugins/cookbook/catalog.json", root), "utf8"),
    skillText: readFileSync(new URL("plugins/cookbook/skills/cookbook/SKILL.md", root), "utf8"),
    otherTexts: OTHER_TEXTS.map((p) => ({ name: p, text: readFileSync(new URL(p, root), "utf8") })),
  });
  for (const e of errors) console.error(e);
  console.log(errors.length ? `${errors.length} problem(s)` : "Cookbook check passed.");
  process.exitCode = errors.length ? 1 : 0;
}
