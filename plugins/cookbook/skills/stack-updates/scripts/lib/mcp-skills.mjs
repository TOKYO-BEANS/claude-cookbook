// Does a hosted MCP server serve skills (the Skills over MCP extension)? For the daily
// update check. `node mcp-skills.mjs <url>` sends `initialize` and then `skills/list`
// with no key: a server that answers both without signing in (Firecrawl and Parallel,
// 25 November 2026) costs nothing. It prints "skills: <n>" to stdout, 0 when the server
// answers "Method not found" (-32601); anything else is a short reason on stderr and
// exit 1. It prints nothing the server returns beyond that count.
import { pathToFileURL } from "node:url";

const VERSION = "2025-11-25";
const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": VERSION };

// The JSON-RPC message of a plain JSON or an event-stream body, or null.
export function message(text) {
  const t = String(text ?? "");
  const data = t.match(/^data: ?(.*)$/m);
  try {
    return JSON.parse(data ? data[1] : t);
  } catch {
    return null;
  }
}

// The number of skills a `skills/list` answer holds: 0 for "Method not found", null when
// the answer is neither a list nor that error.
export function skillCount(msg) {
  if (msg?.error?.code === -32601) return 0;
  const skills = msg?.result?.skills;
  return Array.isArray(skills) ? skills.length : null;
}

async function post(url, body, session) {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...HEADERS, ...(session ? { "mcp-session-id": session } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, session: res.headers.get("mcp-session-id"), msg: message(await res.text()) };
}

async function main(url) {
  if (!/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9/_-]*$/.test(url ?? "")) throw new Error("usage: mcp-skills.mjs <https url>");
  const init = await post(url, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: VERSION, capabilities: {}, clientInfo: { name: "stack-updates", version: "1" } } });
  if (init.status !== 200 || !init.msg?.result) throw new Error(`initialize: HTTP ${init.status}`);
  if (init.session) await post(url, { jsonrpc: "2.0", method: "notifications/initialized" }, init.session);
  const list = await post(url, { jsonrpc: "2.0", id: 2, method: "skills/list", params: {} }, init.session);
  const n = skillCount(list.msg);
  if (list.status !== 200 || n === null) throw new Error(`skills/list: HTTP ${list.status}, no list`);
  console.log(`skills: ${n}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((e) => {
    console.error(String(e?.message ?? e).replace(/[^\x20-\x7e]/g, "").slice(0, 120) || "no answer");
    process.exit(1);
  });
}
