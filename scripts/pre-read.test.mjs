// Run by `npm test` (node --test). The judge is mocked: no network, no keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CHUNK_CHARS, THRESHOLDS } from "../plugins/cookbook/skills/cookbook/scripts/web-batch.mjs";
import {
  BAR, KINDS, LIMITS, QUESTION_IDS,
  contentWords, detectKind, jevBody, jevWorker, judgeStage, keywordRule, loadPrivacy, loadSource, main,
  normalizeDir, parseArgs, partsOf, planStage, privateReason, questionsFor, redact, redactLine, renderReport, renderTranscript,
  resolvePrivateRoots, route, scoreRun, showLines, touchesPrivateRoot,
} from "../plugins/cookbook/skills/cookbook/scripts/pre-read.mjs";

const QUESTION = "Why did the unit test job fail?";
const NO_PRIVACY = { roots: [], ignored: 0, markerNames: [], error: null };
const SEND = { PRE_READ_SEND: "1" }; // what a run with --send gives its worker
const tmp = () => mkdtempSync(join(tmpdir(), "pre-read-"));
const line = (word, n) => `${word} line ${n} `.padEnd(99, "x").slice(0, 99); // 100 characters with its line end
// A file of one part per word: every line of part k carries `words[k]`, and a part is exactly full.
function bulk(words) {
  const perPart = CHUNK_CHARS / 100;
  return words.map((w, k) => Array.from({ length: perPart }, (_, n) => line(w, k * perPart + n)).join("\n")).join("\n");
}
const textOf = (job) => loadSource(job.path, job.kind).parts[job.k - 1].text;

// jev: (text, job) -> { answers, about }
function mocks({ jev = () => ({ answers: 0.05, about: 0.05 }), judge } = {}) {
  const full = (a) => ({ aimed: 0.02, ...a });
  const calls = { judge: 0, jobs: [] };
  return {
    calls,
    providers: {
      async judge(jobs) {
        calls.judge++;
        calls.jobs.push(...jobs);
        if (judge) return judge(jobs);
        return jobs.map((job) => ({ ok: true, model: "jev-1.14.0", usage: { input_tokens: 3000, output_tokens: 2 }, answers: full(jev(textOf(job), job)) }));
      },
    },
  };
}
const byWord = (table) => (text) => {
  for (const [word, answers] of Object.entries(table)) if (text.includes(word)) return answers;
  return { answers: 0.05, about: 0.05 };
};
async function runAll(dir, files, m, extra = {}) {
  const manifest = planStage({ question: QUESTION, files, kind: extra.kind, maxParts: extra.maxParts ?? 400, privacy: extra.privacy ?? NO_PRIVACY });
  await judgeStage(manifest, m.providers, { model: "jev-1.14.0", cacheDir: join(dir, "cache"), privacy: extra.judgePrivacy ?? extra.privacy ?? NO_PRIVACY, send: true });
  return manifest;
}
const part = (m, id) => m.sources.flatMap((s) => s.parts).find((p) => p.id === id);

test("route: the truth table, with web batch's thresholds", () => {
  const r = (answers, about, extra = {}) => route({ status: "pending", jev: { answers, about }, ...extra }).verdict;
  assert.equal(r(THRESHOLDS.yes, 0), "answers");
  assert.equal(r(0.5, 0.9), "uncertain");
  assert.equal(r(THRESHOLDS.no, THRESHOLDS.yes), "related");
  assert.equal(r(THRESHOLDS.no, 0.69), "doesn't");
  assert.equal(route({ status: "pending", jevError: "HTTP 500" }).verdict, "error");
  assert.equal(route({ status: "pending" }).verdict, "error", "a part with no answer is never doesn't");
  assert.equal(route({ status: "capped" }).verdict, "error");
  assert.equal(route({ status: "short", chars: 20 }).verdict, "uncertain");
  assert.equal(route({ status: "empty", chars: 0 }).verdict, "doesn't");
  // A part that speaks to its reader is never skipped on its verdict, and says so.
  const aimed = (answers, about) => route({ status: "pending", jev: { answers, about, aimed: THRESHOLDS.yes } });
  assert.equal(aimed(0.05, 0.05).verdict, "uncertain");
  assert.equal(aimed(0.05, 0.9).verdict, "uncertain");
  assert.equal(aimed(0.9, 0.9).verdict, "answers");
  assert.match(aimed(0.05, 0.05).reason, /nothing asked for \(0\.05\); holds text aimed at its reader: read as data$/);
  assert.equal(route({ status: "pending", jev: { answers: 0.05, about: 0.05, aimed: 0.69 } }).verdict, "doesn't");
  assert.equal(route({ status: "pending", jevError: "HTTP 500", jev: { aimed: 0.9 } }).verdict, "error");
});

