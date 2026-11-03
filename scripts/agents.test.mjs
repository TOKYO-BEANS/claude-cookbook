// The dispatch profiles: agent files, the connector register and the recipe's tables agree.
import test from "node:test";
import assert from "node:assert/strict";
import { checkAgents, readAgents } from "./agents.mjs";

const real = readAgents();
const errors = (o = {}) => checkAgents({ ...real, ...o });
const edit = (name, fn) => real.files.map((f) => (f.name === name ? { ...f, text: fn(f.text) } : f));

test("the real files pass", () => {
  assert.deepEqual(errors(), []);
  assert.deepEqual(real.files.map((f) => f.name).sort(), ["mechanical", "research", "review"]);
});

test("model and effort are required and known", () => {
  assert.ok(errors({ files: edit("mechanical", (t) => t.replace(/^model: .*\n/m, "")) }).some((e) => /mechanical: model/.test(e)));
  assert.ok(errors({ files: edit("mechanical", (t) => t.replace(/^effort: .*$/m, "effort: extreme")) }).some((e) => /mechanical: effort/.test(e)));
});

test("a profile needs its own tool list", () => {
  assert.ok(errors({ files: edit("review", (t) => t.replace(/^tools: .*\n/m, "")) }).some((e) => /review: tools/.test(e)));
});

test("a profile resolves to the same tools in the foreground and the background", () => {
  const files = edit("mechanical", (t) => t.replace(/^tools: (.*)$/m, "tools: $1, AskUserQuestion"));
  assert.ok(errors({ files }).some((e) => /mechanical: AskUserQuestion is not a built-in tool that a background subagent keeps/.test(e)));
});

test("unknown fields and names that differ from the file are caught", () => {
  assert.ok(errors({ files: edit("research", (t) => t.replace(/^model:/m, "colour: red\nmodel:")) }).some((e) => /research: unknown field colour/.test(e)));
  assert.ok(errors({ files: edit("research", (t) => t.replace(/^name: .*$/m, "name: researcher")) }).some((e) => /research: name/.test(e)));
});

test("the description is one short line", () => {
  const long = "x".repeat(201);
  assert.ok(errors({ files: edit("review", (t) => t.replace(/^description: .*$/m, `description: ${long}`)) }).some((e) => /review: description/.test(e)));
});

test("every MCP server in a tool list is in the connector register", () => {
  const files = edit("research", (t) => t.replace(/^tools: (.*)$/m, "tools: $1, mcp__nosuch__*"));
  assert.ok(errors({ files }).some((e) => /research: mcp__nosuch__\* names no server in connector-register.md/.test(e)));
  const plugin = edit("research", (t) => t.replace(/^tools: (.*)$/m, "tools: $1, mcp__plugin_cloudflare_cloudflare__execute"));
  assert.deepEqual(errors({ files: plugin }), []);
});

test("an MCP entry must use the server's real tool prefix", () => {
  for (const wrong of ["mcp__parallel-search__*", "mcp__plugin_nosuch_parallel-search__*", "mcp__evil_graphify__x", "mcp__Wix__*"]) {
    const files = edit("research", (t) => t.replace(/^tools: (.*)$/m, `tools: $1, ${wrong}`));
    assert.ok(errors({ files }).some((e) => e.includes(`research: ${wrong} names no server`)), wrong);
  }
});

test("built-in names are checked in both lists", () => {
  const typo = edit("review", (t) => t.replace(/^disallowedTools: Edit,/m, "disallowedTools: Edti,"));
  assert.ok(errors({ files: typo }).some((e) => /review: Edti is not a built-in tool/.test(e)));
  const read = edit("review", (t) => t.replace(/^tools: Read,/m, "tools: Raed,"));
  assert.ok(errors({ files: read }).some((e) => /review: Raed is not a built-in tool that a background subagent keeps/.test(e)));
});

test("a profile has one row in the subagent table", () => {
  const row = real.profilesText.match(/^\| mechanical \|.*$/m)[0];
  const profilesText = real.profilesText.replace(row, `${row.replace(" haiku | low ", " sonnet | high ")}\n${row}`);
  assert.ok(errors({ profilesText }).some((e) => /subagent table: mechanical has more than one row/.test(e)));
});

test("the recipe's subagent table matches the agent files", () => {
  const profilesText = real.profilesText.replace(/^(\| mechanical \|[^|]*\|) haiku \|/m, "$1 sonnet |");
  assert.ok(errors({ profilesText }).some((e) => /mechanical: the subagent table says model sonnet/.test(e)));
  const missing = real.profilesText.replace(/^\| review \|.*\n/m, "");
  assert.ok(errors({ profilesText: missing }).some((e) => /review: no row in the subagent table/.test(e)));
});

test("the side-chat table uses real start_session values", () => {
  const bad = real.profilesText.replace(/^(\| code \| )`claude-sonnet-5-5`/m, "$1`sonnet`");
  assert.ok(errors({ profilesText: bad }).some((e) => /side chat code: model/.test(e)));
  const mode = real.profilesText.replace(/^(\| ops-deploy \|.*?\| )`default`/m, "$1`ask`");
  assert.ok(errors({ profilesText: mode }).some((e) => /side chat ops-deploy: permission mode/.test(e)));
  const gone = real.profilesText.replace(/^\| design \|.*\n/m, "");
  assert.ok(errors({ profilesText: gone }).some((e) => /side-chat table needs code, design and ops-deploy/.test(e)));
});
