#!/usr/bin/env node
// The one route to a cloud sandbox for a job (recipes/sandboxes.md): a Depot sandbox, started
// through Depot's Connect API with the key-store key `depot-org`. The script decides, not a
// model: the limits below are numbers, and a job past them is the owner's to allow.
//
//   node sandbox-run.mjs [--type small|default|large] --timeout <seconds>
//                        [--push <folder> | --vet <folder>] -- <command> [arguments]
//   node sandbox-run.mjs --list            the org's sandboxes that are not stopped
//   node sandbox-run.mjs --stop <id>       stops one
//
// - Every run gets its size, a timeout and none of the org's secrets: no CI secret, no
//   variable, off the org's tailnet and without Depot Cache's credentials. The key stays in
//   this process; the sandbox never sees it.
// - --push sends a copy made here, never the folder itself: the files git tracks, with their
//   uncommitted edits, and no untracked file. Gitleaks reads the copy first; a finding, or a
//   scan with no result, stops the run. The copy is removed afterwards. In the sandbox the
//   copy becomes a git checkout of one commit, and the command runs in it.
// - --push needs the repository on the upload list, a file on this PC outside every
//   repository: the script cannot tell code from customer data, so a repository is listed
//   once, on purpose, and only when it tracks none. A list goes stale, so every upload is
//   also read for files shaped like data (a spreadsheet, a database, a dump, a mail export,
//   an archive): one that the list does not name for that repository stops the run.
// - --vet sends a folder of outside code as it is, for the vetting step only: the folder
//   holds sandbox-probe.sh and the command is `bash sandbox-probe.sh ...`
//   (recipes/vetting-sandbox.md). It needs no list: it is public code, never ours.
// - The sandbox is always stopped when the command ends: also on a timeout, an error or
//   Ctrl-C. The org's sandboxes are read after; one this run left is stopped again or named.
// - Depot bills a sandbox per vCPU-second from its start to its stop. A run's most (its
//   timeout times its vCPUs) and the month's runs from this PC (a ledger here, filled from
//   Depot's own record of each sandbox) are held under the limits; a fifth of the month is
//   kept back for the vetting step.
// - "SANDBOX-RUN: not started: <why>" and exit 75, a code commands rarely use, mean the
//   command did not run; otherwise the exit code is the command's own, 124 for a timeout.
// - Runs take their place among this PC's runs first and ask Depot after, so runs that
//   arrive together cannot each see room.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The owner's allowance: Claude sizes each job inside these. The run and the count are the
// boat figures of 16 November 2026; the month is half of what boat's plan cost (USD 20).
export const LIMITS = {
  active: 10, // sandboxes at once
  runVcpuSeconds: 14400, // one run's most: its timeout times its vCPUs (an hour at `default`)
  monthVcpuSeconds: 200000, // this PC's runs in a calendar month (UTC): USD 10
  reserve: 0.2, // of the month, kept back for the vetting step
};
// Depot's rate: USD a vCPU-second, the one that reproduced October 2026's invoice.
export const RATE_USD = 0.00005;
// The exit code of a run that did not start (EX_TEMPFAIL): a command's own 1 or 2 is not it.
export const NOT_STARTED = 75;
// The exit code of a command stopped at its timeout, as `timeout` gives.
export const TIMED_OUT = 124;
// The exit code of a run stopped by Ctrl-C or a stop signal, as a shell reports SIGINT.
export const INTERRUPTED = 130;
export const SIZES = Object.freeze({
  small: { vcpus: 2, memoryMb: 4096 },
  default: { vcpus: 4, memoryMb: 8192 },
  large: { vcpus: 8, memoryMb: 16384 },
});
// Minutes the sandbox may live past the command's timeout: its start and the upload.
export const LIFETIME_MARGIN_MINUTES = 5;
// Where the upload goes in the sandbox (the sandbox user's home).
export const WORK = "/home/runner/work";
const SAY = "SANDBOX-RUN";

const oneLine = (text) => String(text).replace(/[^\x20-\x7e]+/g, " ").trim().slice(0, 300);
export const maxCost = (run) => run.timeout * SIZES[run.type].vcpus;

