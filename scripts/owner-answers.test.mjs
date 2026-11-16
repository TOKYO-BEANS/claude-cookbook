// The owner-answers hooks (recipes/parallel-chats.md): what the owner answered in one chat is
// shown to another chat before it opens the same dialog, and a chat that starts a new chat
// first looks at the chats that exist.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAUNCH_PASS_MS,
  MAX_SHOWN,
  OPEN_MS,
  WINDOW_MS,
  candidates,
  decideAsk,
  decideLaunch,
  entryId,
  formatList,
  parseLedger,
  recordAnswers,
  redact,
  repoLabel,
  run,
} from "../plugins/cookbook/hooks/owner-answers-lib.mjs";

const NOW = Date.parse("2026-11-16T19:30:00Z");
const HOUR = 3_600_000;
const Q = "The AI review has no credit. Merge pull request 80 on a hand review?";
const question = (text = Q, labels = ["Merge once", "Not now"]) => ({ question: text, header: "Merge", multiSelect: false, options: labels.map((label) => ({ label, description: "" })) });
const ask = (session, questions = [question()]) => ({ hook_event_name: "PreToolUse", tool_name: "AskUserQuestion", session_id: session, cwd: "C:/work/repo", tool_input: { questions } });
const answered = (session, answers, questions = [question()]) => ({ hook_event_name: "PostToolUse", tool_name: "AskUserQuestion", session_id: session, cwd: "C:/work/repo", tool_input: { questions }, tool_response: { questions, answers } });
const line = (o) => JSON.stringify(o);
const entry = (over = {}) => ({ id: "e1", at: NOW - HOUR, state: "answered", session: "other", thread: "mcp:launch:other", repo: "owner/repo", question: Q, options: ["Merge once", "Not now"], answer: "Merge once", ...over });
const reason = (out) => out.hookSpecificOutput.permissionDecisionReason;

// A ledger and a state store in memory, shaped like the real ones.
function store(lines = []) {
  const s = { lines: [...lines], states: new Map(), logs: [] };
  s.io = {
    readLedger: () => s.lines.join("\n"),
    append: (entries) => s.lines.push(...entries.map(line)),
    readState: (id) => s.states.get(id) ?? {},
    writeState: (id, state) => s.states.set(id, state),
    repo: () => "owner/repo",
    log: (l) => s.logs.push(l),
  };
  return s;
}

test("the ledger: bad lines are skipped and the newest line of an id wins", () => {
  const text = [line(entry({ state: "asked", answer: undefined, at: NOW - 2 * HOUR })), "not json", "", line({ id: 5 }), line(entry())].join("\n");
  const entries = parseLedger(text);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].state, "answered");
  assert.equal(entries[0].answer, "Merge once");
});

test("candidates: other chats only, answered inside the window, open inside its own shorter one", () => {
  const entries = [
    entry({ id: "mine", session: "me" }),
    entry({ id: "same-thread", session: "resumed", thread: "mcp:launch:me" }),
    entry({ id: "old", at: NOW - WINDOW_MS - 1 }),
    entry({ id: "open-fresh", state: "asked", answer: undefined, at: NOW - OPEN_MS + 1000 }),
    entry({ id: "open-stale", state: "asked", answer: undefined, at: NOW - OPEN_MS - 1000 }),
    entry({ id: "seen" }),
    entry({ id: "fresh", at: NOW - 1000 }),
  ];
  const got = candidates(entries, { session: "me", thread: "mcp:launch:me", now: NOW, shown: [`seen:answered:${NOW - HOUR}`] });
  assert.deepEqual(got.map((e) => e.id), ["fresh", "open-fresh"]);
});

test("a first ask with nothing from other chats passes and is written down as open", () => {
  const s = store();
  const out = run({ input: ask("me"), env: { T3CODE_THREAD_ID: "mcp:launch:me" }, now: NOW, io: s.io });
  assert.equal(out, null);
  const [e] = parseLedger(s.io.readLedger());
  assert.equal(e.state, "asked");
  assert.equal(e.question, Q);
  assert.deepEqual(e.options, ["Merge once", "Not now"]);
  assert.equal(e.thread, "mcp:launch:me");
  assert.equal(e.repo, "owner/repo");
  assert.equal(e.id, entryId("me", Q));
});

