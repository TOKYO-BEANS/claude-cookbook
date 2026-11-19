import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { aggregate, buildPrompt, claudeArgs, discardedRow, foreignRows, loadTasks, parseAnswer, parseFlags, parseLimits, probeVerdict, readRule, runProblem, scoredRows, spentSoFar, runSettings, scoreAnswer, summarizeStream, TOOLS } from "./measure/measure.mjs";

const { tasks, suffix, set } = loadTasks();
const task = (id) => tasks.find((t) => t.id === id);

test("the task set is the fixed one: 12 tasks, 38 checks, every check on a field of its task", () => {
  assert.equal(set, "2026-11-19");
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
  assert.deepEqual(args.slice(args.indexOf("--allowedTools") + 1, args.indexOf("--strict-mcp-config")), ["Skill", readRule(resolve("sides/before"))], "no unscoped Read, Glob or Grep is allowed");
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

test("the cap, the stop and the repeats must be positive numbers; a bad one stops the command", () => {
  assert.deepEqual(parseLimits({}), { cap: 1, limit: 30, reps: 2, model: "claude-opus-5-5", transcripts: false });
  assert.deepEqual(parseLimits({ cap: "0.5", limit: "10", reps: "1", model: "m" }), { cap: 0.5, limit: 10, reps: 1, model: "m", transcripts: false });
  for (const bad of [{ limit: "3O" }, { limit: "" }, { cap: "NaN" }, { cap: "0" }, { cap: "-1" }, { reps: "1.5" }, { reps: "x" }, { cap: "40" }, { limit: "Infinity" }]) assert.throws(() => parseLimits(bad), /--(cap|limit|reps)/, JSON.stringify(bad));
});

test("a run's full text is kept only when asked for, and a search is recorded without its pattern", () => {
  assert.equal(parseLimits({ transcripts: "yes" }).transcripts, true);
  assert.equal(parseLimits({ transcripts: "no" }).transcripts, false);
  assert.throws(() => parseLimits({ transcripts: "1" }), /--transcripts/);
  const line = JSON.stringify({ type: "assistant", message: { id: "a", model: "m", usage: {}, content: [{ type: "tool_use", name: "Grep", input: { pattern: "a line quoted from the rules file" } }] } });
  assert.deepEqual(summarizeStream([line], "m").toolCalls, ["Grep"]);
});

test("a flag without a value is an error", () => {
  assert.deepEqual(parseFlags(["--out", "o", "--limit", "5"]), { out: "o", limit: "5" });
  for (const bad of [["--limit"], ["--limit", "--out", "o"], ["limit", "5"]]) assert.throws(() => parseFlags(bad), /needs a value/);
});

test("rows of another task set or model in the folder are found; a row from before the model was recorded counts as this model", () => {
  const rows = [{ set: "a", task: "T" }, { set: "a", model: "m" }, { set: "b", model: "m" }, { set: "a", model: "other" }];
  assert.deepEqual(foreignRows(rows, "a", "m"), [rows[2], rows[3]]);
  assert.deepEqual(foreignRows(rows.slice(0, 2), "a", "m"), []);
});

test("requests are counted for the model the session reports, also when --model was an alias", () => {
  const lines = [
    { type: "system", subtype: "init", model: "claude-x-1" },
    { type: "assistant", message: { id: "a", model: "claude-x-1", usage: { input_tokens: 7 }, content: [] } },
    { type: "assistant", message: { id: "h", model: "claude-small", usage: { input_tokens: 99 }, content: [] } },
  ].map((e) => JSON.stringify(e));
  const s = summarizeStream(lines, "x");
  assert.deepEqual([s.calls, s.firstContext, s.peakContext], [1, 7, 7]);
  assert.equal(summarizeStream(lines.slice(1), "x").calls, 0);
});

test("the probe's verdict: clean only with one rules file, the side's own, and not the user's", () => {
  const side = "C:\\e\\arms\\before", user = "C:\\Users\\u\\.claude\\CLAUDE.md";
  const own = "C:\\e\\arms\\before\\work\\CLAUDE.md";
  assert.deepEqual(probeVerdict(`FILES: 1 — ${own}\nFIRST_HEADING: # x`, side, user), { files: 1, own: true, user: false, clean: true });
  assert.equal(probeVerdict(`**FILES:** 1 - ${own.replaceAll("\\", "/")}`, side, user).clean, true);
  assert.deepEqual(probeVerdict(`FILES: 2 — ${user}; ${own}`, side, user), { files: 2, own: true, user: true, clean: false });
  assert.equal(probeVerdict(`FILES: 1 — ${user}`, side, user).clean, false);
  assert.equal(probeVerdict(undefined, side, user).clean, false);
  assert.equal(probeVerdict("no such line", side, user).clean, false);
});

test("a run that ended in an error, has no result or no counted request is not scored", () => {
  const stream = (result) => summarizeStream([
    { type: "system", subtype: "init", model: "m" },
    { type: "assistant", message: { id: "a", model: "m", usage: { input_tokens: 5 }, content: [] } },
    ...(result ? [{ type: "result", ...result }] : []),
  ].map((e) => JSON.stringify(e)), "m");
  assert.equal(runProblem(stream({ subtype: "success", result: "TOOL: x", total_cost_usd: 0.1 }), 0, "m"), null);
  assert.match(runProblem(stream({ subtype: "success", result: "TOOL: x" }), 0, "m"), /reported no cost/);
  assert.match(runProblem(stream({ subtype: "error_max_budget_usd", is_error: true }), 0, "m"), /error_max_budget_usd/);
  assert.match(runProblem(stream({ subtype: "error_during_execution" }), 1, "m"), /error_during_execution/);
  assert.match(runProblem(stream({ subtype: "success", is_error: true }), 0, "m"), /ended as/);
  assert.match(runProblem(stream(null), 3, "m"), /no result \(exit 3\)/);
  assert.match(runProblem(summarizeStream([JSON.stringify({ type: "result", subtype: "success" })], "m"), 0, "m"), /no request/);
});

test("a run that is not scored still counts against the batch limit, and is not taken as done", () => {
  const base = { set: "s", model: "m", task: "T", side: "before", rep: 1, cap: 1 };
  const cut = discardedRow({ ...base, problem: "the run ended as \"error_max_budget_usd\"", result: { costUsd: 0.75 } });
  const silent = discardedRow({ ...base, problem: "no result (exit 1)", result: null });
  assert.deepEqual([cut.costUsd, cut.costKnown, silent.costUsd, silent.costKnown], [0.75, true, 1, false]);
  const rows = [{ ...base, costUsd: 0.25, passed: 3, of: 3 }, cut, silent];
  assert.equal(spentSoFar(rows), 2);
  assert.deepEqual(scoredRows(rows), [rows[0]]);
  assert.deepEqual(scoredRows([cut]), [], "the task runs again");
  assert.deepEqual(foreignRows([cut], "s", "m"), []);
  assert.equal(spentSoFar([{ costUsd: undefined }, { costUsd: 0.5 }]), 0.5);
  const noCost = summarizeStream([JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true })], "m").result;
  assert.deepEqual([noCost.costUsd, noCost.costReported], [0, false]);
  const charged = discardedRow({ ...base, problem: "x", result: noCost });
  assert.deepEqual([charged.costUsd, charged.costKnown], [1, false], "an error result without a cost counts at the cap");
});

test("a side is before or after, nothing else", () => {
  assert.equal(parseLimits({ side: "before" }).cap, 1);
  assert.equal(parseLimits({ side: "after" }).cap, 1);
  for (const side of ["Before", "both", "", "old"]) assert.throws(() => parseLimits({ side }), /--side must be before or after/);
});

test("the report takes the mean of the repeats and keeps the range of the input", () => {
  const row = (side, input, passed) => ({ task: "T", group: "g", side, input, cacheWrite: 0, cacheRead: 0, output: 10, turns: 2, durationMs: 1000, costUsd: 0.1, firstContext: 5, peakContext: 9, passed, of: 3 });
  const [before, after] = aggregate([row("before", 100, 3), row("before", 300, 2), row("after", 50, 3)]);
  assert.deepEqual([before.input, before.inputMin, before.inputMax, before.passed, before.of, before.runs], [200, 100, 300, 5, 6, 2]);
  assert.deepEqual([after.side, after.input, after.runs], ["after", 50, 1]);
});
