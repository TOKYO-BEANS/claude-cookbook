#!/usr/bin/env node
// The one route to a boat sandbox for a job (recipes/boat.md). The script decides, not a
// model: the limits below are numbers, and a job past them is the owner's to allow.
//
//   node boat-run.mjs [--type small|default|large] --timeout <seconds> [--push <folder>]
//                     -- <command> [arguments]
//
// - Every run gets its size, --no-env (none of the account's stored secrets) and a timeout.
// - --push sends a copy made here, never the folder itself: the files git tracks, with their
//   uncommitted edits, and no untracked file. Gitleaks reads the copy first; a finding, or a
//   scan with no result, stops the run. The copy is removed afterwards.
// - --push needs the repository on the upload list, a file on this PC outside every
//   repository: the script cannot tell code from customer data, so a repository is listed
//   once, on purpose, and only when it tracks none.
// - The sandbox is always deleted when the command ends: a kept one would run on outside
//   these limits.
// - Nothing starts while the plan cannot be read, while something could bill past it, or
//   past the limits. "BOAT-RUN: not started: <why>" and exit 2; otherwise the exit code is
//   the command's own.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The owner's allowance, 16 November 2026: Claude sizes each job, inside these.
export const LIMITS = {
  active: 10, // sandboxes at once
  runSeconds: 3600, // of the plan's time for one run: the timeout times the size's rate
  reserve: 0.2, // of the month's time, kept back for the daily vetting step
};
// What a second of each size takes from the plan's time.
export const RATE = { small: 0.5, default: 1, large: 2 };

const oneLine = (text) => String(text).replace(/[^\x20-\x7e]+/g, " ").trim().slice(0, 300);

export function parseArgs(argv) {
  const out = { type: "small", timeout: null, push: null, command: [] };
  const cut = argv.indexOf("--");
  const own = cut < 0 ? argv : argv.slice(0, cut);
  out.command = cut < 0 ? [] : argv.slice(cut + 1);
  for (let i = 0; i < own.length; i += 1) {
    const a = own[i];
    const value = () => (i + 1 < own.length ? own[(i += 1)] : null);
    if (a === "--type") {
      out.type = value();
      if (!Object.hasOwn(RATE, out.type ?? "")) return { error: "--type is small, default or large" };
    } else if (a === "--timeout") {
      const v = value();
      if (v === null || !/^[1-9][0-9]{0,6}$/.test(v)) return { error: "--timeout takes whole seconds, 1 or more" };
      out.timeout = Number(v);
    } else if (a === "--push") {
      out.push = value();
      if (!out.push) return { error: "--push takes a folder" };
    } else return { error: `${oneLine(a)} is not an option of boat-run: size, timeout and upload are the only ones` };
  }
  if (out.timeout === null) return { error: "--timeout <seconds> is required" };
  if (out.command.length === 0) return { error: "a command is required after --" };
  return out;
}

const count = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;

// null when the run may start, else the reason it may not. `plan` is `boat limits --json`.
export function gate(run, plan) {
  const p = plan;
  if (!p || typeof p !== "object" || !count(p.activeSandboxes) || !count(p.subscriptionQuotaSeconds) || !count(p.subscriptionRemainingSeconds)
    || typeof p.keepGoing?.enabled !== "boolean" || !count(p.wallet?.balanceDollars)) {
    return "no result (the plan could not be read from boat limits)";
  }
  if (p.canStart === false) return "boat says this account cannot start a sandbox now";
  if (p.keepGoing.enabled) return "extra starts are on, so a start could bill past the plan: the owner turns them off or says yes";
  if (p.wallet.balanceDollars > 0) return "the wallet holds money, so use past the plan would spend it: the owner's yes first";
  const cost = run.timeout * RATE[run.type];
  if (cost > LIMITS.runSeconds) {
    return `one run takes at most ${LIMITS.runSeconds} seconds of the plan's time (${run.type}: a timeout of ${Math.floor(LIMITS.runSeconds / RATE[run.type])}); more needs the owner's yes`;
  }
  if (p.activeSandboxes >= LIMITS.active) return `${LIMITS.active} sandboxes are running already; more at once needs the owner's yes`;
  if (p.subscriptionRemainingSeconds - cost < p.subscriptionQuotaSeconds * LIMITS.reserve) {
    return `a fifth of the month's time is kept back for the vetting step, and this run would go into it; the owner's yes first`;
  }
  return null;
}

