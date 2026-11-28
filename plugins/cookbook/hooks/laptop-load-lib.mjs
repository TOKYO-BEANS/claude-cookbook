// How close this laptop is to running short (recipes/sandboxes-boat-chat.md). Read from
// Linux's own counters: /proc/meminfo, /proc/pressure/{memory,cpu} and /proc/loadavg. A chat
// that fits boat starts there once any limit below is reached, before the laptop throttles
// (owner, 27 November 2026). A local chat takes 0.3 to 4 GB with its children, so the
// memory line leaves room for one more. Pure functions, and one reader that never throws:
// a counter it cannot read counts as no reading, never as near.
import { readFileSync } from "node:fs";
import { cpus } from "node:os";

export const LIMITS = Object.freeze({
  availPct: 25, // memory available under this share of RAM
  memPressure: 5, // /proc/pressure/memory "some" avg60 at or over this
  cpuPressure: 30, // /proc/pressure/cpu "some" avg60 at or over this
  loadPerCpu: 1, // the one-minute load average per CPU at or over this
  swapUsedPct: 90, // swap this full counts only together with ...
  swapAvailPct: 35, // ... memory available under this share of RAM
});

// "MemTotal: 14626388 kB" lines → { MemTotal: 14626388, ... } in kB.
export function parseMeminfo(text) {
  const out = {};
  for (const line of String(text ?? "").split("\n")) {
    const m = /^(\w+):\s+(\d+)/.exec(line);
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

// The "some avg60" of a /proc/pressure file, or null.
export function parsePressure(text) {
  const m = /^some\b.*?\bavg60=(\d+(?:\.\d+)?)/m.exec(String(text ?? ""));
  return m ? Number(m[1]) : null;
}

export function parseLoad1(text) {
  const v = Number.parseFloat(String(text ?? "").trim().split(/\s+/)[0]);
  return Number.isFinite(v) ? v : null;
}

const round = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

// { near, reasons, numbers } from the raw texts. `reasons` are fixed phrases holding numbers
// only, safe to show a model.
export function judgeLoad({ meminfo = "", memPsi = "", cpuPsi = "", loadavg = "", cpuCount = 0 } = {}, limits = LIMITS) {
  const m = parseMeminfo(meminfo);
  const hasMem = m.MemTotal > 0 && m.MemAvailable >= 0;
  const availPct = hasMem ? round((m.MemAvailable / m.MemTotal) * 100, 1) : null;
  const availGB = hasMem ? round(m.MemAvailable / 1048576, 1) : null;
  const swapUsedPct = m.SwapTotal > 0 && m.SwapFree >= 0 ? round(((m.SwapTotal - m.SwapFree) / m.SwapTotal) * 100, 1) : null;
  const memPressure = parsePressure(memPsi), cpuPressure = parsePressure(cpuPsi);
  const load1 = parseLoad1(loadavg);
  const loadPerCpu = load1 !== null && cpuCount > 0 ? round(load1 / cpuCount, 2) : null;
  const reasons = [];
  if (availPct !== null && availPct < limits.availPct) reasons.push(`memory available ${availPct}% (${availGB} GB), under ${limits.availPct}%`);
  else if (availPct !== null && swapUsedPct !== null && swapUsedPct >= limits.swapUsedPct && availPct < limits.swapAvailPct)
    reasons.push(`swap ${swapUsedPct}% used and memory available ${availPct}%, under ${limits.swapAvailPct}%`);
  if (memPressure !== null && memPressure >= limits.memPressure) reasons.push(`memory pressure ${memPressure}% (one minute), at or over ${limits.memPressure}%`);
  if (cpuPressure !== null && cpuPressure >= limits.cpuPressure) reasons.push(`CPU pressure ${cpuPressure}% (one minute), at or over ${limits.cpuPressure}%`);
  if (loadPerCpu !== null && loadPerCpu >= limits.loadPerCpu) reasons.push(`load ${loadPerCpu} per CPU (one minute), at or over ${limits.loadPerCpu}`);
  return { near: reasons.length > 0, reasons, numbers: { availPct, availGB, swapUsedPct, memPressure, cpuPressure, loadPerCpu } };
}

// The memory reasons of a reading only: what a heavy local run (a test suite, a Semgrep
// scan) waits on in sandbox-route.mjs. CPU and load stay with the chat launch.
export const memoryReasons = (load) => (Array.isArray(load?.reasons) ? load.reasons : []).filter((r) => /^(memory|swap) /.test(r));

const readOr = (path, read) => {
  try {
    return read(path, "utf8");
  } catch {
    return "";
  }
};

// This laptop's reading now. `read` and `cpuCount` are for tests.
export function laptopLoad({ read = readFileSync, cpuCount = cpus().length, limits = LIMITS } = {}) {
  return judgeLoad({
    meminfo: readOr("/proc/meminfo", read),
    memPsi: readOr("/proc/pressure/memory", read),
    cpuPsi: readOr("/proc/pressure/cpu", read),
    loadavg: readOr("/proc/loadavg", read),
    cpuCount,
  }, limits);
}

// The note a chat hears at an owner's message while this laptop nears a limit (owner,
// 28 November 2026: a chat the owner starts, and a running chat, move off the laptop when they
// fit; boat for anything the owner may be asked about, a cloud session only for a job that
// needs no input). `reasons` are judgeLoad's fixed phrases; `script` is boat-chat.mjs's path.
export const NOTE_HOLD_MS = 60 * 60 * 1000;
export function offloadNote(reasons, script) {
  return [
    `Laptop load (the Cookbook, recipes/sandboxes-boat-chat.md): ${reasons.join("; ")}.`,
    "Before working, decide whether this chat moves off the laptop:",
    "- It fits boat when its job is long, self-contained work in one of our own repositories that needs nothing of this laptop (no key store, display, desktop apps, local-only MCP servers or the owner's sign-ins). Then: commit and push the work in progress to its branch; write a brief (the owner's request word for word, what is done, the branch, what comes next, open questions); run `node " + JSON.stringify(script) + " up <repository path>`; start the chat with `t3_thread_launch`, the `environmentId` it prints and the brief; say in one line where it went, and settle this chat. It asks the owner there, in T3.",
    "- A job that needs no input from the owner at all (a long change that ends in a pull request) may go to a cloud session (`claude --cloud`) instead, once cloud is set up: the first one needs the owner's GitHub grant, asked then. Its pull request is merged from here.",
    "- Anything else stays here: say so in one line and go on.",
    "This chat hears it again in an hour at the earliest.",
  ].join("\n");
}

// Whether to say the note now: a near reading, and none said in this chat within the hold.
export function noteDue(load, lastSaidMs, nowMs, hold = NOTE_HOLD_MS) {
  if (!load?.near) return false;
  return !(Number.isFinite(lastSaidMs) && nowMs - lastSaidMs < hold);
}