test("redaction: what looks like a secret is taken out of a part, and no line is added or lost", () => {
  const lines = [
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345",
    'curl -H "x-api-key: 0123abcd4567efgh" https://example.test',
    "DB_PASSWORD=hunter2hunter2 next",
    "token sk-ant-api03-AbCdEfGhIjKlMnOpQrSt in the output",
    "commit 9f8e7d6c5b4a39281706f5e4d3c2b1a098765432 merged",
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7",
    "mail the owner at someone@example.test",
    "licence ABCD1-EFGH2-IJKL3-MNOP4 entered",
    "a plain line about handoff/2026-11-16-leftovers-of-86.md and t3-e3992bab-62b1d13bf07244a9",
    "==================================================",
  ];
  const out = redact(lines.join("\n")).split("\n");
  assert.equal(out.length, lines.length);
  assert.equal(out[0], "Authorization: [redacted]");
  assert.equal(out[1], 'curl -H "x-api-key: [redacted]" https://example.test');
  assert.equal(out[2], "DB_PASSWORD=[redacted] next");
  assert.equal(out[3], "token [redacted] in the output");
  assert.equal(out[4], "commit [redacted] merged");
  assert.equal(out[5], "[redacted]");
  assert.equal(out[6], "mail the owner at <email>");
  assert.equal(out[7], "licence [redacted] entered");
  assert.equal(out[8], lines[8], "a dated file name and a short id stay");
  assert.equal(out[9], lines[9]);
  assert.equal(redactLine(out[3]), out[3], "redacting twice changes nothing");
  // In a part: the text that would be sent is the redacted one, and the line range is the file's.
  const secret = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  const { parts } = partsOf(`first\nkey ${secret}\nlast`, "log");
  assert.deepEqual([parts[0].text, parts[0].startLine, parts[0].endLine], ["first\nkey [redacted]\nlast", 1, 3]);
  // A line longer than a part is redacted before it is cut, so a cut leaves no half of a secret.
  const long = `${"word ".repeat(CHUNK_CHARS / 5 - 4)}${secret} tail`;
  const cut = partsOf(long, "file").parts;
  assert.ok(cut.length >= 1 && cut.every((p) => !/ghp_|AbCdEf|456789/.test(p.text)));
  // A chat's tool output is redacted as it is rendered into a part.
  const chat = partsOf(msg("user", [{ type: "tool_result", content: `api_key=${secret}` }]), "transcript").parts[0].text;
  assert.equal(chat, "Tool output: api_key=[redacted]");
});

test("the wording: one place, a Noul pair per kind, the part's kind in the state", () => {
  for (const kind of Object.keys(KINDS)) {
    const q = questionsFor(kind);
    assert.deepEqual(Object.keys(q), QUESTION_IDS);
    for (const id of QUESTION_IDS) assert.equal(q[id].type, "noul");
    assert.equal(q.answers.criteria.true, KINDS[kind].true);
  }
  const body = jevBody({ question: QUESTION, kind: "log", name: "ci.log", k: 2, total: 5, text: "T", model: "m" });
  assert.deepEqual(body.state, { question: QUESTION, source: { kind: KINDS.log.describes, part: "2 of 5", name: "ci.log" }, text: "T" });
  assert.equal("name" in jevBody({ question: QUESTION, kind: "transcript", name: "0a1b.jsonl", k: 1, total: 1, text: "T", model: "m" }).state.source, false);
});

test("parts of a file map to its lines; a log loses its colour codes and no line", () => {
  const text = bulk(["alpha", "beta", "gamma"]);
  const { parts } = partsOf(text, "file");
  assert.equal(parts.length, 3);
  assert.equal(parts[0].startLine, 1);
  assert.equal(parts[1].startLine, parts[0].endLine + 1);
  assert.equal(parts.at(-1).endLine, text.split("\n").length);
  assert.ok(parts.every((p) => p.text.length <= CHUNK_CHARS));
  const log = partsOf("\x1b[31mFAIL\x1b[0m one\ntwo", "log").parts[0];
  assert.equal(log.text, "FAIL one\ntwo");
  assert.equal(log.endLine, 2);
  assert.equal(detectKind("C:/x/run.log", "a"), "log");
  assert.equal(detectKind("C:/x/notes.md", "a"), "file");
  assert.equal(detectKind("C:/x/data.jsonl", '{"a":1}'), "file");
});