export function parseArgs(argv) {
  if (argv[0] === "--list" && argv.length === 1) return { mode: "list" };
  if (argv[0] === "--stop") {
    if (argv.length !== 2 || !/^[a-z0-9]{6,40}$/.test(argv[1])) return { error: "--stop takes one sandbox id" };
    return { mode: "stop", id: argv[1] };
  }
  const out = { mode: "run", type: "default", timeout: null, push: null, vet: null, command: [] };
  const cut = argv.indexOf("--");
  const own = cut < 0 ? argv : argv.slice(0, cut);
  out.command = cut < 0 ? [] : argv.slice(cut + 1);
  for (let i = 0; i < own.length; i += 1) {
    const a = own[i];
    const value = () => (i + 1 < own.length ? own[(i += 1)] : null);
    if (a === "--type") {
      out.type = value();
      if (!Object.hasOwn(SIZES, out.type ?? "")) return { error: "--type is small, default or large" };
    } else if (a === "--timeout") {
      const v = value();
      if (v === null || !/^[1-9][0-9]{0,6}$/.test(v)) return { error: "--timeout takes whole seconds, 1 or more" };
      out.timeout = Number(v);
    } else if (a === "--push" || a === "--vet") {
      const v = value();
      if (!v) return { error: `${a} takes a folder` };
      out[a.slice(2)] = v;
    } else return { error: `${oneLine(a)} is not an option of sandbox-run: size, timeout and upload are the only ones` };
  }
  if (out.push !== null && out.vet !== null) return { error: "--push and --vet do not go together" };
  if (out.timeout === null) return { error: "--timeout <seconds> is required" };
  if (out.command.length === 0) return { error: "a command is required after --" };
  if (out.vet !== null && (out.command[0] !== "bash" || out.command[1] !== "sandbox-probe.sh")) {
    return { error: "--vet runs only the vetting probe: -- bash sandbox-probe.sh ..." };
  }
  return out;
}

const count = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;

// null when the run may start, else the reason it may not.
// seen: { running: the org's sandboxes not stopped, waiting: this PC's other runs with no
// sandbox yet, reserved: the most the other runs under way here can take (vCPU-seconds),
// spent: this month's runs from this PC (vCPU-seconds) }.
export function gate(run, seen) {
  const { running, waiting, reserved, spent } = seen ?? {};
  if (![running, waiting, reserved, spent].every(count)) return "no result (the runs under way or the month's use could not be read)";
  const cost = maxCost(run);
  if (cost > LIMITS.runVcpuSeconds) {
    return `one run takes at most ${LIMITS.runVcpuSeconds} vCPU-seconds (${run.type}: a timeout of ${Math.floor(LIMITS.runVcpuSeconds / SIZES[run.type].vcpus)}); more needs the owner's yes`;
  }
  // Depot counts a sandbox once it exists. A run here that holds a place and has none yet
  // is not in that figure, so the two are counted together.
  if (running + waiting >= LIMITS.active) {
    return `${running} sandboxes are running and ${waiting} more ${waiting === 1 ? "is" : "are"} about to start from this PC: ${LIMITS.active} at once is the most; more needs the owner's yes`;
  }
  const room = LIMITS.monthVcpuSeconds * (run.vet !== null ? 1 : 1 - LIMITS.reserve);
  if (spent + reserved + cost > room) {
    const usd = (s) => (s * RATE_USD).toFixed(2);
    return run.vet !== null
      ? `the month's allowance (USD ${usd(LIMITS.monthVcpuSeconds)}) would be passed: used USD ${usd(spent)}, under way USD ${usd(reserved)}, this run at most USD ${usd(cost)}; the owner's yes first`
      : `a fifth of the month's allowance (USD ${usd(LIMITS.monthVcpuSeconds)}) is kept back for the vetting step, and this run would go into it (used USD ${usd(spent)}, under way USD ${usd(reserved)}, this run at most USD ${usd(cost)}): a shorter timeout or a smaller size, or the owner's yes`;
  }
  return null;
}

// The bash script the command runs under, with the command as its own arguments ("$@"),
// never pasted into it. Node 24 goes first on the PATH, as CI has it: the image puts
// Node 22 first. An upload from --push becomes a git checkout of one commit, as a CI checkout
// has its files at HEAD: --force adds a tracked file that a .gitignore names, --allow-empty
// gives an empty copy a HEAD too. A step that fails means the command never ran: exit 75.
export const NODE_FIRST = `d=$(ls -d /opt/hostedtoolcache/node/24.*/x64/bin 2>/dev/null | sort -V | tail -1); [ -n "$d" ] && export PATH="$d:$PATH"`;
export const AS_CHECKOUT = `{ ${[
  "git -c init.defaultBranch=main init -q",
  "git add --all --force .",
  "git -c user.name=sandbox-run -c user.email=sandbox-run@localhost -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -q --no-verify --allow-empty -m 'sandbox-run: the uploaded copy'",
].join(" && ")}; } || { echo '${SAY}: not started: the upload could not be made a git checkout' >&2; exit ${NOT_STARTED}; }`;

