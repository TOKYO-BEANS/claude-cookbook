// Measures a fixed set of tasks (tasks.json) on two "sides" of the setup, each a folder:
//   <sides>/<name>/work/CLAUDE.md   the global rules file of that side, loaded as the folder's own
//   <sides>/<name>/plugin/          the Cookbook plugin of that side (`git archive <commit> plugins/cookbook`)
// Every run is headless on the Claude plan login, read-only (Skill, Read, Glob, Grep), with no MCP
// servers, no user settings or plugins, a spend cap per run and a stop for the whole batch.
//   node scripts/measure/measure.mjs run --sides <dir> --out <dir> [--side before] [--task T1-who-calls] [--reps 2]
//   node scripts/measure/measure.mjs report --out <dir>
// By default a run leaves numbers only in --out: counts, cost, the tools called, which checks passed.
// The model's text can quote the rules file it was given, so the full stream of a run (and what the
// run printed on stderr) is written only with `--transcripts yes`. Keep such a folder out of a repository.
// The rules for scripted runs are in recipes/scripted-runs.md and recipes/scripted-runs-rules.md.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS = Object.freeze(["Skill", "Read", "Glob", "Grep"]);
export const DEFAULTS = Object.freeze({ model: "claude-opus-5-5", cap: 1, limit: 30, reps: 2 });

export const loadTasks = (file = fileURLToPath(new URL("./tasks.json", import.meta.url))) => JSON.parse(readFileSync(file, "utf8"));

export const buildPrompt = (task, suffix) =>
  [task.job, "", suffix, ...Object.entries(task.fields).map(([name, hint]) => `${name}: <${hint}>`)].join("\n");

// The answer is lines of "FIELD: value"; a value runs until the next field line.
export function parseAnswer(text, fieldNames) {
  const out = {};
  let current = null;
  for (const raw of String(text ?? "").replace(/\r/g, "").split("\n")) {
    const m = /^[\s*`>-]*([A-Z][A-Z0-9_]+)[*`]*\s*:\s*(.*)$/.exec(raw);
    if (m && fieldNames.includes(m[1])) {
      current = m[1];
      out[current] = m[2].replace(/^[*\s]+/, "");
    } else if (current) out[current] += `\n${raw}`;
  }
  return out;
}

export function scoreAnswer(task, text) {
  const answer = parseAnswer(text, Object.keys(task.fields));
  const checks = task.checks.map((c) => ({ label: c.label, field: c.field, pass: new RegExp(c.pattern, "i").test(answer[c.field] ?? "") }));
  return { passed: checks.filter((c) => c.pass).length, of: checks.length, checks, answer };
}

const context = (u) => (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0);
const short = (p) => String(p ?? "").replace(/\\/g, "/").split("/").slice(-2).join("/");

// One run's stream-json lines, reduced to the numbers and the tool calls. Requests are counted for
// the model the session itself reports (its init event): `--model` may be an alias such as `opus`,
// which no message carries. `model` is used only when a stream has no init event.
export function summarizeStream(lines, model) {
  const s = { calls: 0, firstContext: 0, peakContext: 0, toolCalls: [], init: null, result: null };
  const seen = new Set();
  for (const line of lines) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "system" && e.subtype === "init") {
      s.init = { tools: e.tools ?? [], plugins: (e.plugins ?? []).map((p) => p.name), skills: (e.skills ?? []).length, mcp: (e.mcp_servers ?? []).map((m) => m.name), login: e.apiKeySource === "none" ? "plan" : "key", model: e.model, version: e.claude_code_version };
    } else if (e.type === "assistant" && e.message) {
      for (const b of e.message.content ?? []) {
        if (b.type === "tool_use") s.toolCalls.push(b.name === "Read" ? `Read ${short(b.input?.file_path)}` : b.name === "Skill" ? `Skill ${b.input?.skill}` : b.name);
      }
      if (seen.has(e.message.id) || ((s.init?.model ?? model) && e.message.model !== (s.init?.model ?? model)) || e.parent_tool_use_id) continue;
      seen.add(e.message.id);
      const c = context(e.message.usage);
      s.calls += 1;
      if (s.calls === 1) s.firstContext = c;
      s.peakContext = Math.max(s.peakContext, c);
    } else if (e.type === "result") {
      s.result = {
        subtype: e.subtype, isError: Boolean(e.is_error), text: e.result ?? "", turns: e.num_turns, durationMs: e.duration_ms, costUsd: e.total_cost_usd ?? 0,
        input: e.usage?.input_tokens ?? 0, cacheWrite: e.usage?.cache_creation_input_tokens ?? 0, cacheRead: e.usage?.cache_read_input_tokens ?? 0, output: e.usage?.output_tokens ?? 0,
        denials: (e.permission_denials ?? []).length, models: Object.keys(e.modelUsage ?? {}),
      };
    }
  }
  return s;
}

