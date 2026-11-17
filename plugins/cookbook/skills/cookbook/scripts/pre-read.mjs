#!/usr/bin/env node
// pre-read: find the part of local bulk worth opening, without Claude reading it all.
// A log, a long file or another chat's transcript is split into parts of about 3k
// tokens, Jev judges each part against one question, and a short table names the
// line ranges to open ("answers" and "uncertain").
//
//   node pre-read.mjs run --question "<what you are looking for>" <file>...
//        [--kind log|file|transcript] [--max-parts 400] [--out <dir>]
//        [--private-roots "<folder>;<folder>"] [--jev-key jev-compaction] [--model jev-1.14.0]
//   Stages on one run folder: plan | judge | report --out <dir>
//   A transcript's messages as text: show <file> --lines <a>-<b>
//   Evaluation:                      score --out <dir> --labels <labels.json>
//
// What leaves this PC: the text of every judged part goes to TypeSafe (owner decision,
// 17 November 2026). A file in a private folder, a file whose text or path names one, and
// a chat the compaction plugin marked private are never sent: the same `privateRoots`
// the compaction plugin reads. An unreadable list sends nothing.
//
// What is written: line ranges, sizes, hashes and probabilities. No text of a file or a
// transcript goes into the run folder, the cache or the worker's job file; the worker
// reads each part from the source file again and checks its hash.
//
// Keys: this process holds none. Jev runs in a child started by with-key.mjs. Fixed rules
// live in code (THRESHOLDS, route(), the part cap); a failed call is an "error" row,
// never "doesn't". The splitter and the Jev caller are web-batch.mjs's.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHUNK_CHARS, DEFAULTS as WEB, THRESHOLDS, callJev, chunkText, pool, readJson, runNode, sha256, short, writeJson } from "./web-batch.mjs";

const SELF = fileURLToPath(import.meta.url);

export const DEFAULTS = {
  maxParts: 400, // about 1.2M Jev input tokens at the most
  model: WEB.model,
  jevKey: WEB.jevKey,
  binDir: WEB.binDir,
  jevConcurrency: WEB.jevConcurrency,
  home: join(homedir(), ".local", "share", "pre-read"),
  settingsFile: join(homedir(), ".claude", "settings.json"), // pluginConfigs holds the plugin's privateRoots
  markerDir: join(homedir(), ".claude", "vendor", "compaction", "state", "private-sessions"),
};
export const LIMITS = { maxParts: 2000 };
export const MIN_TEXT_CHARS = 200; // a shorter file is read directly, without a Jev call
export const COMPACTION_PLUGIN = "fast-jev-compaction-atlas@";

// The bar a labelled run is scored against (recipes/pre-read.md). Written before the first
// call; change it only with a new measurement. Two more points have no number: a question
// must not lose every relevant part, and recall must be above the keyword rule's
// (`someFound_met` and `aboveFixedRule_met` in scoreRun).
export const BAR = { recall: 0.9, falseAnswers: 0.1, openShare: 0.35 };

// ---------- the question wording, in one place ----------
// `describes` goes into the state, so Jev knows what kind of text the part is; the two
// criteria say what "contains what the question asks for" means for that kind.
export const KINDS = {
  log: {
    describes: "output log of a build, test or CI run",
    true: "This part of the log shows the output the question asks for: the command, message, error or result itself.",
    false: "This part of the log shows other steps or other output, with nothing the question asks for.",
  },
  file: {
    describes: "document",
    true: "This part of the document states the facts, decisions or instructions the question asks for, fully or in part.",
    false: "This part of the document states nothing the question asks for, even if it is about a related subject.",
  },
  transcript: {
    describes: "chat between a user and an AI coding assistant, with the assistant's tool calls and their output",
    true: "In this part of the chat the user or the assistant says, decides, finds or does what the question asks for.",
    false: "This part of the chat is about other work, or mentions the subject without what the question asks for.",
  },
};
export const questionsFor = (kind) => ({
  answers: {
    type: "noul",
    instructions: "Does `text` contain what `question` asks for?",
    criteria: { true: KINDS[kind].true, false: KINDS[kind].false },
  },
  about: {
    type: "noul",
    instructions: "Is `text` about the subject of `question`?",
    criteria: {
      true: "This part deals with the thing the question asks about, whether or not it holds the answer.",
      false: "This part deals with other things only.",
    },
  },
});
export const QUESTION_IDS = ["answers", "about"];
export const QUESTION_VERSION = sha256(JSON.stringify(Object.keys(KINDS).map((k) => [KINDS[k].describes, questionsFor(k)]))).slice(0, 12);

export const VERDICTS = ["answers", "uncertain", "error", "related", "doesn't"]; // table order
const OPEN = new Set(["answers", "uncertain"]);
const estTokens = (chars) => Math.round(chars / 4);
const lastName = (path) => String(path).split(/[\\/]/).pop();

// ---------- private folders: the compaction plugin's rules ----------
// A port of the pure functions in the plugin's hooks/atlas-scope.ts (0.4.1), so the two
// agree on what a private folder is and on what "names one" means.