test("an answer from another chat stops the dialog once, with the answer and its limits", () => {
  const s = store([line(entry())]);
  const out = run({ input: ask("me"), env: {}, now: NOW, io: s.io });
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  const text = reason(out);
  assert.match(text, /Merge pull request 80 on a hand review\?/);
  assert.match(text, /Answer: "Merge once"/);
  assert.match(text, /owner\/repo/);
  assert.match(text, /mcp:launch:other/);
  assert.match(text, /does not cover yours/); // another item is another question
  for (const stop of ["spend", "deletion", "access change", "security finding", "customers see", "first publication", "message to other people", "uninstall", "loosened rule"]) assert.ok(text.includes(stop), stop); // every stop is asked each time
  assert.match(text, /again/);
  assert.equal(parseLedger(s.io.readLedger()).length, 1, "a stopped dialog is not written down as asked");
  // The second ask passes: everything was shown.
  assert.equal(run({ input: ask("me"), env: {}, now: NOW + 5000, io: s.io }), null);
  assert.equal(parseLedger(s.io.readLedger()).filter((e) => e.state === "asked").length, 1);
});

test("a question open in another chat is shown as open, and a new answer stops a later ask again", () => {
  const s = store([line(entry({ id: "o1", state: "asked", answer: undefined, at: NOW - 60_000 }))]);
  const first = run({ input: ask("me"), env: {}, now: NOW, io: s.io });
  assert.match(reason(first), /open in another chat/i);
  assert.equal(run({ input: ask("me"), env: {}, now: NOW + 1000, io: s.io }), null);
  s.io.append([entry({ id: "n1", at: NOW + 2000, question: "Buy more credit?", answer: "No" })]);
  const again = run({ input: ask("me", [question("Something else?")]), env: {}, now: NOW + 3000, io: s.io });
  assert.match(reason(again), /Buy more credit\?/);
  assert.doesNotMatch(reason(again), /hand review/);
});

test("a chat that saw a question open is shown its answer when it comes", () => {
  const s = store();
  assert.equal(run({ input: ask("a"), env: {}, now: NOW, io: s.io }), null);
  assert.match(reason(run({ input: ask("b"), env: {}, now: NOW + 1000, io: s.io })), /open in another chat/i);
  run({ input: answered("a", { [Q]: "Not now" }), env: {}, now: NOW + 2000, io: s.io });
  const out = run({ input: ask("b"), env: {}, now: NOW + 3000, io: s.io });
  assert.match(reason(out), /Answer: "Not now"/);
  assert.equal(run({ input: ask("b"), env: {}, now: NOW + 4000, io: s.io }), null);
  // The owner is asked again and answers differently: the newer answer is shown too, once.
  run({ input: ask("a"), env: {}, now: NOW + 5000, io: s.io });
  run({ input: answered("a", { [Q]: "Merge once" }), env: {}, now: NOW + 6000, io: s.io });
  assert.match(reason(run({ input: ask("b"), env: {}, now: NOW + 7000, io: s.io })), /Answer: "Merge once"/);
  assert.equal(run({ input: ask("b"), env: {}, now: NOW + 8000, io: s.io }), null);
});

test("more answers than fit are counted, and none of them stops the next ask", () => {
  const many = Array.from({ length: MAX_SHOWN + 4 }, (_, i) => line(entry({ id: `e${i}`, at: NOW - i * 1000, question: `Question ${i}?` })));
  const s = store(many);
  const out = run({ input: ask("me"), env: {}, now: NOW, io: s.io });
  assert.equal((reason(out).match(/^- /gm) ?? []).length, MAX_SHOWN);
  assert.match(reason(out), /4 older/);
  assert.equal(run({ input: ask("me"), env: {}, now: NOW + 1000, io: s.io }), null);
});

test("the answer of a dialog is written down, one entry per question", () => {
  const s = store();
  const two = [question(), question("Which size?", ["Small", "Large"])];
  run({ input: ask("me", two), env: {}, now: NOW, io: s.io });
  const out = run({ input: answered("me", { [Q]: "Merge once", "Which size?": ["Small", "Large"] }, two), env: {}, now: NOW + 9000, io: s.io });
  assert.equal(out, null);
  const entries = parseLedger(s.io.readLedger());
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => [e.state, e.answer]).sort(), [["answered", "Merge once"], ["answered", "Small, Large"]]);
  // The chat that asked is not shown its own answer.
  assert.equal(run({ input: ask("me"), env: {}, now: NOW + 10_000, io: s.io }), null);
});