export function commandArgs(run) {
  const script = [NODE_FIRST, ...(run.push !== null ? [AS_CHECKOUT] : []), 'exec "$@"'].join("; ");
  return ["-c", script, "sandbox-run", ...run.command];
}

function links(dir, at = "") {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = at ? `${at}/${e.name}` : e.name;
    if (e.isSymbolicLink()) return rel;
    if (e.isDirectory()) {
      const inner = links(join(dir, e.name), rel);
      if (inner) return inner;
    }
  }
  return null;
}

// A copy of the folder's tracked files in a new temporary folder: { dir, tmp, remove,
// prefix }. The prefix is where the folder sits in its repository ("" at the top, else
// "src/"): the upload list names files from the repository's top.
// `git stash create` writes a commit of the tracked files as they are now and changes
// nothing in the working folder; with no edits it prints nothing and HEAD is used.
export function stage(folder) {
  const from = resolve(folder);
  const git = (...a) => spawnSync("git", ["-C", from, "-c", "user.name=sandbox-run", "-c", "user.email=sandbox-run@localhost", ...a], { encoding: "utf8" });
  if (git("rev-parse", "--show-toplevel").status !== 0) throw new Error("the folder to upload is not in a git repository: only tracked files are uploaded");
  if (git("rev-parse", "--verify", "-q", "HEAD^{commit}").status !== 0) throw new Error("the repository has no commit yet: commit first, only tracked files are uploaded");
  const where = git("rev-parse", "--show-prefix");
  if (where.status !== 0) throw new Error("git could not say where the folder sits in its repository");
  const prefix = where.stdout.trim();
  const stash = git("stash", "create");
  if (stash.status !== 0) throw new Error("git could not read the tracked files (stash create failed)");
  const tree = /^[0-9a-f]{40,64}$/.test(stash.stdout.trim()) ? stash.stdout.trim() : "HEAD";
  const tmp = mkdtempSync(join(tmpdir(), "sandbox-run-"));
  const remove = () => rmSync(tmp, { recursive: true, force: true });
  try {
    const dir = join(tmp, basename(from));
    mkdirSync(dir);
    // The repository's own bytes, with LF line endings whatever this machine's git says.
    if (git("-c", "core.autocrlf=false", "-c", "core.eol=lf", "archive", "--format=tar", "-o", join(tmp, "src.tar"), tree).status !== 0) throw new Error("git archive failed");
    if (spawnSync("tar", ["-xf", "../src.tar"], { cwd: dir, encoding: "utf8" }).status !== 0) throw new Error("tar could not unpack the copy");
    rmSync(join(tmp, "src.tar"), { force: true });
    const link = links(dir);
    if (link) throw new Error(`the upload holds a symbolic link (${oneLine(link)}), which could lead outside the copy`);
    return { dir, tmp, remove, prefix };
  } catch (e) {
    remove();
    throw e;
  }
}

// The folder as one gzip tar, its contents at the top ("./..."), symbolic links as links.
export function pack(dir) {
  const r = spawnSync("tar", ["-czf", "-", "-C", dir, "."], { maxBuffer: 1 << 30 });
  if (r.error || r.status !== 0) throw new Error(`tar could not pack the upload (${r.error ? "did not run" : `exit ${r.status}`})`);
  return r.stdout;
}

// Gitleaks on the copy, with its default rules: no ignore file of the repository's own, and
// a "gitleaks:allow" comment in a file does not quiet it. Gitleaks also reads a
// .gitleaksignore at the top of the folder it scans, so the copy's is moved out for the scan
// and put back for the upload.
export function scan(dir, tmp) {
  const own = join(dir, ".gitleaksignore");
  const aside = join(tmp, "gitleaksignore-of-the-copy");
  const had = existsSync(own);
  if (had) renameSync(own, aside);
  try {
    return scanCopy(dir, tmp);
  } finally {
    if (had) renameSync(aside, own);
  }
}