export function normalizeDir(dir) {
  if (typeof dir !== "string") return null;
  let d = dir.trim().replace(/\//g, "\\");
  if (/^\\\\[?.]\\unc\\/i.test(d)) return null;
  if (/^\\\\[?.]\\/.test(d)) d = d.slice(4);
  if (!/^[a-z]:(\\|$)/i.test(d)) return null;
  const out = [];
  for (const raw of d.toLowerCase().split(/\\+/)) {
    const segment = raw === ".." ? raw : raw.replace(/[. ]+$/, "");
    if (segment === "") continue;
    if (segment === "..") {
      if (out.length > 1) out.pop();
      continue;
    }
    if (/~\d/.test(segment)) return null;
    out.push(segment);
  }
  return out.length > 0 ? out.join("\\") : null;
}

// The option is a semicolon-separated list; entries that are not drive folders are counted.
export function resolvePrivateRoots(option) {
  let entries;
  if (option === undefined || option === null) entries = [];
  else if (typeof option === "string") entries = option.split(";");
  else if (Array.isArray(option) && option.every((x) => typeof x === "string")) entries = option.flatMap((x) => x.split(";"));
  else return { roots: [], ignored: 1 };
  const roots = [];
  let ignored = 0;
  for (const raw of entries) {
    const entry = raw.trim().replace(/^"(.*)"$/, "$1").trim();
    if (!entry) continue;
    if (normalizeDir(entry) === null) ignored += 1;
    else roots.push(entry);
  }
  return { roots, ignored };
}

export function privateNeedles(roots) {
  const needles = new Set();
  for (const root of roots) {
    const r = normalizeDir(root);
    if (r === null) continue;
    const segments = r.split("\\");
    const flat = r.replace(/[^a-z0-9]/g, "-"); // Claude's project-folder form
    if (segments.length === 1) {
      needles.add(`${segments[0]}/`);
      needles.add(`${flat}-`);
      continue;
    }
    needles.add(segments.join("/"));
    needles.add(`/${segments.slice(1).join("/")}`);
    if (segments.length >= 3) needles.add(segments.slice(-2).join("/"));
    needles.add(`../${segments[segments.length - 1]}`);
    needles.add(flat.slice(2));
  }
  return [...needles];
}

export const normalizeText = (text) => String(text).toLowerCase().replace(/%5c|%2f/g, "/").replace(/[\\/]+/g, "/");

export function privateMatcher(roots) {
  const needles = privateNeedles(roots);
  if (needles.length === 0) return null;
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const bounded = needles.filter((n) => /^[a-z0-9]/.test(n)).map(esc);
  const open = needles.filter((n) => !/^[a-z0-9]/.test(n)).map(esc);
  const parts = [];
  if (bounded.length > 0) parts.push(`(?:^|[^a-z0-9])(?:${bounded.join("|")})`);
  if (open.length > 0) parts.push(`(?:${open.join("|")})`);
  return new RegExp(parts.join("|"));
}

// In a root, or above one (a chat that ran in Desktop saw every project under it). Stricter
// than the plugin's function in one place: a folder that cannot be compared counts as private
// here, where the plugin leaves that doubt to its caller.
export function touchesPrivateRoot(dir, roots) {
  const d = normalizeDir(dir);
  if (d === null) return true;
  return roots.some((root) => {
    const r = normalizeDir(root);
    return r === null || d === r || d.startsWith(r + "\\") || r.startsWith(d + "\\");
  });
}

// The lines of a text that are JSON objects (a chat transcript is one per line).
function jsonObjects(text) {
  const out = [];
  for (const raw of String(text).replace(/^﻿/, "").split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("{")) continue;
    try {
      const j = JSON.parse(line);
      if (j && typeof j === "object") out.push(j);
    } catch {
      /* not JSON: the raw text is checked as it is */
    }
  }
  return out;
}

const MAX_SCAN_NODES = 5_000_000;
// Whether any string in `value` (keys included, any depth) names a root; null when the
// structure is too large to say. The plugin's mentionsPrivateRoot: a path inside a JSON
// string is matched as the string reads, not as its escaped form in the file.
function stringsName(value, matcher) {
  const stack = [value];
  let nodes = 0;
  while (stack.length > 0) {
    if (++nodes > MAX_SCAN_NODES) return null;
    const item = stack.pop();
    if (typeof item === "string") {
      if (matcher.test(normalizeText(item))) return true;
    } else if (Array.isArray(item)) {
      for (const child of item) stack.push(child);
    } else if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) stack.push(key, child);
    }
  }
  return false;
}

// Why a source is not sent, or null when it may be. `path` is the real path and `typedPath`
// the one given; `text` is the file as read and `partTexts` the parts as they would be sent
// (a chat rendered, a log without colour codes): a folder is looked for in both forms.
// `markerNames` is the listing of the plugin's private-session folder.
export function privateReason({ path, typedPath, text = "", partTexts = [], roots = [], markerNames = [] }) {
  const paths = [...new Set([path, typedPath].filter((p) => typeof p === "string"))];
  const objects = jsonObjects(text);
  // A chat is known by its file name, by a folder above it (a subagent's chat lies in a
  // folder named after its session) and by the session ids its lines carry.
  const ids = new Set();
  for (const p of paths) for (const segment of p.split(/[\\/]/)) ids.add(segment.replace(/\.jsonl$/i, "").toLowerCase());
  for (const o of objects) if (typeof o.sessionId === "string") ids.add(o.sessionId.toLowerCase());
  if (markerNames.some((n) => /\.json$/i.test(String(n)) && ids.has(String(n).slice(0, -5).toLowerCase()))) return "the chat is marked private";
  if (roots.length === 0) return null;
  for (const p of paths) {
    const d = normalizeDir(p);
    if (d === null) return "its path cannot be compared with the private folders";
    for (const root of roots) {
      const r = normalizeDir(root);
      if (r === null || d === r || d.startsWith(r + "\\")) return "it is in a private folder";
    }
  }
  // Whatever kind the file was read as: a line that carries a working folder is a chat's.
  if (objects.some((o) => typeof o.cwd === "string" && touchesPrivateRoot(o.cwd, roots))) return "the chat ran in or above a private folder";
  const matcher = privateMatcher(roots);
  if (!matcher) return null;
  if (paths.some((p) => matcher.test(normalizeText(p)))) return "its path names a private folder";
  if (matcher.test(normalizeText(text)) || partTexts.some((t) => matcher.test(normalizeText(t)))) return "its text names a private folder";
  const inJson = stringsName(objects, matcher);
  if (inJson === null) return "its text is too large to check for private folders";
  if (inJson) return "its text names a private folder";
  return null;
}

