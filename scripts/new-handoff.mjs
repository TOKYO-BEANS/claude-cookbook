// A new handoff entry with the five parts the check asks for (scripts/check.mjs, HANDOFF_PARTS):
//   node scripts/new-handoff.mjs <slug> "<title>" [--date YYYY-MM-DD]
// Writes handoff/<date>-<slug>.md and prints its path; never overwrites an entry.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HANDOFF_ENTRY_NAME, HANDOFF_PARTS } from "./check.mjs";

export const scaffold = (title) =>
  [`# ${title}`, "", ...HANDOFF_PARTS.flatMap((part) => [`**${part}.** `, ""])].join("\n");

export function newHandoff({ root, date, slug, title }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`date must be YYYY-MM-DD, not ${date}`);
  const name = `${date}-${slug}.md`;
  if (!HANDOFF_ENTRY_NAME.test(name)) throw new Error(`slug must be lower-case words joined by hyphens, not ${slug}`);
  const dir = join(root, "handoff");
  const path = join(dir, name);
  if (existsSync(path)) throw new Error(`${path} exists: pick another slug`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, scaffold(title), { flag: "wx" });
  return path;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--date");
  const date = at >= 0 ? args.splice(at, 2)[1] : new Date().toISOString().slice(0, 10);
  const [slug, title] = args;
  if (!slug || !title) {
    console.error('usage: node scripts/new-handoff.mjs <slug> "<title>" [--date YYYY-MM-DD]');
    process.exitCode = 2;
  } else {
    try {
      console.log(newHandoff({ root: fileURLToPath(new URL("../", import.meta.url)), date, slug, title }));
    } catch (e) {
      console.error(e.message);
      process.exitCode = 1;
    }
  }
}
