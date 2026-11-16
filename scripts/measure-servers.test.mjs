import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate, armSettings, deferConfig, buildRow, claudeArgs, expectedServers, loadServers, otherModel, parseArm, parseFlags, parseLimits, plainUrl, reportText, serversOfPlugin, serverStates, settled, toolsByServer } from "./measure/servers.mjs";

// A fixed list for the tests; the live one (servers.json) follows this PC's setup.
const catalog = {
  servers: ["claude.ai Claude Docs", "cloudflare-docs", "firecrawl", "graphify", "plugin:cloudflare:cloudflare", "plugin:context-mode:context-mode", "plugin:openseo:openseo", "plugin:parallel:parallel-search", "stagehand"],
  plugins: ["cloudflare@cloudflare", "openseo@openseo"],
  userServers: ["cloudflare-docs", "firecrawl", "graphify", "stagehand"],
};
const log = (pairs) => pairs.map(([n, s]) => `2026-11-15T22:47:33.718Z [DEBUG] MCP server "${n}": ${s === "connected" ? "Successfully connected (transport: http) in 164ms" : "Connection failed after 300ms"}`).join("\n");

test("the server list names each server once; each plugin and each user-scope server is in it", () => {
  const live = loadServers();
  assert.equal(new Set(live.servers).size, live.servers.length);
  for (const p of live.plugins) assert.ok(serversOfPlugin(p, live.servers).length > 0, p);
  for (const s of live.userServers) assert.ok(live.servers.includes(s) && !s.startsWith("plugin:") && !s.startsWith("claude.ai "), s);
});

test("an arm is read strictly: an unknown server, plugin or kind stops the command", () => {
  assert.deepEqual(parseArm("all", catalog), { arm: "all", denied: [], pluginOff: null, defer: null });
  assert.equal(parseArm("defer:firecrawl", catalog).defer, "firecrawl");
  assert.throws(() => parseArm("defer:plugin:openseo:openseo", catalog), /unknown arm/, "a plugin's server has no entry of the user's to change");
  assert.deepEqual(parseArm("none", catalog).denied, catalog.servers);
  assert.deepEqual(parseArm("without:plugin:openseo:openseo", catalog).denied, ["plugin:openseo:openseo"]);
  assert.equal(parseArm("plugin-off:openseo@openseo", catalog).pluginOff, "openseo@openseo");
  for (const bad of ["without:nothing", "plugin-off:graphify", "with:graphify", "", "without:"]) assert.throws(() => parseArm(bad, catalog), /unknown arm/);
});

test("an arm's settings deny its servers by name or switch its plugin off, and nothing else", () => {
  assert.deepEqual(armSettings(parseArm("all", catalog)), {});
  assert.deepEqual(armSettings(parseArm("without:stagehand", catalog)), { deniedMcpServers: [{ serverName: "stagehand" }] });
  assert.deepEqual(armSettings(parseArm("plugin-off:cloudflare@cloudflare", catalog)), { enabledPlugins: { "cloudflare@cloudflare": false } });
});

test("the servers a run waits for leave out the denied one and a disabled plugin's own", () => {
  assert.ok(!expectedServers(parseArm("without:firecrawl", catalog), catalog.servers).includes("firecrawl"));
  const e = expectedServers(parseArm("plugin-off:cloudflare@cloudflare", catalog), catalog.servers);
  assert.ok(!e.includes("plugin:cloudflare:cloudflare"));
  assert.ok(e.includes("cloudflare-docs"));
  assert.deepEqual(expectedServers(parseArm("none", catalog), catalog.servers), []);
});

test("a run is settled when every expected server has connected or failed, by its exact name", () => {
  const text = log([["graphify", "connected"], ["firecrawl", "failed"]]);
  assert.deepEqual(serverStates(text, ["graphify", "firecrawl", "stagehand"]), { graphify: "connected", firecrawl: "failed" });
  assert.ok(settled(text, ["graphify", "firecrawl"]));
  assert.ok(!settled(text, ["graphify", "stagehand"]));
  assert.ok(!settled(log([["plugin:cloudflare:cloudflare", "connected"]]), ["cloudflare"]));
  assert.ok(settled("", []));
});

test("the run can call nothing and keeps no transcript", () => {
  const a = claudeArgs({ settings: "s.json", model: "m", cap: 1, debug: "d.log" });
  assert.deepEqual(a.slice(a.indexOf("--permission-mode"), a.indexOf("--permission-mode") + 2), ["--permission-mode", "dontAsk"]);
  assert.ok(a.includes("--no-session-persistence"));
  assert.deepEqual(a.slice(a.indexOf("--max-budget-usd"), a.indexOf("--max-budget-usd") + 2), ["--max-budget-usd", "1"]);
  for (const never of ["--allowedTools", "--dangerously-skip-permissions", "bypassPermissions"]) assert.ok(!a.includes(never));
});

test("tools are counted per server by the name Claude Code gives them", () => {
  const c = toolsByServer(["Read", "ToolSearch", "mcp__plugin_openseo_openseo__whoami", "mcp__claude_ai_Claude_Docs__read", "mcp__cloudflare-docs__search", "mcp__t3-code__x"], catalog.servers);
  assert.deepEqual(c, { builtIn: 2, otherMcp: 1, "plugin:openseo:openseo": 1, "claude.ai Claude Docs": 1, "cloudflare-docs": 1 });
});