// The list for this run: the plugin's option in the user settings, `--private-roots`, and
// the plugin's markers. `error` is set when any of it cannot be read: nothing is sent then.
// The messages are fixed words: a parser's own message can quote the settings file.
// Not read: a list in managed settings or in a file given to Claude Code with `--settings`.
export function loadPrivacy({ settingsFile = DEFAULTS.settingsFile, markerDir = DEFAULTS.markerDir, extra } = {}) {
  try {
    const options = [];
    if (existsSync(settingsFile)) {
      let raw, settings;
      try {
        raw = readFileSync(settingsFile, "utf8");
      } catch (e) {
        throw new Error(`the settings file was not read (${e.code ?? "error"})`);
      }
      try {
        settings = JSON.parse(raw);
      } catch {
        throw new Error("the settings file is not valid JSON");
      }
      const configs = settings?.pluginConfigs ?? {};
      if (typeof configs !== "object") throw new Error("pluginConfigs is not an object");
      for (const [id, config] of Object.entries(configs)) {
        if (!id.startsWith(COMPACTION_PLUGIN)) continue;
        const value = config?.options?.privateRoots;
        if (value !== undefined && typeof value !== "string") throw new Error("privateRoots is not text");
        if (value) options.push(value);
      }
    }
    if (extra) options.push(extra);
    const { roots, ignored } = resolvePrivateRoots(options);
    let markerNames = [];
    if (existsSync(markerDir)) {
      try {
        markerNames = readdirSync(markerDir);
      } catch (e) {
        throw new Error(`the private-session markers were not read (${e.code ?? "error"})`);
      }
    }
    return { roots, ignored, markerNames, error: null };
  } catch (e) {
    return { roots: [], ignored: 0, markerNames: [], error: e.message };
  }
}

// Why a loaded source may not be sent, with the list as it is now. The plan asks, and the
// judge asks again with a list read again: a folder or a marker added in between counts.
function notSent(privacy, source, loaded) {
  if (!privacy || privacy.error) return `the private-folder list could not be read (${privacy?.error ?? "not loaded"})`;
  return privateReason({ path: source.path, typedPath: source.typed, text: loaded.text, partTexts: loaded.parts.map((p) => p.text), roots: privacy.roots, markerNames: privacy.markerNames });
}

// ---------- parts ----------

const CUT = { toolInput: 600, toolResult: 2000 }; // a tool call and its output are cut to this
const cutText = (s, n) => (s.length > n ? `${s.slice(0, n)} [${s.length - n} more characters]` : s);
const contentText = (c) =>
  typeof c === "string"
    ? c
    : Array.isArray(c)
      ? c.map((x) => (typeof x === "string" ? x : x?.type === "text" ? (x.text ?? "") : x?.type === "image" ? "[image]" : "")).filter(Boolean).join("\n")
      : "";

// A Claude Code transcript (JSONL) as readable text: one block per message line, with the
// line it came from. Lines that are not a user or assistant message are bookkeeping.
export function renderTranscript(text) {
  const blocks = [];
  const cwds = new Set();
  text.split("\n").forEach((raw, n) => {
    if (!raw.trim()) return;
    let j;
    try {
      j = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof j?.cwd === "string") cwds.add(j.cwd);
    if (j?.type !== "user" && j?.type !== "assistant") return;
    const who = j.type === "user" ? "User" : "Assistant";
    const c = j.message?.content;
    const out = [];
    if (typeof c === "string") {
      if (c.trim()) out.push(`${who}: ${c}`);
    } else if (Array.isArray(c)) {
      for (const item of c) {
        if (item?.type === "text" && item.text?.trim()) out.push(`${who}: ${item.text}`);
        else if (item?.type === "tool_use") out.push(`Assistant calls ${item.name}: ${cutText(JSON.stringify(item.input ?? {}), CUT.toolInput)}`);
        else if (item?.type === "tool_result") out.push(`Tool output: ${cutText(contentText(item.content), CUT.toolResult)}`);
      }
    }
    if (out.length) blocks.push({ line: n + 1, text: out.join("\n") });
  });
  return { blocks, cwds: [...cwds] };
}

