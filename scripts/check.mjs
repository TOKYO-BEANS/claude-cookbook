// Checks that plugins/cookbook/catalog.json, SKILL.md (the map) and the pages beside it
// (recipes/ and options/) agree. No dependencies: run `node scripts/check.mjs` before
// every merge.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import { CHANGELOG_HOSTS, CONNECTION_CHECKS, SELF_UPDATING_TOOLS, VERSION_COMMANDS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs";

export { CHANGELOG_HOSTS };

// The plugin's other skill bodies, checked for the dollar-sign rule like the cookbook skill.
export const OTHER_TEXTS = Object.freeze([
  "plugins/cookbook/skills/stack-updates/SKILL.md",
]);
const dollarErrors = (name, text) =>
  text.replace(/\r/g, "").split("\n").flatMap((line, i) => (/\$\d/.test(line) ? [`${name} line ${i + 1}: dollar sign before a digit (write "\${1}" or USD 30)`] : []));

// The pages beside SKILL.md, by folder. A page is read with one Read call, and context-mode
// cuts any tool result over 4,096 bytes, so a page must fit: its bytes plus what Read adds
// to each line (a line number and a tab, and a carriage return in a CRLF checkout).
export const PAGE_FOLDERS = Object.freeze(["recipes", "options"]);
export const PAGE_READ_LIMIT = 4000;
// SKILL.md loads in full on every non-trivial task: it holds the map and the ground rules only.
export const SKILL_LIMIT = 14000;
export const readCost = (text) => Buffer.byteLength(text) + 9 * text.split("\n").length;
const mdLinks = (text) => [...text.matchAll(/\]\(([^)\s]+\.md)\)/g)].map((m) => m[1]).filter((t) => !t.includes("://"));
const resolveLink = (from, target) => posix.normalize(posix.join(posix.dirname(from), target));
const pageTitle = (text) => /^# (.+)\n/.exec(text)?.[1].trim();

// Problems of the pages themselves and of the links between SKILL.md and them.
function pageErrors(skill, pages) {
  const errors = [];
  const names = new Set();
  const titles = new Map();
  for (const { name, text } of pages) {
    if (names.has(name)) errors.push(`${name}: listed twice`);
    names.add(name);
    if (!new RegExp(`^(${PAGE_FOLDERS.join("|")})/[a-z0-9-]+\\.md$`).test(name)) errors.push(`${name}: a page is <${PAGE_FOLDERS.join("|")}>/<lower-case-name>.md`);
    const title = pageTitle(text);
    if (!title) errors.push(`${name}: must start with a "# Title" line`);
    else if (titles.has(title)) errors.push(`${name}: same title as ${titles.get(title)}`);
    else titles.set(title, name);
    const cost = readCost(text);
    if (cost > PAGE_READ_LIMIT) errors.push(`${name}: ${cost} bytes as a Read result, over ${PAGE_READ_LIMIT}: split the page`);
    errors.push(...dollarErrors(name, text));
  }
  if (Buffer.byteLength(skill) > SKILL_LIMIT) errors.push(`SKILL.md is ${Buffer.byteLength(skill)} bytes, over ${SKILL_LIMIT}: move text to a recipe page`);
  // Every link resolves, and every page is reached from SKILL.md, directly or through a page.
  const byName = new Map(pages.map((p) => [p.name, p.text]));
  const reached = new Set();
  const queue = [];
  const follow = (from, text) => {
    for (const target of mdLinks(text)) {
      const to = resolveLink(from, target);
      if (!names.has(to)) errors.push(`${from}: link to ${target}, which does not exist`);
      else if (!reached.has(to)) {
        reached.add(to);
        queue.push(to);
      }
    }
  };
  follow("SKILL.md", skill);
  while (queue.length) {
    const name = queue.shift();
    follow(name, byName.get(name));
  }
  for (const name of names) if (!reached.has(name)) errors.push(`${name}: no map row or page links to it`);
  return errors;
}

