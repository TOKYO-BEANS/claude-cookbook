// sandbox-claude.mjs: a Claude job in a Depot sandbox on the plan token (skills/cookbook/scripts).
// The run is locked down by the script, not by the prompt, and what comes back is only data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BEGIN, END, FILES, FILTER, MODEL, EFFORT, SCRIPT, TOOLS, localVersion, parseArgs, runArgs, splitOutput, summarize, unpack } from "../plugins/cookbook/skills/cookbook/scripts/sandbox-claude.mjs";
import { parseArgs as runParse } from "../plugins/cookbook/skills/cookbook/scripts/sandbox-run.mjs";

test("arguments: a prompt is required; small, an hour, USD 10 and the plain tools by default", () => {
  const j = parseArgs(["--", "fix", "the", "test"]);
  assert.deepEqual(j, { push: null, type: "small", timeout: 3600, budget: 10, tools: TOOLS, promptFile: null, prompt: "fix the test" });
  assert.match(parseArgs([]).error, /prompt is required/);
  assert.match(parseArgs(["--prompt-file", "p.md", "--", "x"]).error, /not both/);
  assert.match(parseArgs(["--budget", "-1", "--", "x"]).error, /--budget/);
  assert.match(parseArgs(["--tools", "Bash(rm -rf /)", "--", "x"]).error, /--tools/);
  assert.match(parseArgs(["--model", "claude-fable-5-2", "--", "x"]).error, /not an option/);
  assert.match(parseArgs(["--timeout"]).error, /takes a value/);
});

test("the job goes through sandbox-run --claude, and sandbox-run reads it as a run with an upload", () => {
  const job = parseArgs(["--push", "/r", "--type", "default", "--timeout", "900", "--budget", "2.5", "--", "do it"]);
  const a = runArgs(job, "2.1.332", "do it");
  const run = runParse(a);
  assert.equal(run.error, undefined);
  assert.equal(run.claude, true);
  assert.equal(run.push, "/r");
  assert.equal(run.type, "default");
  assert.equal(run.timeout, 900);
  assert.deepEqual(run.command, ["bash", "-c", SCRIPT, "sandbox-claude", "2.1.332", "do it", "2.5", TOOLS, FILTER]);
  assert.ok(!runArgs(parseArgs(["--", "x"]), "1.0.0", "x").includes("--push"));
});

test("the run in the sandbox is locked down: Opus 5.5 high, no settings, no MCP, no saved session, a cap, an empty environment", () => {
  assert.equal(MODEL, "claude-opus-5-5");
  assert.equal(EFFORT, "high");
  for (const part of ["--model claude-opus-5-5", "--effort high", "--permission-mode dontAsk", '--tools "$TOOLS"', '--allowedTools "$TOOLS"', '--max-budget-usd "$BUDGET"', "--no-session-persistence", '--setting-sources ""', "--strict-mcp-config", "env -i ", "CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1"]) {
    assert.ok(SCRIPT.includes(part), part);
  }
  assert.ok(!/bypassPermissions|dangerously|ANTHROPIC_API_KEY/.test(SCRIPT));
  // The prompt and the other values are arguments, never pasted into the script.
  assert.ok(SCRIPT.includes('PROMPT="$2"') && SCRIPT.includes('-p "$PROMPT"'));
  assert.ok(SCRIPT.includes('grep -rqF -- "$CLAUDE_CODE_OAUTH_TOKEN"'), "a run whose files hold the token sends nothing back");
});

test("the filter keeps every event and ends a run that is not on the plan login", { skip: process.platform === "win32" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "sc-filter-"));
  try {
    const run = (lines) => spawnSync(process.execPath, ["-e", FILTER, join(dir, "s.jsonl")], { input: lines.map((l) => JSON.stringify(l)).join("\n") + "\n", encoding: "utf8" });
    const ok = run([{ type: "system", subtype: "init", apiKeySource: "none", model: MODEL, tools: ["Read"] }, { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash" }] } }]);
    assert.equal(ok.status, 0);
    assert.match(ok.stderr, /claude-opus-5-5 on the plan token/);
    assert.match(ok.stderr, /tool Bash/);
    const key = run([{ type: "system", subtype: "init", apiKeySource: "ANTHROPIC_API_KEY", model: MODEL }, { type: "result" }]);
    assert.equal(key.status, 3);
    assert.match(key.stderr, /refused: the run is not on the plan token/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the files are cut out of the output, and only the three expected names are unpacked", { skip: process.platform === "win32" }, () => {
  assert.deepEqual(splitOutput("hello\n"), { text: "hello\n", files: null });
  assert.deepEqual(splitOutput(`a\n${BEGIN}\nQUJD\n${END}\nb\n`), { text: "a\nb\n", files: "QUJD" });
  const dir = mkdtempSync(join(tmpdir(), "sc-unpack-"));
  try {
    const src = join(dir, "src");
    const into = join(dir, "into");
    mkdirSync(src);
    mkdirSync(into);
    for (const f of FILES) writeFileSync(join(src, f), `${f}\n`);
    const good = spawnSync("tar", ["-czf", "-", "-C", src, ...FILES]).stdout.toString("base64");
    assert.equal(unpack(good, into), null);
    assert.deepEqual(readdirSync(into).sort(), [...FILES].sort());
    writeFileSync(join(src, "extra.sh"), "x\n");
    const extra = spawnSync("tar", ["-czf", "-", "-C", src, ...FILES, "extra.sh"]).stdout.toString("base64");
    assert.match(unpack(extra, join(dir, "into")), /not the three expected/);
    assert.match(unpack("bm90IGEgdGFy", into), /could not be read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the summary: model, plan login, turns, list-rate cost and result from the event stream", () => {
  const s = summarize([
    JSON.stringify({ type: "system", subtype: "init", model: MODEL, apiKeySource: "none", tools: ["Read"] }),
    "not json",
    JSON.stringify({ type: "result", num_turns: 3, total_cost_usd: 0.42, usage: { output_tokens: 10 }, duration_ms: 1000, is_error: false, result: "done" }),
  ].join("\n"));
  assert.deepEqual(s, { model: MODEL, apiKeySource: "none", tools: ["Read"], turns: 3, costUsd: 0.42, usage: { output_tokens: 10 }, durationMs: 1000, isError: false, result: "done" });
  assert.equal(localVersion("2.1.332 (Claude Code)\n"), "2.1.332");
  assert.equal(localVersion("nothing"), null);
});