// Whole messages per part; a message longer than a part is cut, every piece on its line.
function chunkBlocks(blocks) {
  const parts = [];
  let cur = [], size = 0;
  const flush = () => {
    if (cur.length) parts.push({ text: cur.map((b) => b.text).join("\n\n"), startLine: cur[0].line, endLine: cur.at(-1).line });
    cur = [];
    size = 0;
  };
  for (const b of blocks) {
    if (b.text.length > CHUNK_CHARS) {
      flush();
      for (const c of chunkText(b.text, Infinity).chunks) parts.push({ text: c.text, startLine: b.line, endLine: b.line });
      continue;
    }
    if (size && size + b.text.length + 2 > CHUNK_CHARS) flush();
    cur.push(b);
    size += b.text.length + 2;
  }
  flush();
  return parts;
}

export function detectKind(path, text) {
  if (/\.jsonl$/i.test(path)) {
    const first = text.split("\n").find((l) => l.trim());
    try {
      const j = JSON.parse(first);
      if (j && typeof j === "object" && typeof j.type === "string") return "transcript";
    } catch {
      /* not a transcript */
    }
  }
  return /\.(log|out)$/i.test(path) ? "log" : "file";
}

// The parts of one text, each with the line range of the source file it covers (1-based).
export function partsOf(text, kind) {
  if (kind === "transcript") {
    const { blocks, cwds } = renderTranscript(text);
    return { parts: chunkBlocks(blocks), cwds };
  }
  // Colour codes in a log are noise; taking them out moves no line.
  const clean = kind === "log" ? text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "") : text;
  // A blank part (a line end after a full part) holds nothing to judge.
  return { parts: chunkText(clean, Infinity).chunks.filter((p) => p.text.trim() !== ""), cwds: [] };
}

// Reads a source and splits it. Text stays in memory: callers write none of it.
export function loadSource(path, kindOption) {
  const buf = readFileSync(path);
  // Windows PowerShell writes a redirected log as UTF-16 with a byte order mark.
  const utf16 = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe;
  if (!utf16 && buf.subarray(0, 8000).includes(0)) throw new Error("not a text file");
  const text = (utf16 ? buf.subarray(2).toString("utf16le") : buf.toString("utf8")).replace(/^﻿/, "");
  const kind = kindOption ?? detectKind(path, text);
  const { parts, cwds } = partsOf(text, kind);
  if (kind === "transcript" && parts.length === 0 && text.trim()) throw new Error("no chat messages in it: not a chat transcript");
  return { kind, text, parts, cwds };
}

export function jevBody({ question, kind, name, k, total, text, model }) {
  const source = { kind: KINDS[kind].describes, part: `${k} of ${total}` };
  if (kind !== "transcript") source.name = name; // a transcript's file name is an id
  return { model, state: { question, source, text }, questions: questionsFor(kind) };
}

export function cacheKey(body) {
  return sha256(JSON.stringify({ v: QUESTION_VERSION, model: body.model, state: body.state }));
}

// ---------- routing: the truth table ----------
// A = p(answers), T = p(about), for one part.
//   Jev failure, past the part cap, not sent  -> error
//   A >= yes                                  -> answers
//   A <= no and T >= yes                      -> related (on the subject, no answer: not opened)
//   A <= no                                   -> doesn't
//   otherwise                                 -> uncertain
export function route(part) {
  if (part.status === "capped") return { verdict: "error", reason: "not judged: past the part cap" };
  if (part.status === "short") return { verdict: "uncertain", reason: `short file (${part.chars} chars): read it directly` };
  if (part.status === "empty") return { verdict: "doesn't", reason: "empty file" };
  if (part.jevError) return { verdict: "error", reason: `Jev: ${short(part.jevError, 110)}` };
  const j = part.jev;
  if (!j) return { verdict: "error", reason: "not judged" };
  const { yes, no } = THRESHOLDS;
  if (j.answers >= yes) return { verdict: "answers", reason: `holds an answer (${j.answers.toFixed(2)})` };
  if (j.answers <= no && j.about >= yes) return { verdict: "related", reason: `on the subject, no answer (${j.answers.toFixed(2)})` };
  if (j.answers <= no) return { verdict: "doesn't", reason: `nothing asked for (${j.answers.toFixed(2)})` };
  return { verdict: "uncertain", reason: `answer unclear (${j.answers.toFixed(2)})` };
}

// ---------- stages ----------

// Reads and splits every file, and decides which may be sent. The manifest holds no text.
export function planStage({ question, files, kind, maxParts, privacy }) {
  if (!files?.length) throw new Error("name at least one file");
  let budget = maxParts;
  const sources = files.map((file, n) => {
    // `typed` is the path as given and `path` the real one: both are checked, and the name
    // that goes to Jev is the real file's.
    const s = { i: n + 1, path: resolve(file), typed: resolve(file), name: lastName(file), kind: kind ?? null, status: "ok", error: null, chars: 0, parts: [] };
    let loaded;
    try {
      s.path = realpathSync(s.path);
      s.name = lastName(s.path);
      loaded = loadSource(s.path, kind);
    } catch (e) {
      return Object.assign(s, { status: "error", error: `not read: ${short(e.code === "ENOENT" ? "no such file" : (e.code ?? e.message), 100)}` });
    }
    s.kind = loaded.kind;
    const why = notSent(privacy, s, loaded);
    if (why) return Object.assign(s, { status: "private", error: `not sent: ${why}` });
    s.chars = loaded.parts.reduce((sum, p) => sum + p.text.length, 0);
    const tiny = s.chars < MIN_TEXT_CHARS ? (loaded.text.trim() ? "short" : "empty") : null;
    const list = tiny && loaded.parts.length === 0 ? [{ text: "", startLine: 1, endLine: 1 }] : loaded.parts;
    s.parts = list.map((p, k) => {
      const part = { id: `${s.i}.${k + 1}`, k: k + 1, startLine: p.startLine, endLine: p.endLine, chars: p.text.length, hash: sha256(p.text), status: tiny ?? "pending" };
      if (!tiny && budget-- <= 0) part.status = "capped";
      return part;
    });
    return s;
  });
  return { created: new Date().toISOString(), question, maxParts, privacy: { roots: privacy.roots.length, ignored: privacy.ignored, error: privacy.error }, sources };
}

