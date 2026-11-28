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
