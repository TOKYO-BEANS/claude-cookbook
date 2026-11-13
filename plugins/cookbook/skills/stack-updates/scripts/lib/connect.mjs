// The connection checks and date warnings of the daily update check.
//
// `runChecks` makes one real call per service from the fixed table
// CONNECTION_CHECKS (free and read-only, plus one tiny paid Parallel search),
// one after another with a 30-second timeout each, and runs `claude mcp list`
// once for every hosted part that names a server. Jev gets no call: the newest
// line of the router's decision log is read instead. The result keeps no account
// detail: service names, and for a failure an error of at most 200 characters
// with anything key-shaped removed. A service with no check is "unchecked",
// never working. The script holds no key: tools that need one run through their
// DPAPI shims in ~/.local/bin.
import { open } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRun, expandTokens } from "./inventory.mjs";
import { CONNECTION_CHECKS } from "./tables.mjs";

export const CHECK_TIMEOUT_MS = 30_000;
const OUTPUT_LIMIT = 100_000; // `boat limits` alone prints about 6 KB of JSON
const ERROR_LIMIT = 200;
const LIB = dirname(fileURLToPath(import.meta.url));

// The Jev router's decision log, relative to the home folder. Its newest line's
// `ts` is the proof Jev answered.
export const JEV_LOG = join(".claude", "vendor", "compaction", "state", "jev-turn-router-decisions.jsonl");
export const JEV_TOOL_ID = "jev";
const JEV_MAX_AGE_MS = 48 * 3_600_000;
const JEV_LOG_LINES = 200;
const JEV_LOG_BYTES = 262_144;
// The outcomes of the log that record an answer from Jev. Seen on 13 November 2026:
// "routed" (Jev answered; reasons jev, low-confidence-no-downgrade and
// downgrade-not-worth-cache-rebuild) and "skipped" (no call: not-a-prompt,
// not-opus, headless). The log has shown no error or timeout outcome; anything
// not listed here is not an answer.
export const JEV_ANSWER_OUTCOMES = Object.freeze(["routed"]);

// ---- error text ------------------------------------------------------------