export async function judgeStage(manifest, providers, opts) {
  mkdirSync(opts.cacheDir, { recursive: true });
  const jobs = [];
  for (const s of manifest.sources) {
    const pending = s.parts.filter((p) => p.status === "pending");
    for (const p of s.parts) {
      delete p.jev;
      delete p.jevError;
    }
    if (!pending.length) continue;
    let loaded = null;
    try {
      loaded = loadSource(s.path, s.kind);
    } catch (e) {
      for (const p of pending) p.jevError = `the file could not be read again: ${short(e.code ?? e.message, 80)}`;
      continue;
    }
    // Asked again on the text just read, with the list as `opts.privacy` holds it now.
    const why = notSent(opts.privacy, s, loaded);
    if (why) {
      Object.assign(s, { status: "private", error: `not sent: ${why}`, parts: [] });
      continue;
    }
    for (const p of pending) {
      const text = loaded.parts[p.k - 1]?.text;
      if (text === undefined || sha256(text) !== p.hash) {
        p.jevError = "the file changed after the plan: run again";
        continue;
      }
      const job = { path: s.path, kind: s.kind, name: s.name, k: p.k, total: s.parts.length, hash: p.hash, question: manifest.question, model: opts.model };
      job.key = cacheKey(jevBody({ ...job, text }));
      jobs.push({ job, part: p });
    }
  }
  const results = new Map();
  const misses = [];
  for (const { job } of jobs) {
    const f = join(opts.cacheDir, `${job.key}.json`);
    if (existsSync(f)) {
      try {
        const c = readJson(f);
        if (!QUESTION_IDS.every((id) => typeof c.answers?.[id] === "number" && c.answers[id] >= 0 && c.answers[id] <= 1)) throw new Error("broken cache entry");
        results.set(job.key, { ok: true, answers: c.answers, model: c.model, usage: null });
        continue;
      } catch {
        /* a broken cache entry is asked again */
      }
    }
    if (!misses.some((m) => m.key === job.key)) misses.push(job);
  }
  let fresh = [];
  if (misses.length) {
    try {
      fresh = await providers.judge(misses);
      if (!Array.isArray(fresh) || fresh.length !== misses.length) throw new Error("Jev worker returned the wrong number of results");
    } catch (e) {
      fresh = misses.map(() => ({ ok: false, error: e.message }));
    }
  }
  const usage = { input_tokens: 0, output_tokens: 0, requests: misses.length, cached: jobs.length - misses.length };
  misses.forEach((m, n) => {
    const r = fresh[n] ?? { ok: false, error: "no result" };
    results.set(m.key, r);
    if (r.ok) {
      writeJson(join(opts.cacheDir, `${m.key}.json`), { model: r.model, answers: r.answers, questionVersion: QUESTION_VERSION });
      usage.input_tokens += r.usage?.input_tokens ?? 0;
      usage.output_tokens += r.usage?.output_tokens ?? 0;
    }
  });
  const models = new Set();
  for (const { job, part } of jobs) {
    const r = results.get(job.key);
    if (!r.ok) {
      part.jevError = short(r.error, 160);
      continue;
    }
    if (r.model) models.add(r.model);
    part.jev = { answers: r.answers.answers, about: r.answers.about };
  }
  for (const s of manifest.sources) for (const p of s.parts) Object.assign(p, route(p));
  manifest.jev = { requestedModel: opts.model, models: [...models], questionVersion: QUESTION_VERSION, usage };
  return manifest;
}

// Runs of neighbouring parts as "a-b, c-d" line ranges, so a long list stays one line.
function ranges(parts) {
  const out = [];
  for (const p of parts) {
    const last = out.at(-1);
    if (last && last.k + 1 === p.k) Object.assign(last, { k: p.k, endLine: p.endLine });
    else out.push({ k: p.k, startLine: p.startLine, endLine: p.endLine });
  }
  return out.map((r) => `${r.startLine}-${r.endLine}`).join(", ");
}