test("an answer given as text is read too, and a question without an answer is left open", () => {
  const input = { ...answered("me", {}), tool_response: `Your questions have been answered: "${Q}"="Not now". You can now continue.` };
  assert.equal(recordAnswers({ input, env: {}, now: NOW, repo: "" })[0].answer, "Not now");
  assert.deepEqual(recordAnswers({ input: answered("me", {}), env: {}, now: NOW, repo: "" }), []);
  // Quotes and a comma inside the answer, and a second question after it.
  const two = [question(), question("Which size?", ["Small", "Large"])];
  const quoted = { ...answered("me", {}, two), tool_response: `Your questions have been answered: "${Q}"="say "hi", "bye" then", "Which size?"="Large". You can now continue.` };
  assert.deepEqual(recordAnswers({ input: quoted, env: {}, now: NOW, repo: "" }).map((e) => e.answer), ['say "hi", "bye" then', "Large"]);
});

test("what looks like a key is never written down, and long text is cut", () => {
  // Built here, so no scanner reads a key in this file.
  const filler = "a1B2".repeat(10);
  const prefixed = `${"gh"}p_${filler}`;
  assert.equal(redact("yes"), "yes");
  assert.match(redact(`use ${prefixed} for it`), /not recorded/);
  assert.match(redact(`${"s"}k-ant-${filler}`), /not recorded/);
  assert.match(redact(filler), /not recorded/);
  assert.match(redact(`${"gl"}pat-${filler}`), /not recorded/);
  assert.match(redact(`postgres://user:${"Sup3r"}Passw0rd@db.example/x`), /not recorded/);
  assert.match(redact(`${"ey"}J${filler}.${filler}.${filler}`), /not recorded/);
  // A URL, a path, a commit, a chat id and words joined by "_" are kept.
  for (const plain of ["Kubernetes_ClusterAutoscaler_Config2024_For_The_New_Region", "https://github.com/some-owner/some-long-repository-name/pull/80", "plugins/cookbook/skills/cookbook/scripts/owner-answers.mjs", "aac9c72d152f0b6a3f5d7e9c1b2a4d6f8e0c1a2b", "mcp:launch:bcdc676a10872f58173aa01bcdc676a10872f58173"]) {
    assert.equal(redact(plain), plain);
  }
  assert.ok(redact("word ".repeat(400)).length <= 620);
  const [e] = recordAnswers({ input: answered("me", { [Q]: prefixed }), env: {}, now: NOW, repo: "" });
  assert.doesNotMatch(JSON.stringify(e), /a1B2/);
});

test("asking the same question again does not hide the answer it already has", () => {
  const first = entry({ id: "same", at: NOW - HOUR });
  const again = entry({ id: "same", at: NOW - 1000, state: "asked", answer: undefined });
  assert.equal(parseLedger([line(first), line(again)].join("\n"))[0].answer, "Merge once");
  const newer = entry({ id: "same", at: NOW, answer: "Not now" });
  assert.equal(parseLedger([line(first), line(again), line(newer)].join("\n"))[0].answer, "Not now");
});

test("a new chat is stopped once, then passes for ten minutes", () => {
  const s = store();
  const launch = (session) => ({ hook_event_name: "PreToolUse", tool_name: "mcp__t3-code__t3_thread_launch", session_id: session, tool_input: { prompt: "Do the job" } });
  const out = run({ input: launch("me"), env: {}, now: NOW, io: s.io });
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(reason(out), /t3_thread_list/);
  assert.match(reason(out), /gh pr list/);
  assert.equal(run({ input: launch("me"), env: {}, now: NOW + 60_000, io: s.io }), null);
  assert.equal(run({ input: { ...launch("me"), tool_name: "mcp__t3-code__create_threads" }, env: {}, now: NOW + LAUNCH_PASS_MS - 1, io: s.io }), null);
  assert.equal(run({ input: launch("me"), env: {}, now: NOW + LAUNCH_PASS_MS + 1, io: s.io }).hookSpecificOutput.permissionDecision, "deny");
  // Another chat has its own turn, and a delegate child is left alone.
  assert.equal(run({ input: launch("you"), env: {}, now: NOW + 1000, io: s.io }).hookSpecificOutput.permissionDecision, "deny");
  assert.equal(decideLaunch({ input: launch("kid"), env: { T3CODE_THREAD_ID: "thread:delegated-task:1" }, now: NOW, state: {} }).output, null);
});

