#!/usr/bin/env node
// A Claude job in a Depot sandbox instead of on this laptop (recipes/sandboxes-claude.md;
// owner's yes, 27 November 2026: the plan token on Depot, Opus 5.5 high).
//
//   node sandbox-claude.mjs [--push <folder>] [--type small|default|large] [--timeout <seconds>]
//                           [--budget <usd>] [--tools <list>] (--prompt-file <file> | -- <prompt>)
//
// - It runs through sandbox-run.mjs --claude, so every limit, the upload checks and the stop
//   of the sandbox are that script's. The plan token (key `claude-depot`) goes with the job's
//   command only; this process never reads it.
// - In the sandbox: Claude Code at the version this laptop runs, then one locked-down
//   `claude -p` (recipes/scripted-runs.md): Opus 5.5 at high effort, the tools listed and no
//   others, no settings, no MCP server, no saved session, a spend cap at API list rates, and an
//   environment built from nothing but the token. A run whose `apiKeySource` is not `none`
//   (the plan login) is ended at its first event.
// - What comes back is data, never trusted: the run's event stream, its error output and,
//   for --push, the changes as one patch against the uploaded commit (commits made during
//   the run included). A run whose files hold
//   the token sends nothing back. Gitleaks reads the files here, and a finding ends with exit
//   4; the patch is applied only after it has been read, by `git apply`. The prompt goes on
//   stdin, so one that starts with "-" is still the prompt.
// - The files land in ~/.local/share/sandbox-run/claude/<run>/ with summary.json (model,
//   turns, usage and the cap's figure), and the last lines say where.
import { spawn, spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NOT_STARTED, STATE, scan } from "./sandbox-run.mjs";

export const MODEL = "claude-opus-5-5";
export const EFFORT = "high";
export const TOOLS = "Read,Edit,Write,Glob,Grep,Bash";
export const BUDGET_USD = 10;
export const TIMEOUT = 3600;
export const RUNS = join(STATE, "claude");
export const BEGIN = "===SANDBOX-CLAUDE:BEGIN===";
export const END = "===SANDBOX-CLAUDE:END===";
export const FILES = Object.freeze(["stream.jsonl", "changes.patch", "claude.err"]);
const SAY = "SANDBOX-CLAUDE";
// The exit code when the returned files did not pass the secret scan, whatever the job's own
// code: a caller that reads only the code must not take the patch as good.
export const SCAN_FAILED = 4;

export function parseArgs(argv) {
  const out = { push: null, type: "small", timeout: TIMEOUT, budget: BUDGET_USD, tools: TOOLS, promptFile: null, prompt: null };
  const cut = argv.indexOf("--");
  const own = cut < 0 ? argv : argv.slice(0, cut);
  if (cut >= 0) out.prompt = argv.slice(cut + 1).join(" ");
  for (let i = 0; i < own.length; i += 1) {
    const a = own[i];
    const v = i + 1 < own.length ? own[i + 1] : null;
    i += 1;
    if (v === null) return { error: `${String(a).slice(0, 40)} takes a value` };
    if (a === "--push") out.push = v;
    else if (a === "--type") out.type = v;
    else if (a === "--timeout") {
      if (!/^[1-9][0-9]{0,6}$/.test(v)) return { error: "--timeout takes whole seconds" };
      out.timeout = Number(v);
    } else if (a === "--budget") {
      if (!/^[0-9]{1,3}(\.[0-9]{1,2})?$/.test(v) || Number(v) <= 0) return { error: "--budget takes US dollars, above 0 and under 1000" };
      out.budget = Number(v);
    } else if (a === "--tools") {
      if (!/^[A-Za-z]+(,[A-Za-z]+)*$/.test(v)) return { error: "--tools takes built-in tool names, comma-separated" };
      out.tools = v;
    } else if (a === "--prompt-file") out.promptFile = v;
    else return { error: `${String(a).slice(0, 40)} is not an option of sandbox-claude` };
  }
  if (out.promptFile !== null && out.prompt !== null) return { error: "a prompt file or a prompt after --, not both" };
  if (out.promptFile === null && !out.prompt) return { error: "a prompt is required: --prompt-file <file> or -- <prompt>" };
  return out;
}

// The event filter in the sandbox: it keeps every line in the stream file, names each tool
// call on stderr and ends the run when its first event is not on the plan login.
export const FILTER = `const fs=require("fs");const out=fs.openSync(process.argv[1],"w");let buf="";
const say=(t)=>process.stderr.write("${SAY}: "+t+"\\n");
const line=(l)=>{fs.writeSync(out,l+"\\n");let m;try{m=JSON.parse(l)}catch{return}
if(m.type==="system"&&m.subtype==="init"){if(m.apiKeySource!=="none"){say("refused: the run is not on the plan token");process.exit(3)}say(m.model+" on the plan token, tools "+(m.tools||[]).join(","))}
else if(m.type==="assistant")for(const c of (m.message&&m.message.content)||[])if(c.type==="tool_use")say("tool "+c.name)};
process.stdin.on("data",(d)=>{buf+=d;let i;while((i=buf.indexOf("\\n"))>=0){line(buf.slice(0,i));buf=buf.slice(i+1)}});
process.stdin.on("end",()=>{if(buf)line(buf)});`;