// Removes anything a key or a token could hide in before the text is cut, so half
// a token cannot survive the cut: whole Authorization lines, `Bearer <value>`,
// `key=`, `token=`, `secret=` and `password=` values of 20 or more characters
// (also as JSON), and any run of 40 or more key characters.
export function scrub(text) {
  return String(text ?? "")
    .slice(0, 4_000)
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/[[0-9;]*m/g, "")
    .replace(/^.*authorization.*$/gim, "[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, "Bearer [redacted]")
    .replace(/\b(api[_-]?key|key|token|secret|password|passwd)(["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]{20,}/gi, "$1$2[redacted]")
    .replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
}
const clip = (text) => scrub(text).slice(0, ERROR_LIMIT);
const cause = (e) => String(e?.message ?? e);

// ---- one table check -------------------------------------------------------

async function runOne(entry, { run, home }) {
  let res;
  try {
    res = await run(expandTokens(entry.argv, home, LIB), { timeoutMs: CHECK_TIMEOUT_MS, maxBytes: OUTPUT_LIMIT, home });
  } catch (e) {
    return { error: clip(cause(e)) || "the command could not run" };
  }
  if (res?.timedOut) return { error: `timed out after ${CHECK_TIMEOUT_MS / 1000} s` };
  // A cut stops the process, which leaves no exit code: a matched line still proves the answer.
  if (res?.code !== 0 && !res?.truncated) return { error: clip(res?.stderr) || `exit ${res?.code ?? "unknown"}, no error text` };
  if (!entry.ok.test(String(res?.stdout ?? ""))) return { error: "the output did not show the account answering" };
  return {};
}

// ---- claude mcp list -------------------------------------------------------

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, "-");

function parseMcpList(text) {
  const out = [];
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    const colon = line.indexOf(": ");
    const dash = line.lastIndexOf(" - ");
    if (colon > 0 && dash > colon) out.push({ name: line.slice(0, colon), status: line.slice(dash + 3).trim() });
  }
  return out;
}

// `plugin:<plugin>:<server>`, `claude.ai <Connector>` or a plain server name.
function matches(entry, server, toolName) {
  const want = norm(server);
  if (norm(entry.name) === want || norm(entry.name.split(":").pop()) === want) return true;
  const connector = /^claude\.ai (.+)$/.exec(entry.name);
  if (!connector) return false;
  const c = norm(connector[1]);
  return c === want || norm(toolName) === c || norm(toolName).startsWith(`${c}-`);
}
const isConnected = (status) => /\bConnected\s*$/i.test(status) && !/failed|needs auth/i.test(status);

const serversOf = (tool) => (Array.isArray(tool.parts) ? tool.parts : [])
  .filter((p) => p?.installed?.kind === "hosted" && typeof p.installed.server === "string" && p.installed.server)
  .map((p) => p.installed.server);

// A skill, a local CLI or a plugin with no hosted part has no connection to check.
const hasHostedPart = (tool) => (Array.isArray(tool.parts) ? tool.parts : []).some((p) => p?.installed?.kind === "hosted");

// ---- Jev -------------------------------------------------------------------

// The newest real answer in the last 200 lines of the log (a bounded read from the
// end of the file) must be within 48 hours of now. Lines that do not parse are ignored.
async function jevAnswered(home, now) {
  let fh;
  try {
    fh = await open(join(home, JEV_LOG), "r");
    const { size } = await fh.stat();
    const length = Math.min(size, JEV_LOG_BYTES);
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, size - length);
    const lines = buf.toString("utf8").split("\n").map((l) => l.trim()).filter(Boolean).slice(-JEV_LOG_LINES);
    for (const line of lines.reverse()) {
      let o;
      try { o = JSON.parse(line); } catch { continue; }
      if (!JEV_ANSWER_OUTCOMES.includes(o?.outcome)) continue;
      const at = Date.parse(o.ts);
      if (!Number.isFinite(at)) continue;
      return now - at <= JEV_MAX_AGE_MS;
    }
    return false;
  } catch {
    return false;
  } finally {
    await fh?.close().catch(() => {});
  }
}

// ---- runChecks -------------------------------------------------------------

// `-> { broken: { service, error }[], unchecked: string[], working: string[] }`.
// `checks` is injectable for tests; the real run uses CONNECTION_CHECKS.
export async function runChecks(catalog, { run = defaultRun, home, now = new Date(), checks = CONNECTION_CHECKS } = {}) {
  const at = new Date(now).getTime();
  const tools = (Array.isArray(catalog?.tools) ? catalog.tools : []).filter((t) => t?.lifecycle === "active" || t?.lifecycle === "trial");
  const broken = [], unchecked = [], working = [];

  let mcp = null;
  if (tools.some((t) => serversOf(t).length)) {
    let res;
    try {
      res = await run(["claude", "mcp", "list"], { timeoutMs: CHECK_TIMEOUT_MS, maxBytes: OUTPUT_LIMIT, home });
    } catch (e) {
      res = { code: -1, stdout: "", stderr: cause(e) };
    }
    if (res?.timedOut) mcp = { error: `timed out after ${CHECK_TIMEOUT_MS / 1000} s` };
    else if (res?.code !== 0 && !res?.truncated) mcp = { error: clip(res?.stderr) || `exit ${res?.code ?? "unknown"}, no error text` };
    else mcp = { entries: parseMcpList(res?.stdout) };
    if (mcp.error) broken.push({ service: "claude mcp list", error: mcp.error });
  }

  for (const tool of tools) {
    const errors = [];
    let proved = false;
    const entry = Object.hasOwn(checks, tool.id) ? checks[tool.id] : undefined;
    if (entry) {
      proved = true;
      const r = await runOne(entry, { run, home });
      if (r.error) errors.push(r.error);
    }
    if (tool.id === JEV_TOOL_ID) {
      if (await jevAnswered(home, at)) proved = true;
      else { unchecked.push(tool.name); continue; }
    }
    const servers = serversOf(tool);
    if (servers.length) {
      if (mcp?.error) { if (!errors.length) unchecked.push(tool.name); else broken.push({ service: tool.name, error: clip(errors.join("; ")) }); continue; }
      proved = true;
      for (const server of servers) {
        const found = (mcp?.entries ?? []).filter((e) => matches(e, server, tool.name));
        if (!found.length) errors.push(`${server}: not listed by claude mcp list`);
        else if (!found.some((e) => isConnected(e.status))) errors.push(`${server}: ${found[0].status}`);
      }
    }
    if (errors.length) broken.push({ service: tool.name, error: clip(errors.join("; ")) });
    else if (proved) working.push(tool.name);
    else if (hasHostedPart(tool)) unchecked.push(tool.name);
  }
  return { broken, unchecked, working };
}

// ---- dates -----------------------------------------------------------------

const dayNumber = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

// The dated facts to warn about today: exactly 14, 7 or 3 days ahead, and every
// day from 2 days ahead through the date itself. `today` is YYYY-MM-DD.
// `-> { label, on, days }[]`, soonest first.
export function dueDates(catalog, today) {
  const out = [];
  for (const tool of Array.isArray(catalog?.tools) ? catalog.tools : []) {
    for (const d of Array.isArray(tool?.dates) ? tool.dates : []) {
      const days = dayNumber(d.on) - dayNumber(today);
      if (days === 14 || days === 7 || days === 3 || (days >= 0 && days <= 2)) out.push({ label: d.label, on: d.on, days });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}
