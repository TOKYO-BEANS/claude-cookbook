// The weekly review's input (recipes/learning-loop.md): from the archived Claude Code sessions
// of the last N days, the signals a lesson is made of, in one Markdown file small enough for
// one read: tool errors that came back in more than one session, and what the owner typed.
// It reads the archive (already masked), never ~/.claude. No model takes part.
// Usage: node digest.mjs [--days 7] [--archive <folder>] [--out <file>]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zstdDecompressSync } from "node:zlib";
import { defaultDest } from "./archive.mjs";

const DAY = 86_400_000;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
const oneLine = (s) => s.replace(/\s+/g, " ").trim();
const textOf = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => (b?.type === "text" ? b.text : "")).join("\n") : "");

/** An error's signature: the same failure in other words (numbers, paths, ids, quoted values) counts as one. */
export function signature(tool, text) {
  const t = oneLine(text).toLowerCase()
    .replace(/<masked:[a-z-]+>/g, "<v>")
    .replace(/(?:~|\.{0,2})?\/[\w.@~+-]+(?:\/[\w.@~+-]+)+/g, "<path>")
    .replace(/"[^"]{0,200}"|'[^']{0,200}'|`[^`]{0,200}`/g, "<q>")
    .replace(/\b[0-9a-f]{7,}\b/g, "<id>")
    .replace(/\d+/g, "#");
  return `${tool}: ${clip(t, 140)}`;
}

/** Signals of one session's records: { project, session, start, errors: [{tool, text, sig}], owner: [text] }. */
export function sessionSignals(records, { project = "", session = "" } = {}) {
  const tools = new Map();
  const out = { project, session, start: null, errors: [], owner: [] };
  for (const r of records) {
    if (!out.start && r.timestamp) out.start = r.timestamp;
    const content = r.message?.content;
    if (r.type === "assistant" && Array.isArray(content)) {
      for (const b of content) if (b?.type === "tool_use") tools.set(b.id, b.name);
    }
    if (r.type !== "user" || r.isSidechain || r.isMeta) continue;
    if (Array.isArray(content) && content.some((b) => b?.type === "tool_result")) {
      for (const b of content) {
        if (b?.type !== "tool_result" || !b.is_error) continue;
        const tool = tools.get(b.tool_use_id) ?? "unknown";
        const text = textOf(b.content);
        out.errors.push({ tool, text: clip(oneLine(text), 300), sig: signature(tool, text) });
      }
      continue;
    }
    const typed = oneLine(textOf(content));
    // Harness text, slash-command wrappers and system notes are not the owner's words.
    if (!typed || /^(<|\[Request interrupted|Caveat:|This session is being continued)/.test(typed)) continue;
    out.owner.push(clip(typed, 400));
  }
  return out;
}

function* archivedSessions(archive, since) {
  const index = JSON.parse(readFileSync(join(archive, "index.json"), "utf8"));
  for (const [key, meta] of Object.entries(index)) {
    if (!key.startsWith("claude/") || meta.mtimeMs < since || key.includes("/subagents/")) continue;
    const [, project, file] = key.split("/");
    const text = zstdDecompressSync(readFileSync(join(archive, `${key}.zst`))).toString("utf8");
    const records = [];
    for (const line of text.split("\n")) { try { if (line) records.push(JSON.parse(line)); } catch { /* a cut line */ } }
    yield sessionSignals(records, { project, session: file.replace(/\.jsonl$/, "") });
  }
}

/** The digest as Markdown, cut at maxBytes. */
export function buildDigest(sessions, { days, now = Date.now(), maxBytes = 80_000 } = {}) {
  const repeats = new Map();
  for (const s of sessions) for (const e of s.errors) {
    const r = repeats.get(e.sig) ?? { sig: e.sig, count: 0, sessions: new Set(), example: e.text };
    r.count += 1; r.sessions.add(s.session.slice(0, 8)); repeats.set(e.sig, r);
  }
  const repeated = [...repeats.values()].filter((r) => r.sessions.size > 1).sort((a, b) => b.sessions.size - a.sessions.size || b.count - a.count);
  const lines = [
    `# Agent log digest: ${days} days to ${new Date(now).toISOString().slice(0, 10)}`, "",
    `${sessions.length} sessions, ${sessions.reduce((n, s) => n + s.errors.length, 0)} tool errors, ${sessions.reduce((n, s) => n + s.owner.length, 0)} owner messages.`, "",
    "## Errors that came back in more than one session", "",
    ...repeated.slice(0, 40).map((r) => `- **${r.sessions.size} sessions, ${r.count} times** \`${r.sig}\` (${[...r.sessions].slice(0, 6).join(", ")})\n  - e.g. ${r.example}`),
    "", "## What the owner typed, by session", "",
  ];
  for (const s of [...sessions].filter((x) => x.owner.length).sort((a, b) => String(a.start).localeCompare(String(b.start)))) {
    lines.push(`### ${String(s.start).slice(0, 16)} ${s.project} ${s.session.slice(0, 8)} (${s.errors.length} errors)`, ...s.owner.map((m) => `- ${m}`), "");
  }
  let md = lines.join("\n");
  if (Buffer.byteLength(md) > maxBytes) md = `${Buffer.from(md).subarray(0, maxBytes).toString("utf8")}\n\n(cut at ${maxBytes} bytes)\n`;
  return md;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
  const days = Number(arg("--days", "7"));
  const archive = arg("--archive", defaultDest());
  const now = Date.now();
  const sessions = [...archivedSessions(archive, now - days * DAY)];
  const out = arg("--out", join(archive, "digests", `${new Date(now).toISOString().slice(0, 10)}.md`));
  mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
  writeFileSync(out, buildDigest(sessions, { days, now }), { mode: 0o600 });
  console.log(`digest: ${sessions.length} sessions -> ${out}`);
}
