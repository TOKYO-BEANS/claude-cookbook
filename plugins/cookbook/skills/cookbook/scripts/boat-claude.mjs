#!/usr/bin/env node
// A long Claude job in a boat sandbox, on the owner's Claude subscription through boat's AI
// credentials proxy (recipes/boat-claude.md). The script decides, not a model: the caps
// below are numbers, and a job past them is the owner's to allow.
//
//   node boat-claude.mjs --model <id> --timeout <seconds> --task <file.md>
//                        [--requests <n>] [--effort <level>] [--type small|default|large]
//                        [--push <folder>]
//
// - The sandbox starts in the boat environment "claude-proxy", or the default environment
//   when there is none of that name. Either must inject nothing of the account (no GitHub
//   token, no boat credentials, no secrets) except the Claude sign-in as a proxy
//   placeholder: "safe for third parties" and "proxy AI credentials" on, checked before
//   every run. --no-env carries no sign-in at all.
// - Everything boat-run.mjs checks holds here too, from the same code: the plan, its time and
//   starts, the runs under way, the upload list, data-shaped files and Gitleaks on the copy.
// - The proxy bills the boat wallet per request. A run stops at its request cap (default
//   CLAUDE.requests, at most CLAUDE.maxRequests) and at its timeout: boat refuses the
//   sandbox's placeholders, the agent is interrupted and the sandbox deleted. No run starts
//   past CLAUDE.dayRequests for the day, below the wallet floor, or beside CLAUDE.active
//   other Claude runs from this PC.
// - The task goes in as /home/user/TASK.md. The report comes back from /home/user/RESULT.md,
//   and with --push the changes come back as a patch, never applied here. Both land in a
//   folder under ~/.local/share/boat-run/claude/, are scanned by Gitleaks, and are data.
// - "BOAT-CLAUDE: not started: <why>" and exit 75: nothing ran. Exit 0: the agent finished
//   and wrote its report. Exit 1: it ran and did not finish cleanly; the line says why.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITS, NOT_STARTED, RATE, STATE, UPLOAD_LIST, boatCommand, call, dataFiles, gate, listEntry, readLimits, removeSandbox, repoKey, scan, stage, takeSlot, unnamed } from "./boat-run.mjs";

// The owner's yes of 17 November 2026 ("Keep on, build it"), sized so the wallet (USD 29
// that day, USD 1 a day while the proxy is on and USD 1 per 1,000 requests) cannot be
// drained by a runaway prompt.
export const CLAUDE = {
  models: ["claude-fable-5-2", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  efforts: ["low", "medium", "high", "xhigh", "max"],
  active: 3, // Claude runs from this PC at once
  requests: 200, // a run's request cap when none is given
  maxRequests: 500, // the most one run may ask for
  dayRequests: 2000, // proxied requests a day, all sandboxes together
  walletFloor: 5, // dollars the wallet keeps after this run's cap
  setupSeconds: 600, // sandbox time beyond the agent's timeout: start, upload, fetch, delete
  pollSeconds: 20, // how often the request count is read during a run
};
export const DOLLARS_PER_REQUEST = 0.001;
// boat's own id where it differs from the Claude id (its list, 17 November 2026: it refused
// "claude-opus-5-5" and names Opus "opus-5-5").
export const BOAT_MODEL = { "claude-opus-5-5": "opus-5-5" };
export const ENVIRONMENT = "claude-proxy";
export const TASK_BYTES = 60000;

const oneLine = (text) => String(text).replace(/[^\x20-\x7e]+/g, " ").trim().slice(0, 300);
const whole = (v, lo, hi) => (/^[1-9][0-9]{0,6}$/.test(v ?? "") && Number(v) >= lo && Number(v) <= hi ? Number(v) : null);

export function parseArgs(argv) {
  const out = { model: null, effort: null, type: "small", timeout: null, task: null, push: null, requests: CLAUDE.requests };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const v = i + 1 < argv.length ? argv[(i += 1)] : null;
    if (a === "--model") {
      if (!CLAUDE.models.includes(v)) return { error: `--model is one of ${CLAUDE.models.join(", ")}: a full id, never an alias (boat's "haiku" was an old model)` };
      out.model = v;
    } else if (a === "--effort") {
      if (!CLAUDE.efforts.includes(v)) return { error: `--effort is one of ${CLAUDE.efforts.join(", ")}` };
      out.effort = v;
    } else if (a === "--type") {
      if (!Object.hasOwn(RATE, v ?? "")) return { error: "--type is small, default or large" };
      out.type = v;
    } else if (a === "--timeout") {
      out.timeout = whole(v, 1, 9999999);
      if (out.timeout === null) return { error: "--timeout takes whole seconds, 1 or more" };
    } else if (a === "--requests") {
      out.requests = whole(v, 1, CLAUDE.maxRequests);
      if (out.requests === null) return { error: `--requests is a whole number from 1 to ${CLAUDE.maxRequests}; more needs the owner's yes` };
    } else if (a === "--task") {
      if (!v) return { error: "--task takes a file" };
      out.task = v;
    } else if (a === "--push") {
      if (!v) return { error: "--push takes a folder" };
      out.push = v;
    } else return { error: `${oneLine(a)} is not an option of boat-claude` };
  }
  if (!out.model) return { error: "--model <id> is required" };
  if (out.timeout === null) return { error: "--timeout <seconds> is required" };
  if (!out.task) return { error: "--task <file> is required: the job, written out" };
  return out;
}