test("other tools and other events pass untouched", () => {
  const s = store([line(entry())]);
  assert.equal(run({ input: { hook_event_name: "PreToolUse", tool_name: "Bash", session_id: "me", tool_input: {} }, env: {}, now: NOW, io: s.io }), null);
  assert.equal(run({ input: { hook_event_name: "PostToolUse", tool_name: "mcp__t3-code__t3_thread_launch", session_id: "me" }, env: {}, now: NOW, io: s.io }), null);
  assert.equal(run({ input: {}, env: {}, now: NOW, io: s.io }), null);
  assert.equal(decideAsk({ input: { ...ask("me"), tool_input: { questions: "x" } }, env: {}, now: NOW, ledgerText: line(entry()), state: {}, repo: "" }).output, null);
});

test("a store that cannot be read or written never stops a dialog", () => {
  const s = store([line(entry())]);
  s.io.readLedger = () => { throw new Error("locked"); };
  assert.equal(run({ input: ask("me"), env: {}, now: NOW, io: s.io }), null);
  assert.equal(s.logs.length, 1);
  assert.doesNotMatch(JSON.stringify(s.logs), /hand review/); // the log never holds a question
});

test("repository names and the list", () => {
  assert.equal(repoLabel("https://github.com/Owner/Repo.git\n"), "owner/repo");
  assert.equal(repoLabel("git@github.com:Owner/Repo.git"), "owner/repo");
  assert.equal(repoLabel("C:/somewhere/local"), "");
  const text = formatList(parseLedger([line(entry()), line(entry({ id: "o", state: "asked", answer: undefined, at: NOW - 60_000, question: "Open one?" }))].join("\n")), { now: NOW, hours: 72 });
  assert.match(text, /16 Nov 18:30 UTC/);
  assert.match(text, /Answer: "Merge once"/);
  assert.match(text, /Open one\?/);
  assert.equal(formatList([], { now: NOW, hours: 72 }), "No owner answers in the last 72 hours.");
});

test("the hook file and the command, end to end on a folder of their own", () => {
  const home = mkdtempSync(join(tmpdir(), "owner-answers-"));
  const env = { ...process.env, OWNER_ANSWERS_DIR: home, T3CODE_THREAD_ID: "" };
  const hook = fileURLToPath(new URL("../plugins/cookbook/hooks/owner-answers.mjs", import.meta.url));
  const cli = fileURLToPath(new URL("../plugins/cookbook/skills/cookbook/scripts/owner-answers.mjs", import.meta.url));
  const fire = (input) => spawnSync(process.execPath, [hook], { input: JSON.stringify(input), env, encoding: "utf8" });
  const cwd = tmpdir();
  assert.equal(fire({ ...ask("a"), cwd }).stdout, "");
  assert.equal(fire({ ...answered("a", { [Q]: "Merge once" }), cwd }).stdout, "");
  const denied = JSON.parse(fire({ ...ask("b"), cwd }).stdout);
  assert.match(reason(denied), /Answer: "Merge once"/);
  assert.equal(fire({ ...ask("b"), cwd }).stdout, "");
  const broken = spawnSync(process.execPath, [hook], { input: "not json", env, encoding: "utf8" });
  assert.equal(broken.status, 0);
  assert.equal(broken.stdout, "");
  const added = spawnSync(process.execPath, [cli, "add", "--question", "Keep the plan?", "--answer", "Yes, keep it"], { env, encoding: "utf8" });
  assert.equal(added.status, 0, added.stderr);
  const listed = spawnSync(process.execPath, [cli, "list"], { env, encoding: "utf8" });
  assert.match(listed.stdout, /Keep the plan\?/);
  assert.match(listed.stdout, /Answer: "Yes, keep it"/);
  assert.match(listed.stdout, /Merge once/);
  assert.equal(spawnSync(process.execPath, [cli, "add", "--question", "x"], { env, encoding: "utf8" }).status, 2);
  assert.ok(readFileSync(join(home, "ledger.jsonl"), "utf8").trim().split("\n").length >= 4);
  writeFileSync(join(home, "ledger.jsonl"), "");
  assert.match(spawnSync(process.execPath, [cli, "list", "--hours", "5"], { env, encoding: "utf8" }).stdout, /No owner answers in the last 5 hours/);
});
