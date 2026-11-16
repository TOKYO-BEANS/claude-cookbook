// Measures what each MCP server costs a session start on this PC: the input tokens of the first
// request of a headless session with the user's own settings, plugins and servers, in "arms":
//   all                      every server on (the ordinary session)
//   none                     every server in servers.json denied
//   without:<server>         one server denied (`deniedMcpServers`, added to the user's own list)
//   plugin-off:<plugin@src>  one plugin disabled: its server, skills and agents all leave
//   defer:<server>           one user-scope server with `"alwaysLoad": false`: it stays connected, and
//                            the tools its author marked to load in full wait behind tool search.
//                            Only an entry recorded in servers.json by its fingerprint
//                            (`servers.mjs fingerprint --server <name>`) is ever copied for this.
// A server's cost is mean(all) - mean(without:<server>), with the range the repeats allow.
//   node scripts/measure/servers.mjs run --out <dir> --arm <arm> [--reps 3] [--cap 1] [--limit 15] [--model <id>]
//   node scripts/measure/servers.mjs report --out <dir>
// A server reaches a new session a moment after it starts, and a prompt sent at once is answered
// without the servers still connecting: that is why two plain runs differ by thousands of tokens.
// Each run therefore holds its prompt back until the session's debug log shows every expected
// server connected or failed, and records which did. The debug log lives in a temporary folder
// that is deleted after the run; --out keeps numbers and tool, server and plugin names only.
// The run loads the user's own settings (they are what is measured), and with them the user's
// allow rules, which `dontAsk` would honour. So every arm's settings add a PreToolUse hook that
// refuses every tool call: a hook is not part of the model's context, so the measurement is
// the same. A run in which the model tried a tool anyway is not counted. The run is on the
// Claude plan login, with a spend cap per run and a stop for the batch. Rules:
// recipes/scripted-runs.md and scripted-runs-rules.md.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeStream } from "./measure.mjs";

export const DEFAULTS = Object.freeze({ model: "claude-opus-5-5", cap: 1, limit: 15, reps: 3 });
export const PROMPT = "Reply with the single word OK.";
const CONNECT_SECONDS = 100;
const GRACE_MS = 4000; // a server lists its tools a moment after it connects
const RUN_SECONDS = 240;
const KILL_GRACE_MS = 5000; // then SIGKILL, where a signal can be ignored

export const loadServers = (file = fileURLToPath(new URL("./servers.json", import.meta.url))) => JSON.parse(readFileSync(file, "utf8"));

// The servers a plugin brings are named `plugin:<plugin>:<server>`.
export const serversOfPlugin = (plugin, servers) => servers.filter((s) => s.startsWith(`plugin:${plugin.split("@")[0]}:`));

// An arm's name, read strictly: an unknown server or plugin stops the command before a paid run.
export function parseArm(arm, { servers, plugins, deferrable = {} }) {
  const base = { arm, denied: [], pluginOff: null, defer: null };
  if (arm === "all") return base;
  if (arm === "none") return { ...base, denied: [...servers] };
  const [kind, ...rest] = String(arm).split(":");
  const name = rest.join(":");
  if (kind === "without" && servers.includes(name)) return { ...base, denied: [name] };
  if (kind === "plugin-off" && plugins.includes(name)) return { ...base, pluginOff: name };
  if (kind === "defer" && Object.hasOwn(deferrable, name)) return { ...base, defer: name };
  throw new Error(`unknown arm: ${arm}`);
}