// A Read rule for an absolute folder: `//c/x` on Windows (C:\x), `//x` elsewhere (/x).
export const readRule = (absDir) => `Read(//${absDir.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase()).replace(/^\/+/, "")}/**)`;

// `--setting-sources project` does not keep the user's own CLAUDE.md out (probed on Claude Code
// 2.1.325: both files were loaded), so the run's settings exclude it by path. The side's file in
// `work/` is then the only rules file; the `probe` command proves it before a batch.
export const userRulesFile = () => join(homedir(), ".claude", "CLAUDE.md");
export const runSettings = () => {
  const p = userRulesFile();
  return { claudeMdExcludes: [p, p.replaceAll("\\", "/")] };
};

// Only Skill and one Read rule are allowed. Claude Code applies a Read rule to Grep and Glob too, so
// under `dontAsk` all three work inside the side folder and are refused outside it (proved with one
// run on Claude Code 2.1.325). A bare `Glob` or `Grep` here would let a run search every file the
// user can read, the user's own rules file included.
export function claudeArgs({ sideDir, emptyMcp, settings, model, cap }) {
  return [
    "-p", "--model", model, "--output-format", "stream-json", "--verbose",
    "--tools", ...TOOLS,
    "--permission-mode", "dontAsk", "--allowedTools", "Skill", readRule(resolve(sideDir)),
    "--strict-mcp-config", "--mcp-config", emptyMcp,
    "--setting-sources", "project", "--settings", settings,
    "--plugin-dir", join(sideDir, "plugin"),
    "--max-budget-usd", String(cap),
    "--no-session-persistence",
  ];
}

function runClaude(args, cwd, prompt) {
  return new Promise((done, fail) => {
    const child = spawn("claude", args, { cwd, env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1" }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", fail);
    child.on("close", (code) => done({ code, out, err }));
    child.stdin.end(prompt);
  });
}

const readSummaries = (outDir) => {
  const file = join(outDir, "summary.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
};

// The cap, the batch stop and the repeats, read strictly: a value that is no positive number
// would switch the stop off (a comparison with NaN is false), so it stops the command instead.
export function parseLimits(opts) {
  const num = (name) => {
    const v = opts[name] === undefined ? DEFAULTS[name] : Number(opts[name]);
    if (!Number.isFinite(v) || v <= 0) throw new Error(`--${name} must be a number above 0, got "${opts[name]}"`);
    return v;
  };
  const cap = num("cap"), limit = num("limit"), reps = num("reps");
  if (!Number.isInteger(reps)) throw new Error(`--reps must be a whole number, got "${opts.reps}"`);
  if (cap > limit) throw new Error(`--cap ${cap} is above --limit ${limit}`);
  if (![undefined, "yes", "no"].includes(opts.transcripts)) throw new Error(`--transcripts must be yes or no, got "${opts.transcripts}"`);
  return { cap, limit, reps, model: opts.model ?? DEFAULTS.model, transcripts: opts.transcripts === "yes" };
}

// Rows of another task set or model in the same folder: results compare within one set and one
// model only, so `run` and `report` stop on them. A row written before `model` was recorded has none.
export const foreignRows = (rows, set, model) => rows.filter((r) => r.set !== set || (r.model !== undefined && r.model !== model));
const refuseForeign = (rows, set, model, outDir) => {
  const other = foreignRows(rows, set, model);
  if (other.length) throw new Error(`${outDir} holds ${other.length} result(s) of another task set or model (${[...new Set(other.map((r) => `${r.set}, ${r.model ?? "model not recorded"}`))].join("; ")}): use a new --out folder`);
};

// Flags come in pairs; a flag without a value is an error, never a silent default.
export function parseFlags(rest) {
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!/^--[a-z]+$/.test(rest[i]) || rest[i + 1] === undefined || rest[i + 1].startsWith("--")) throw new Error(`"${rest[i]}" needs a value`);
    opts[rest[i].slice(2)] = rest[i + 1];
  }
  return opts;
}