// The map: one table under "## The map" with Job, Owner, Fallback and Recipe. A row names
// its recipe page(s) in recipes/, "—" (no recipe is needed) or "being built".
function mapErrors(skill, toolNames) {
  const section = skill.split(/^## /m).find((s) => s.startsWith("The map"));
  if (!section) return ['SKILL.md has no "## The map" section'];
  const errors = [];
  let rows = 0;
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
    if (cells[0] === "Job" || /^-+$/.test(cells[0])) continue;
    if (cells.length !== 4) {
      errors.push(`map: row "${cells[0]}" needs 4 cells (job, owner, fallback, recipe)`);
      continue;
    }
    const [job, owner, fallback, recipe] = cells;
    if (!owner && !fallback && !recipe && /^\*\*.+\*\*$/.test(job)) continue; // a group heading: a bold job cell alone
    rows += 1;
    if (!owner) errors.push(`map: row "${job}" has no owner`);
    if (!fallback) errors.push(`map: row "${job}" has no fallback (write "—" when there is none)`);
    const targets = mdLinks(recipe);
    if (!targets.length && !["—", "being built"].includes(recipe)) errors.push(`map: row "${job}" names no recipe page, "—" or "being built"`);
    for (const t of targets) if (!t.startsWith("recipes/")) errors.push(`map: row "${job}" links ${t}: a recipe page is in recipes/`);
    for (const [, raw] of owner.matchAll(/\*\*(.+?)\*\*/g)) {
      const text = raw.replace(/`/g, "").toLowerCase();
      const prefixes = [...text.matchAll(/([a-z0-9-]+-)\*/g)].map((m) => m[1]);
      if (!toolNames.some((n) => text.includes(n) || prefixes.some((p) => n.startsWith(p)))) errors.push(`map: "${raw}" names no tool in catalog.json`);
    }
  }
  if (!rows) errors.push("map: the table has no rows");
  return errors;
}

// The pages on disk under a skill folder (a URL ending in "/"): [{ name: "recipes/x.md", text }].
export function readPages(skillFolder) {
  return PAGE_FOLDERS.flatMap((d) =>
    readdirSync(new URL(`${d}/`, skillFolder)).filter((f) => f.endsWith(".md")).sort()
      .map((f) => ({ name: `${d}/${f}`, text: readFileSync(new URL(`${d}/${f}`, skillFolder), "utf8") })));
}

const CATEGORIES = ["Development", "Research", "Infrastructure", "Memory", "Security", "Productivity", "Workflows"];
const SOURCES = ["npm", "github", "vendor"];
const LIFECYCLES = ["active", "trial", "watching"];
const FIELDS = ["id", "name", "category", "purpose", "source", "repository", "package", "website", "lifecycle", "recipe", "uses", "parts"];
const OPTIONAL = ["dates"];
// Per kind, the fields beyond `kind` (and, for a feed, `updater`). The catalog
// names kinds and constants only: never a command line or a pattern.
const INSTALLED_FIELDS = Object.freeze({
  plugin: ["id"], pinned: ["folder", "package"], command: [], skill: ["folder"],
  project: ["project", "package", "path"], hosted: ["server"], none: [],
});
const INSTALLED_REQUIRED = Object.freeze({
  plugin: ["id"], pinned: ["folder", "package"], skill: ["folder"], project: ["project", "package"],
});
// This file is public: a project part names a key, never a repository. The update
// check maps the key on the PC (`~/.local/share/stack-updates/projects.json`).
const PROJECT_KEY = /^[a-z0-9-]{1,40}$/;
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
const PROJECT_PATH = /^(?!.*\.\.)[A-Za-z0-9._-]{1,80}(?:\/[A-Za-z0-9._-]{1,80}){0,5}$/;
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
const validDay = (v) => {
  if (typeof v !== "string" || !DAY.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`); // an impossible date ("2026-13-45") is not a number
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
};

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
  if ("project" in inst && !(typeof inst.project === "string" && PROJECT_KEY.test(inst.project))) errors.push(`${at}: installed project must be a key (lower-case letters, digits, hyphens), not a repository`);
  if ("server" in inst && !SERVER.test(String(inst.server))) errors.push(`${at}: installed server`);
  if ("path" in inst && (typeof inst.path !== "string" || !PROJECT_PATH.test(inst.path))) errors.push(`${at}: installed path must be a plain relative folder`);
  return errors;
}

// What an `updater` text never tells the updating session to do: install a package
// globally (into AppData, unvetted), take whatever is newest, or run a vendor's
// install script. A pinned copy moves through a new lockfile, the three scans and
// `npm ci --ignore-scripts`.
const UNVETTED = Object.freeze([
  ["npm install -g", /\bnpm\s+install\s+(?:\S+\s+)*?(?:-g|--global)\b/i],
  ["npm i -g", /\bnpm\s+i\s+(?:\S+\s+)*?(?:-g|--global)\b/i],
  ["@latest", /@latest\b/i],
  ["install.ps1", /\binstall\.ps1\b/i],
  ["curl piped to a shell", /\bcurl\s[^|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|pwsh|powershell|iex)\b/i],
]);

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
  else if ("updater" in feed) {
    const found = UNVETTED.filter(([, re]) => re.test(feed.updater)).map(([name]) => name);
    if (found.length) errors.push(`${at}: feed updater must not install unvetted (${found.join(", ")})`);
  }
  return errors;
}