// The plan's time this run may take: the agent's timeout and the sandbox's own setup.
export const sandboxRun = (run) => ({ type: run.type, timeout: run.timeout + CLAUDE.setupSeconds });

// null when the agent's timeout fits one run's share of the plan with the setup beside it;
// else why not, naming the most --timeout this size takes here (boat-run's own message
// would name the sandbox's limit, which counts the setup too).
export function longest(run) {
  const most = Math.floor(LIMITS.runSeconds / RATE[run.type]) - CLAUDE.setupSeconds;
  return run.timeout > most ? `one run takes at most ${LIMITS.runSeconds} seconds of the plan's time with ${CLAUDE.setupSeconds} of setup (${run.type}: a --timeout of ${most} at most); more needs the owner's yes` : null;
}

// The environment a run starts in, { name } or { error }: "claude-proxy" when it exists,
// else the default one, and only when it passes nothing of the account but the proxied
// sign-in. `list` is `boat env list --json`.
export function pickEnvironment(list) {
  const envs = list?.environments;
  if (!Array.isArray(envs)) return { error: "no result (the environments could not be read from boat env list)" };
  const e = envs.find((x) => x?.name === ENVIRONMENT) ?? envs.find((x) => x?.isDefault === true);
  if (!e || typeof e.name !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(e.name)) return { error: `boat has no environment "${ENVIRONMENT}" and no default one that can be named: the owner makes one on boat's dashboard (safe for third parties on, proxy AI credentials on)` };
  if (e.safeForThirdParties !== true) return { error: `the environment "${e.name}" is not "safe for third parties", so the account's GitHub token, boat credentials or secrets could go in: the owner turns it on, or makes "${ENVIRONMENT}" with it on` };
  if (e.proxyAiCredentials !== true) return { error: `the environment "${e.name}" does not pass the Claude sign-in as a proxy placeholder: the owner turns "proxy AI credentials" on` };
  return { name: e.name };
}

// null when the wallet and the day's requests leave room for this run's cap, else why not.
// `usage` is `boat ai usage --json` (the account view); `today` is "YYYY-MM-DD" in UTC.
// `others` is how many other Claude runs from this PC hold a place: each may still use up to
// CLAUDE.maxRequests that boat's figure does not show yet, so that much is kept for each.
export function checkBudget(run, usage, wallet, today, others) {
  const days = usage?.usage;
  if (!Array.isArray(days) || !(typeof wallet === "number" && Number.isFinite(wallet))) return "no result (the proxy's usage or the wallet could not be read)";
  if (!(Number.isInteger(others) && others >= 0)) return "no result (the count of Claude runs under way could not be read)";
  const todays = days.filter((d) => d?.day === today);
  if (todays.some((d) => !(Number.isFinite(d?.requests) && d.requests >= 0))) return "no result (today's proxied requests could not be read)";
  const used = todays.reduce((n, d) => n + d.requests, 0);
  const held = others * CLAUDE.maxRequests;
  const beside = held ? ` and ${held} kept for ${others} other run${others === 1 ? "" : "s"} under way` : "";
  if (used + held + run.requests > CLAUDE.dayRequests) return `${used} proxied requests today${beside}, and a cap of ${run.requests} would pass ${CLAUDE.dayRequests} a day: a smaller cap, later, or the owner's yes`;
  const after = wallet - (held + run.requests) * DOLLARS_PER_REQUEST;
  if (after < CLAUDE.walletFloor) return `the wallet holds USD ${wallet}; this run's cap${beside} could leave less than USD ${CLAUDE.walletFloor}: the owner tops it up or says yes`;
  return null;
}