async function run(opts) {
  const { cap, limit, reps, model, transcripts } = parseLimits(opts);
  const { suffix, tasks, set } = loadTasks();
  const sidesDir = resolve(opts.sides), outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });
  const emptyMcp = join(outDir, "empty-mcp.json");
  writeFileSync(emptyMcp, '{"mcpServers":{}}\n');
  const settings = join(outDir, "run-settings.json");
  writeFileSync(settings, `${JSON.stringify(runSettings())}\n`);
  const sides = opts.side ? [opts.side] : ["before", "after"];
  const chosen = opts.task ? tasks.filter((t) => t.id === opts.task) : tasks;
  if (!chosen.length) throw new Error(`no task ${opts.task}`);
  for (let rep = 1; rep <= reps; rep += 1) {
    for (const task of chosen) {
      for (const side of sides) {
        const done = readSummaries(outDir);
        refuseForeign(done, set, model, outDir);
        if (done.some((r) => r.task === task.id && r.side === side && r.rep === rep)) continue;
        const spent = done.reduce((a, r) => a + r.costUsd, 0);
        if (spent + cap > limit) { console.log(`STOPPED: ${spent.toFixed(2)} spent, the next run could pass the limit of ${limit}`); return; }
        const sideDir = join(sidesDir, side);
        const name = `${side}-${task.id}-r${rep}`;
        const started = Date.now();
        const res = await runClaude(claudeArgs({ sideDir, emptyMcp, settings, model, cap }), join(sideDir, "work"), buildPrompt(task, suffix));
        const wallMs = Date.now() - started;
        if (transcripts) {
          writeFileSync(join(outDir, `${name}.jsonl`), res.out);
          if (res.err.trim()) writeFileSync(join(outDir, `${name}.err`), res.err);
        }
        const s = summarizeStream(res.out.split("\n"), model);
        if (!s.result) { console.log(`${name}: NO RESULT (exit ${res.code})${transcripts ? `; see ${name}.err` : "; run it again with --transcripts yes to keep its output"}`); return; }
        if (!s.calls) { console.log(`${name}: a result but no request of the session's model (${s.init?.model ?? model}) was counted; stopped, nothing recorded`); return; }
        const score = scoreAnswer(task, s.result.text);
        const row = { set, model, task: task.id, group: task.group, side, rep, exit: res.code, wallMs, ...s.result, calls: s.calls, firstContext: s.firstContext, peakContext: s.peakContext, toolCalls: s.toolCalls, passed: score.passed, of: score.of, failed: score.checks.filter((c) => !c.pass).map((c) => c.label), login: s.init?.login, plugins: s.init?.plugins, tools: s.init?.tools, mcp: s.init?.mcp, version: s.init?.version };
        delete row.text;
        appendFileSync(join(outDir, "summary.jsonl"), `${JSON.stringify(row)}\n`);
        console.log(`${name}: ${score.passed}/${score.of} | in ${row.input + row.cacheWrite + row.cacheRead} out ${row.output} | turns ${row.turns} | ${(row.durationMs / 1000).toFixed(1)}s | USD ${row.costUsd.toFixed(3)} | ${row.toolCalls.join(", ") || "no tools"}${row.failed.length ? ` | missed: ${row.failed.join("; ")}` : ""}${row.denials ? ` | ${row.denials} denied` : ""}`);
      }
    }
  }
}

// One cheap run per side that names the rules files it was given. A side is clean when it names
// one file, the one in its own `work/` folder.
export const PROBE_PROMPT = "Use no tools. Look only at the instruction files given to you in this session. Answer with exactly two lines.\nFILES: <how many separate instruction files (CLAUDE.md) you were given, then the full path of each>\nFIRST_HEADING: <the first top-level heading of each, copied character for character>";

