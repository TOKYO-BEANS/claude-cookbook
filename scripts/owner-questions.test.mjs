// The owner-questions Stop hook: closing messages that leave something with the owner are
// stopped once until the turn asks with the dialog or marks the thread, and a "done" closing
// is stopped once until the thread is settled.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DONE_THRESHOLD,
  MARKER,
  OWNER_THRESHOLD,
  decide,
  phraseCheck,
  readTranscript,
  run,
  sessionMode,
} from "../plugins/cookbook/hooks/owner-questions-lib.mjs";
import { askJev } from "../plugins/cookbook/hooks/owner-questions-jev.mjs";
import { askBroker, startBroker } from "../plugins/cookbook/hooks/owner-questions-broker.mjs";

const closings = JSON.parse(readFileSync(new URL("./fixtures/owner-questions/closings.json", import.meta.url), "utf8"));
const cases = Object.entries(closings).filter(([k]) => !k.startsWith("_"));
const THREAD = "mcp:launch:abc";

// ---------- a transcript, built the way Claude Code writes it ----------
const T3_TOOLS = { type: "attachment", attachment: { type: "deferred_tools_delta", addedNames: ["mcp__t3-code__t3_thread_organize", "mcp__t3-code__t3_thread_update"] } };
const prompt = (text) => ({ type: "user", message: { role: "user", content: text } });
const call = (name, input = {}) => ({ type: "assistant", message: { content: [{ type: "tool_use", id: `t${Math.random()}`, name, input }] } });
const result = () => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "x", content: "ok" }] } });
const say = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });
const jsonl = (entries) => entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
const ASK = () => call("AskUserQuestion", { questions: [] });
const SETTLE = () => call("mcp__t3-code__t3_thread_organize", { action: "settle" });
const MARK = (threadId) => [call("mcp__t3-code__t3_thread_organize", { action: "pin", ...(threadId ? { threadId } : {}) }), call("mcp__t3-code__t3_thread_update", { action: "rename", title: `${MARKER}keep or cancel?`, ...(threadId ? { threadId } : {}) })];

test("the phrase fallback reads today's real closing messages right", () => {
  for (const [name, c] of cases) {
    assert.deepEqual(phraseCheck(c.text), { owner: c.owner, done: c.done }, name);
  }
});

test("a transcript gives the turn's tool calls, the T3 tools and the marker", () => {
  const t = readTranscript(jsonl([T3_TOOLS, prompt("first"), ASK(), result(), say("x"), prompt("second"), call("Bash"), result(), SETTLE(), result(), say("done")]), { threadId: THREAD });
  assert.equal(t.t3Tools, true);
  assert.equal(t.scripted, false);
  assert.deepEqual(t.turnCalls.map((c) => c.name), ["Bash", "mcp__t3-code__t3_thread_organize"]);
  assert.equal(t.asked, false, "the dialog was in an earlier turn");
  assert.equal(t.settled, true);
  assert.equal(t.marked, false);
});

test("the marker counts across turns, for this thread only", () => {
  const marked = readTranscript(jsonl([T3_TOOLS, prompt("a"), ...MARK(), say("q"), prompt("b"), say("c")]), { threadId: THREAD });
  assert.equal(marked.marked, true);
  const other = readTranscript(jsonl([T3_TOOLS, prompt("a"), ...MARK("mcp:other"), say("q")]), { threadId: THREAD });
  assert.equal(other.marked, false, "pinning another thread during a sweep does not mark this one");
  const own = readTranscript(jsonl([T3_TOOLS, prompt("a"), ...MARK(THREAD), say("q")]), { threadId: THREAD });
  assert.equal(own.marked, true);
  const back = readTranscript(jsonl([T3_TOOLS, prompt("a"), ...MARK(), prompt("b"), call("mcp__t3-code__t3_thread_update", { action: "rename", title: "Packaging decision" })]), { threadId: THREAD });
  assert.equal(back.marked, false, "renamed back");
});

test("a scripted run is seen by its budget attachment; broken lines are skipped", () => {
  const t = readTranscript(`not json\n${jsonl([{ type: "attachment", attachment: { type: "budget_usd" } }, prompt("go"), say("ok")])}`, { threadId: THREAD });
  assert.equal(t.scripted, true);
  assert.equal(t.t3Tools, false);
});

test("which sessions the hook works in", () => {
  const t3 = { t3Tools: true, scripted: false };
  const plain = { t3Tools: false, scripted: false };
  assert.equal(sessionMode({ env: { CLAUDE_CODE_ENTRYPOINT: "t3-code", T3CODE_THREAD_ID: THREAD }, transcript: t3 }), "full");
  assert.equal(sessionMode({ env: { CLAUDE_CODE_ENTRYPOINT: "t3-code", T3CODE_THREAD_ID: "thread:delegated-task:command%3Ax" }, transcript: t3 }), "skip", "a delegated child reports to its parent");
  assert.equal(sessionMode({ env: { CLAUDE_CODE_ENTRYPOINT: "t3-code", T3CODE_THREAD_ID: THREAD }, transcript: plain }), "skip", "claude -p started inside a T3 thread");
  assert.equal(sessionMode({ env: { CLAUDE_CODE_ENTRYPOINT: "sdk-cli" }, transcript: plain }), "skip");
  assert.equal(sessionMode({ env: { CLAUDE_CODE_ENTRYPOINT: "cli" }, transcript: { t3Tools: false, scripted: true } }), "skip");
  assert.equal(sessionMode({ env: { CLAUDE_CODE_ENTRYPOINT: "cli" }, transcript: plain }), "dialog");
  assert.equal(sessionMode({ env: { CLAUDE_CODE_ENTRYPOINT: "claude-desktop" }, transcript: plain }), "dialog");
  assert.equal(sessionMode({ env: {}, transcript: plain }), "skip", "unknown: stay out of the way");
});