const summary = (over = {}) => ({ firstContext: 60000, calls: 1, init: { tools: ["Read"], plugins: ["cookbook"], skills: 3, login: "plan", model: "m", version: "2.1.325" }, result: { subtype: "success", isError: false, costUsd: 0.2, costReported: true }, ...over });
const rowOf = (over = {}) => buildRow({ arm: "all", rep: 1, model: "m", cap: 1, expected: ["graphify"], all: ["graphify", "stagehand"], waitMs: 5000, exit: 0, stopped: null, states: { expected: { graphify: "connected" }, other: {} }, summary: summary(), ...over });

test("a row counts only when the run ended well with every expected server and no other", () => {
  assert.equal(rowOf().problem, null);
  assert.equal(rowOf().costUsd, 0.2);
  assert.match(rowOf({ states: { expected: { graphify: "failed" }, other: {} } }).problem, /not connected: graphify/);
  assert.match(rowOf({ states: { expected: { graphify: "connected" }, other: { stagehand: "connected" } } }).problem, /left out: stagehand/);
  assert.equal(rowOf({ stopped: "the time limit" }).problem, "the time limit");
  assert.match(rowOf({ summary: summary({ result: { subtype: "error_max_budget_usd", isError: true, costUsd: 1, costReported: true } }) }).problem, /error_max_budget_usd/);
  const none = rowOf({ summary: summary({ result: null }) });
  assert.equal(none.problem, "no result");
  assert.equal(none.costUsd, 1, "a run without a result counts at the cap");
  assert.equal(rowOf({ summary: summary({ result: { subtype: "success", isError: false, costReported: false } }) }).costUsd, 1);
});

test("a saving is a difference of means with the range the repeats allow; a row with a problem is left out", () => {
  const rows = [
    { arm: "all", firstContext: 70000, problem: null }, { arm: "all", firstContext: 70200, problem: null },
    { arm: "without:x", firstContext: 68000, problem: null }, { arm: "without:x", firstContext: 68100, problem: null },
    { arm: "without:x", firstContext: 10, problem: "no result" },
  ];
  const [all, x] = aggregate(rows);
  assert.deepEqual([all.n, all.mean, all.saving], [2, 70100, null]);
  assert.deepEqual(x.saving, { mean: 2050, low: 1900, high: 2200 });
  assert.match(reportText(rows.map((r, i) => ({ ...r, rep: i, costUsd: 0.1 }))), /\| without:x \| 2 \| 68,050 \(68,000 to 68,100\) \| 2,050 \(1,900 to 2,200\) \|\n\nNot counted: without:x #4: no result\n\nSpend at list prices: USD 0\.50 over 5 runs\./);
});

test("limits and flags are read strictly", () => {
  assert.deepEqual(parseLimits({}), { cap: 1, limit: 15, reps: 3 });
  for (const bad of [{ cap: "x" }, { limit: "0" }, { reps: "1.5" }, { reps: "-1" }]) assert.throws(() => parseLimits(bad), /positive number/);
  assert.deepEqual(parseFlags(["--out", "o", "--arm", "all"]), { out: "o", arm: "all" });
  assert.throws(() => parseFlags(["--out", "--arm"]), /needs a value/);
  assert.throws(() => parseFlags(["--out"]), /needs a value/);
});

test("a deferred server is the user's own entry with alwaysLoad false, copied only when it can hold no key", () => {
  const ok = { type: "http", url: "https://mcp.example.dev/v2/mcp", headersHelper: "helper", timeout: 5000 };
  assert.deepEqual(deferConfig("a", { mcpServers: { a: ok } }), { mcpServers: { a: { ...ok, alwaysLoad: false } } });
  const refused = {
    headers: { ...ok, headers: { Authorization: "x" } },
    env: { ...ok, env: { BROWSER: "cloud" } },
    command: { command: "node", args: ["server.js", "--api-key", "x"] },
    keyInPath: { type: "http", url: "https://mcp.example.dev/fc-0123456789abcdef0123/v2/mcp" },
    keyInQuery: { type: "http", url: "https://mcp.example.dev/mcp?key=x" },
    keyInUser: { type: "http", url: "https://user:pass@mcp.example.dev/mcp" },
    notHttps: { type: "http", url: "http://mcp.example.dev/mcp" },
    stdio: { type: "stdio", url: "https://mcp.example.dev/mcp" },
  };
  for (const [n, entry] of Object.entries(refused)) assert.throws(() => deferConfig(n, { mcpServers: { [n]: entry } }), /not copied/, n);
  assert.throws(() => deferConfig("zz", { mcpServers: {} }), /no user-scope server/);
  assert.ok(plainUrl("https://api.example.com/mcp"));
  assert.ok(!plainUrl("https://api.example.com/mcp#x") && !plainUrl("not a url") && !plainUrl("https://api.example.com/a%2Fb"));
  const a = claudeArgs({ settings: "s", model: "m", cap: 1, debug: "d", mcpConfig: "mcp.json" });
  assert.deepEqual(a.slice(0, 2), ["--mcp-config", "mcp.json"]);
  assert.ok(!a.includes("--strict-mcp-config"));
});

test("a folder is of one requested model: an alias the session reports under its full id is not another model", () => {
  const row = rowOf({ model: "opus", summary: summary({ init: { tools: [], plugins: [], skills: 0, login: "plan", model: "claude-opus-5-5", version: "2.1.325" } }) });
  assert.deepEqual([row.requested, row.model], ["opus", "claude-opus-5-5"]);
  assert.ok(!otherModel([row], "opus"));
  assert.ok(otherModel([row], "claude-opus-5-5"));
  assert.ok(!otherModel([{ model: "claude-opus-5-5" }], "claude-opus-5-5"), "a row from before the field has the reported model only");
  assert.ok(otherModel([{ model: "claude-opus-5-5" }], "claude-haiku-5-5"));
  assert.ok(!otherModel([], "x"));
});