const msg = (type, content, extra = {}) => JSON.stringify({ type, cwd: "C:\\work\\repo", message: { role: type, content }, ...extra });
const TRANSCRIPT = [
  JSON.stringify({ type: "custom-title", title: "bookkeeping" }),
  msg("user", "Please find the flaky test."),
  msg("assistant", [{ type: "thinking", thinking: "hidden" }]),
  msg("assistant", [{ type: "tool_use", name: "Bash", input: { command: "npm test", note: "n".repeat(900) } }]),
  msg("user", [{ type: "tool_result", content: [{ type: "text", text: "FAIL retry.test " + "o".repeat(3000) }] }]),
  "not json",
  msg("assistant", [{ type: "text", text: "The retry test is flaky." }]),
].join("\n");

test("a transcript is rendered per message line: bookkeeping and thinking out, tool calls and output cut", () => {
  const { blocks, cwds } = renderTranscript(TRANSCRIPT);
  assert.deepEqual(blocks.map((b) => b.line), [2, 4, 5, 7]);
  assert.equal(blocks[0].text, "User: Please find the flaky test.");
  assert.match(blocks[1].text, /^Assistant calls Bash: \{"command":"npm test"/);
  assert.match(blocks[1].text, /more characters\]$/);
  assert.match(blocks[2].text, /^Tool output: FAIL retry\.test/);
  assert.ok(blocks[2].text.length < 2100);
  assert.deepEqual(cwds, ["C:\\work\\repo"]);
  assert.equal(detectKind("C:/x/0a1b.jsonl", TRANSCRIPT), "transcript");
  const { parts } = partsOf(TRANSCRIPT, "transcript");
  assert.equal(parts.length, 1);
  assert.deepEqual([parts[0].startLine, parts[0].endLine], [2, 7]);
  // A message longer than a part is cut, and every piece stays on its line.
  const big = [msg("user", "first"), msg("assistant", [{ type: "text", text: `${"word ".repeat(40)}\n`.repeat(150) }]), msg("user", "last")].join("\n");
  const cut = partsOf(big, "transcript").parts;
  assert.ok(cut.length >= 3);
  assert.ok(cut.slice(1, -1).every((p) => p.startLine === 2 && p.endLine === 2 && p.text.length <= CHUNK_CHARS));
});