export function boatArgv(run, stagedDir) {
  return ["run", "--type", run.type, "--no-env", "--timeout", String(run.timeout), ...(stagedDir ? ["--push", stagedDir] : []), "--", ...run.command];
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

// A copy of the folder's tracked files in a new temporary folder: { dir, tmp, remove }.
// `git stash create` writes a commit of the tracked files as they are now and changes
// nothing in the working folder; with no edits it prints nothing and HEAD is used.
export function stage(folder) {
  const from = resolve(folder);
  const git = (...a) => spawnSync("git", ["-C", from, "-c", "user.name=boat-run", "-c", "user.email=boat-run@localhost", ...a], { encoding: "utf8" });
  if (git("rev-parse", "--show-toplevel").status !== 0) throw new Error("the folder to upload is not in a git repository: only tracked files are uploaded");
  if (git("rev-parse", "--verify", "-q", "HEAD^{commit}").status !== 0) throw new Error("the repository has no commit yet: commit first, only tracked files are uploaded");
  const stash = git("stash", "create");
  if (stash.status !== 0) throw new Error("git could not read the tracked files (stash create failed)");
  const tree = /^[0-9a-f]{40,64}$/.test(stash.stdout.trim()) ? stash.stdout.trim() : "HEAD";
  const tmp = mkdtempSync(join(tmpdir(), "boat-run-"));
  const remove = () => rmSync(tmp, { recursive: true, force: true });
  try {
    const dir = join(tmp, basename(from));
    mkdirSync(dir);
    if (git("archive", "--format=tar", "-o", join(tmp, "src.tar"), tree).status !== 0) throw new Error("git archive failed");
    // A relative path and the folder as working directory: no drive letter for tar to misread.
    if (spawnSync("tar", ["-xf", "../src.tar"], { cwd: dir, encoding: "utf8" }).status !== 0) throw new Error("tar could not unpack the copy");
    rmSync(join(tmp, "src.tar"), { force: true });
    const link = links(dir);
    if (link) throw new Error(`the upload holds a symbolic link (${oneLine(link)}), which could lead outside the copy`);
    return { dir, tmp, remove };
  } catch (e) {
    remove();
    throw e;
  }
}

// Gitleaks on the copy, with its default rules: no ignore file of the repository's own, and
// a "gitleaks:allow" comment in a file does not quiet it.
export function scan(dir, tmp) {
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
// first and counts the others after: two that arrive together at the last place may both be
// refused, and never both pass. Names are never reused, so clearing a dead run's file
// cannot remove a live one's.
export function takeSlot(dir, { pid = process.pid, alive = isAlive, max = LIMITS.active, token = randomUUID() } = {}) {
  mkdirSync(dir, { recursive: true });
  const mine = `run-${pid}-${token}`;
  writeFileSync(join(dir, mine), "", { flag: "wx" });
  let others = 0;
  for (const name of readdirSync(dir)) {
    const holder = /^run-([1-9][0-9]*)-/.exec(name);
    if (!holder || name === mine) continue;
    if (alive(Number(holder[1]))) others += 1;
    else rmSync(join(dir, name), { force: true });
  }
  const release = () => rmSync(join(dir, mine), { force: true });
  if (others >= max) {
    release();
    return null;
  }
  return { file: join(dir, mine), release };
}

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

// One repository on a line; "#" starts a comment. A whole line must match: no patterns.
export function onList(key, listText) {
  if (!key) return false;
  return String(listText).split(/\r?\n/).map((l) => normalKey(l.replace(/#.*$/, ""))).some((l) => l !== "" && l === key);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

// On the owner's PC the key comes from the encrypted store for this one process; elsewhere
// `boat` is on the path.
function boat(argv, options) {
  const key = join(homedir(), ".local", "bin", "with-key.mjs");
  const exe = join(homedir(), ".local", "share", "boat", "boat.exe");
  const local = process.platform === "win32" && existsSync(key) && existsSync(exe);
  const env = { ...process.env, BOAT_NO_UPDATE: "1" };
  return local ? spawnSync(process.execPath, [key, "boat", "BOAT_API_KEY", exe, ...argv], { ...options, env }) : spawnSync("boat", argv, { ...options, env });
}

const STATE = process.env.BOAT_RUN_STATE || join(homedir(), ".local", "share", "boat-run");
const UPLOAD_LIST = join(STATE, "upload-allowed.txt");

const REAL = {
  limits: () => {
    const r = boat(["limits", "--json"], { encoding: "utf8" });
    if (r.error || r.status !== 0) throw new Error(`boat limits ${r.error ? "did not run" : `exit ${r.status}`}`);
    return JSON.parse(r.stdout);
  },
  slot: () => takeSlot(join(STATE, "slots")),
  permit: (folder) => {
    const key = repoKey(folder);
    let list = "";
    try {
      list = readFileSync(UPLOAD_LIST, "utf8");
    } catch { /* no list yet: nothing is allowed */ }
    return { ok: onList(key, list), key, list: UPLOAD_LIST };
  },
  stage,
  scan,
  boat: (argv) => {
    const r = boat(argv, { stdio: "inherit" });
    if (r.error) throw new Error("boat did not run");
    return r.status ?? 1;
  },
  say: (line) => console.error(line),
};

export function main(argv, deps = REAL) {
  const stop = (why) => {
    deps.say(`BOAT-RUN: not started: ${why}`);
    return 2;
  };
  const run = parseArgs(argv);
  if (run.error) return stop(run.error);
  let plan;
  try {
    plan = deps.limits();
  } catch (e) {
    return stop(`no result (${oneLine(e?.message)})`);
  }
  const refusal = gate(run, plan);
  if (refusal) return stop(refusal);
  const slot = deps.slot();
  if (!slot) return stop(`${LIMITS.active} runs from this PC are under way; more at once needs the owner's yes`);
  let staged = null;
  try {
    if (run.push !== null) {
      const permit = deps.permit(run.push);
      if (!permit.ok) {
        return stop(`${permit.key ? oneLine(permit.key) : "this folder"} is not on the upload list (${oneLine(permit.list)}): a repository is listed once, when it tracks code and no customer data; one that tracks customer data needs the owner's yes`);
      }
      staged = deps.stage(run.push);
      const result = deps.scan(staged.dir, staged.tmp);
      if (!result.ok) return stop(`the secret scan of the upload: ${result.reason}`);
    }
    return deps.boat(boatArgv(run, staged ? staged.dir : null));
  } catch (e) {
    return stop(oneLine(e?.message));
  } finally {
    if (staged) staged.remove();
    slot.release();
  }
}

// realpath on both sides, so a run through a junction or symlink still starts.
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