// A `defer` arm passes the user's own entry for the server again with `"alwaysLoad": false`
// (Claude Code 2.1.287 or later). The entry goes into a temporary file, and no check of its
// text can prove that it holds no key, so only an entry a person has read and recorded is
// copied: its fingerprint must be the one in servers.json. On top of that it must be a remote
// server with these fields and no others, on an https URL with a plain DNS host name, no user
// part, no query and no long path segment, and its headers helper must be a command that
// fetches the headers, not one that carries them. Anything else is refused, whatever it holds.
const DEFER_FIELDS = new Set(["type", "url", "headersHelper", "timeout", "alwaysLoad"]);
const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;
export function plainUrl(text) {
  let u;
  try { u = new URL(String(text)); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.port) return false;
  const labels = u.hostname.split(".");
  if (labels.length < 2 || !labels.every((l) => DNS_LABEL.test(l)) || !/[a-z]/.test(labels.at(-1))) return false;
  return u.pathname.split("/").every((seg) => seg.length <= 12 && /^[A-Za-z0-9._~-]*$/.test(seg));
}
// A headers helper prints the headers when it runs. One whose own text carries a header or a
// key (an inline `echo "Authorization: Bearer ..."`) is refused.
export const plainHelper = (text) => text === undefined || (typeof text === "string" && !/bearer|authorization|echo|printf|write-(output|host)|secret|password|(api[-_]?key|token)\s*[:=]/i.test(text));
// The fingerprint of an entry: SHA-256 over its fields in a fixed order, `alwaysLoad` left out.
export function entryFingerprint(entry) {
  const fields = Object.keys(entry).filter((k) => k !== "alwaysLoad").sort().map((k) => [k, entry[k]]);
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}
export function deferConfig(name, userConfig, deferrable = {}) {
  const entry = userConfig?.mcpServers?.[name];
  if (!entry) throw new Error(`no user-scope server named ${name}`);
  const extra = Object.keys(entry).filter((k) => !DEFER_FIELDS.has(k));
  if (extra.length) throw new Error(`${name}: its entry has ${extra.join(", ")}, so it is not copied`);
  if (!["http", "sse", "ws"].includes(entry.type) || !plainUrl(entry.url)) throw new Error(`${name}: its URL could hold a key, so it is not copied`);
  if (!plainHelper(entry.headersHelper)) throw new Error(`${name}: its headers helper could hold a key, so it is not copied`);
  if (!Object.hasOwn(deferrable, name) || entryFingerprint(entry) !== deferrable[name]) throw new Error(`${name}: its entry is not the one recorded in servers.json, so it is not copied`);
  return { mcpServers: { [name]: { ...entry, alwaysLoad: false } } };
}

// Settings lists merge, so `deniedMcpServers` here adds to the user's own deny list.
// A hook that ends with exit code 2 blocks the call it was asked about, whatever rule allows
// it. It is started by its full path: a hook may run with a short PATH.
export const blockCommand = (node = process.execPath) => `"${node.replaceAll("\\", "/")}" -e "process.exit(2)"`;
export function armSettings({ denied, pluginOff }, node = process.execPath) {
  const s = { hooks: { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: blockCommand(node) }] }] } };
  if (denied.length) s.deniedMcpServers = denied.map((serverName) => ({ serverName }));
  if (pluginOff) s.enabledPlugins = { [pluginOff]: false };
  return s;
}

export const expectedServers = ({ denied, pluginOff }, servers) => {
  const gone = new Set([...denied, ...(pluginOff ? serversOfPlugin(pluginOff, servers) : [])]);
  return servers.filter((s) => !gone.has(s));
};

// What the debug log says of each server: "connected", "failed" or nothing yet.
export function serverStates(debugText, names) {
  const text = String(debugText);
  const state = {};
  for (const n of names) {
    if (text.includes(`MCP server "${n}": Successfully connected`)) state[n] = "connected";
    else if (text.includes(`MCP server "${n}": Connection failed`)) state[n] = "failed";
  }
  return state;
}
export const settled = (debugText, expected) => Object.keys(serverStates(debugText, expected)).length === expected.length;

export function claudeArgs({ settings, model, cap, debug, mcpConfig }) {
  return [
    ...(mcpConfig ? ["--mcp-config", mcpConfig] : []),
    "-p", "--model", model, "--permission-mode", "dontAsk", "--settings", settings,
    "--max-budget-usd", String(cap), "--no-session-persistence",
    "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--debug-file", debug,
  ];
}