export function renderReport(manifest, outDir) {
  const cell = (s) => String(s ?? "-").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
  const all = manifest.sources.flatMap((s) => s.parts.map((p) => ({ s, p })));
  const shown = all
    .filter(({ p }) => OPEN.has(p.verdict) || (p.verdict === "error" && p.status !== "capped"))
    .sort((a, b) => VERDICTS.indexOf(a.p.verdict) - VERDICTS.indexOf(b.p.verdict) || (b.p.jev?.answers ?? 0) - (a.p.jev?.answers ?? 0) || a.s.i - b.s.i || a.p.k - b.p.k);
  const num = (v) => (typeof v === "number" ? v.toFixed(2) : "-");
  const lines = [
    `Question: ${manifest.question}`,
    `Run folder: ${resolve(outDir)}`,
    "",
    "Sources:",
    ...manifest.sources.map((s) =>
      s.status === "ok"
        ? `${s.i}. ${s.path} (${s.kind}, ${s.parts.length} ${s.parts.length === 1 ? "part" : "parts"}, about ${estTokens(s.chars)} tokens)`
        : `${s.i}. ${s.path}: ${s.error}`,
    ),
    "",
    "| part | verdict | p(answers) | p(about) | reason | open |",
    "| --- | --- | --- | --- | --- | --- |",
    ...shown.map(({ s, p }) => `| ${p.id} | ${p.verdict} | ${num(p.jev?.answers)} | ${num(p.jev?.about)} | ${cell(p.reason)} | source ${s.i}, lines ${p.startLine}-${p.endLine} |`),
    ...manifest.sources.filter((s) => s.status !== "ok").map((s) => `| ${s.i} | error | - | - | ${cell(s.error)} | - |`),
  ];
  const count = Object.fromEntries(VERDICTS.map((v) => [v, all.filter(({ p }) => p.verdict === v).length]));
  count.error += manifest.sources.filter((s) => s.status !== "ok").length;
  const per = (test) => manifest.sources.map((s) => [s, s.parts.filter(test)]).filter(([, list]) => list.length);
  const listing = (test) => per(test).map(([s, list]) => `source ${s.i} lines ${ranges(list)}`).join("; ");
  const allChars = all.reduce((sum, { p }) => sum + p.chars, 0);
  const openChars = all.filter(({ p }) => OPEN.has(p.verdict)).reduce((sum, { p }) => sum + p.chars, 0);
  const table = lines.join("\n");
  const jv = manifest.jev ?? {};
  const summary = {
    counts: count,
    open: shown.filter(({ p }) => OPEN.has(p.verdict)).map(({ s, p }) => ({ id: p.id, path: s.path, lines: `${p.startLine}-${p.endLine}` })),
    jev: jv,
    tokens: { allEst: estTokens(allChars), openEst: estTokens(openChars), tableEst: estTokens(table.length) },
  };
  const foot = ["", `Open: ${count.answers} answers, ${count.uncertain} uncertain. Errors: ${count.error}. Not opened: ${count.related} related, ${count["doesn't"]} doesn't.`];
  const related = listing((p) => p.verdict === "related");
  if (related) foot.push(`Related, no answer (open only when the rows above do not settle it): ${related}.`);
  const capped = listing((p) => p.status === "capped");
  if (capped) foot.push(`Not judged, past the cap of ${manifest.maxParts} parts: ${capped}. Raise --max-parts or ask about fewer files.`);
  if (manifest.sources.some((s) => s.kind === "transcript" && s.status === "ok")) foot.push(`A chat's lines are JSON: \`node "${SELF}" show <path> --lines <a>-<b>\` prints those messages as text.`);
  if (manifest.privacy?.ignored) foot.push(`Private folders: ${manifest.privacy.ignored} entries of the list are not absolute drive folders and were ignored.`);
  foot.push(
    `Jev: ${jv.usage?.requests ?? 0} requests, ${jv.usage?.cached ?? 0} from cache, ${jv.usage?.input_tokens ?? 0} input tokens, model ${jv.models?.join(", ") || jv.requestedModel || "?"}.`,
    `Tokens (est., 4 chars each): all text ${summary.tokens.allEst}; the parts to open ${summary.tokens.openEst}; this table ${summary.tokens.tableEst}.`,
  );
  return { text: table + "\n" + foot.join("\n"), summary };
}

// ---------- scoring a labelled run ----------

const STOP = new Set("the and for was were what which where when why how did does with that this from about into are has have had not any its there their then than who whom whose will would should could been being but can all one out our you your".split(" "));
export const contentWords = (question) => [...new Set((String(question).toLowerCase().match(/[a-z0-9][a-z0-9_.-]{2,}/g) ?? []).filter((w) => !STOP.has(w)))];

// The fixed rule Jev has to beat: parts ranked by how many of the question's content
// words they hold, and as many opened as Jev opened (parts with no word fill the rest, in
// file order). `texts` maps a part id to its text.
export function keywordRule(question, rows, texts, opens, labels) {
  const words = contentWords(question);
  const ranked = rows
    .map((p, n) => ({ p, n, hits: words.filter((w) => (texts.get(p.id) ?? "").toLowerCase().includes(w)).length }))
    .sort((a, b) => b.hits - a.hits || a.n - b.n)
    .slice(0, opens);
  const relevant = rows.filter((p) => labels[p.id] === true).length;
  const caught = ranked.filter((r) => labels[r.p.id] === true).length;
  return { words: words.length, opened: ranked.length, caught, recall: relevant ? caught / relevant : null };
}