const turn = (o = {}) => ({ asked: false, marked: false, settled: false, ...o });
const verdict = (owner, done) => ({ source: "jev", owner, done });

test("an open item with no dialog and no marker is stopped, with what to do", () => {
  const full = decide({ mode: "full", turn: turn(), verdict: verdict(true, false) });
  assert.deepEqual(full.problems, ["owner"]);
  assert.match(full.reason, /AskUserQuestion/);
  assert.match(full.reason, /Not now/);
  assert.ok(full.reason.includes(MARKER), "names the marker");
  assert.match(full.reason, /t3_thread_organize/);
  const dialog = decide({ mode: "dialog", turn: turn(), verdict: verdict(true, false) });
  assert.deepEqual(dialog.problems, ["owner"]);
  assert.doesNotMatch(dialog.reason, /t3_thread/, "no T3 tools outside T3");
});

test("an open item that was asked or marked passes", () => {
  assert.deepEqual(decide({ mode: "full", turn: turn({ asked: true }), verdict: verdict(true, false) }).problems, []);
  assert.deepEqual(decide({ mode: "full", turn: turn({ marked: true }), verdict: verdict(true, false) }).problems, []);
  assert.deepEqual(decide({ mode: "dialog", turn: turn({ asked: true }), verdict: verdict(true, false) }).problems, []);
});

test("done without settle is stopped in T3 only", () => {
  const r = decide({ mode: "full", turn: turn(), verdict: verdict(false, true) });
  assert.deepEqual(r.problems, ["settle"]);
  assert.match(r.reason, /settle/);
  assert.deepEqual(decide({ mode: "full", turn: turn({ settled: true }), verdict: verdict(false, true) }).problems, []);
  assert.deepEqual(decide({ mode: "dialog", turn: turn(), verdict: verdict(false, true) }).problems, []);
});

test("done with an open item asks first; a marked, waiting chat is not told to settle", () => {
  assert.deepEqual(decide({ mode: "full", turn: turn(), verdict: verdict(true, true) }).problems, ["owner", "settle"]);
  assert.deepEqual(decide({ mode: "full", turn: turn({ marked: true }), verdict: verdict(true, true) }).problems, []);
});

test("a marked chat whose closing leaves nothing open is told to unmark", () => {
  const r = decide({ mode: "full", turn: turn({ marked: true }), verdict: verdict(false, false) });
  assert.deepEqual(r.problems, ["unmark"]);
  assert.match(r.reason, /unpin/);
});

test("an ordinary mid-job reply passes untouched", () => {
  assert.deepEqual(decide({ mode: "full", turn: turn(), verdict: verdict(false, false) }), { problems: [], reason: "" });
});

// ---------- run(): the whole hook with fakes ----------
const fixture = (name) => closings[name].text;
function hook({ text, entries, active = false, env = { CLAUDE_CODE_ENTRYPOINT: "t3-code", T3CODE_THREAD_ID: THREAD }, classify }) {
  const logs = [];
  const calls = [];
  const transcript = jsonl(entries ?? [T3_TOOLS, prompt("go"), call("Bash"), result(), say(text)]);
  return run({
    input: { hook_event_name: "Stop", stop_hook_active: active, transcript_path: "t.jsonl", last_assistant_message: text, session_id: "s1" },
    env,
    readFile: () => transcript,
    classify: async (t) => {
      calls.push(t);
      return classify ? classify(t) : { ok: true, answers: { owner_item: 0.1, declares_done: 0.1 } };
    },
    log: (l) => logs.push(l),
  }).then((out) => ({ out, logs, calls }));
}

test("the second stop always passes, without a Jev call: it can never loop", async () => {
  const { out, calls } = await hook({ text: fixture("still-yours"), active: true });
  assert.equal(out, null);
  assert.equal(calls.length, 0);
});

test("skipped sessions make no Jev call", async () => {
  const { out, calls } = await hook({ text: fixture("still-yours"), env: { CLAUDE_CODE_ENTRYPOINT: "sdk-cli" }, entries: [prompt("go"), say("x")] });
  assert.equal(out, null);
  assert.equal(calls.length, 0);
});