test("happy path: open rows first, related and skipped in the footer, and no file text on disk", async () => {
  const dir = tmp();
  try {
    const file = join(dir, "ci.log");
    writeFileSync(file, bulk(["SECRETALPHA", "SECRETBETA", "SECRETGAMMA", "SECRETDELTA", "SECRETOMEGA"]));
    const m = mocks({ jev: byWord({ SECRETBETA: { answers: 0.95, about: 0.9 }, SECRETGAMMA: { answers: 0.5, about: 0.8 }, SECRETDELTA: { answers: 0.1, about: 0.9 } }) });
    const out = join(dir, "run");
    const logs = [];
    await main(["run", "--send", "--question", QUESTION, file, "--out", out, "--cache-dir", join(dir, "cache"), "--settings-file", join(dir, "none.json"), "--marker-dir", join(dir, "none")], { providers: m.providers, log: (t) => logs.push(t) });
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    assert.deepEqual(manifest.sources[0].parts.map((p) => p.verdict), ["doesn't", "answers", "uncertain", "related", "doesn't"]);
    assert.equal(manifest.sources[0].kind, "log");
    const report = logs.join("\n");
    const rows = report.split("\n").filter((l) => /^\| 1\./.test(l));
    assert.deepEqual(rows.map((r) => r.split("|")[2].trim()), ["answers", "uncertain"]);
    const p2 = part(manifest, "1.2");
    assert.match(rows[0], new RegExp(`source 1, lines ${p2.startLine}-${p2.endLine} \\|$`));
    assert.match(report, /Open: 1 answers, 1 uncertain\. Errors: 0\. Not opened: 1 related, 2 doesn't\./);
    assert.match(report, new RegExp(`Related, no answer .*source 1 lines ${part(manifest, "1.4").startLine}-`));
    assert.match(report, /Jev: 5 requests, 0 from cache, 15000 input tokens/);
    // The worker's jobs name parts; they carry no text, and nothing in the run folder or the cache does.
    assert.ok(m.calls.jobs.every((j) => !("text" in j) && typeof j.hash === "string"));
    const written = [out, join(dir, "cache")].flatMap((d) => readdirSync(d).map((f) => join(d, f)));
    assert.ok(written.length >= 8);
    for (const f of written) assert.equal(/SECRET(ALPHA|BETA|GAMMA|DELTA|OMEGA)/.test(readFileSync(f, "utf8")), false, `${f} holds file text`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("private folders: the plugin's rules decide, before anything is read by the judge", () => {
  assert.equal(normalizeDir("C:/Work/Secret/"), "c:\\work\\secret");
  assert.equal(normalizeDir("relative/path"), null);
  assert.deepEqual(resolvePrivateRoots('C:\\Work\\Secret; "D:\\Other" ;nonsense'), { roots: ["C:\\Work\\Secret", "D:\\Other"], ignored: 1 });
  const roots = ["C:\\Work\\Secret"];
  const ask = (o) => privateReason({ text: "", roots, ...o });
  assert.equal(ask({ path: "C:\\Work\\Secret\\logs\\run.log" }), "it is in a private folder");
  assert.equal(ask({ path: "C:\\Work\\Secret-old\\run.log" }), "its path names a private folder", "a look-alike sibling counts, as in the plugin");
  assert.equal(ask({ path: "C:\\Users\\u\\.claude\\projects\\C--Work-Secret\\0a1b.jsonl" }), "its path names a private folder");
  assert.equal(ask({ path: "C:\\Work\\Open\\run.log", text: 'cd "C:\\\\Work\\\\Secret" && npm test' }), "its text names a private folder");
  assert.equal(ask({ path: "C:\\Work\\Open\\run.log", text: "see /c/work/secret/readme" }), "its text names a private folder");
  const ranIn = (cwd) => JSON.stringify({ type: "user", cwd, message: { role: "user", content: "hello" } });
  // A chat that ran above a root, whatever kind the file is read as (a copy named .txt, a byte order mark).
  assert.equal(ask({ path: "C:\\Work\\Open\\0a1b.jsonl", text: ranIn("C:\\Work") }), "the chat ran in or above a private folder");
  assert.equal(ask({ path: "C:\\Work\\Open\\copy.txt", text: "\uFEFF" + ranIn("C:\\Work") }), "the chat ran in or above a private folder");
  assert.equal(ask({ path: "/home/u/run.log" }), "its path cannot be compared with the private folders");
  assert.equal(ask({ path: "C:\\Work\\Open\\run.log", text: "nothing private\n" + ranIn("C:\\Work\\Open") }), null);
  // The path as typed counts beside the real one (a link into a private folder, or out of one).
  assert.equal(ask({ path: "C:\\Work\\Open\\run.log", typedPath: "C:\\Work\\Secret\\link.log" }), "it is in a private folder");
  // A folder named inside a JSON string: in the file the line end before it is written \\n, so only the string as it reads names it.
  const inJson = JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "grep hits:\nWork/Secret/notes.md" }] } });
  assert.equal(/(^|[^a-z0-9])work\/secret/.test(inJson.toLowerCase().replace(/[\\/]+/g, "/")), false, "the raw line does not show it");
  assert.equal(ask({ path: "C:\\Work\\Open\\0a1b.jsonl", text: inJson }), "its text names a private folder");
  // A folder split by colour codes in a log: the text without the codes names it, and so does a part.
  const coloured = "\x1b[2mC:\\Work\\\x1b[22m\x1b[1mSecret\x1b[22m\\src\\a.ts";
  assert.equal(/(^|[^a-z0-9])c:\/work\/secret/.test(coloured.toLowerCase().replace(/[\\/]+/g, "/")), false, "the raw line does not show it");
  assert.equal(ask({ path: "C:\\Work\\Open\\run.log", text: coloured }), "its text names a private folder");
  assert.equal(ask({ path: "C:\\Work\\Open\\run.log", text: "", partTexts: [partsOf(coloured, "log").parts[0].text] }), "its text names a private folder");
  assert.equal(touchesPrivateRoot("C:\\Work\\Open", roots), false);
  // With no folder marked private everything may go, except a chat the plugin marked.
  assert.equal(privateReason({ path: "/home/u/run.log", text: "x", roots: [] }), null);
  const markerNames = ["README.txt", "0a1b-cd.json"];
  assert.equal(privateReason({ path: "C:\\p\\0A1B-cd.jsonl", text: "x", roots: [], markerNames }), "the chat is marked private");
  // A subagent's chat lies in a folder named after the marked session, and its lines carry that id.
  assert.equal(privateReason({ path: "C:\\p\\0a1b-cd\\subagents\\agent-a1.jsonl", text: "x", roots: [], markerNames }), "the chat is marked private");
  assert.equal(privateReason({ path: "C:\\p\\copy.jsonl", text: JSON.stringify({ type: "user", sessionId: "0A1B-CD" }), roots: [], markerNames }), "the chat is marked private");
  assert.equal(privateReason({ path: "C:\\p\\other.jsonl", text: JSON.stringify({ type: "user", sessionId: "ffff" }), roots: [], markerNames }), null);
});