async function probe(opts) {
  const sidesDir = resolve(opts.sides), outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });
  const emptyMcp = join(outDir, "empty-mcp.json"), settings = join(outDir, "run-settings.json");
  writeFileSync(emptyMcp, '{"mcpServers":{}}\n');
  writeFileSync(settings, `${JSON.stringify(runSettings())}\n`);
  const { cap, model, transcripts } = parseLimits(opts);
  for (const side of ["before", "after"]) {
    const sideDir = join(sidesDir, side);
    const res = await runClaude(claudeArgs({ sideDir, emptyMcp, settings, model, cap }), join(sideDir, "work"), PROBE_PROMPT);
    if (transcripts) writeFileSync(join(outDir, `probe-${side}.jsonl`), res.out);
    const s = summarizeStream(res.out.split("\n"), model);
    console.log(`== ${side}: first request ${s.firstContext} tokens, USD ${(s.result?.costUsd ?? 0).toFixed(3)}, login ${s.init?.login}\n${s.result?.text ?? res.err}`);
  }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const totalIn = (r) => r.input + r.cacheWrite + r.cacheRead;

// Per task and side: the mean over the repeats, and the range of the total input.
export function aggregate(rows) {
  const out = [];
  for (const task of [...new Set(rows.map((r) => r.task))]) {
    for (const side of ["before", "after"]) {
      const rs = rows.filter((r) => r.task === task && r.side === side);
      if (!rs.length) continue;
      const ins = rs.map(totalIn);
      out.push({ task, group: rs[0].group, side, runs: rs.length, input: Math.round(mean(ins)), inputMin: Math.min(...ins), inputMax: Math.max(...ins), firstContext: Math.round(mean(rs.map((r) => r.firstContext))), peakContext: Math.round(mean(rs.map((r) => r.peakContext))), output: Math.round(mean(rs.map((r) => r.output))), turns: mean(rs.map((r) => r.turns)), seconds: mean(rs.map((r) => r.durationMs)) / 1000, costUsd: mean(rs.map((r) => r.costUsd)), passed: rs.reduce((a, r) => a + r.passed, 0), of: rs.reduce((a, r) => a + r.of, 0) });
    }
  }
  return out;
}

function report(opts) {
  const rows = readSummaries(resolve(opts.out));
  if (rows.length) refuseForeign(rows, rows[0].set, rows.find((r) => r.model !== undefined)?.model, resolve(opts.out));
  const agg = aggregate(rows);
  const lines = ["| Task | Side | Input tokens (range) | First request | Largest request | Output | Turns | Seconds | USD | Checks |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const a of agg) lines.push(`| ${a.task} | ${a.side} | ${a.input} (${a.inputMin} to ${a.inputMax}) | ${a.firstContext} | ${a.peakContext} | ${a.output} | ${a.turns.toFixed(1)} | ${a.seconds.toFixed(1)} | ${a.costUsd.toFixed(3)} | ${a.passed}/${a.of} |`);
  for (const side of ["before", "after"]) {
    const rs = rows.filter((r) => r.side === side);
    if (!rs.length) continue;
    lines.push(`| ALL (sum of ${rs.length} runs) | ${side} | ${rs.reduce((a, r) => a + totalIn(r), 0)} | | | ${rs.reduce((a, r) => a + r.output, 0)} | ${rs.reduce((a, r) => a + r.turns, 0)} | ${(rs.reduce((a, r) => a + r.durationMs, 0) / 1000).toFixed(0)} | ${rs.reduce((a, r) => a + r.costUsd, 0).toFixed(2)} | ${rs.reduce((a, r) => a + r.passed, 0)}/${rs.reduce((a, r) => a + r.of, 0)} |`);
  }
  const text = `${lines.join("\n")}\n`;
  writeFileSync(join(resolve(opts.out), "report.md"), text);
  writeFileSync(join(resolve(opts.out), "report.json"), `${JSON.stringify(agg, null, 2)}\n`);
  console.log(text);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const usage = "usage: measure.mjs probe --sides <dir> --out <dir> [--transcripts yes] | run --sides <dir> --out <dir> [--side before|after] [--task <id>] [--reps 2] [--cap 1] [--limit 30] [--model <id>] [--transcripts yes] | report --out <dir>";
  try {
    const opts = parseFlags(rest);
    if (cmd === "run" && opts.sides && opts.out) await run(opts);
    else if (cmd === "probe" && opts.sides && opts.out) await probe(opts);
    else if (cmd === "report" && opts.out) report(opts);
    else { console.error(usage); process.exit(2); }
  } catch (e) {
    console.error(`${e.message}\n${usage}`);
    process.exit(2);
  }
}