// The tools of the first request, counted per MCP server from the session's init event.
export function toolsByServer(tools, servers) {
  const ids = servers.map((s) => [s, `mcp__${s.replace(/[^A-Za-z0-9_-]/g, "_")}__`]);
  const count = { builtIn: 0, otherMcp: 0 };
  for (const t of tools) {
    if (!t.startsWith("mcp__")) { count.builtIn += 1; continue; }
    const hit = ids.find(([, prefix]) => t.startsWith(prefix));
    if (hit) count[hit[0]] = (count[hit[0]] ?? 0) + 1;
    else count.otherMcp += 1;
  }
  return count;
}

// One run as a row of numbers and names. `problem` names why a row is not to be counted.
export function buildRow({ arm, rep, model, cap, expected, states, all, waitMs, exit, stopped, summary: s }) {
  const r = s.result;
  const unexpected = all.filter((n) => !expected.includes(n) && states.other?.[n] === "connected");
  const missing = expected.filter((n) => states.expected[n] !== "connected");
  const problem = stopped ? stopped
    : !r ? "no result"
    : r.isError || r.subtype !== "success" ? `ended as ${r.subtype}`
    : !s.firstContext ? "no request counted"
    : s.toolCalls.length ? `the model tried a tool: ${[...new Set(s.toolCalls.map((t) => t.split(" ")[0]))].join(", ")}`
    : missing.length ? `not connected: ${missing.join(", ")}`
    : unexpected.length ? `connected though left out: ${unexpected.join(", ")}`
    : null;
  return {
    arm, rep, requested: model, model: s.init?.model ?? model, version: s.init?.version ?? null, planLogin: s.init?.login === "plan",
    firstContext: s.firstContext, requests: s.calls, waitMs, exit,
    costUsd: r && r.costReported ? r.costUsd : cap, costReported: Boolean(r?.costReported),
    toolCalls: s.toolCalls.length, tools: s.init ? toolsByServer(s.init.tools, all) : null, plugins: s.init?.plugins ?? null, skills: s.init?.skills ?? null,
    connected: expected.filter((n) => states.expected[n] === "connected"), problem,
  };
}

// A folder holds the runs of one requested model. The model a session reports can be another
// name for it (`opus` against its full id), so the comparison is on what was asked for; a row
// from before that field existed has only the reported one.
export const otherModel = (rows, model) => rows.some((r) => (r.requested ?? r.model) && (r.requested ?? r.model) !== model);

export const spentSoFar = (rows) => rows.reduce((a, r) => a + (r.costUsd ?? 0), 0);

export function parseLimits(opts) {
  const out = {};
  for (const k of ["cap", "limit", "reps"]) {
    const v = opts[k] === undefined ? DEFAULTS[k] : Number(opts[k]);
    if (!Number.isFinite(v) || v <= 0 || (k === "reps" && !Number.isInteger(v))) throw new Error(`--${k} must be a positive number`);
    out[k] = v;
  }
  return out;
}

export function parseFlags(rest) {
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith("--") || rest[i + 1] === undefined || rest[i + 1].startsWith("--")) throw new Error(`a flag needs a value: ${rest[i]}`);
    opts[rest[i].slice(2)] = rest[i + 1];
  }
  return opts;
}

const stats = (xs) => ({ n: xs.length, mean: xs.reduce((a, b) => a + b, 0) / xs.length, min: Math.min(...xs), max: Math.max(...xs) });

// Per arm: the first request's size over the rows that count. Per arm other than `all`: what
// leaving it out saves, as a difference of means, with the lowest and highest the repeats allow.
export function aggregate(rows) {
  const good = rows.filter((r) => !r.problem);
  const arms = new Map();
  for (const r of good) arms.set(r.arm, [...(arms.get(r.arm) ?? []), r.firstContext]);
  const all = arms.has("all") ? stats(arms.get("all")) : null;
  return [...arms].map(([arm, xs]) => {
    const s = stats(xs);
    const saving = all && arm !== "all" ? { mean: all.mean - s.mean, low: all.min - s.max, high: all.max - s.min } : null;
    return { arm, ...s, saving };
  });
}

