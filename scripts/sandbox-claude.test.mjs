// sandbox-claude.mjs: a Claude job in a Depot sandbox on the plan token (skills/cookbook/scripts).
// The run is locked down by the script, not by the prompt, and what comes back is only data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BEGIN, END, FILES, SCAN_FAILED, FILTER, MODEL, EFFORT, SCRIPT, TOOLS, localVersion, parseArgs, runArgs, splitOutput, summarize, unpack } from "../plugins/cookbook/skills/cookbook/scripts/sandbox-claude.mjs";
import { NOT_STARTED, parseArgs as runParse } from "../plugins/cookbook/skills/cookbook/scripts/sandbox-run.mjs";

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
  assert.ok(SCRIPT.includes('PROMPT="$2"') && SCRIPT.includes(`printf '%s' "$PROMPT" | env -i`) && SCRIPT.includes("claude -p --model"));
  // The token is out of the environment of every step but claude -p (the install included),
  // and the patch is taken against the uploaded commit, so the run's own commits count.
  assert.ok(SCRIPT.indexOf("export -n CLAUDE_CODE_OAUTH_TOKEN") < SCRIPT.indexOf("npm install"));
  assert.ok(SCRIPT.includes('git diff --cached --binary "$BASE"'));
  assert.equal(SCAN_FAILED, 4);
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
    // A link made in the sandbox never becomes a link here.
    const linked = join(dir, "linked");
    mkdirSync(linked);
    writeFileSync(join(linked, "stream.jsonl"), "x\n");
    writeFileSync(join(linked, "claude.err"), "x\n");
    symlinkSync("/etc/hostname", join(linked, "changes.patch"));
    const link = spawnSync("tar", ["-czf", "-", "-C", linked, ...FILES]).stdout.toString("base64");
    const fresh = join(dir, "fresh");
    mkdirSync(fresh);
    assert.match(unpack(link, fresh), /not three regular files/);
    assert.deepEqual(readdirSync(fresh), []);
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
  assert.deepEqual(s, { model: MODEL, planLogin: true, tools: ["Read"], turns: 3, costUsd: 0.42, usage: { output_tokens: 10 }, durationMs: 1000, isError: false, result: "done" });
  assert.equal(summarize(JSON.stringify({ type: "system", subtype: "init", apiKeySource: "ANTHROPIC_API_KEY" })).planLogin, false);
  assert.equal(summarize("").planLogin, null);
  assert.equal(localVersion("2.1.332 (Claude Code)\n"), "2.1.332");
  assert.equal(localVersion("nothing"), null);
});

// main() run as a process, with no network and no key: the script is copied next to a stand-in
// sandbox-run.mjs (the real one's NOT_STARTED, STATE and scan, but a canned job as its main), and
// `claude` and `gitleaks` on PATH are stubs. HOME is a fresh folder, so the runs land there.
const REAL = new URL("../plugins/cookbook/skills/cookbook/scripts/", import.meta.url);
const STUB_RUN = `import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
export { NOT_STARTED, STATE, scan } from ${JSON.stringify(new URL("sandbox-run.mjs", REAL).href)};
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  if (process.env.SC_RUN_OUT) process.stdout.write(readFileSync(process.env.SC_RUN_OUT));
  if (process.env.SC_RUN_SIGNAL) process.kill(process.pid, process.env.SC_RUN_SIGNAL);
  process.exitCode = Number(process.env.SC_RUN_CODE ?? 0);
}
`;
const STUB_CLAUDE = `#!/bin/sh\nprintf '%s\\n' "\${SC_CLAUDE_VERSION-2.1.332 (Claude Code)}"\n`;
const STUB_GITLEAKS = `#!/bin/sh
R=""; while [ $# -gt 0 ]; do [ "$1" = "--report-path" ] && R="$2"; shift; done
[ -n "\${SC_GITLEAKS_REPORT-[]}" ] && printf '%s' "\${SC_GITLEAKS_REPORT-[]}" >"$R"
exit "\${SC_GITLEAKS_CODE:-0}"
`;

function harness() {
  // The real path: on macOS tmpdir() is under the /var link, and the script's own main check
  // compares argv[1] with its resolved URL, so from the link it would never run.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "sc-main-")));
  const bin = join(root, "bin");
  const scripts = join(root, "scripts");
  mkdirSync(bin);
  mkdirSync(scripts);
  copyFileSync(fileURLToPath(new URL("sandbox-claude.mjs", REAL)), join(scripts, "sandbox-claude.mjs"));
  writeFileSync(join(scripts, "sandbox-run.mjs"), STUB_RUN);
  for (const [name, body] of [["claude", STUB_CLAUDE], ["gitleaks", STUB_GITLEAKS]]) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  let n = 0;
  // The job's output: text, then the three files the way the sandbox sends them.
  const output = (files, { text = "from the job\n", events } = {}) => {
    const src = join(root, `files-${(n += 1)}`);
    mkdirSync(src);
    const stream = events ?? [{ type: "system", subtype: "init", apiKeySource: "none", model: MODEL, tools: ["Read"] }, { type: "result", num_turns: 2, total_cost_usd: 0.1, is_error: false, result: "all done" }];
    writeFileSync(join(src, "stream.jsonl"), stream.map((e) => JSON.stringify(e)).join("\n") + "\n");
    writeFileSync(join(src, "changes.patch"), "");
    writeFileSync(join(src, "claude.err"), "");
    // COPYFILE_DISABLE: macOS tar would add ._ files for extended attributes.
    const b64 = spawnSync("tar", ["-czf", "-", "-C", src, ...files], { env: { ...process.env, COPYFILE_DISABLE: "1" } }).stdout.toString("base64");
    const out = join(root, `out-${n}`);
    writeFileSync(out, `${text}${BEGIN}\n${b64}\n${END}\n`);
    return out;
  };
  const run = (args, env = {}) => {
    const home = join(root, `home-${(n += 1)}`);
    const tmp = join(home, "tmp");
    mkdirSync(tmp, { recursive: true });
    // Its own TMPDIR, so a temp folder main() leaves behind fails the run and never outlives the test.
    const r = spawnSync(process.execPath, [join(scripts, "sandbox-claude.mjs"), ...args], { encoding: "utf8", timeout: 60_000, env: { ...process.env, HOME: home, TMPDIR: tmp, PATH: `${bin}:${process.env.PATH}`, ...env } });
    assert.equal(r.error, undefined);
    assert.deepEqual(readdirSync(tmp), [], "main() left a temp folder");
    const runs = join(home, ".local", "share", "sandbox-run", "claude");
    return { ...r, runs: existsSync(runs) ? readdirSync(runs).map((d) => join(runs, d)) : [] };
  };
  return { root, output, run, done: () => rmSync(root, { recursive: true, force: true }) };
}

