#!/usr/bin/env node
// Ends the Claude process of a T3 chat that has sat idle (owner, 28 November 2026; the Cookbook,
// recipes/sandboxes-boat-chat.md). T3 keeps each chat's `claude` process, about 300 MB, until
// T3 itself stops, so chats finished hours ago held gigabytes. T3 starts the process again with
// `--resume` at the chat's next message, so the chat keeps its history.
//
//   node idle-chats.mjs [--dry-run] [--idle <minutes>] [--thread <chat id>]   (a user timer runs it every 10 minutes)
//
// A process is ended (SIGTERM) only when all of these hold:
// - it is `claude` started by T3 for a chat (`T3CODE_THREAD_ID` in its environment);
// - T3's state (read-only) shows no run of that chat queued, starting, running or waiting,
//   and its last run ended at least --idle minutes ago (30 by default);
// - it has no Bash shell alive under it (a tool call or a background command or monitor);
// - a second look just before the kill finds that chat's runs and its shell state unchanged
//   (a run that starts between the first look and the kill keeps the process).
// Anything it cannot read counts as busy: it keeps the process. Each process it ends is one line
// in ~/.local/share/claude-cookbook/idle-chats/log.jsonl (time, pid, chat id, minutes idle, MB).
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

export const IDLE_MINUTES = 30;
// Run states that end a run; any other state (queued, starting, running, waiting...) is busy.
const DONE = new Set(["completed", "interrupted", "failed", "cancelled", "rolled_back"]);
const SHELL = /shell-snapshots\/snapshot-/;

// Pure: which processes to end. procs: [{ pid, thread, shell }]; runs: [{ thread, status,
// requestedAt, completedAt }] (ISO strings). Returns { end: [{ pid, thread, idleMin }], keep: [{ pid, why }] }.
export function pickIdle({ procs, runs, nowMs, idleMinutes = IDLE_MINUTES }) {
  const byThread = new Map();
  for (const r of runs) {
    const t = byThread.get(r.thread) ?? { busy: false, last: null };
    if (!DONE.has(r.status)) t.busy = true;
    const at = Date.parse(r.completedAt ?? r.requestedAt ?? "");
    if (Number.isFinite(at) && (t.last === null || at > t.last)) t.last = at;
    byThread.set(r.thread, t);
  }
  const end = [], keep = [];
  for (const p of procs) {
    const t = byThread.get(p.thread);
    if (!p.thread) keep.push({ pid: p.pid, why: "no chat" });
    else if (p.shell) keep.push({ pid: p.pid, why: "a shell runs under it" });
    else if (!t) keep.push({ pid: p.pid, why: "no runs read" });
    else if (t.busy) keep.push({ pid: p.pid, why: "a run is not finished" });
    else if (t.last === null) keep.push({ pid: p.pid, why: "no run time" });
    else {
      const idleMin = Math.floor((nowMs - t.last) / 60000);
      if (idleMin < idleMinutes) keep.push({ pid: p.pid, why: `idle ${idleMin} min` });
      else end.push({ pid: p.pid, thread: p.thread, idleMin });
    }
  }
  return { end, keep };
}

const read = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
};
const argvOf = (pid, proc = "/proc") => (read(`${proc}/${pid}/cmdline`)?.toString("utf8") ?? "").split("\0").filter(Boolean);

// The T3 chat processes on this machine: { pid, thread, shell, mb }.
export function chatProcesses(proc = "/proc") {
  const pids = readdirSync(proc)
    .filter((n) => /^\d+$/.test(n))
    .sort((a, b) => a - b);
  const parent = new Map();
  for (const pid of pids) {
    const stat = read(`${proc}/${pid}/stat`)?.toString("utf8") ?? "";
    const m = /\)\s+\S+\s+(\d+)/.exec(stat);
    if (m) parent.set(pid, m[1]);
  }
  const shells = new Set();
  for (const pid of pids) {
    if (SHELL.test(argvOf(pid, proc).join(" "))) {
      for (let p = parent.get(pid), hops = 0; p && hops < 6; p = parent.get(p), hops++) shells.add(p);
    }
  }
  const out = [];
  for (const pid of pids) {
    const argv = argvOf(pid, proc);
    if (basename(argv[0] ?? "") !== "claude" || !argv.includes("stream-json")) continue;
    const env = read(`${proc}/${pid}/environ`)?.toString("utf8").split("\0") ?? [];
    const thread = env.find((e) => e.startsWith("T3CODE_THREAD_ID="))?.slice("T3CODE_THREAD_ID=".length) || null;
    const rss = /VmRSS:\s+(\d+)/.exec(read(`${proc}/${pid}/status`)?.toString("utf8") ?? "");
    out.push({ pid: Number(pid), thread, shell: shells.has(pid), mb: rss ? Math.round(Number(rss[1]) / 1024) : null });
  }
  return out;
}

