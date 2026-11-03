// Checks the dispatch profiles: plugins/cookbook/agents/*.md, the connector register and the
// tables in dispatch-profiles.md agree. No dependencies: `npm test` runs it.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIELDS = ["name", "description", "tools", "disallowedTools", "model", "effort", "maxTurns"];
// The built-in tools a background subagent keeps (docs/en/sub-agents, "Available tools"). A
// profile that lists only these resolves to the same tools in the foreground and the background.
const BACKGROUND = ["Read", "Grep", "Glob", "LSP", "Bash", "PowerShell", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "TodoWrite", "Skill", "ToolSearch", "EnterWorktree", "ExitWorktree", "Monitor", "TaskStop", "SendMessage", "Artifact"];
const MODELS = ["haiku", "sonnet", "opus"];
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const MODES = ["default", "acceptEdits", "plan", "auto", "bypassPermissions", "inherit"];
const SIDE_CHATS = ["code", "design", "ops-deploy"];
const BUILT_IN = /^[A-Z][A-Za-z]+$/;
const MCP = /^mcp__([A-Za-z0-9_-]+?)__(\*|[A-Za-z0-9_-]+)$/;
const MODEL_ID = /^claude-(fable|opus|sonnet|haiku)-\d+(-\d+)*$/;

// Flat `key: value` frontmatter, which is all an agent file here uses.
function frontmatter(text) {
  const m = text.replace(/\r/g, "").match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
    else if (line.trim()) fields[`?${line.trim()}`] = "";
  }
  return fields;
}

const list = (v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const cells = (line) => line.split("|").slice(1, -1).map((c) => c.trim().replace(/`/g, ""));

// Rows of the first table under a `## heading`, without the header and divider rows.
function tableRows(text, heading) {
  const section = text.replace(/\r/g, "").split(/^## /m).find((s) => s.startsWith(heading)) ?? "";
  const lines = section.split("\n").filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|$/.test(l));
  return lines.slice(1).map(cells);
}

function registeredServers(registerText) {
  return new Set(tableRows(registerText, "Servers and connectors").map((r) => r[0]).filter(Boolean));
}

function mcpErrors(tool, servers, at) {
  const m = tool.match(MCP);
  if (!m) return [`${at}: ${tool} is not a tool name`];
  const id = m[1].startsWith("plugin_") ? m[1].slice("plugin_".length) : m[1];
  const known = [...servers].some((s) => id === s || id.endsWith(`_${s}`));
  return known ? [] : [`${at}: ${tool} names no server in connector-register.md`];
}

export function checkAgents({ files, registerText, profilesText }) {
  const errors = [];
  const servers = registeredServers(registerText);
  const subagentRows = new Map(tableRows(profilesText, "Subagent profiles").map((r) => [r[0], r]));
  for (const { name, text } of files) {
    const at = name;
    const f = frontmatter(text);
    if (!f) {
      errors.push(`${at}: no frontmatter`);
      continue;
    }
    for (const k of Object.keys(f)) if (!FIELDS.includes(k)) errors.push(`${at}: unknown field ${k.replace(/^\?/, "")}`);
    if (f.name !== name) errors.push(`${at}: name must equal the file name`);
    if (!f.description || f.description.length > 200) errors.push(`${at}: description must be one line of at most 200 characters`);
    if (!MODELS.includes(f.model)) errors.push(`${at}: model must be haiku, sonnet or opus`);
    if (!EFFORTS.includes(f.effort)) errors.push(`${at}: effort must be one of ${EFFORTS.join(", ")}`);
    if ("maxTurns" in f && !/^[1-9]\d{0,2}$/.test(f.maxTurns)) errors.push(`${at}: maxTurns must be a whole number`);
    if (!list(f.tools).length) errors.push(`${at}: tools must list what the profile may use (without it, it inherits every tool)`);
    for (const tool of [...list(f.tools), ...list(f.disallowedTools)])
      if (!BUILT_IN.test(tool)) errors.push(...mcpErrors(tool, servers, at));
    for (const tool of list(f.tools))
      if (BUILT_IN.test(tool) && !BACKGROUND.includes(tool)) errors.push(`${at}: ${tool} is dropped when the profile runs in the background`);
    if (!text.replace(/\r/g, "").replace(/^---\n[\s\S]*?\n---\n/, "").trim()) errors.push(`${at}: no instructions after the frontmatter`);
    const row = subagentRows.get(name);
    if (!row) errors.push(`${at}: no row in the subagent table of dispatch-profiles.md`);
    else {
      if (row[1] !== `cookbook:${name}`) errors.push(`${at}: the subagent table must name the agent cookbook:${name}`);
      if (row[2] !== f.model) errors.push(`${at}: the subagent table says model ${row[2]}, the file ${f.model}`);
      if (row[3] !== f.effort) errors.push(`${at}: the subagent table says effort ${row[3]}, the file ${f.effort}`);
    }
  }
  for (const name of subagentRows.keys())
    if (!files.some((f) => f.name === name)) errors.push(`subagent table: ${name} has no agent file`);
  const sideRows = tableRows(profilesText, "Side-chat profiles");
  if (SIDE_CHATS.some((p) => !sideRows.some((r) => r[0] === p)))
    errors.push("dispatch-profiles.md: the side-chat table needs code, design and ops-deploy");
  for (const [profile, model, effort, mode, worktree] of sideRows) {
    const at = `side chat ${profile}`;
    if (!MODEL_ID.test(model)) errors.push(`${at}: model must be a full model ID such as claude-sonnet-5-5`);
    if (!EFFORTS.includes(effort)) errors.push(`${at}: effort must be one of ${EFFORTS.join(", ")}`);
    if (!MODES.includes(mode)) errors.push(`${at}: permission mode must be a start_session value or inherit`);
    if (!["true", "false"].includes(worktree)) errors.push(`${at}: use_worktree must be true or false`);
  }
  return errors;
}

export function readAgents(root = new URL("../", import.meta.url)) {
  const dir = new URL("plugins/cookbook/agents/", root);
  const files = readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .map((n) => ({ name: n.slice(0, -3), text: readFileSync(new URL(n, dir), "utf8") }));
  const skill = new URL("plugins/cookbook/skills/cookbook/", root);
  return {
    files,
    registerText: readFileSync(new URL("connector-register.md", skill), "utf8"),
    profilesText: readFileSync(new URL("dispatch-profiles.md", skill), "utf8"),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = checkAgents(readAgents());
  for (const e of errors) console.error(e);
  console.log(errors.length ? `${errors.length} problem(s)` : "Dispatch profile check passed.");
  process.exitCode = errors.length ? 1 : 0;
}