test("main: not started is 75 (bad arguments, no local version); a prompt file that is not there ends with 1", { skip: process.platform === "win32" }, () => {
  const h = harness();
  try {
    const bad = h.run(["--model", "x", "--", "do it"]);
    assert.equal(bad.status, NOT_STARTED);
    assert.match(bad.stderr, /not started: --model is not an option/);
    const none = h.run(["--", "do it"], { SC_CLAUDE_VERSION: "" });
    assert.equal(none.status, NOT_STARTED);
    assert.match(none.stderr, /version on this laptop could not be read/);
    assert.deepEqual(none.runs, []);
    const missing = h.run(["--prompt-file", join(h.root, "no-such-prompt.md")]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /ENOENT.*no-such-prompt\.md/);
  } finally {
    h.done();
  }
});

test("main: with no files back, the job's own code (or 130 for a signal); files that do not unpack are never a 0", { skip: process.platform === "win32" }, () => {
  const h = harness();
  try {
    const empty = join(h.root, "empty");
    writeFileSync(empty, "nothing\n");
    const three = h.run(["--", "do it"], { SC_RUN_OUT: empty, SC_RUN_CODE: "3" });
    assert.equal(three.status, 3);
    assert.match(three.stdout, /^nothing\n/);
    assert.match(three.stderr, /no files came back \(exit 3\)/);
    const stopped = h.run(["--", "do it"], { SC_RUN_OUT: empty, SC_RUN_CODE: "0", SC_RUN_SIGNAL: "SIGTERM" });
    assert.equal(stopped.status, 130);
    assert.match(stopped.stderr, /no files came back \(exit 130\)/);
    // Two of the three files: the job said 0, the run says 1; a job's own failure stays its code.
    const short = h.output(["stream.jsonl", "claude.err"]);
    const zero = h.run(["--", "do it"], { SC_RUN_OUT: short, SC_RUN_CODE: "0" });
    assert.equal(zero.status, 1);
    assert.match(zero.stderr, /not the three expected; nothing kept/);
    assert.equal(zero.runs.length, 1);
    assert.deepEqual(readdirSync(zero.runs[0]), []);
    const failed = h.run(["--", "do it"], { SC_RUN_OUT: short, SC_RUN_CODE: "3" });
    assert.equal(failed.status, 3);
    assert.match(failed.stderr, /not the three expected; nothing kept/);
  } finally {
    h.done();
  }
});

test("main: a secret-scan finding or no scan result is 4 whatever the job's code; a clean scan gives the job's code", { skip: process.platform === "win32" }, () => {
  const h = harness();
  try {
    const good = h.output(FILES);
    const found = h.run(["--", "do it"], { SC_RUN_OUT: good, SC_RUN_CODE: "0", SC_GITLEAKS_CODE: "3", SC_GITLEAKS_REPORT: JSON.stringify([{ RuleID: "generic-api-key", File: "x/changes.patch" }]) });
    assert.equal(found.status, SCAN_FAILED);
    assert.match(found.stderr, /1 finding \(generic-api-key in x\/changes.patch\).*Do not apply the patch/);
    const blind = h.run(["--", "do it"], { SC_RUN_OUT: good, SC_RUN_CODE: "0", SC_GITLEAKS_CODE: "2", SC_GITLEAKS_REPORT: "" });
    assert.equal(blind.status, SCAN_FAILED);
    assert.match(blind.stderr, /no result \(gitleaks exit 2, no report\)/);
    const ok = h.run(["--", "do it"], { SC_RUN_OUT: good, SC_RUN_CODE: "0" });
    assert.equal(ok.status, 0);
    assert.equal(ok.stdout, "from the job\nall done\n");
    assert.match(ok.stderr, /claude-opus-5-5 \(high\), on the plan login, 2 turns, USD 0.1/);
    assert.match(ok.stderr, /files in .*; no changes/);
    assert.equal(ok.runs.length, 1);
    const summary = JSON.parse(readFileSync(join(ok.runs[0], "summary.json"), "utf8"));
    assert.equal(summary.exit, 0);
    assert.equal(summary.version, "2.1.332");
    // A run the filter ended (3) still brings its files back, and its code stays 3.
    const ended = h.run(["--", "do it"], { SC_RUN_OUT: good, SC_RUN_CODE: "3" });
    assert.equal(ended.status, 3);
    assert.match(ended.stderr, /files in .*; no changes/);
    assert.deepEqual(readdirSync(ended.runs[0]).sort(), [...FILES, "summary.json"].sort());
    assert.equal(JSON.parse(readFileSync(join(ended.runs[0], "summary.json"), "utf8")).exit, 3);
  } finally {
    h.done();
  }
});