const readRows = (outDir) => {
  const file = join(outDir, "summary.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
};

function session(argv, cwd, debugFile, expected) {
  return new Promise((done) => {
    const child = spawn("claude", argv, { cwd, env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let out = "", stopped = null, sent = false, settledAt = 0;
    const started = Date.now();
    let waitMs = 0;
    const readDebug = () => { try { return readFileSync(debugFile, "utf8"); } catch { return ""; } };
    let tick = null, hard = null;
    // Runs once: it ends the watch, so a limit that was reached is not acted on again.
    const kill = (why) => {
      if (stopped) return;
      stopped = why;
      clearInterval(tick);
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }).on("error", () => child.kill());
      else { child.kill(); hard = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS); }
    };
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {});
    tick = setInterval(() => {
      const now = Date.now();
      if (now - started > RUN_SECONDS * 1000) return kill("the time limit");
      if (sent) return;
      if (!settledAt && settled(readDebug(), expected)) settledAt = now;
      if (settledAt && now - settledAt >= GRACE_MS) {
        sent = true;
        waitMs = now - started;
        child.stdin.end(`${JSON.stringify({ type: "user", message: { role: "user", content: PROMPT } })}\n`);
      } else if (!settledAt && now - started > CONNECT_SECONDS * 1000) kill(`not every server settled in ${CONNECT_SECONDS} seconds`);
    }, 250);
    const end = (exit) => { clearInterval(tick); clearTimeout(hard); done({ exit, out, stopped, waitMs, debugText: readDebug() }); };
    child.on("error", () => end(null));
    child.on("close", end);
  });
}

const userConfig = () => JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf8"));

// A run's temporary folder and its files, for this user only: the modes count where the
// system has them, and on Windows the folder is in the user's own temporary folder. The debug
// log exists before the session starts, so the session adds to a file that is already private.
export function makeTemp(root = tmpdir()) {
  const temp = mkdtempSync(join(root, "measure-servers-"));
  chmodSync(temp, 0o700);
  const paths = { temp, work: join(temp, "work"), settings: join(temp, "settings.json"), debug: join(temp, "debug.log"), mcp: join(temp, "mcp.json") };
  mkdirSync(paths.work, { mode: 0o700 });
  writeFileSync(paths.debug, "", { mode: 0o600 });
  return paths;
}
const writePrivate = (file, text) => writeFileSync(file, text, { mode: 0o600 });

// Deletes the folder, trying again while a file in it is still held. When that fails the files
// are emptied, so nothing of the run stays readable, and the line that comes back names the
// folder, not its path. Nothing comes back when the folder is gone.
export function removeTemp(paths, rm = rmSync) {
  try { rm(paths.temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); return null; } catch { /* emptied below */ }
  let emptied = true;
  for (const file of [paths.debug, paths.settings, paths.mcp]) {
    try { if (existsSync(file)) writeFileSync(file, ""); } catch { emptied = false; }
  }
  return `the run's temporary folder ${basename(paths.temp)} (in the system's temporary folder) could not be deleted; ${emptied ? "its files were emptied" : "its files could NOT be emptied: delete it by hand, it holds the session's debug log"}`;
}

// One session in a temporary folder that is deleted whatever happens: it holds the arm's
// settings, the session's debug log and, for a `defer` arm, the copied entry.
async function oneRun({ arm, catalog, expected, model, cap, rep }) {
  const paths = makeTemp();
  try {
    writePrivate(paths.settings, JSON.stringify(armSettings(arm)));
    if (arm.defer) writePrivate(paths.mcp, JSON.stringify(deferConfig(arm.defer, userConfig(), catalog.deferrable)));
    const r = await session(claudeArgs({ settings: paths.settings, model, cap, debug: paths.debug, mcpConfig: arm.defer ? paths.mcp : null }), paths.work, paths.debug, expected);
    const others = catalog.servers.filter((n) => !expected.includes(n));
    return buildRow({
      arm: arm.arm, rep, model, cap, expected, all: catalog.servers, waitMs: r.waitMs, exit: r.exit, stopped: r.stopped,
      states: { expected: serverStates(r.debugText, expected), other: serverStates(r.debugText, others) },
      summary: summarizeStream(r.out.split("\n"), model),
    });
  } finally {
    const left = removeTemp(paths);
    if (left) { console.log(left); process.exitCode = 3; }
  }
}