// labels: { "<part id>": true | false } (true = the part holds what the question asks for).
// Read only here, after judging; the labels never reach Jev.
export function scoreRun(manifest, labels, { texts } = {}) {
  const parts = manifest.sources.flatMap((s) => s.parts);
  const rows = parts.filter((p) => Object.hasOwn(labels, p.id));
  const total = parts.length;
  // A label for a part the run does not hold (its file was not read or not sent): when it
  // says "relevant", that part was not found, and it counts as a miss.
  const known = new Set(parts.map((p) => p.id));
  const lost = Object.keys(labels).filter((id) => !known.has(id));
  const lostRelevant = lost.filter((id) => labels[id] === true);
  const relevant = rows.filter((p) => labels[p.id] === true);
  const opened = rows.filter((p) => OPEN.has(p.verdict));
  const caught = relevant.filter((p) => OPEN.has(p.verdict));
  const answers = rows.filter((p) => p.verdict === "answers");
  const falseAnswers = answers.filter((p) => labels[p.id] === false);
  const chars = (list) => list.reduce((sum, p) => sum + p.chars, 0);
  const relevantCount = relevant.length + lostRelevant.length;
  const recall = relevantCount ? caught.length / relevantCount : null;
  const fixedRule = texts ? keywordRule(manifest.question, rows, texts, opened.length, labels) : null;
  const score = {
    labelled: rows.length,
    unlabelled: total - rows.length,
    labelsWithoutPart: lost.length,
    relevant: relevantCount,
    caught: caught.length,
    recall,
    caughtWithRelated: relevant.filter((p) => OPEN.has(p.verdict) || p.verdict === "related").length,
    missed: [
      ...relevant.filter((p) => !OPEN.has(p.verdict)).map((p) => ({ id: p.id, verdict: p.verdict, reason: p.reason })),
      ...lostRelevant.map((id) => ({ id, verdict: "error", reason: "not in the run" })),
    ],
    answers: answers.length,
    falseAnswers: falseAnswers.map((p) => ({ id: p.id, reason: p.reason })),
    opened: opened.length,
    openedNotRelevant: opened.filter((p) => labels[p.id] === false).length,
    openChars: chars(opened),
    allChars: chars(rows),
    openShare: chars(rows) ? chars(opened) / chars(rows) : null,
    errors: rows.filter((p) => p.verdict === "error").length,
    fixedRule,
  };
  score.bar = {
    ...BAR,
    recall_met: recall === null ? null : recall >= BAR.recall,
    // A run has one question: it must not lose every relevant part of it.
    someFound_met: relevantCount ? caught.length > 0 : null,
    falseAnswers_met: answers.length ? falseAnswers.length / answers.length <= BAR.falseAnswers : true,
    openShare_met: score.openShare === null ? null : score.openShare <= BAR.openShare,
    aboveFixedRule_met: fixedRule?.recall == null || recall === null ? null : recall > fixedRule.recall,
  };
  return score;
}

// ---------- Jev worker (runs in the child that holds the key) ----------
// A job names a part by file and number. The worker reads the text from the file and
// refuses a part whose hash is not the planned one.
export async function jevWorker(jobsFile, resultsFile, { env = process.env, fetchImpl = fetch, sleep } = {}) {
  const jobs = readJson(jobsFile);
  const key = env.TYPESAFE_API_KEY;
  let results;
  if (!key) {
    results = jobs.map(() => ({ ok: false, error: "TYPESAFE_API_KEY missing: the DPAPI key could not be decrypted" }));
  } else {
    results = new Array(jobs.length);
    const loaded = new Map();
    await pool(jobs, DEFAULTS.jevConcurrency, async (job, n) => {
      try {
        const id = `${job.kind}|${job.path}`;
        if (!loaded.has(id)) loaded.set(id, loadSource(job.path, job.kind));
        const text = loaded.get(id).parts[job.k - 1]?.text;
        if (text === undefined || sha256(text) !== job.hash) throw new Error("the file changed after the plan: run again");
        const r = await callJev(jevBody({ ...job, text }), { key, fetchImpl, sleep });
        // The API's own error text could quote the request: only the status is kept.
        if (!r.ok && /^HTTP \d+/.test(r.error)) r.error = r.error.match(/^HTTP \d+/)[0];
        results[n] = r;
      } catch (e) {
        results[n] = { ok: false, error: short(e.message, 160) };
      }
    });
  }
  writeJson(resultsFile, results);
  return results;
}

export function realProviders({ binDir = DEFAULTS.binDir, jevKey = DEFAULTS.jevKey, workDir }) {
  return {
    async judge(jobs) {
      const shim = join(binDir, "with-key.mjs");
      if (!existsSync(shim)) throw new Error(`${shim} not found (the DPAPI shims live in ~/.local/bin)`);
      const jobsFile = join(workDir, "jev-jobs.json");
      const resultsFile = join(workDir, "jev-results.json");
      writeJson(jobsFile, jobs);
      rmSync(resultsFile, { force: true });
      try {
        const r = await runNode([shim, jevKey, "TYPESAFE_API_KEY", process.execPath, SELF, "judge-worker", jobsFile, resultsFile], { timeoutMs: 30 * 60_000 });
        if (!existsSync(resultsFile)) throw new Error(`Jev worker failed (exit ${r.code}): ${short(r.stderr)}`);
        return readJson(resultsFile);
      } finally {
        rmSync(jobsFile, { force: true });
        rmSync(resultsFile, { force: true });
      }
    },
  };
}

