// Count MCP tool calls, Skill tool calls and slash commands in Claude Code
// transcripts over the last N days. Each tool_use id and each user message
// uuid counts once. Prints only names and counts.
// Usage: node usage-census.mjs <projects-root> [days]
import { createReadStream, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".jsonl")) yield p;
  }
}

const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const textOf = (content) =>
  typeof content === "string" ? content
    : Array.isArray(content) ? content.map((b) => (typeof b?.text === "string" ? b.text : "")).join("\n")
    : "";

export async function census({ root, days = 30, now = Date.now() }) {
  const since = now - days * 86400000;
  const seen = new Set();
  const seenMessages = new Set();
  const servers = new Map(); // server -> {calls, tools:Map, last, projects:Set}
  const skills = new Map(); // skill name -> Skill tool calls
  const slash = new Map(); // command name -> user messages
  let files = 0;
  let lines = 0;

  for (const f of walk(root)) {
    if (statSync(f).mtimeMs < since) continue;
    files++;
    const project = f.slice(root.length + 1).split(/[\\/]/)[0];
    const rl = createInterface({ input: createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) {
      lines++;
      const isCall = line.includes('"tool_use"') && (line.includes("mcp__") || line.includes('"Skill"'));
      const isSlash = line.includes("<command-name>");
      if (!isCall && !isSlash) continue;
      let o;
      try { o = JSON.parse(line); } catch { continue; }
      const ts = Date.parse(o.timestamp || "");
      if (!(ts >= since)) continue;
      if (isSlash && o.type === "user" && !seenMessages.has(o.uuid)) {
        seenMessages.add(o.uuid);
        for (const [, name] of textOf(o.message?.content).matchAll(/<command-name>\/?([^<]+)<\/command-name>/g))
          bump(slash, name.trim());
      }
      const content = o.message?.content;
      if (!isCall || !Array.isArray(content)) continue;
      for (const b of content) {
        if (b?.type !== "tool_use" || typeof b.name !== "string" || seen.has(b.id)) continue;
        if (b.name === "Skill") {
          seen.add(b.id);
          const name = String(b.input?.skill ?? "").replace(/^\//, "").trim();
          if (name) bump(skills, name);
          continue;
        }
        const m = b.name.match(/^mcp__(.+?)__(.+)$/);
        if (!m) continue;
        seen.add(b.id);
        const s = servers.get(m[1]) || { calls: 0, tools: new Map(), last: 0, projects: new Set() };
        s.calls++;
        bump(s.tools, m[2]);
        if (ts > s.last) s.last = ts;
        s.projects.add(project);
        servers.set(m[1], s);
      }
    }
  }
  return { files, lines, servers, skills, slash };
}

export function report({ files, lines, servers, skills, slash }, days) {
  const out = [];
  out.push(`MCP tool calls, last ${days} days, from ${files} transcript files (${lines} lines); each tool_use id once.`);
  out.push(`Generated ${new Date().toISOString()}. Tool names and counts only.\n`);
  for (const [srv, s] of [...servers].sort((a, b) => b[1].calls - a[1].calls)) {
    const top = [...s.tools].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => `${t} ${n}`).join(", ");
    out.push(`${srv}: ${s.calls} calls, ${s.tools.size} tools, ${s.projects.size} project folders, last ${new Date(s.last).toISOString().slice(0, 10)} | ${top}`);
  }
  const byCount = (m) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  out.push(`\nSkill tool calls by skill (each tool_use id once): ${skills.size} skills`);
  for (const [name, n] of byCount(skills)) out.push(`Skill ${name} ${n}`);
  out.push(`\nSlash commands in user messages (each message uuid once; built-in commands included): ${slash.size} names`);
  for (const [name, n] of byCount(slash)) out.push(`Slash ${name} ${n}`);
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const days = Number(process.argv[3] || 30);
  console.log(report(await census({ root: process.argv[2], days }), days));
}