function scanCopy(dir, tmp) {
  const cfg = join(tmp, "gitleaks.toml");
  const none = join(tmp, "gitleaks-ignore");
  const report = join(tmp, "gitleaks.json");
  writeFileSync(cfg, "[extend]\nuseDefault = true\n");
  writeFileSync(none, "");
  const env = { ...process.env };
  delete env.GITLEAKS_CONFIG;
  delete env.GITLEAKS_CONFIG_TOML;
  const r = spawnSync("gitleaks", ["dir", dir, "--config", cfg, "--gitleaks-ignore-path", none, "--ignore-gitleaks-allow", "--no-banner", "--redact", "--exit-code", "3", "--report-format", "json", "--report-path", report], { encoding: "utf8", env });
  if (r.error) return { ok: false, reason: "no result (gitleaks did not run)" };
  let found;
  try {
    found = JSON.parse(readFileSync(report, "utf8"));
  } catch {
    return { ok: false, reason: `no result (gitleaks exit ${r.status}, no report)` };
  }
  if (!Array.isArray(found) || (r.status !== 0 && r.status !== 3)) return { ok: false, reason: `no result (gitleaks exit ${r.status})` };
  if (r.status === 0 && found.length === 0) return { ok: true };
  // Rule and file only: never the matched text.
  const where = found.slice(0, 5).map((f) => `${oneLine(f.RuleID)} in ${oneLine(String(f.File).replace(/\\/g, "/").split("/").slice(-2).join("/"))}`);
  return { ok: false, reason: `${found.length} finding${found.length === 1 ? "" : "s"} (${where.join("; ")}): a security finding goes to the owner` };
}

// A file of its own for each run, held while the process lives, so that runs started in
// the same second cannot all read "nothing is running" and pass. Each run writes its file
// (holding the most it can take, in vCPU-seconds) first and counts the others after: two
// that arrive together at the last place may both be refused, and never both pass. Names
// are never reused, so clearing a dead run's file cannot remove a live one's.
// `waiting` is how many of the others have no sandbox yet: Depot's own count does not hold
// them. A run calls `up` once its sandbox exists. `reserved` is what the others can take.
const UP = ".up";
export function takeSlot(dir, { pid = process.pid, alive = isAlive, max = LIMITS.active, token = randomUUID(), cost = 0 } = {}) {
  mkdirSync(dir, { recursive: true });
  const mine = `run-${pid}-${token}`;
  const file = join(dir, mine);
  writeFileSync(file, String(cost), { flag: "wx" });
  let others = 0;
  let waiting = 0;
  let reserved = 0;
  for (const name of readdirSync(dir)) {
    const holder = /^run-([1-9][0-9]*)-/.exec(name);
    if (!holder || name === mine) continue;
    if (!alive(Number(holder[1]))) {
      rmSync(join(dir, name), { force: true });
      continue;
    }
    others += 1;
    if (!name.endsWith(UP)) waiting += 1;
    let held = Number.NaN;
    try {
      held = Number(readFileSync(join(dir, name), "utf8").trim());
    } catch { /* gone between the listing and the read: counted at the full run below */ }
    reserved += Number.isFinite(held) && held >= 0 ? held : LIMITS.runVcpuSeconds;
  }
  const release = () => {
    rmSync(file, { force: true });
    rmSync(file + UP, { force: true });
  };
  if (others >= max) {
    release();
    return null;
  }
  const up = () => {
    try {
      renameSync(file, file + UP);
    } catch { /* not renamed: the run stays counted as waiting, the safe side */ }
  };
  return { file, waiting, reserved, others, up, release };
}

// The ledger: one JSON line a run, { month: "2026-11", id, vcpuSeconds, usd, from }.
// `from` says where the figure came from: Depot's record, or the run's most when that
// record could not be read (the safe side).
export const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);
export function spentIn(month, text) {
  let sum = 0;
  for (const line of String(text).split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      throw new Error("the ledger has a line that is not JSON");
    }
    if (e?.month === month) {
      if (!count(e.vcpuSeconds)) throw new Error("the ledger has a line without vCPU-seconds");
      sum += e.vcpuSeconds;
    }
  }
  return sum;
}

// How much a stopped sandbox took, from Depot's record: created to stopped, times its vCPUs.
// null when the record does not say.
export function billed(sandbox, vcpus) {
  const from = Date.parse(sandbox?.createdAt ?? "");
  const to = Date.parse(sandbox?.stoppedAt ?? "");
  const v = Number(sandbox?.resources?.vcpus ?? vcpus);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || !(v > 0)) return null;
  const seconds = (to - from) / 1000;
  return { seconds, vcpuSeconds: Math.ceil(seconds * v), usd: seconds * v * RATE_USD };
}