// The script the job's command runs in the sandbox; everything it uses comes as an argument.
// A step that fails before Claude starts ends with 75, as sandbox-run's own steps do.
export const SCRIPT = [
  "set -u -o pipefail",
  'V="$1"; PROMPT="$2"; BUDGET="$3"; TOOLS="$4"; FILTER="$5"',
  // The token stays a shell variable: no step but `claude -p` gets it in its environment.
  "export -n CLAUDE_CODE_OAUTH_TOKEN",
  'O=$(mktemp -d /tmp/sandbox-claude.XXXXXX)',
  // The uploaded commit: the patch is taken against it, so commits made during the run count.
  'BASE=$(git rev-parse --verify -q "HEAD^{commit}" 2>/dev/null || true)',
  `npm install -g --prefix "$HOME/.claude-code" --no-fund --no-audit --loglevel=error "@anthropic-ai/claude-code@$V" >"$O/install.log" 2>&1 || { echo "${SAY}: not started: Claude Code $V could not be installed" >&2; tail -5 "$O/install.log" >&2; exit ${NOT_STARTED}; }`,
  `printf '%s' "$PROMPT" | env -i HOME="$HOME" PATH="$HOME/.claude-code/bin:$PATH" USER="\${USER:-runner}" TERM=dumb LANG=C.UTF-8 CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1 DISABLE_AUTOUPDATER=1 claude -p --model ${MODEL} --effort ${EFFORT} --permission-mode dontAsk --tools "$TOOLS" --allowedTools "$TOOLS" --max-budget-usd "$BUDGET" --no-session-persistence --setting-sources "" --strict-mcp-config --output-format stream-json --verbose 2>"$O/claude.err" | node -e "$FILTER" "$O/stream.jsonl"`,
  "code=$?",
  ': >"$O/changes.patch"',
  'if [ -n "$BASE" ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then git add --all >/dev/null 2>&1 && git diff --cached --binary "$BASE" >"$O/changes.patch"; fi',
  `if grep -rqF -- "$CLAUDE_CODE_OAUTH_TOKEN" "$O"; then echo "${SAY}: the run's files hold the token: nothing is sent back" >&2; exit 3; fi`,
  `echo "${BEGIN}"`,
  `tar -czf - -C "$O" ${FILES.join(" ")} | base64 -w0`,
  "echo",
  `echo "${END}"`,
  "exit $code",
].join("\n");

// The arguments of sandbox-run.mjs for a job.
export function runArgs(job, version, prompt) {
  return [
    "--type", job.type, "--timeout", String(job.timeout), "--claude",
    ...(job.push !== null ? ["--push", job.push] : []),
    "--", "bash", "-c", SCRIPT, "sandbox-claude", version, prompt, String(job.budget), job.tools, FILTER,
  ];
}

// Claude Code's version on this laptop: the sandbox runs the same one.
export function localVersion(text) {
  const m = /^(\d+\.\d+\.\d+)\b/.exec(String(text).trim());
  return m ? m[1] : null;
}

// The output of the job's command: the text around the files, and the files' base64 (or null).
export function splitOutput(text) {
  const b = text.indexOf(`${BEGIN}\n`);
  if (b < 0) return { text, files: null };
  const e = text.indexOf(`\n${END}`, b);
  if (e < 0) return { text: text.slice(0, b), files: null };
  return { text: text.slice(0, b) + text.slice(e + END.length + 2), files: text.slice(b + BEGIN.length + 1, e).trim() };
}

// The run's figures from its event stream: model, plan login, turns, cost at list rates, result.
// The login is kept only as yes or no (`apiKeySource` is "none" on the plan login): the field
// names where a key came from, and a name of a key source is not written out.
export function summarize(jsonl) {
  const s = { model: null, planLogin: null, tools: [], turns: null, costUsd: null, usage: null, durationMs: null, isError: null, result: null };
  for (const line of String(jsonl).split("\n")) {
    let m;
    try {
      m = JSON.parse(line);
    } catch {
      continue;
    }
    if (m?.type === "system" && m.subtype === "init") Object.assign(s, { model: m.model ?? null, planLogin: m.apiKeySource === undefined ? null : m.apiKeySource === "none", tools: m.tools ?? [] });
    if (m?.type === "result") Object.assign(s, { turns: m.num_turns ?? null, costUsd: m.total_cost_usd ?? null, usage: m.usage ?? null, durationMs: m.duration_ms ?? null, isError: m.is_error ?? null, result: typeof m.result === "string" ? m.result : null });
  }
  return s;
}