async function run(opts) {
  if (!opts.out || !opts.arm) throw new Error("run needs --out and --arm");
  const { cap, limit, reps } = parseLimits(opts);
  const model = opts.model ?? DEFAULTS.model;
  const catalog = loadServers();
  const arm = parseArm(opts.arm, catalog);
  const expected = expectedServers(arm, catalog.servers);
  mkdirSync(opts.out, { recursive: true });
  const rows = readRows(opts.out);
  if (otherModel(rows, model)) throw new Error("this folder holds runs of another model");
  let spent = spentSoFar(rows);
  const have = rows.filter((r) => r.arm === arm.arm && !r.problem).length;
  for (let rep = have + 1; rep <= reps; rep += 1) {
    if (spent + cap > limit) { console.log(`stopped: USD ${spent.toFixed(2)} spent, one more run could pass the limit of ${limit}`); process.exitCode = 3; return; }
    const row = await oneRun({ arm, catalog, expected, model, cap, rep });
    appendFileSync(join(opts.out, "summary.jsonl"), `${JSON.stringify(row)}\n`);
    spent += row.costUsd;
    console.log(`${row.arm} #${rep}: first request ${row.firstContext} tokens, waited ${Math.round(row.waitMs / 1000)} s, USD ${row.costUsd.toFixed(3)}${row.costReported ? "" : " (the cap: no cost reported)"}, ${row.planLogin ? "plan login" : "NOT the plan login"}${row.problem ? `, NOT COUNTED: ${row.problem}` : ""}`);
    if (row.problem || !row.planLogin) { process.exitCode ||= 1; return; }
    if (process.exitCode) return; // a temporary folder that could not be deleted stops the batch
  }
}

const n0 = (x) => Math.round(x).toLocaleString("en-US");

export function reportText(rows) {
  const out = ["| Arm | Runs | First request, mean (lowest to highest) | Saved by leaving it out, mean (range) |", "| --- | --- | --- | --- |"];
  for (const a of aggregate(rows)) out.push(`| ${a.arm} | ${a.n} | ${n0(a.mean)} (${n0(a.min)} to ${n0(a.max)}) | ${a.saving ? `${n0(a.saving.mean)} (${n0(a.saving.low)} to ${n0(a.saving.high)})` : ""} |`);
  const bad = rows.filter((r) => r.problem);
  if (bad.length) out.push("", ...bad.map((r) => `Not counted: ${r.arm} #${r.rep}: ${r.problem}`));
  out.push("", `Spend at list prices: USD ${spentSoFar(rows).toFixed(2)} over ${rows.length} runs.`);
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const usage = "usage: servers.mjs run --out <dir> --arm all|none|without:<server>|plugin-off:<plugin@source>|defer:<server> [--reps 3] [--cap 1] [--limit 15] [--model <id>] | report --out <dir> | fingerprint --server <name>";
  try {
    const [cmd, ...rest] = process.argv.slice(2);
    const opts = parseFlags(rest);
    if (cmd === "run") await run(opts);
    else if (cmd === "fingerprint" && opts.server) {
      const entry = userConfig().mcpServers?.[opts.server];
      if (!entry) throw new Error(`no user-scope server named ${opts.server}`);
      console.log(entryFingerprint(entry));
    }
    else if (cmd === "report" && opts.out) { const text = reportText(readRows(opts.out)); writeFileSync(join(opts.out, "report.md"), `${text}\n`); console.log(text); }
    else { console.error(usage); process.exit(2); }
  } catch (e) {
    console.error(`${e.message}\n${usage}`);
    process.exit(2);
  }
}
