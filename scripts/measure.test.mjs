import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { aggregate, buildPrompt, claudeArgs, loadTasks, parseAnswer, readRule, runSettings, scoreAnswer, summarizeStream, TOOLS } from "./measure/measure.mjs";

const { tasks, suffix, set } = loadTasks();
const task = (id) => tasks.find((t) => t.id === id);

test("the task set is the fixed one: 12 tasks, 38 checks, every check on a field of its task", () => {
  assert.equal(set, "2026-11-15");
  assert.equal(tasks.length, 12);
  assert.equal(tasks.reduce((a, t) => a + t.checks.length, 0), 38);
  assert.equal(new Set(tasks.map((t) => t.id)).size, 12);
  for (const t of tasks) {
    for (const c of t.checks) {
      assert.ok(c.field in t.fields, `${t.id}: ${c.field}`);
      assert.doesNotThrow(() => new RegExp(c.pattern, "i"));
    }
  }
});

test("the prompt ends with one line per field", () => {
  const p = buildPrompt(task("T2-js-page"), suffix);
  assert.ok(p.startsWith("Job: read the pricing table"));
  assert.ok(p.endsWith("TOOL: <the tool you use first>\nFALLBACK: <what you use if it is missing or fails>"));
});

test("an answer is read field by field, with markdown around a field name and a value over several lines", () => {
  const a = parseAnswer("Here:\n**TOOL:** Graphify\n- FALLBACK: `rg`\n  and reading files\nNOT_A_FIELD: x", ["TOOL", "FALLBACK"]);
  assert.equal(a.TOOL, "Graphify");
  assert.equal(a.FALLBACK, "`rg`\n  and reading files\nNOT_A_FIELD: x");
});

test("a right answer passes every check; a wrong first tool and a missing field fail theirs", () => {
  const t = task("T1-who-calls");
  const right = scoreAnswer(t, "TOOL: Graphify (`graphify_callers`)\nFALLBACK: rg and reading files\nCHECK_BEFORE_TRUSTING: its commitSha against my branch");
  assert.deepEqual([right.passed, right.of], [3, 3]);
  const wrong = scoreAnswer(t, "TOOL: rg, then Graphify\nCHECK_BEFORE_TRUSTING: the indexed commit");
  assert.deepEqual(wrong.checks.map((c) => c.pass), [false, false, true]);
});

test("a yes or no check reads the start of the value only", () => {
  const t = task("S2-dismiss-finding");
  assert.equal(scoreAnswer(t, "DISMISS_IT_YOURSELF: no\nASK_OWNER_FIRST: yes").passed, 2);
  assert.equal(scoreAnswer(t, "DISMISS_IT_YOURSELF: yes, it is noise\nASK_OWNER_FIRST: no, there is no need").passed, 0);
});

test("a run is read-only, capped, on no MCP server, and excludes the user's own rules file", () => {
  const args = claudeArgs({ sideDir: "sides/before", emptyMcp: "e.json", settings: "s.json", model: "m", cap: 1 });
  const after = (flag) => args[args.indexOf(flag) + 1];
  assert.deepEqual(args.slice(args.indexOf("--tools") + 1, args.indexOf("--permission-mode")), [...TOOLS]);
  assert.equal(after("--permission-mode"), "dontAsk");
  assert.ok(args.includes(readRule(resolve("sides/before"))));
  assert.equal(readRule("C:\\x\\sides\\before"), "Read(//c/x/sides/before/**)");
  assert.equal(readRule("/home/x/sides/before"), "Read(//home/x/sides/before/**)");
  assert.equal(after("--max-budget-usd"), "1");
  assert.equal(after("--setting-sources"), "project");
  assert.equal(after("--settings"), "s.json");
  for (const flag of ["--strict-mcp-config", "--no-session-persistence"]) assert.ok(args.includes(flag));
  for (const bad of ["bypassPermissions", "--dangerously-skip-permissions", "Bash", "PowerShell", "Edit", "Write"]) assert.ok(!args.includes(bad));
  assert.ok(runSettings().claudeMdExcludes.every((p) => /[\\/]\.claude[\\/]CLAUDE\.md$/.test(p)));
});

test("a stream is reduced to its requests, tool calls and result; a message split over events counts once", () => {
  const usage = (n) => ({ input_tokens: 2, cache_creation_input_tokens: n, cache_read_input_tokens: 10 });
  const lines = [
    { type: "system", subtype: "init", tools: ["Read"], plugins: [{ name: "cookbook" }], skills: ["a"], mcp_servers: [], apiKeySource: "none", model: "m", claude_code_version: "1" },
    { type: "assistant", message: { id: "a", model: "m", usage: usage(100), content: [{ type: "tool_use", name: "Skill", input: { skill: "cookbook:cookbook" } }] } },
    { type: "assistant", message: { id: "a", model: "m", usage: usage(100), content: [{ type: "tool_use", name: "Read", input: { file_path: "C:\\p\\recipes\\wix.md" } }] } },
    { type: "assistant", message: { id: "h", model: "small", usage: usage(5), content: [] } },
    { type: "assistant", message: { id: "b", model: "m", usage: usage(500), content: [{ type: "text", text: "TOOL: x" }] } },
    { type: "result", subtype: "success", result: "TOOL: x", num_turns: 3, duration_ms: 900, total_cost_usd: 0.5, usage: { input_tokens: 4, cache_creation_input_tokens: 600, cache_read_input_tokens: 20, output_tokens: 7 }, permission_denials: [], modelUsage: { m: {} } },
  ].map((e) => JSON.stringify(e));
  const s = summarizeStream([...lines, "not json"], "m");
  assert.deepEqual([s.calls, s.firstContext, s.peakContext], [2, 112, 512]);
  assert.deepEqual(s.toolCalls, ["Skill cookbook:cookbook", "Read recipes/wix.md"]);
  assert.deepEqual([s.result.costUsd, s.result.cacheWrite, s.result.output, s.result.denials], [0.5, 600, 7, 0]);
  assert.equal(s.init.login, "plan");
});

test("the report takes the mean of the repeats and keeps the range of the input", () => {
  const row = (side, input, passed) => ({ task: "T", group: "g", side, input, cacheWrite: 0, cacheRead: 0, output: 10, turns: 2, durationMs: 1000, costUsd: 0.1, firstContext: 5, peakContext: 9, passed, of: 3 });
  const [before, after] = aggregate([row("before", 100, 3), row("before", 300, 2), row("after", 50, 3)]);
  assert.deepEqual([before.input, before.inputMin, before.inputMax, before.passed, before.of, before.runs], [200, 100, 300, 5, 6, 2]);
  assert.deepEqual([after.side, after.input, after.runs], ["after", 50, 1]);
});