const STOPPED = /FINISHED|CANCELLED|FAILED/;
export const notStopped = (list) => (list?.sandboxes ?? []).filter((s) => !STOPPED.test(String(s?.status ?? "")));

// How a repository is named on the upload list: its origin without the scheme, the user
// and ".git", in lower case (github.com/owner/name), or its folder when it has no origin.
export function repoKey(folder) {
  const from = resolve(folder);
  const git = (...a) => spawnSync("git", ["-C", from, ...a], { encoding: "utf8" });
  const top = git("rev-parse", "--show-toplevel");
  if (top.status !== 0) return null;
  const origin = git("config", "--get", "remote.origin.url");
  return normalKey(origin.status === 0 && origin.stdout.trim() ? origin.stdout.trim() : top.stdout.trim());
}

export function normalKey(text) {
  return String(text).trim().replace(/\\/g, "/").replace(/^[a-z+]+:\/\//i, "").replace(/^[^@/]+@/, "").replace(/^([^/:]+):(?!\/)/, "$1/").replace(/\.git$/i, "").replace(/\/+$/, "").toLowerCase();
}

// One repository on a line; "#" starts a comment. The whole name must match: no patterns.
// After the name, "data:" and the data-shaped files that were looked at and may go, each a
// path in the repository or a folder ending in "/" (no spaces in a path).
// null when the repository is not listed, else { data: [paths] }.
export function listEntry(key, listText) {
  if (!key) return null;
  for (const raw of String(listText).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const cut = line.search(/\sdata:(\s|$)/);
    const name = normalKey(cut < 0 ? line : line.slice(0, cut));
    if (name !== key) continue;
    const data = cut < 0 ? [] : line.slice(cut).replace(/^\sdata:/, "").trim().split(/\s+/).filter(Boolean).map((d) => d.replace(/\\/g, "/").replace(/^\.\//, ""));
    return { data };
  }
  return null;
}

export const onList = (key, listText) => listEntry(key, listText) !== null;

// File names that hold records more often than code.
export const DATA_SHAPED = /\.(csv|tsv|xls|xlsx|xlsm|xlsb|ods|numbers|sqlite|sqlite3|db|mdb|accdb|sql|dump|bak|parquet|avro|orc|ndjson|jsonl|pst|ost|mbox|eml|msg|vcf|zip|7z|rar|tar|gz|tgz|bz2|xz)$/i;

// The data-shaped files in a folder, as paths with "/" from its top.
export function dataFiles(dir, at = "") {
  const found = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = at ? `${at}/${e.name}` : e.name;
    if (e.isDirectory()) found.push(...dataFiles(join(dir, e.name), rel));
    else if (DATA_SHAPED.test(e.name)) found.push(rel);
  }
  return found.sort();
}

// A file is named by its whole path, or by a folder above it that ends in "/".
export function unnamed(files, named) {
  return files.filter((f) => !named.some((n) => (n.endsWith("/") ? f.startsWith(n) : f === n)));
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

// Depot's Connect API (depot.sandbox.v1.SandboxService), by fetch: no SDK to install.
export const API = "https://api.depot.dev/depot.sandbox.v1.SandboxService/";
// A call that only asks, starts or stops answers in seconds; one that hangs is ended.
export const CALL_SECONDS = 60;

export function envelope(obj) {
  const body = Buffer.from(JSON.stringify(obj));
  const head = Buffer.alloc(5);
  head.writeUInt32BE(body.length, 1);
  return Buffer.concat([head, body]);
}

// A reader of Connect stream frames: feed it bytes as they come, it returns the whole
// frames so far as { end, msg }.
export function frames() {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const out = [];
    while (buf.length >= 5) {
      const len = buf.readUInt32BE(1);
      if (buf.length < 5 + len) break;
      out.push({ end: (buf[0] & 2) !== 0, msg: JSON.parse(buf.subarray(5, 5 + len).toString("utf8")) });
      buf = buf.subarray(5 + len);
    }
    return out;
  };
}

export function client(token, f = fetch) {
  const headers = (type) => ({ Authorization: `Bearer ${token}`, "Content-Type": type, "Connect-Protocol-Version": "1" });
  const failed = (method, status, text) => new Error(`${method}: HTTP ${status} ${oneLine(text).slice(0, 200)}`);
  async function unary(method, body) {
    const r = await f(API + method, { method: "POST", headers: headers("application/json"), body: JSON.stringify(body), signal: AbortSignal.timeout(CALL_SECONDS * 1000) });
    const text = await r.text();
    if (!r.ok) throw failed(method, r.status, text);
    return JSON.parse(text);
  }
  // A streaming call; each message goes to `each` as it comes. Throws on an end frame
  // that carries an error.
  async function stream(method, body, each, signal) {
    const r = await f(API + method, { method: "POST", headers: headers("application/connect+json"), body, signal });
    if (!r.ok) throw failed(method, r.status, await r.text());
    const read = frames();
    const take = (bytes) => {
      for (const { end, msg } of read(Buffer.from(bytes))) {
        if (end) {
          if (msg?.error) throw new Error(`${method}: ${oneLine(msg.error.code ?? "")} ${oneLine(msg.error.message ?? "")}`.trim());
        } else each(msg);
      }
    };
    if (r.body?.getReader) {
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        take(value);
      }
    } else take(await r.arrayBuffer());
  }
  return {
    create: (opts) => unary("CreateSandbox", opts),
    get: (id) => unary("GetSandbox", { id }),
    list: () => unary("ListSandboxes", {}),
    stop: (id) => unary("StopSandbox", { sandbox: { id }, blocking: true }),
    // Runs one command: { started, code } (code null when no end was reported). Output
    // goes to out(stream, bytes) as it comes.
    async run(id, cmd, args, { cwd, out = () => {}, signal } = {}) {
      const result = { started: false, code: null };
      await stream("RunCommand", envelope({ sandbox: { id }, cmd, args, ...(cwd ? { cwd } : {}) }), (msg) => {
        if (msg.started) result.started = true;
        if (msg.stdout) out("stdout", Buffer.from(msg.stdout.data ?? "", "base64"));
        if (msg.stderr) out("stderr", Buffer.from(msg.stderr.data ?? "", "base64"));
        if (msg.finished) result.code = msg.finished.exitCode ?? 0;
      }, signal);
      return result;
    },
    async write(id, path, data, { signal } = {}) {
      const parts = [envelope({ init: { sandbox: { id }, path, createDirectories: true } })];
      for (let i = 0; i < data.length; i += 1 << 20) parts.push(envelope({ data: data.subarray(i, i + (1 << 20)).toString("base64") }));
      const limit = AbortSignal.timeout(10 * CALL_SECONDS * 1000);
      await stream("WriteFile", Buffer.concat(parts), () => {}, signal ? AbortSignal.any([signal, limit]) : limit);
    },
  };
}

// One fixed place on the PC. No environment variable moves it: whoever starts the script
// could otherwise bring a list and an empty ledger of their own.
export const STATE = join(homedir(), ".local", "share", "sandbox-run");
export const UPLOAD_LIST = join(STATE, "upload-allowed.txt");
export const LEDGER = join(STATE, "ledger.jsonl");

const REAL = {
  key: async () => (await import("./with-key.mjs")).readKey("depot-org").then((k) => k.key),
  api: (token) => client(token),
  slot: (cost) => takeSlot(join(STATE, "slots"), { cost }),
  spent: (month) => spentIn(month, existsSync(LEDGER) ? readFileSync(LEDGER, "utf8") : ""),
  record: (entry) => {
    mkdirSync(STATE, { recursive: true });
    appendFileSync(LEDGER, `${JSON.stringify(entry)}\n`);
  },
  permit: (folder) => {
    const key = repoKey(folder);
    let list = "";
    try {
      list = readFileSync(UPLOAD_LIST, "utf8");
    } catch { /* no list yet: nothing is allowed */ }
    const entry = listEntry(key, list);
    return { ok: entry !== null, key, list: UPLOAD_LIST, data: entry ? entry.data : [] };
  },
  stage,
  dataFiles,
  scan,
  pack,
  vetFolder: (folder) => {
    const dir = resolve(folder);
    if (!statSync(dir).isDirectory() || !existsSync(join(dir, "sandbox-probe.sh"))) throw new Error("the --vet folder must hold sandbox-probe.sh");
    return dir;
  },
  out: (stream, bytes) => (stream === "stdout" ? process.stdout : process.stderr).write(bytes),
  say: (line) => console.error(line),
  now: () => Date.now(),
  wait: (ms) => new Promise((done) => setTimeout(done, ms)),
  onSignal: (stop) => {
    const handler = () => stop("interrupted");
    process.once("SIGINT", handler);
    process.once("SIGTERM", handler);
    return () => {
      process.off("SIGINT", handler);
      process.off("SIGTERM", handler);
    };
  },
};

// The two small commands for a sandbox a run left: list and stop.
async function admin(run, deps, api) {
  if (run.mode === "list") {
    const left = notStopped(await api.list());
    for (const s of left) deps.say(`${oneLine(s.sandboxId)} ${oneLine(s.name ?? "")} ${oneLine(s.status ?? "")} ${oneLine(s.createdAt ?? "")} ${oneLine(s.resources?.vcpus ?? "")} vCPU`);
    deps.say(`${SAY}: ${left.length} sandbox${left.length === 1 ? "" : "es"} not stopped`);
    return 0;
  }
  await api.stop(run.id);
  deps.say(`${SAY}: ${run.id} stopped`);
  return 0;
}

// Ready when a trivial command answers; a new sandbox answers in about two seconds.
// Each try is bounded, and a Ctrl-C or a timeout (`signal`) ends the wait.
async function ready(api, id, deps, signal, limitMs = 180000) {
  const from = deps.now();
  for (;;) {
    if (signal.aborted) throw new Error("interrupted");
    const r = await api.run(id, "/bin/true", [], { signal: AbortSignal.any([signal, AbortSignal.timeout(CALL_SECONDS * 1000)]) }).catch(() => null);
    if (signal.aborted) throw new Error("interrupted");
    if (r?.code === 0) return;
    if (deps.now() - from > limitMs) throw new Error(`the sandbox did not answer in ${limitMs / 1000} seconds`);
    await deps.wait(500);
  }
}

export async function main(argv, deps = REAL) {
  const stop = (why) => {
    deps.say(`${SAY}: not started: ${why}`);
    return NOT_STARTED;
  };
  const run = parseArgs(argv);
  if (run.error) return stop(run.error);
  let api;
  try {
    api = deps.api(await deps.key());
  } catch (e) {
    return stop(`no result (the key depot-org could not be read: ${oneLine(e?.message ?? e)})`);
  }
  if (run.mode !== "run") {
    try {
      return await admin(run, deps, api);
    } catch (e) {
      deps.say(`${SAY}: ${oneLine(e?.message)}`);
      return 1;
    }
  }
  const vcpus = SIZES[run.type].vcpus;
  // The place first, Depot's count after: a run that asked Depot before it held a place
  // could pass beside others that had asked at the same moment.
  let slot;
  try {
    slot = deps.slot(maxCost(run));
  } catch (e) {
    return stop(`no result (the count of runs under way could not be kept: ${oneLine(e?.code || e?.message)})`);
  }
  if (!slot) return stop(`${LIMITS.active} runs from this PC are under way; more at once needs the owner's yes`);
  let staged = null;
  let id = null;
  let started = false;
  let why = null; // set when the run is cut short: "timeout" or "interrupted"
  const cut = new AbortController();
  const end = (reason) => {
    why ??= reason;
    cut.abort();
  };
  const unhook = deps.onSignal(end);
  let timer = null;
  try {
    let seen;
    try {
      seen = { running: notStopped(await api.list()).length, waiting: slot.waiting, reserved: slot.reserved, spent: deps.spent(monthOf(deps.now())) };
    } catch (e) {
      return stop(`no result (${oneLine(e?.message)})`);
    }
    const refusal = gate(run, seen);
    if (refusal) return stop(refusal);
    let upload = null;
    let cwd = WORK;
    if (run.push !== null) {
      const permit = deps.permit(run.push);
      if (!permit.ok) {
        return stop(`${permit.key ? oneLine(permit.key) : "this folder"} is not on the upload list (${oneLine(permit.list)}): a repository is listed once, when it tracks code and no customer data; one that tracks customer data needs the owner's yes`);
      }
      staged = deps.stage(run.push);
      // From the repository's top, as the list names them: an upload of a subfolder would
      // otherwise be compared under the wrong folder.
      const data = unnamed(deps.dataFiles(staged.dir).map((f) => `${staged.prefix || ""}${f}`), permit.data || []);
      if (data.length > 0) {
        const some = data.slice(0, 5).map(oneLine).join("; ");
        return stop(`the upload holds ${data.length} data-shaped file${data.length === 1 ? "" : "s"} the upload list does not name (${some}${data.length > 5 ? "; ..." : ""}): look at each; name it on the list only when it holds no customer data, and take one that does to the owner`);
      }
      const result = deps.scan(staged.dir, staged.tmp);
      if (!result.ok) return stop(`the secret scan of the upload: ${result.reason}`);
      upload = deps.pack(staged.dir);
      cwd = `${WORK}/${basename(staged.dir)}`;
    } else if (run.vet !== null) {
      const dir = deps.vetFolder(run.vet);
      upload = deps.pack(dir);
      cwd = `${WORK}/${basename(dir)}`;
    }
    if (cut.signal.aborted) return stop("interrupted");
    const created = await api.create({
      name: `sandbox-run-${deps.now()}-${randomUUID().slice(0, 8)}`,
      resources: { vcpus, memoryMb: SIZES[run.type].memoryMb },
      timeoutMinutes: Math.ceil(run.timeout / 60) + LIFETIME_MARGIN_MINUTES,
      disableTailnet: true,
      disableDepotCache: true,
    });
    id = created?.sandbox?.sandboxId ?? null;
    if (!id || !/^[a-z0-9]{6,40}$/.test(id)) {
      id = null;
      return stop("no result (Depot gave no sandbox id)");
    }
    slot.up();
    deps.say(`${SAY}: ${id} started (${run.type}, ${vcpus} vCPU)`);
    await ready(api, id, deps, cut.signal);
    if (upload) {
      await api.write(id, "/tmp/sandbox-run-upload.tgz", upload, { signal: cut.signal });
      const unpack = await api.run(id, "/bin/bash", ["-c", `mkdir -p '${cwd}' && tar -xzf /tmp/sandbox-run-upload.tgz -C '${cwd}' && rm -f /tmp/sandbox-run-upload.tgz`], { signal: AbortSignal.any([cut.signal, AbortSignal.timeout(CALL_SECONDS * 1000)]) });
      if (unpack.code !== 0) return stop(`the upload could not be unpacked in the sandbox (exit ${unpack.code})`);
    }
    if (cut.signal.aborted) return stop("interrupted");
    timer = setTimeout(() => end("timeout"), run.timeout * 1000);
    started = true;
    const r = await api.run(id, "/bin/bash", commandArgs(run), { cwd, out: deps.out, signal: cut.signal });
    if (why === "timeout") throw new Error("timeout");
    if (r.code === null) {
      deps.say(`${SAY}: the command's end was not reported`);
      return 1;
    }
    return r.code;
  } catch (e) {
    if (why === "timeout") {
      deps.say(`${SAY}: the command ran past its timeout of ${run.timeout} seconds and was stopped`);
      return TIMED_OUT;
    }
    if (!started) return stop(why ?? oneLine(e?.message));
    deps.say(`${SAY}: ${why ?? oneLine(e?.message)}`);
    return why === "interrupted" ? INTERRUPTED : 1;
  } finally {
    if (timer) clearTimeout(timer);
    unhook();
    if (id) await settle(api, id, run, deps);
    if (staged) staged.remove();
    slot.release();
  }
}

// After every run that made a sandbox: stop it, read Depot's record of it, write the
// ledger, and look that it is gone. The last line says what it took.
async function settle(api, id, run, deps) {
  const vcpus = SIZES[run.type].vcpus;
  let stopped = await api.stop(id).then(() => true, () => false);
  const info = (await api.get(id).catch(() => null))?.sandbox ?? null;
  if (!stopped && STOPPED.test(String(info?.status ?? ""))) stopped = true;
  const took = billed(info, vcpus);
  const worst = (run.timeout + LIFETIME_MARGIN_MINUTES * 60) * vcpus;
  try {
    deps.record({ month: monthOf(deps.now()), id, vcpuSeconds: took ? took.vcpuSeconds : worst, usd: Number((took ? took.usd : worst * RATE_USD).toFixed(4)), from: took ? "depot" : "most" });
  } catch {
    deps.say(`${SAY}: the ledger could not be written (${LEDGER})`);
  }
  let left = null;
  try {
    left = notStopped(await api.list()).some((s) => s.sandboxId === id);
    if (left) {
      stopped = await api.stop(id).then(() => true, () => false);
      left = notStopped(await api.list()).some((s) => s.sandboxId === id);
    }
  } catch { /* not read: said below */ }
  if (left === true || (!stopped && left !== false)) {
    deps.say(`${SAY}: the sandbox ${id} may still be running: node sandbox-run.mjs --list, then --stop ${id}`);
    return;
  }
  const cost = took ? `${took.seconds.toFixed(1)} s at ${vcpus} vCPU, USD ${took.usd.toFixed(4)} by Depot's record` : "Depot's record could not be read: the run's most went into the ledger";
  deps.say(`${SAY}: ${id} stopped; ${cost}`);
}

// realpath on both sides, so a run through a symlink still starts.
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  process.exitCode = await main(process.argv.slice(2));
}
