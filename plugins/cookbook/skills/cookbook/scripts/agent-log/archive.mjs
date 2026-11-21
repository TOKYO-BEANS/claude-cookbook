// The agent log's archive (recipes/learning-loop.md): every Claude Code and Codex session
// transcript, copied into ~/.local/share/agent-log/ outside ~/.claude, with every credential
// shape masked on the way (agentshield/sanitize.mjs maskText) and image data dropped, then
// compressed with zstd. A session that grew since the last run is copied again in full.
// No model takes part and nothing leaves this machine.
// Usage: node archive.mjs [--dest <folder>]   (the nightly timer runs it through its launcher)
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { zstdCompressSync } from "node:zlib";
import { maskText, shapesIn } from "../agentshield/sanitize.mjs";

export const defaultDest = (home = homedir()) => join(home, ".local", "share", "agent-log");
export const defaultSources = (home = homedir()) => [
  { name: "claude", root: join(home, ".claude", "projects") },
  { name: "codex", root: join(home, ".codex", "sessions") },
];
// Fields that only link records (a tool call to its result, a message to its parent): kept
// as they are when they look like an id, so the digest can follow them. Every other string
// is masked by shape.
const ID_KEYS = new Set(["id", "uuid", "parentUuid", "leafUuid", "sessionId", "session_id", "tool_use_id", "toolUseID", "requestId", "promptId", "call_id", "turn_id"]);
const ID_VALUE = /^[A-Za-z0-9_.:-]{1,100}$/;
// Bulk with no lesson in it: pictures pasted as base64, and the encrypted signature of a thinking block.
const DROPPED_KEYS = new Set(["signature", "encrypted_content"]);
const IMAGE = /^[A-Za-z0-9+/=]{1000,}$/;
// A string this long is a tool result dump: its head is kept, the rest goes.
const MAX_STRING = 100_000;

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && e.name.endsWith(".jsonl")) yield p;
  }
}

const bump = (counts, name) => { counts[name] = (counts[name] ?? 0) + 1; };

function cleanValue(value, counts, key = "") {
  if (typeof value === "string") {
    if (DROPPED_KEYS.has(key)) { bump(counts, `${key}-dropped`); return "<dropped>"; }
    // An id is kept only when no named credential shape is in it: "random-looking" alone is what ids are.
    if (ID_KEYS.has(key) && ID_VALUE.test(value) && shapesIn(value).every((n) => n === "long-random")) return value;
    if (IMAGE.test(value)) { bump(counts, "image-dropped"); return "<image-dropped>"; }
    const cut = value.length > MAX_STRING ? (bump(counts, "string-cut"), `${value.slice(0, MAX_STRING)}<cut ${value.length - MAX_STRING} chars>`) : value;
    return maskText(cut, counts);
  }
  if (Array.isArray(value)) return value.map((v) => cleanValue(v, counts, key));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanValue(v, counts, k);
    return out;
  }
  return value;
}

/** One transcript (JSONL) with credential shapes masked and bulk dropped; a line that is not JSON is masked as text. */
export function cleanTranscript(text, counts = {}) {
  return text.split("\n").map((line) => {
    if (!line.trim()) return line;
    try { return JSON.stringify(cleanValue(JSON.parse(line), counts)); } catch { return maskText(line, counts); }
  }).join("\n");
}

/** Copies each new or grown transcript. Returns { copied, skipped, bytesIn, bytesOut, counts }. */
export function archiveAll({ sources = defaultSources(), dest = defaultDest() } = {}) {
  mkdirSync(dest, { recursive: true, mode: 0o700 });
  chmodSync(dest, 0o700);
  const indexPath = join(dest, "index.json");
  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : {};
  const result = { copied: 0, skipped: 0, bytesIn: 0, bytesOut: 0, counts: {} };
  for (const { name, root } of sources) {
    for (const file of walk(root)) {
      const key = `${name}/${relative(root, file)}`;
      const { size, mtimeMs } = statSync(file);
      if (index[key]?.size === size && index[key]?.mtimeMs === mtimeMs) { result.skipped += 1; continue; }
      const packed = zstdCompressSync(Buffer.from(cleanTranscript(readFileSync(file, "utf8"), result.counts)));
      const out = join(dest, `${key}.zst`);
      mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
      writeFileSync(`${out}.tmp`, packed, { mode: 0o600 });
      renameSync(`${out}.tmp`, out);
      index[key] = { size, mtimeMs, archivedAt: new Date().toISOString() };
      result.copied += 1; result.bytesIn += size; result.bytesOut += packed.length;
    }
  }
  writeFileSync(`${indexPath}.tmp`, JSON.stringify(index), { mode: 0o600 });
  renameSync(`${indexPath}.tmp`, indexPath);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const at = process.argv.indexOf("--dest");
  const r = archiveAll(at > 0 ? { dest: process.argv[at + 1] } : {});
  const masked = Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
  console.log(`agent-log: ${r.copied} copied, ${r.skipped} unchanged; ${(r.bytesIn / 1e6).toFixed(1)} MB in, ${(r.bytesOut / 1e6).toFixed(1)} MB stored; masked: ${masked}`);
}