// The prompt the agent gets. The job itself is in TASK.md.
export function promptText(folder) {
  return [
    "Your task is in /home/user/TASK.md: read it first.",
    folder ? `The code is in /home/user/${folder}: make your changes there; they are sent back as a patch.` : null,
    "Nobody can answer questions during this run: decide, and note what you assumed.",
    "Before you stop, write your report to /home/user/RESULT.md: what you did, what you checked and how, and what is left open.",
  ].filter(Boolean).join(" ");
}

export function promptArgv(run, id, folder) {
  return ["prompt", id, "--provider", "claude", "--model", BOAT_MODEL[run.model] ?? run.model, ...(run.effort ? ["--reasoning-effort", run.effort] : []), "--json", promptText(folder)];
}

export function newArgv(run, taskFile, environment, name) {
  return ["new", "--type", run.type, "--environment", environment, "--ttl", String(run.timeout + CLAUDE.setupSeconds), "--name", name, "--file", `TASK.md=${taskFile}`, "--json"];
}

const lines = (text) => String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
const parsed = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

// The sandbox id from `boat new --json`, once it said ready; else null.
export function newId(stdout) {
  const events = lines(stdout).map(parsed).filter(Boolean);
  const ready = events.find((e) => e.event === "ready" && /^bx_[a-z0-9]{4,40}$/.test(e.id ?? ""));
  return ready ? ready.id : null;
}

// A line of `boat prompt --json` that says the run failed: an error, or a provider limit such
// as "Claude login required". null for any other line.
export function failure(line) {
  const e = parsed(line);
  if (!e || typeof e !== "object") return null;
  if (e.event === "error") return oneLine(e.error || "boat reported an error");
  const inner = e.data?.data;
  if (inner && typeof inner === "object" && inner.limitType) return oneLine(`${inner.summary || "a provider limit"} (${inner.limitType})`);
  return null;
}

// Requests so far for one sandbox, from `boat ai usage <id> --json`; null when unreadable.
export function requestsOf(usage, id) {
  const box = Array.isArray(usage?.sandboxes) ? usage.sandboxes.find((s) => s?.sandboxId === id) : null;
  const t = box ? box.totals : usage?.totals;
  return Number.isFinite(t?.requests) ? t.requests : null;
}

function boat(argv, ms = 60000) {
  const c = boatCommand(argv);
  return call(c.file, c.args, { encoding: "utf8", env: c.env, maxBuffer: 64 * 1024 * 1024 }, ms);
}

function boatJson(argv, ms) {
  const r = boat(argv, ms);
  if (r.error || r.status !== 0) throw new Error(`boat ${argv[0]}${argv[1] && !argv[1].startsWith("-") ? ` ${argv[1]}` : ""} ${r.error?.code === "ETIMEDOUT" ? "did not answer in time" : `failed (exit ${r.status})`}`);
  return JSON.parse(r.stdout);
}

// A command in the sandbox; { ok, stdout } from boat exec's JSON answer.
function exec(id, script, seconds = 120) {
  const r = boat(["exec", id, "--timeout", String(seconds), "--json", "--", "bash", "-c", script], (seconds + 30) * 1000);
  const j = r.error ? null : parsed(r.stdout.trim());
  if (!j) return { ok: false, stdout: "", why: "boat exec gave no answer" };
  return { ok: j.exitCode === 0 && !j.stdoutTruncated, stdout: String(j.stdout ?? ""), why: j.stdoutTruncated ? "the output was cut" : `exit ${j.exitCode}` };
}

// Readings of the request count that may fail in a row before the run is stopped: a cap
// that cannot be read is not a cap.
export const MISSED_READINGS = 3;