// T3's runs for these chats, read-only. Throws when the state cannot be read.
export async function chatRuns(threads, db = join(homedir(), ".t3", "userdata", "statev2.sqlite")) {
  if (!threads.length) return [];
  const { DatabaseSync } = await import("node:sqlite");
  const conn = new DatabaseSync(db, { readOnly: true });
  try {
    const q = conn.prepare(`SELECT thread_id, status, requested_at, completed_at FROM orchestration_v2_projection_runs WHERE thread_id IN (${threads.map(() => "?").join(",")})`);
    return q.all(...threads).map((r) => ({ thread: r.thread_id, status: r.status, requestedAt: r.requested_at, completedAt: r.completed_at }));
  } finally {
    conn.close();
  }
}

const sameRuns = (a, b) => {
  const key = (runs) => runs.map((r) => JSON.stringify([r.status, r.requestedAt, r.completedAt])).sort().join("\n");
  return key(a) === key(b);
};

// The second look, just before a kill: the same chat process, still no shell under it, and the
// chat's runs exactly as the first look read them. Returns null when the kill may go ahead, else why not.
export async function changedSince({ pid, thread }, runsBefore, { proc = "/proc", db } = {}) {
  const now = chatProcesses(proc).find((p) => p.pid === pid);
  if (!now || now.thread !== thread) return "the process is gone or not that chat";
  if (now.shell) return "a shell runs under it now";
  let runs;
  try {
    runs = await chatRuns([thread], db);
  } catch (e) {
    return `T3's state could not be read again (${e?.code ?? "error"})`;
  }
  return sameRuns(runs, runsBefore) ? null : "its runs changed";
}

// opts are for the tests only: a stand-in /proc and T3 state, the clock, the kill and the log folder.
export async function main(args, opts = {}) {
  const { proc = "/proc", db, nowMs = Date.now(), kill = (pid, sig) => process.kill(pid, sig), logDir = join(homedir(), ".local", "share", "claude-cookbook", "idle-chats"), log = console.log, warn = console.error } = opts;
  const dry = args.includes("--dry-run");
  const i = args.indexOf("--idle");
  const idleMinutes = i >= 0 ? Number(args[i + 1]) : IDLE_MINUTES;
  if (!Number.isFinite(idleMinutes) || idleMinutes < 1) {
    warn("usage: idle-chats.mjs [--dry-run] [--idle <minutes, 1 or more>] [--thread <chat id>]");
    return 2;
  }
  const t = args.indexOf("--thread");
  const only = t >= 0 ? args[t + 1] : null;
  const procs = chatProcesses(proc).filter((p) => !only || p.thread === only);
  let runs;
  try {
    runs = await chatRuns([...new Set(procs.map((p) => p.thread).filter(Boolean))], db);
  } catch (e) {
    warn(`idle-chats: T3's state could not be read (${e?.code ?? "error"}); nothing ended`);
    return 0;
  }
  const { end, keep } = pickIdle({ procs, runs, nowMs, idleMinutes });
  for (const k of keep) log(`keep ${k.pid}: ${k.why}`);
  for (const e of end) {
    const mb = procs.find((p) => p.pid === e.pid)?.mb ?? null;
    if (dry) {
      log(`would end ${e.pid}: chat ${e.thread}, idle ${e.idleMin} min, ${mb ?? "?"} MB`);
      continue;
    }
    const why = await changedSince(e, runs.filter((r) => r.thread === e.thread), { proc, db });
    if (why) {
      log(`keep ${e.pid}: ${why}`);
      continue;
    }
    log(`end ${e.pid}: chat ${e.thread}, idle ${e.idleMin} min, ${mb ?? "?"} MB`);
    try {
      kill(e.pid, "SIGTERM");
      mkdirSync(logDir, { recursive: true });
      appendFileSync(join(logDir, "log.jsonl"), `${JSON.stringify({ at: new Date(nowMs).toISOString(), pid: e.pid, thread: e.thread, idleMin: e.idleMin, mb })}\n`);
    } catch (err) {
      warn(`idle-chats: ${e.pid} not ended (${err?.code ?? "error"})`);
    }
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main(process.argv.slice(2));
