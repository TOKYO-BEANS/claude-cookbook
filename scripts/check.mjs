// Checks that plugins/cookbook/catalog.json and SKILL.md agree. No
// dependencies: run `node scripts/check.mjs` before every merge.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CATEGORIES = ["Development", "Research", "Infrastructure", "Memory", "Security", "Productivity", "Workflows"];
const SOURCES = ["npm", "github", "vendor"];
const FIELDS = ["id", "name", "category", "purpose", "source", "repository", "package", "website", "lifecycle", "recipe", "uses"];
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
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

export function checkCookbook({ catalogText, skillText }) {
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
    Object.keys(catalog).sort().join(",") !== "tools,version"
  )
    return ["catalog.json needs exactly { \"version\": 1, \"tools\": [ …at least one… ] }"];
  const errors = [];
  const headings = new Set([...skill.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim()));
  const ids = new Set();
  catalog.tools.forEach((t, i) => {
    const at = `tools[${i}]${t && typeof t.id === "string" ? ` (${t.id})` : ""}`;
    if (!t || typeof t !== "object" || Array.isArray(t)) return errors.push(`${at}: not an object`);
    for (const k of Object.keys(t)) if (!FIELDS.includes(k)) errors.push(`${at}: unknown field ${k}`);
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
    if (!["active", "trial"].includes(t.lifecycle)) errors.push(`${at}: lifecycle must be active or trial`);
    if (t.recipe !== null && (typeof t.recipe !== "string" || !headings.has(t.recipe))) errors.push(`${at}: recipe heading not in SKILL.md`);
    if (!Array.isArray(t.uses) || t.uses.some((u) => typeof u !== "string" || !ID.test(u))) errors.push(`${at}: uses`);
    else if (t.uses.length && t.category !== "Workflows") errors.push(`${at}: only workflows list uses`);
    if (t.recipe !== null && typeof t.name === "string" && !skill.includes(t.name)) errors.push(`${at}: name not mentioned in SKILL.md`);
  });
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
  });
  for (const e of errors) console.error(e);
  console.log(errors.length ? `${errors.length} problem(s)` : "Cookbook check passed.");
  process.exitCode = errors.length ? 1 : 0;
}