// boat prompt, its lines written to `events` as they come. Every `pollSeconds` the request
// count is read; at the cap, after MISSED_READINGS failed readings in a row, or at the
// timeout, the sandbox's placeholders are refused and the agent interrupted.
// Resolves { stopped, failed }. `io` is for the tests.
export function runPrompt(run, id, folder, events, io = {}) {
  const {
    start = (argv) => {
      const c = boatCommand(argv);
      return spawn(c.file, c.args, { env: c.env, stdio: ["ignore", "pipe", "pipe"] });
    },
    ask = boat,
    usageOf = (sid) => boatJson(["ai", "usage", sid, "--json"]),
    pollMs = CLAUDE.pollSeconds * 1000,
    killMs = 30000,
  } = io;
  return new Promise((done) => {
    const child = start(promptArgv(run, id, folder));
    let stopped = null;
    let failed = null;
    let unconfirmed = false;
    let missed = 0;
    // One partial line per stream: a line split across chunks of stdout is never joined to
    // a chunk of stderr.
    const reader = () => {
      let rest = "";
      const lines = (text) => {
        const parts = text.split("\n");
        rest = parts.pop();
        for (const l of parts) {
          writeFileSync(events, `${l}\n`, { flag: "a" });
          failed ??= failure(l);
        }
      };
      const take = (chunk) => lines(rest + chunk.toString("utf8"));
      take.flush = () => { if (rest) lines(`${rest}\n`); };
      return take;
    };
    const out = reader();
    const err = reader();
    child.stdout.on("data", out);
    child.stderr.on("data", err);
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      clearInterval(poll);
      clearTimeout(clock);
      out.flush();
      err.flush();
      done({ stopped, failed, unconfirmed });
    };
    const halt = (why) => {
      if (stopped) return;
      // The block is what stops the spending: asked twice before it counts as failed.
      const blocked = [0, 1].some(() => ask(["ai", "block", id])?.status === 0);
      const interrupted = ask(["interrupt", id])?.status === 0;
      // Neither confirmed: the agent may still be spending, so main deletes the sandbox
      // before it fetches anything.
      unconfirmed = !blocked && !interrupted;
      stopped = blocked ? why : `${why}; boat did not confirm the block`;
      // On this PC boat runs under a launcher: killing it may leave boat.exe holding the
      // pipes, so "close" may never come. The run ends anyway, and main deletes the sandbox.
      setTimeout(() => {
        child.kill("SIGKILL");
        setTimeout(finish, killMs).unref();
      }, killMs).unref();
    };
    const poll = setInterval(() => {
      let n = null;
      try {
        n = requestsOf(usageOf(id), id);
      } catch { /* counted below as a missed reading */ }
      if (n === null) {
        missed += 1;
        if (missed >= MISSED_READINGS) halt(`${missed} readings of the request count in a row failed, so the cap could not hold`);
        return;
      }
      missed = 0;
      if (n >= run.requests) halt(`the request cap (${n} of ${run.requests})`);
    }, pollMs);
    const clock = setTimeout(() => halt(`the timeout (${run.timeout} seconds)`), run.timeout * 1000);
    child.on("error", () => { failed ??= "boat prompt did not run"; });
    child.on("close", finish);
  });
}

const REAL = {
  limits: () => readLimits(),
  slot: () => takeSlot(join(STATE, "slots")),
  claudeSlot: () => takeSlot(join(STATE, "claude-slots"), { max: CLAUDE.active }),
  environments: () => boatJson(["env", "list", "--json"]),
  usage: () => boatJson(["ai", "usage", "--days", "2", "--json"]),
  usageOf: (id) => boatJson(["ai", "usage", id, "--json"]),
  permit: (folder) => {
    const key = repoKey(folder);
    let list = "";
    try {
      list = readFileSync(UPLOAD_LIST, "utf8");
    } catch { /* no list yet: nothing is allowed */ }
    const entry = listEntry(key, list);
    return { ok: entry !== null, key, data: entry ? entry.data : [] };
  },
  stage,
  dataFiles,
  scan,
  boat,
  exec,
  prompt: runPrompt,
  remove: (id) => removeSandbox(id),
  runName: () => `boat-claude-${randomUUID().slice(0, 8)}`,
  findByName: (name) => {
    try {
      const list = boatJson(["list", "--json"]).sandboxes;
      return (Array.isArray(list) ? list.find((x) => x?.name === name)?.id : null) ?? null;
    } catch {
      return null;
    }
  },
  // A script stopped by Ctrl-C, Ctrl-Break or a closed window still refuses the sandbox's
  // placeholders, deletes it and removes its copies. A forced kill (a tool's time limit; on
  // Windows SIGTERM is never delivered) runs no handler: then only the sandbox's TTL ends it,
  // and nothing holds the request cap until then.
  onStop: (clean) => {
    const signals = ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"];
    const handler = (sig) => {
      try {
        clean();
      } finally {
        process.exit(sig === "SIGINT" ? 130 : 143);
      }
    };
    for (const sig of signals) process.on(sig, handler);
    return () => { for (const sig of signals) process.off(sig, handler); };
  },
  outDir: (id) => join(STATE, "claude", `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}`),
  today: () => new Date().toISOString().slice(0, 10),
  say: (line) => console.error(line),
};