// Unpacks the files that came back, only under their three names, into dir; null when done,
// else why not.
export function unpack(base64, dir) {
  const tmp = mkdtempSync(join(tmpdir(), "sandbox-claude-"));
  try {
    const tgz = join(tmp, "files.tgz");
    writeFileSync(tgz, Buffer.from(base64, "base64"));
    const list = spawnSync("tar", ["-tzf", tgz], { encoding: "utf8" });
    if (list.status !== 0) return "the files could not be read";
    const names = list.stdout.split("\n").filter(Boolean);
    if (names.length !== FILES.length || new Set(names).size !== names.length || names.some((n) => !FILES.includes(n))) return "the files were not the three expected";
    // Only regular files: a link made in the sandbox must not point at a file on this laptop.
    const kinds = spawnSync("tar", ["-tvzf", tgz], { encoding: "utf8" });
    if (kinds.status !== 0) return "the files could not be read";
    const lines = kinds.stdout.split("\n").filter(Boolean);
    if (lines.length !== FILES.length || lines.some((l) => !l.startsWith("-"))) return "the files were not three regular files";
    const out = join(tmp, "out");
    mkdirSync(out);
    const x = spawnSync("tar", ["-xzf", tgz, "-C", out, "--no-same-owner", "--no-same-permissions", ...FILES], { encoding: "utf8" });
    if (x.status !== 0) return "the files could not be unpacked";
    for (const f of FILES) {
      let st;
      try {
        st = lstatSync(join(out, f));
      } catch {
        return "the files could not be unpacked";
      }
      if (!st.isFile() || st.nlink !== 1) return "the files were not three regular files";
    }
    for (const f of FILES) copyFileSync(join(out, f), join(dir, f), constants.COPYFILE_EXCL);
    return null;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main(argv) {
  const job = parseArgs(argv);
  if (job.error) {
    console.error(`${SAY}: not started: ${job.error}`);
    return NOT_STARTED;
  }
  const prompt = job.promptFile !== null ? readFileSync(job.promptFile, "utf8") : job.prompt;
  const version = localVersion(spawnSync("claude", ["--version"], { encoding: "utf8" }).stdout ?? "");
  if (!version) {
    console.error(`${SAY}: not started: Claude Code's version on this laptop could not be read`);
    return NOT_STARTED;
  }
  const dir = join(RUNS, new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  const runner = join(fileURLToPath(new URL(".", import.meta.url)), "sandbox-run.mjs");
  const chunks = [];
  const code = await new Promise((done) => {
    const child = spawn(process.execPath, [runner, ...runArgs(job, version, prompt)], { stdio: ["ignore", "pipe", "inherit"] });
    child.stdout.on("data", (d) => chunks.push(d));
    child.on("close", (c, signal) => done(c ?? (signal ? 130 : 1)));
  });
  const { text, files } = splitOutput(Buffer.concat(chunks).toString("utf8"));
  if (text.trim()) process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  if (files === null) {
    console.error(`${SAY}: no files came back (exit ${code})`);
    return code;
  }
  const bad = unpack(files, dir);
  if (bad) {
    console.error(`${SAY}: ${bad}; nothing kept`);
    return code || 1;
  }
  const summary = { ...summarize(readFileSync(join(dir, "stream.jsonl"), "utf8")), exit: code, version, effort: EFFORT, budgetUsd: job.budget, push: job.push ? resolve(job.push) : null };
  writeFileSync(join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const tmp = mkdtempSync(join(tmpdir(), "sandbox-claude-scan-"));
  const scanned = scan(dir, tmp);
  rmSync(tmp, { recursive: true, force: true });
  if (summary.result) process.stdout.write(`${summary.result}\n`);
  const patch = join(dir, "changes.patch");
  const changed = existsSync(patch) && readFileSync(patch, "utf8").trim() !== "";
  console.error(`${SAY}: ${summary.model ?? "no model"} (${EFFORT}), ${summary.planLogin === true ? "on the plan login" : summary.planLogin === false ? "NOT on the plan login" : "login unknown"}, ${summary.turns ?? "?"} turns, USD ${summary.costUsd ?? "?"} at API list rates (on the plan)`);
  if (!scanned.ok) {
    console.error(`${SAY}: the secret scan of the returned files: ${scanned.reason}. Do not apply the patch; a finding goes to the owner (files in ${dir})`);
    return SCAN_FAILED;
  }
  console.error(`${SAY}: files in ${dir}${changed ? `; changes: read ${patch}, then git apply it` : "; no changes"}`);
  return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