test("Jev's answer decides, at the stated thresholds", async () => {
  const at = (o, d) => hook({ text: "anything", classify: () => ({ ok: true, answers: { owner_item: o, declares_done: d } }) });
  assert.equal((await at(OWNER_THRESHOLD, 0)).out.decision, "block");
  assert.equal((await at(OWNER_THRESHOLD - 0.01, 0)).out, null);
  assert.equal((await at(0, DONE_THRESHOLD)).out.decision, "block");
  const { logs } = await at(0.9, 0);
  assert.equal(logs[0].source, "jev");
  assert.equal(logs[0].text, undefined, "the log never holds the message");
});

test("a 'done' phrase counts even when Jev scores it low", async () => {
  const { out } = await hook({ text: fixture("done-clean"), classify: () => ({ ok: true, answers: { owner_item: 0.1, declares_done: 0.1 } }) });
  assert.equal(out.decision, "block");
  assert.match(out.reason, /settle/);
});

test("a Jev failure falls back to the phrase list, visibly", async () => {
  const down = () => ({ ok: false, error: "timed out after 6000 ms" });
  const open = await hook({ text: fixture("decision-for-you"), classify: down });
  assert.equal(open.out.decision, "block");
  assert.match(open.out.reason, /phrase list/);
  assert.match(open.out.systemMessage, /timed out/);
  const quiet = await hook({ text: fixture("mid-job"), classify: down });
  assert.equal(quiet.out.decision, undefined, "nothing found: the stop goes ahead");
  assert.match(quiet.out.systemMessage, /phrase list/, "but the owner sees that Jev was not asked");
  assert.equal(quiet.logs[0].source, "phrases");
});

test("today's four real closings are stopped and the mid-job reply passes (phrase path)", async () => {
  const down = () => ({ ok: false, error: "no broker" });
  for (const name of ["still-yours", "decision-for-you", "need-a-yes", "done-with-leftovers"]) {
    assert.equal((await hook({ text: fixture(name), classify: down })).out.decision, "block", name);
  }
  assert.equal((await hook({ text: fixture("mid-job"), classify: down })).out.decision, undefined);
});

test("a turn that asked with the dialog passes", async () => {
  const { out } = await hook({ text: fixture("need-a-yes"), entries: [T3_TOOLS, prompt("go"), ASK(), result(), say(fixture("need-a-yes"))], classify: () => ({ ok: true, answers: { owner_item: 0.95, declares_done: 0 } }) });
  assert.equal(out, null);
});

test("a broken hook never blocks a session", async () => {
  const out = await run({ input: { hook_event_name: "Stop", transcript_path: "x" }, env: { CLAUDE_CODE_ENTRYPOINT: "t3-code" }, readFile: () => { throw new Error("gone"); }, classify: async () => ({ ok: true, answers: {} }), log: () => {} });
  assert.equal(out, null);
});

// ---------- Jev call and broker ----------
const reply = (status, body) => async () => ({ ok: status === 200, status, json: async () => body });

test("askJev reads typed answers and keeps failures apart", async () => {
  const good = await askJev("x", { key: "k", fetchImpl: reply(200, { model: "jev-1.14.0", answers: { owner_item: { type: "noul", noul: 0.7 }, declares_done: { type: "noul", noul: 0.1 } } }) });
  assert.deepEqual(good, { ok: true, answers: { owner_item: 0.7, declares_done: 0.1 }, model: "jev-1.14.0" });
  assert.deepEqual(await askJev("x", { key: "k", fetchImpl: reply(429, {}) }), { ok: false, error: "HTTP 429" });
  assert.match((await askJev("x", { key: "k", fetchImpl: reply(200, { answers: {} }) })).error, /malformed/);
  assert.equal((await askJev("x", {})).error, "no key");
  const slow = await askJev("x", { key: "k", timeoutMs: 5, fetchImpl: (u, o) => new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("t"), { name: "TimeoutError" })))) });
  assert.match(slow.error, /timed out/);
});

test("the broker answers on its pipe; no broker is a failure, not 'nothing open'", async () => {
  const pipe = process.platform === "win32" ? `\\\\.\\pipe\\owner-questions-test-${process.pid}` : join(tmpdir(), `oq-${process.pid}.sock`);
  assert.match((await askBroker("x", { pipe, timeoutMs: 300 })).error, /no broker/);
  const server = await startBroker({ pipe, ask: async (text) => ({ ok: true, answers: { owner_item: text.length / 10, declares_done: 0 } }), idleMs: 60_000 });
  try {
    assert.deepEqual(await askBroker("abc", { pipe, timeoutMs: 2000 }), { ok: true, answers: { owner_item: 0.3, declares_done: 0 } });
  } finally {
    server.close();
  }
});

test("hooks.json runs the Stop hook with absolute paths and a time limit", () => {
  const hooks = JSON.parse(readFileSync(new URL("../plugins/cookbook/hooks/hooks.json", import.meta.url), "utf8")).hooks;
  const stop = hooks.Stop?.[0]?.hooks?.[0];
  assert.ok(stop, "a Stop hook");
  assert.equal(stop.command, '"C:/Program Files/nodejs/node.exe" "${CLAUDE_PLUGIN_ROOT}/hooks/owner-questions.mjs"');
  assert.ok(stop.timeout > 0 && stop.timeout <= 20);
  assert.equal(hooks.SubagentStop, undefined, "never for subagents");
});