export async function main(argv, deps = REAL) {
  const stop = (why) => {
    deps.say(`BOAT-CLAUDE: not started: ${why}`);
    return NOT_STARTED;
  };
  const run = parseArgs(argv);
  if (run.error) return stop(run.error);
  let task;
  try {
    if (statSync(run.task).size > TASK_BYTES) return stop(`the task file is over ${TASK_BYTES} bytes: put the long parts in the repository and point at them`);
    task = resolve(run.task);
  } catch {
    return stop("the task file could not be read");
  }
  let slot;
  let claudeSlot;
  try {
    slot = deps.slot();
    if (!slot) return stop(`${LIMITS.active} boat runs from this PC are under way; more at once needs the owner's yes`);
    claudeSlot = deps.claudeSlot();
  } catch (e) {
    slot?.release();
    return stop(`no result (the count of runs under way could not be kept: ${oneLine(e?.code || e?.message)})`);
  }
  if (!claudeSlot) {
    slot.release();
    return stop(`${CLAUDE.active} Claude runs from this PC are under way; more at once needs the owner's yes`);
  }
  let staged = null;
  let id = null;
  let asked = false; // boat new was called: a sandbox may exist from here on
  let taskCopy = null;
  let offStop = null;
  let gone = false; // the sandbox was deleted before the end
  let name = null; // this run's sandbox name, unique, set before boat new
  try {
    let plan;
    let envs;
    let usage;
    try {
      plan = deps.limits();
      envs = deps.environments();
      usage = deps.usage();
    } catch (e) {
      return stop(`no result (${oneLine(e?.message)})`);
    }
    const environment = pickEnvironment(envs);
    const refusal = longest(run) ?? gate(sandboxRun(run), plan, slot.waiting) ?? environment.error ?? checkBudget(run, usage, plan?.wallet?.balanceDollars, deps.today(), claudeSlot.others);
    if (refusal) return stop(refusal);
    if (run.push !== null) {
      const permit = deps.permit(run.push);
      if (!permit.ok) return stop(`${permit.key ? oneLine(permit.key) : "this folder"} is not on the upload list (${oneLine(UPLOAD_LIST)}): see recipes/boat.md`);
      staged = deps.stage(run.push);
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(basename(staged.dir))) return stop("the folder's name holds characters the sandbox's shell would read: letters, digits, dot, dash and underscore only");
      const data = unnamed(deps.dataFiles(staged.dir).map((f) => `${staged.prefix || ""}${f}`), permit.data || []);
      if (data.length > 0) return stop(`the upload holds ${data.length} data-shaped file${data.length === 1 ? "" : "s"} the upload list does not name (${data.slice(0, 5).map(oneLine).join("; ")}): see recipes/boat.md`);
      const result = deps.scan(staged.dir, staged.tmp);
      if (!result.ok) return stop(`the secret scan of the upload: ${result.reason}`);
    }
    // The task is scanned before it goes in, from a copy, so what was scanned is what is sent.
    taskCopy = mkdtempSync(join(tmpdir(), "boat-claude-task-"));
    const sent = join(taskCopy, "task", "TASK.md");
    mkdirSync(join(taskCopy, "task"));
    writeFileSync(sent, readFileSync(task));
    const taskScan = deps.scan(join(taskCopy, "task"), taskCopy);
    if (!taskScan.ok) return stop(`the secret scan of the task file: ${taskScan.reason}`);
    // Each run has a name of its own: a start that ends without boat saying the sandbox's id
    // (a time-out, a cut answer) is found by it and deleted below. A signal is handled only
    // after boat new returns (it is a synchronous call), so the handler always has the id.
    name = deps.runName();
    offStop = deps.onStop(() => {
      if (id) {
        deps.boat(["ai", "block", id]);
        deps.remove(id);
      }
      if (staged) staged.remove();
      if (taskCopy) rmSync(taskCopy, { recursive: true, force: true });
    });
    asked = true;
    const made = deps.boat(newArgv(run, sent, environment.name, name), 180000);
    id = made.error ? null : newId(made.stdout);
    if (!id) {
      const any = /"id":"(bx_[a-z0-9]{4,40})"/.exec(String(made.stdout ?? ""));
      id = any ? any[1] : null;
      throw new Error(`boat new did not report a ready sandbox${made.error ? " in time" : ` (exit ${made.status})`}`);
    }
    slot.up();
    claudeSlot.up();
    const folder = staged ? basename(staged.dir) : null;
    if (staged) {
      const pushed = deps.boat(["push", id, staged.dir, "--json"], 300000);
      if (pushed.error || pushed.status !== 0) throw new Error("boat push failed");
      const base = deps.exec(id, `cd ~/${folder} && git init -q && git add -A && git -c user.name=boat-claude -c user.email=boat-claude@localhost commit -qm base`);
      if (!base.ok) throw new Error(`the sandbox copy could not be recorded for the patch (${base.why})`);
    }
    const out = deps.outDir(id);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "TASK.md"), readFileSync(sent));
    const events = join(out, "events.jsonl");
    deps.say(`BOAT-CLAUDE: ${id} (environment ${environment.name}) runs ${run.model}; caps: ${run.requests} requests, ${run.timeout} seconds; events in ${events}`);
    const ran = await deps.prompt(run, id, folder, events);
    if (ran.unconfirmed) {
      // Neither the block nor the interrupt was confirmed: nothing is fetched first.
      gone = deps.remove(id);
      deps.say(`BOAT-CLAUDE: not finished: stopped at ${ran.stopped}; boat confirmed neither the block nor the interrupt, so ${gone ? "the sandbox was deleted before anything was fetched" : "nothing was fetched and the delete is tried once more"}`);
      return 1;
    }
    const report = deps.exec(id, "cat /home/user/RESULT.md");
    if (report.ok) writeFileSync(join(out, "RESULT.md"), report.stdout);
    let patch = null;
    if (staged) {
      patch = deps.exec(id, `cd ~/${folder} && git add -A && git diff --cached --binary HEAD`);
      if (patch.ok && patch.stdout) writeFileSync(join(out, "changes.patch"), patch.stdout);
    }
    let requests = null;
    try {
      requests = requestsOf(deps.usageOf(id), id);
    } catch { /* reported as unknown */ }
    const tmp = mkdtempSync(join(tmpdir(), "boat-claude-"));
    let check;
    try {
      check = deps.scan(out, tmp);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    deps.say(`BOAT-CLAUDE: ${requests === null ? "unknown" : requests} proxied requests (about USD ${requests === null ? "?" : (requests * DOLLARS_PER_REQUEST).toFixed(3)}); files in ${out}`);
    if (!check.ok) deps.say(`BOAT-CLAUDE: the secret scan of what came back: ${check.reason}: use none of it; a finding goes to the owner`);
    if (staged) deps.say(patch?.ok ? (patch.stdout ? "BOAT-CLAUDE: changes.patch is data from the sandbox: read it, then git apply" : "BOAT-CLAUDE: no changes to the code") : `BOAT-CLAUDE: the changes could not be fetched (${patch?.why})`);
    const why = ran.stopped ? `stopped at ${ran.stopped}` : ran.failed ? `the agent failed: ${ran.failed}` : !report.ok ? "the agent wrote no report (RESULT.md)" : !check.ok ? "the returned files failed the secret scan" : null;
    if (why) {
      deps.say(`BOAT-CLAUDE: not finished: ${why}`);
      return 1;
    }
    deps.say("BOAT-CLAUDE: finished: RESULT.md is the agent's report, data from the sandbox");
    return 0;
  } catch (e) {
    if (!id && !asked) return stop(oneLine(e?.message));
    if (!id) {
      // boat new was asked and named no sandbox: look for this run's own name.
      const found = name ? deps.findByName(name) : null;
      if (found) {
        deps.boat(["ai", "block", found]);
        gone = deps.remove(found);
      }
      deps.say(`BOAT-CLAUDE: not finished: ${oneLine(e?.message)}; ${gone ? `its sandbox ${found}, found by the run's name, is deleted` : "a sandbox may still exist: run 'boat list' and delete what this run left"}`);
      return 1;
    }
    deps.say(`BOAT-CLAUDE: not finished: ${oneLine(e?.message)}`);
    return 1;
  } finally {
    offStop?.();
    if (taskCopy) rmSync(taskCopy, { recursive: true, force: true });
    if (id && !gone && !deps.remove(id)) deps.say(`BOAT-CLAUDE: the sandbox ${id} may still exist: run 'boat list' and delete it`);
    if (staged) staged.remove();
    claudeSlot.release();
    slot.release();
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  process.exitCode = await main(process.argv.slice(2));
}