// A part's own source of release notes, for a feed that publishes none (npm): a
// GitHub repository whose releases are tagged with the part's versions.
function notesErrors(notes, at) {
  if (!isObject(notes)) return [`${at}: notes must be an object`];
  const errors = [];
  if (notes.kind !== "github") errors.push(`${at}: notes kind must be github`);
  for (const k of Object.keys(notes)) if (!["kind", "repository"].includes(k)) errors.push(`${at}: notes field ${k} is not allowed`);
  if (!REPO.test(String(notes.repository))) errors.push(`${at}: notes repository must be owner/name`);
  return errors;
}

function partsErrors(parts, at) {
  if (!Array.isArray(parts) || !parts.length) return [`${at}: needs at least one part`];
  const errors = [];
  const seen = new Set();
  parts.forEach((p, i) => {
    const pat = `${at} part ${isObject(p) && typeof p.name === "string" ? p.name : i}`;
    if (!isObject(p)) return errors.push(`${pat}: not an object`);
    for (const k of Object.keys(p)) if (!["name", "installed", "feed", "notes"].includes(k)) errors.push(`${pat}: unknown field ${k}`);
    if ("notes" in p) errors.push(...notesErrors(p.notes, pat));
    if (typeof p.name !== "string" || !PART.test(p.name)) errors.push(`${pat}: part name must match [a-z0-9-], at most 40`);
    else if (seen.has(p.name)) errors.push(`${at}: duplicate part ${p.name}`);
    else seen.add(p.name);
    errors.push(...installedErrors(p.installed, pat), ...feedErrors(p.feed, pat));
    // A page hash can never say an installed version is behind, so it follows only what has none.
    if (isObject(p.feed) && p.feed.kind === "changelog" && !["hosted", "none"].includes(p.installed?.kind))
      errors.push(`${pat}: a changelog feed is allowed only on a hosted or none part`);
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
// The patterns are built with String.raw, so every backslash reaches the RegExp (a
// template literal would turn `\.` into a bare `.`). No element of either table may
// hold a character cmd.exe gives a meaning to (& | < > ^ % ! ") or whitespace: the
// shim launcher passes its arguments through cmd.exe.
const SHELLS = /^(cmd|powershell|pwsh|bash|sh|wscript|cscript)(.exe)?$/i;
const NAME = String.raw`[A-Za-z0-9._-]+`;
const SHELL_META = /[&|<>^%!"\s]/;
export function argvProblems(argv) {
  const problems = [];
  const list = Array.isArray(argv) ? argv : [];
  const cmd = list[0];
  let start = 1;
  if (list.some((a) => typeof a === "string" && SHELL_META.test(a))) problems.push("has a shell metacharacter or whitespace in an element");
  if (cmd === "cmd.exe") {
    const shim = list[3];
    const shaped = list[1] === "/d" && list[2] === "/c" && typeof shim === "string" && new RegExp(String.raw`^\{bin\}/${NAME}\.cmd$`).test(shim) && !shim.includes("..");
    if (shaped) start = 4;
    else problems.push("argv[0] cmd.exe is allowed only as cmd.exe /d /c {bin}/<name>.cmd");
  } else {
    const bare = typeof cmd === "string" && new RegExp(String.raw`^${NAME}$`).test(cmd) && !SHELLS.test(cmd);
    const share = new RegExp(String.raw`^\{share\}/${NAME}(/${NAME})*$`);
    const bin = new RegExp(String.raw`^\{bin\}/${NAME}$`);
    const rel = (shape) => typeof cmd === "string" && shape.test(cmd) && !cmd.split("/").some((seg) => seg === ".." || seg === ".");
    if (!bare && !rel(share) && !rel(bin)) problems.push("argv[0] must be a bare command name (not a shell), {share}/ and a relative path without .., or {bin}/ and a file name");
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

export function checkCookbook({ catalogText, skillText, pages = [], otherTexts = [], commands = VERSION_COMMANDS, selfUpdating = SELF_UPDATING_TOOLS, checks = CONNECTION_CHECKS }) {
  const skill = skillText.replace(/\r/g, "");
  const pageList = pages.map((p) => ({ name: String(p?.name), text: String(p?.text).replace(/\r/g, "") }));
  const allText = [skill, ...pageList.map((p) => p.text)].join("\n");
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
  errors.push(...pageErrors(skill, pageList));
  // A tool's recipe is the title of a page in recipes/.
  const headings = new Set(pageList.filter((p) => p.name.startsWith("recipes/")).map((p) => pageTitle(p.text)).filter(Boolean));
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
    if (t.recipe !== null && (typeof t.recipe !== "string" || !headings.has(t.recipe))) errors.push(`${at}: recipe heading names no page title in recipes/`);
    if (!Array.isArray(t.uses) || t.uses.some((u) => typeof u !== "string" || !ID.test(u))) errors.push(`${at}: uses`);
    else if (t.uses.length && t.category !== "Workflows") errors.push(`${at}: only workflows list uses`);
    if (t.recipe !== null && typeof t.name === "string" && !allText.includes(t.name)) errors.push(`${at}: name not mentioned in SKILL.md or a page`);
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
  errors.push(...mapErrors(skill, names));
  return errors;
}

// The handoff (recipes/parallel-chats.md): an entry is a file of its own in handoff/, so two
// pull requests never edit the same lines. HANDOFF.md holds the entries before 0.40.0 and is
// closed: its text is pinned here, with line endings set aside.
export const HANDOFF_CLOSED_SHA256 = "d4e6c76da2b8f6f60efedf5dfd4fbf3ff54f6bc0e8fc3a00404e33f1973e41ca";
export const HANDOFF_ENTRY_NAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.md$/;
export const handoffHash = (text) => createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
export function handoffErrors({ closedText, entryNames, pinned = HANDOFF_CLOSED_SHA256 }) {
  const errors = [];
  if (handoffHash(closedText) !== pinned) errors.push("HANDOFF.md is closed and has changed: put the entry in a new file, handoff/YYYY-MM-DD-short-name.md, and leave HANDOFF.md as it is on main");
  if (!entryNames.length) errors.push("handoff/ has no entry");
  for (const n of entryNames) if (!HANDOFF_ENTRY_NAME.test(n)) errors.push(`handoff/${n}: an entry is named YYYY-MM-DD-short-name.md (lower case, digits and hyphens)`);
  return errors;
}

// An entry's content (the owner's rule in the global CLAUDE.md): what changed, the
// verification, what is outstanding, the dead ends and the evidence, each as a bold label or a
// heading ("None." is an answer), and evidence that points at a durable copy. The reason: 32 of
// the 114 AI review findings on the 60 pull requests merged before 18 November 2026 were about
// the entry itself. Entries named from HANDOFF_CONTENT_FROM on are read; older ones are not.
export const HANDOFF_CONTENT_FROM = "2026-11-19";
export const HANDOFF_PARTS = ["What changed", "Verification", "Outstanding", "Dead ends", "Evidence"];
const isLabel = (line) => /^\s*(\*\*|#{1,6}\s)/.test(line);
// The label's own text: the bold span that opens the line, or the heading's text. A word in the
// text after a bold label names no part.
const labelText = (line) => /^\s*\*\*(.+?)\*\*/.exec(line)?.[1] ?? /^\s*#{1,6}\s+(.*)/.exec(line)?.[1] ?? "";
// Home-folder forms of .claude only: a .claude folder committed in a repository is durable.
const NOT_DURABLE = /AppData[\\/]Local[\\/]Temp|[\\/]scratchpad[\\/]|(^|[\s`'"(])\/tmp\/|(~|\$\{?HOME\}?|%USERPROFILE%|\$env:USERPROFILE|[A-Za-z]:[\\/]Users[\\/][^\\/\s`]+|\/(?:home|Users)\/[^/\s`]+)[\\/]\.claude[\\/]/i;
export function handoffEntryErrors({ name, text }) {
  if (name.slice(0, 10) < HANDOFF_CONTENT_FROM) return [];
  const lines = String(text).split(/\r?\n/);
  const errors = [];
  for (const part of HANDOFF_PARTS) {
    const named = new RegExp(`\\b${part}\\b`, "i");
    if (!lines.some((l) => named.test(labelText(l)))) errors.push(`handoff/${name}: no "${part}" part (a bold label or a heading; "None." is an answer)`);
  }
  const start = lines.findIndex((l) => /\bevidence\b/i.test(labelText(l)));
  if (start >= 0) {
    const next = lines.findIndex((l, i) => i > start && isLabel(l));
    if (lines.slice(start, next < 0 ? undefined : next).some((l) => NOT_DURABLE.test(l)))
      errors.push(`handoff/${name}: the evidence points at a temp folder or ~/.claude: copy it into the repository or ~/.local/share/<project>/evidence`);
  }
  return errors;
}

// The plugin has no version number (recipes/parallel-chats.md): with none in the manifest and
// none in the marketplace entry, Claude Code installs by commit and takes every merge as an
// update. A number would be one line that every pull request sets, and two that set the same
// one merge with no conflict and no update.
export const PLUGIN_MANIFEST = "plugins/cookbook/.claude-plugin/plugin.json";
export const MARKETPLACE = ".claude-plugin/marketplace.json";
export function versionErrors({ manifestText, marketplaceText }) {
  const errors = [];
  const fix = "the plugin has no version number, its commit is its version (recipes/parallel-chats.md): take the line out";
  const parse = (name, text) => {
    try {
      const value = JSON.parse(text);
      if (value !== null && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {
      // said below
    }
    errors.push(`${name} is not a JSON object`);
    return null;
  };
  const manifest = parse(PLUGIN_MANIFEST, manifestText);
  if (manifest && Object.hasOwn(manifest, "version")) errors.push(`${PLUGIN_MANIFEST} has a version: ${fix}`);
  const market = parse(MARKETPLACE, marketplaceText);
  if (market && !Array.isArray(market.plugins)) errors.push(`${MARKETPLACE} lists no plugins`);
  for (const entry of market && Array.isArray(market.plugins) ? market.plugins : []) {
    if (entry !== null && typeof entry === "object" && Object.hasOwn(entry, "version"))
      errors.push(`${MARKETPLACE}: the entry ${String(entry.name).slice(0, 60)} has a version: ${fix}`);
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = new URL("../", import.meta.url);
  const entryNames = readdirSync(new URL("handoff/", root));
  const handoff = handoffErrors({ closedText: readFileSync(new URL("HANDOFF.md", root), "utf8"), entryNames });
  for (const name of entryNames.filter((n) => HANDOFF_ENTRY_NAME.test(n)))
    handoff.push(...handoffEntryErrors({ name, text: readFileSync(new URL(`handoff/${name}`, root), "utf8") }));
  const errors = checkCookbook({
    catalogText: readFileSync(new URL("plugins/cookbook/catalog.json", root), "utf8"),
    skillText: readFileSync(new URL("plugins/cookbook/skills/cookbook/SKILL.md", root), "utf8"),
    pages: readPages(new URL("plugins/cookbook/skills/cookbook/", root)),
    otherTexts: OTHER_TEXTS.map((p) => ({ name: p, text: readFileSync(new URL(p, root), "utf8") })),
  });
  errors.push(...handoff);
  errors.push(...versionErrors({
    manifestText: readFileSync(new URL(PLUGIN_MANIFEST, root), "utf8"),
    marketplaceText: readFileSync(new URL(MARKETPLACE, root), "utf8"),
  }));
  for (const e of errors) console.error(e);
  console.log(errors.length ? `${errors.length} problem(s)` : "Cookbook check passed.");
  process.exitCode = errors.length ? 1 : 0;
}