test("a private source is an error row and never reaches the judge; an unreadable list sends nothing", async () => {
  const dir = tmp();
  try {
    const secret = join(dir, "secret");
    mkdirSync(secret);
    const inside = join(secret, "run.log");
    const outside = join(dir, "open.log");
    writeFileSync(inside, bulk(["inside"]));
    writeFileSync(outside, bulk(["outside"]));
    const settings = join(dir, "settings.json");
    writeFileSync(settings, JSON.stringify({ pluginConfigs: { "other@x": { options: { privateRoots: "C:\\Nope" } }, "fast-jev-compaction-atlas@claude-local": { options: { privateRoots: "C:\\Work\\Secret" } } } }));
    const read = loadPrivacy({ settingsFile: settings, markerDir: join(dir, "none"), extra: "D:\\More" });
    assert.deepEqual([read.roots, read.error], [["C:\\Work\\Secret", "D:\\More"], null]);
    // The run: `inside` is in a private folder (or, off Windows, cannot be compared): not sent.
    const m = mocks({ jev: () => ({ answers: 0.9, about: 0.9 }) });
    const manifest = await runAll(dir, [inside], m, { privacy: { ...NO_PRIVACY, roots: [secret] } });
    assert.equal(manifest.sources[0].status, "private");
    assert.match(manifest.sources[0].error, /^not sent: /);
    assert.equal(m.calls.judge, 0);
    assert.match(renderReport(manifest, dir).text, /\| 1 \| error \| - \| - \| not sent: /);
    // A broken settings file is doubt: nothing is sent, not even the open file.
    writeFileSync(settings, '{ "v": {"X": SETTINGSTEXT');
    const broken = loadPrivacy({ settingsFile: settings, markerDir: join(dir, "none") });
    assert.equal(broken.error, "the settings file is not valid JSON", "fixed words: the parser's message quotes the file");
    const m2 = mocks();
    const closed = await runAll(dir, [outside], m2, { privacy: broken });
    assert.match(closed.sources[0].error, /^not sent: the private-folder list could not be read/);
    assert.equal(m2.calls.judge, 0);
    writeFileSync(settings, JSON.stringify({ pluginConfigs: { "fast-jev-compaction-atlas@claude-local": { options: { privateRoots: 7 } } } }));
    assert.ok(loadPrivacy({ settingsFile: settings, markerDir: join(dir, "none") }).error);
    assert.equal(loadPrivacy({ settingsFile: join(dir, "absent.json"), markerDir: join(dir, "none") }).error, null);
    // The judge asks again: a folder marked private after the plan stops the send, and so does a missing list.
    const m3 = mocks({ jev: () => ({ answers: 0.9, about: 0.9 }) });
    const later = await runAll(dir, [outside], m3, { judgePrivacy: { ...NO_PRIVACY, roots: [dir] } });
    assert.equal(m3.calls.judge, 0);
    assert.deepEqual([later.sources[0].status, later.sources[0].parts.length], ["private", 0]);
    assert.match(renderReport(later, dir).text, /\| 1 \| error \| - \| - \| not sent: /);
    const m4 = mocks();
    const planned = planStage({ question: QUESTION, files: [outside], maxParts: 400, privacy: NO_PRIVACY });
    await judgeStage(planned, m4.providers, { model: "jev-1.14.0", cacheDir: join(dir, "cache"), send: true });
    assert.equal(m4.calls.judge, 0, "no list given to the judge: nothing is sent");
    assert.match(planned.sources[0].error, /could not be read \(not loaded\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Jev failures are error rows, never doesn't: a failed call, a worker crash, a wrong count", async () => {
  const dir = tmp();
  try {
    const file = join(dir, "notes.md");
    writeFileSync(file, bulk(["one", "two"]));
    const failing = mocks({ judge: (jobs) => jobs.map((j) => (j.k === 2 ? { ok: false, error: "HTTP 500" } : { ok: true, model: "jev-1.14.0", answers: { answers: 0.02, about: 0.02 } })) });
    const a = await runAll(dir, [file], failing);
    assert.deepEqual(a.sources[0].parts.map((p) => p.verdict), ["doesn't", "error"]);
    assert.match(part(a, "1.2").reason, /^Jev: HTTP 500/);
    const crash = mocks({ judge: () => { throw new Error("worker died"); } });
    const b = await runAll(join(dir, "b"), [file], crash);
    assert.ok(b.sources[0].parts.every((p) => p.verdict === "error"));
    const short = mocks({ judge: () => [] });
    const c = await runAll(join(dir, "c"), [file], short);
    assert.ok(c.sources[0].parts.every((p) => p.verdict === "error"));
    assert.match(renderReport(c, dir).text, /Errors: 2\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("missing, binary, empty and short files get a row without a call", async () => {
  const dir = tmp();
  try {
    const files = { "bin.dat": Buffer.from([1, 0, 2, 0]), "empty.log": "", "short.md": "a short note" };
    for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, name), data);
    const m = mocks();
    const manifest = await runAll(dir, [join(dir, "absent.log"), ...Object.keys(files).map((n) => join(dir, n))], m);
    assert.equal(m.calls.judge, 0);
    assert.deepEqual(manifest.sources.map((s) => s.status), ["error", "error", "ok", "ok"]);
    assert.match(manifest.sources[0].error, /no such file/);
    assert.match(manifest.sources[1].error, /not a text file/);
    assert.equal(part(manifest, "3.1").verdict, "doesn't");
    assert.equal(part(manifest, "4.1").verdict, "uncertain");
    assert.match(renderReport(manifest, dir).text, /Errors: 2\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a line end after a full part makes no blank part; a UTF-16 log is read; a forced kind that does not fit is an error", async () => {
  const dir = tmp();
  try {
    const full = bulk(["only"]) + "\n";
    assert.equal(full.length, CHUNK_CHARS);
    assert.deepEqual(partsOf(full, "file").parts.map((p) => [p.startLine, p.endLine]), [[1, CHUNK_CHARS / 100]]);
    const wide = join(dir, "wide.log");
    writeFileSync(wide, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("FAIL wide line\nsecond", "utf16le")]));
    assert.equal(loadSource(wide).parts[0].text, "FAIL wide line\nsecond");
    const log = join(dir, "run.log");
    writeFileSync(log, bulk(["plain"]));
    const m = mocks();
    const manifest = await runAll(dir, [log], m, { kind: "transcript" });
    assert.equal(m.calls.judge, 0);
    assert.match(manifest.sources[0].error, /^not read: no chat messages in it/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the part cap: parts past it are listed as not judged, never as doesn't", async () => {
  const dir = tmp();
  try {
    const a = join(dir, "a.log"), b = join(dir, "b.log");
    writeFileSync(a, bulk(["a1", "a2", "a3"]));
    writeFileSync(b, bulk(["b1", "b2"]));
    const m = mocks();
    const manifest = await runAll(dir, [a, b], m, { maxParts: 4 });
    assert.equal(m.calls.jobs.length, 4);
    assert.deepEqual(manifest.sources[1].parts.map((p) => p.verdict), ["doesn't", "error"]);
    const report = renderReport(manifest, dir).text;
    assert.match(report, new RegExp(`Not judged, past the cap of 4 parts: source 2 lines ${part(manifest, "2.2").startLine}-`));
    assert.throws(() => parseArgs(["run", "--max-parts", String(LIMITS.maxParts + 1)]), /capped/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cache by part, question and model: a rerun asks nothing; changed text asks again", async () => {
  const dir = tmp();
  try {
    const file = join(dir, "notes.md");
    writeFileSync(file, bulk(["one", "two", "three"]));
    const m = mocks({ jev: byWord({ two: { answers: 0.9, about: 0.9 } }) });
    await runAll(dir, [file], m);
    assert.equal(m.calls.jobs.length, 3);
    const again = await runAll(dir, [file], m);
    assert.equal(m.calls.jobs.length, 3, "nothing asked again");
    assert.equal(again.jev.usage.cached, 3);
    assert.equal(part(again, "1.2").verdict, "answers");
    writeFileSync(file, bulk(["one", "two", "changed"]));
    await runAll(dir, [file], m);
    assert.equal(m.calls.jobs.length, 4, "only the changed part");
    assert.equal(m.calls.jobs.at(-1).k, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the worker reads the part from the file, checks its hash and holds the key alone", async () => {
  const dir = tmp();
  try {
    const file = join(dir, "run.log");
    writeFileSync(file, bulk(["WORKERTEXT", "other"]));
    const manifest = planStage({ question: QUESTION, files: [file], maxParts: 400, privacy: NO_PRIVACY });
    let jobs;
    await judgeStage(manifest, { judge: async (j) => ((jobs = j), j.map(() => ({ ok: false, error: "stop" }))) }, { model: "jev-1.14.0", cacheDir: join(dir, "cache"), privacy: NO_PRIVACY, send: true });
    const jobsFile = join(dir, "jobs.json"), resultsFile = join(dir, "results.json");
    writeFileSync(jobsFile, JSON.stringify(jobs));
    assert.equal(readFileSync(jobsFile, "utf8").includes("WORKERTEXT"), false);
    const sent = [];
    const fetchImpl = async (url, init) => {
      sent.push(JSON.parse(init.body));
      assert.equal(init.headers.authorization, "Bearer k-test");
      return { ok: true, status: 200, json: async () => ({ model: "jev-1.14.0", usage: { input_tokens: 9 }, answers: { answers: { type: "noul", noul: 0.8 }, about: { type: "noul", noul: 0.6 }, aimed: { type: "noul", noul: 0.1 } } }) };
    };
    const results = await jevWorker(jobsFile, resultsFile, { env: { ...SEND, TYPESAFE_API_KEY: "k-test" }, fetchImpl });
    assert.deepEqual(results.map((r) => r.ok), [true, true]);
    assert.deepEqual(results[0].answers, { answers: 0.8, about: 0.6, aimed: 0.1 });
    assert.ok(sent.some((b) => b.state.text.includes("WORKERTEXT") && b.state.question === QUESTION && b.state.source.name === "run.log"));
    assert.deepEqual(Object.keys(sent[0].questions), QUESTION_IDS);
    assert.equal(readFileSync(resultsFile, "utf8").includes("k-test"), false);
    // A file that changed after the plan is an error, not a judgement of other text.
    writeFileSync(file, bulk(["rewritten", "other"]));
    const changed = await jevWorker(jobsFile, resultsFile, { env: { ...SEND, TYPESAFE_API_KEY: "k-test" }, fetchImpl });
    assert.equal(changed[0].ok, false);
    assert.match(changed[0].error, /changed after the plan/);
    assert.equal(changed[1].ok, true);
    // A malformed answer and a missing key are errors too.
    const bad = await jevWorker(jobsFile, resultsFile, { env: { ...SEND, TYPESAFE_API_KEY: "k" }, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ answers: { answers: { type: "noul", noul: 0.8 } } }) }) });
    assert.match(bad[1].error, /malformed Jev answer for "about"/);
    // The API's error text could quote the request: only the status reaches the results.
    const refused = await jevWorker(jobsFile, resultsFile, { env: { ...SEND, TYPESAFE_API_KEY: "k" }, fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "bad state: rewritten line 3" } }) }) });
    assert.equal(refused[1].error, "HTTP 400");
    const noKey = await jevWorker(jobsFile, resultsFile, { env: { ...SEND }, fetchImpl: async () => assert.fail("no call without a key") });
    assert.ok(noKey.every((r) => !r.ok && /TYPESAFE_API_KEY missing/.test(r.error)));
    // A worker that was not started by a run with --send sends nothing, key or no key.
    const unsaid = await jevWorker(jobsFile, resultsFile, { env: { TYPESAFE_API_KEY: "k-test" }, fetchImpl: async () => assert.fail("no call without --send") });
    assert.ok(unsaid.every((r) => !r.ok && r.error === "not sent: the run did not say --send"));
    await assert.rejects(judgeStage(manifest, { judge: async () => assert.fail("no call") }, { model: "jev-1.14.0", cacheDir: join(dir, "cache"), privacy: NO_PRIVACY }), /add --send to say so/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("score: recall, false answers, the share to open and the keyword rule; labels never reach the judge", async () => {
  const dir = tmp();
  try {
    const file = join(dir, "run.log");
    // Part 2 holds the failure in other words than the question; parts 1 and 4 repeat the question's words.
    writeFileSync(file, bulk(["unit test job started", "AssertionError expected 3", "lint ok", "unit test job fail summary", "upload"]));
    const m = mocks({ jev: byWord({ AssertionError: { answers: 0.9, about: 0.9 }, summary: { answers: 0.8, about: 0.9 }, "lint ok": { answers: 0.75, about: 0.2 } }) });
    const manifest = await runAll(dir, [file], m);
    const labels = { "1.1": false, "1.2": true, "1.3": false, "1.4": true };
    assert.equal(JSON.stringify(m.calls.jobs).includes("true"), false);
    const texts = new Map(loadSource(file, "log").parts.map((p, k) => [`1.${k + 1}`, p.text]));
    const s = scoreRun(manifest, labels, { texts });
    assert.deepEqual([s.labelled, s.unlabelled, s.relevant, s.caught, s.recall], [4, 1, 2, 2, 1]);
    assert.deepEqual(s.falseAnswers.map((f) => f.id), ["1.3"]);
    assert.deepEqual([s.answers, s.opened, s.openedNotRelevant], [3, 3, 1]);
    assert.equal(s.openShare, 0.75);
    // The keyword rule opens as many parts as Jev did: 4 and 1 hold the question's words, and the next in file order (2) fills the third place.
    assert.deepEqual(contentWords(QUESTION), ["unit", "test", "job", "fail"]);
    assert.deepEqual([s.fixedRule.opened, s.fixedRule.caught, s.fixedRule.recall], [3, 2, 1]);
    assert.equal(keywordRule(QUESTION, manifest.sources[0].parts.slice(0, 4), texts, 2, labels).recall, 0.5, "two places: parts 4 and 1, and part 2 is missed");
    assert.deepEqual([s.bar.recall_met, s.bar.someFound_met, s.bar.falseAnswers_met, s.bar.openShare_met, s.bar.aboveFixedRule_met], [true, true, false, false, false]);
    assert.deepEqual([BAR.recall, BAR.falseAnswers, BAR.openShare], [0.9, 0.1, 0.35]);
    // A missed relevant part is listed with its verdict; an error is a miss, not a pass.
    const miss = scoreRun(manifest, { "1.5": true });
    assert.deepEqual([miss.recall, miss.missed[0].id, miss.missed[0].verdict, miss.bar.recall_met, miss.bar.someFound_met], [0, "1.5", "doesn't", false, false]);
    // A label for a part the run does not hold (its file was not read) is a miss, not a dropped row.
    const lost = scoreRun(manifest, { "1.2": true, "2.1": true, "2.2": false });
    assert.deepEqual([lost.labelled, lost.labelsWithoutPart, lost.relevant, lost.caught, lost.recall], [1, 2, 2, 1, 0.5]);
    assert.deepEqual(lost.missed, [{ id: "2.1", verdict: "error", reason: "not in the run" }]);
    assert.equal(keywordRule("why?", [], new Map(), 3, {}).recall, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("show prints a transcript's messages as text and a file's lines as they are", () => {
  const dir = tmp();
  try {
    const chat = join(dir, "0a1b.jsonl"), notes = join(dir, "notes.md");
    writeFileSync(chat, TRANSCRIPT);
    writeFileSync(notes, "one\ntwo\nthree\nfour");
    const shown = showLines(chat, 2, 5);
    assert.match(shown, /^\[line 2\] User: Please find the flaky test\./);
    assert.match(shown, /\[line 5\] Tool output: FAIL retry\.test/);
    assert.equal(shown.includes("The retry test is flaky"), false);
    assert.equal(showLines(notes, 2, 3), "two\nthree");
    assert.throws(() => parseArgs(["show", chat, "--lines", "5-2"]), /--lines/);
    assert.deepEqual([parseArgs(["show", chat, "--lines", "2-5"]).from, parseArgs(["show", chat, "--lines", "2-5"]).to], [2, 5]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("main: stages on one run folder, score from a labels file, guarded arguments", async () => {
  const dir = tmp();
  try {
    const file = join(dir, "0a1b.jsonl");
    writeFileSync(file, Array.from({ length: 40 }, (_, n) => msg(n % 2 ? "assistant" : "user", [{ type: "text", text: `${n === 21 ? "DECISION made here" : "chatter"} ${"z".repeat(900)}` }])).join("\n"));
    const m = mocks({ jev: byWord({ DECISION: { answers: 0.92, about: 0.95 } }) });
    const out = join(dir, "run");
    const quiet = { providers: m.providers, log: () => {} };
    const common = ["--out", out, "--cache-dir", join(dir, "cache"), "--settings-file", join(dir, "none.json"), "--marker-dir", join(dir, "none")];
    await main(["plan", "--question", QUESTION, file, ...common], quiet);
    assert.equal(m.calls.judge, 0, "plan asks nothing");
    const planned = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    assert.equal(planned.sources[0].kind, "transcript");
    assert.ok(planned.sources[0].parts.length >= 3);
    await assert.rejects(main(["judge", ...common], quiet), /add --send to say so/);
    assert.equal(m.calls.judge, 0, "without --send the judge stops before any call");
    await main(["judge", "--send", ...common], quiet);
    const logs = [];
    await main(["report", ...common], { ...quiet, log: (t) => logs.push(t) });
    assert.match(logs.join("\n"), /show <path> --lines <a>-<b>/);
    const judged = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    const hit = judged.sources[0].parts.find((p) => p.verdict === "answers");
    assert.ok(hit.startLine <= 22 && hit.endLine >= 22);
    const labels = join(dir, "labels.json");
    writeFileSync(labels, JSON.stringify(Object.fromEntries(judged.sources[0].parts.map((p) => [p.id, p.id === hit.id]))));
    await main(["score", "--labels", labels, ...common], quiet);
    const score = JSON.parse(readFileSync(join(out, "score.json"), "utf8"));
    assert.deepEqual([score.recall, score.falseAnswers.length, score.bar.recall_met], [1, 0, true]);
    assert.ok(existsSync(join(out, "report.md")) && existsSync(join(out, "summary.json")));
    await assert.rejects(main(["judge", "--send", "--question", "another", ...common], quiet), /differs from the run's question/);
    await assert.rejects(main(["run", file, ...common], quiet), /--question is required/);
    await assert.rejects(main(["run", "--question", QUESTION, ...common], quiet), /name at least one file/);
    await assert.rejects(main(["judge", "--send", "--out", join(dir, "nothing")], quiet), /run the plan stage first/);
    assert.throws(() => parseArgs(["run", "--kind", "pdf"]), /--kind is one of/);
    assert.throws(() => parseArgs(["run", "--jev-key", "sk_live_ABC"]), /key name, not a key/);
    assert.throws(() => parseArgs(["run", "--bogus"]), /unknown option/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