// ---------- show: a line range as text ----------
export function showLines(path, from, to, kindOption) {
  const text = readFileSync(path, "utf8");
  const kind = kindOption ?? detectKind(path, text);
  if (kind === "transcript") return renderTranscript(text).blocks.filter((b) => b.line >= from && b.line <= to).map((b) => `[line ${b.line}] ${b.text}`).join("\n\n");
  return text.split("\n").slice(from - 1, to).join("\n");
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const o = { cmd, files: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const v = () => {
      if (i + 1 >= rest.length) throw new Error(`${a} needs a value`);
      return rest[++i];
    };
    if (a === "--question") o.question = v();
    else if (a === "--kind") o.kind = v();
    else if (a === "--max-parts") o.maxParts = Number(v());
    else if (a === "--out") o.out = v();
    else if (a === "--jev-key") o.jevKey = v();
    else if (a === "--model") o.model = v();
    else if (a === "--cache-dir") o.cacheDir = v();
    else if (a === "--labels") o.labels = v();
    else if (a === "--lines") o.lines = v();
    else if (a === "--private-roots") o.privateRoots = v();
    else if (a === "--settings-file") o.settingsFile = v();
    else if (a === "--marker-dir") o.markerDir = v();
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else o.files.push(a);
  }
  o.maxParts ??= DEFAULTS.maxParts;
  o.model ??= DEFAULTS.model;
  o.jevKey ??= DEFAULTS.jevKey;
  if (!Number.isInteger(o.maxParts) || o.maxParts < 1) throw new Error("--max-parts needs a positive whole number");
  if (o.maxParts > LIMITS.maxParts) throw new Error(`--max-parts is capped at ${LIMITS.maxParts} per run`);
  if (o.kind !== undefined && !Object.hasOwn(KINDS, o.kind)) throw new Error(`--kind is one of ${Object.keys(KINDS).join(", ")}`);
  if (!/^[a-z0-9-]+$/.test(o.jevKey)) throw new Error("--jev-key must be a key name, not a key");
  if (o.lines !== undefined) {
    const m = /^(\d+)-(\d+)$/.exec(o.lines);
    if (!m || Number(m[1]) < 1 || Number(m[2]) < Number(m[1])) throw new Error("--lines is <first>-<last>, 1-based");
    o.from = Number(m[1]);
    o.to = Number(m[2]);
  }
  return o;
}

function defaultOut(question) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  const slug = String(question ?? "run").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return join(DEFAULTS.home, "runs", `${stamp}-${slug}`);
}

export async function main(argv, { providers, log = console.log } = {}) {
  const o = parseArgs(argv);
  if (o.cmd === "judge-worker") {
    const [jobs, results] = o.files;
    await jevWorker(jobs, results);
    return;
  }
  if (o.cmd === "show") {
    if (o.files.length !== 1 || !o.from) throw new Error("usage: pre-read.mjs show <file> --lines <first>-<last>");
    log(showLines(o.files[0], o.from, o.to, o.kind));
    return;
  }
  const stages = { run: ["plan", "judge", "report"], plan: ["plan"], judge: ["judge"], report: ["report"], score: ["score"] }[o.cmd];
  if (!stages) throw new Error("usage: pre-read.mjs run|plan|judge|report|show|score [options] (see the header of this file)");
  if (!o.out && !stages.includes("plan")) throw new Error("--out <run folder> is required for this stage");
  const outDir = resolve(o.out ?? defaultOut(o.question));
  mkdirSync(outDir, { recursive: true });
  const manifestFile = join(outDir, "manifest.json");
  const p = providers ?? realProviders({ jevKey: o.jevKey, workDir: outDir });
  const opts = { model: o.model, cacheDir: o.cacheDir ?? join(DEFAULTS.home, "cache") };
  let m = existsSync(manifestFile) && !stages.includes("plan") ? readJson(manifestFile) : null;
  for (const stage of stages) {
    if (stage === "plan") {
      if (!o.question) throw new Error("--question is required");
      const privacy = loadPrivacy({ settingsFile: o.settingsFile, markerDir: o.markerDir, extra: o.privateRoots });
      m = planStage({ question: o.question, files: o.files, kind: o.kind, maxParts: o.maxParts, privacy });
      writeJson(manifestFile, m);
      if (o.cmd === "plan") log(`${m.sources.reduce((n, s) => n + s.parts.length, 0)} parts in ${m.sources.length} files -> ${manifestFile}`);
      continue;
    }
    if (!m) throw new Error(`no manifest.json in ${outDir}; run the plan stage first`);
    if (stage === "judge") {
      if (o.question && o.question !== m.question) throw new Error("--question differs from the run's question");
      // Read again, not taken from the plan: the list may have changed since.
      const privacy = loadPrivacy({ settingsFile: o.settingsFile, markerDir: o.markerDir, extra: o.privateRoots });
      m = await judgeStage(m, p, { ...opts, privacy });
      writeJson(manifestFile, m);
    } else if (stage === "report") {
      const { text, summary } = renderReport(m, outDir);
      writeFileSync(join(outDir, "report.md"), text + "\n");
      writeJson(join(outDir, "summary.json"), summary);
      log(text);
    } else if (stage === "score") {
      if (!o.labels) throw new Error("--labels <file> is required");
      // The keyword rule needs the text again; a part that changed since the plan is left out of it.
      const texts = new Map();
      for (const s of m.sources) {
        if (s.status !== "ok") continue;
        try {
          const loaded = loadSource(s.path, s.kind);
          for (const part of s.parts) {
            const text = loaded.parts[part.k - 1]?.text;
            if (text !== undefined && sha256(text) === part.hash) texts.set(part.id, text);
          }
        } catch {
          /* an unreadable file has no keyword score */
        }
      }
      const s = scoreRun(m, readJson(o.labels), { texts });
      writeJson(join(outDir, "score.json"), s);
      log(JSON.stringify(s, null, 2));
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`pre-read: ${e.message}`);
    process.exit(1);
  });
}
