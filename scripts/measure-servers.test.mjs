import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import { aggregate, armSettings, blockCommand, deferConfig, entryFingerprint, buildRow, claudeArgs, expectedServers, loadServers, makeTemp, otherModel, parseArm, parseFlags, parseLimits, plainHelper, plainUrl, removeTemp, reportText, serversOfPlugin, serverStates, settled, toolsByServer } from "./measure/servers.mjs";

test("a run's temporary folder is private, its debug log exists before the session, and it is deleted after", () => {
  const root = mkdtempSync(join(tmpdir(), "measure-servers-test-"));
  try {
    const p = makeTemp(root);
    assert.ok(statSync(p.work).isDirectory());
    assert.equal(readFileSync(p.debug, "utf8"), "");
    if (process.platform !== "win32") {
      assert.equal(statSync(p.temp).mode & 0o777, 0o700);
      assert.equal(statSync(p.work).mode & 0o777, 0o700);
      assert.equal(statSync(p.debug).mode & 0o777, 0o600);
    }
    assert.equal(removeTemp(p), null);
    assert.ok(!existsSync(p.temp));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a temporary folder that cannot be deleted has its files emptied, and the line names the folder, not its path", () => {
  const root = mkdtempSync(join(tmpdir(), "measure-servers-test-"));
  try {
    const p = makeTemp(root);
    writeFileSync(p.debug, "a debug line");
    writeFileSync(p.settings, "{\"x\":1}");
    writeFileSync(p.mcp, "{\"mcpServers\":{}}");
    const line = removeTemp(p, () => { throw new Error("EBUSY"); });
    assert.match(line, /could not be deleted; its files were emptied$/);
    assert.ok(line.includes(basename(p.temp)) && !line.includes(root));
    for (const f of [p.debug, p.settings, p.mcp]) assert.equal(readFileSync(f, "utf8"), "");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a headers helper that carries a header or a key in its own text is refused, also when its entry is the recorded one", () => {
  for (const bad of ["echo \"Authorization: Bearer fc-0123456789\"", "printf 'x-api-key: abc'", "pwsh -c Write-Output @{a=1}", "helper --token=abc", "helper --api-key: abc", "get-secret.cmd", 5]) assert.ok(!plainHelper(bad), String(bad));
  for (const good of [undefined, "powershell.exe -NoProfile -File C:/tools/agent-key.ps1 -Mode headers -Name firecrawl", "/usr/local/bin/headers firecrawl"]) assert.ok(plainHelper(good), String(good));
  const entry = { type: "http", url: "https://mcp.example.dev/v2/mcp", headersHelper: "echo \"Authorization: Bearer fc-0123456789\"" };
  assert.throws(() => deferConfig("a", { mcpServers: { a: entry } }, { a: entryFingerprint(entry) }), /headers helper could hold a key/);
});

// A fixed list for the tests; the live one (servers.json) follows this PC's setup.
const catalog = {
  servers: ["claude.ai Claude Docs", "cloudflare-docs", "firecrawl", "graphify", "plugin:cloudflare:cloudflare", "plugin:context-mode:context-mode", "plugin:openseo:openseo", "plugin:parallel:parallel-search", "stagehand"],
  plugins: ["cloudflare@cloudflare", "openseo@openseo"],
  deferrable: { firecrawl: "0".repeat(64) },
};
const log = (pairs) => pairs.map(([n, s]) => `2026-11-15T22:47:33.718Z [DEBUG] MCP server "${n}": ${s === "connected" ? "Successfully connected (transport: http) in 164ms" : "Connection failed after 300ms"}`).join("\n");

test("the server list names each server once; each plugin has a server in it, and a deferrable server is a user-scope one recorded by a fingerprint", () => {
  const live = loadServers();
  assert.equal(new Set(live.servers).size, live.servers.length);
  for (const p of live.plugins) assert.ok(serversOfPlugin(p, live.servers).length > 0, p);
  for (const [s, print] of Object.entries(live.deferrable)) {
    assert.ok(live.servers.includes(s) && !s.startsWith("plugin:") && !s.startsWith("claude.ai "), s);
    assert.match(print, /^[0-9a-f]{64}$/, s);
  }
});

test("an arm is read strictly: an unknown server, plugin or kind stops the command", () => {
  assert.deepEqual(parseArm("all", catalog), { arm: "all", denied: [], pluginOff: null, defer: null });
  assert.equal(parseArm("defer:firecrawl", catalog).defer, "firecrawl");
  assert.throws(() => parseArm("defer:plugin:openseo:openseo", catalog), /unknown arm/, "a plugin's server has no entry of the user's to change");
  assert.throws(() => parseArm("defer:graphify", catalog), /unknown arm/, "a server whose entry is not recorded is not deferred");
  assert.throws(() => parseArm("defer:toString", catalog), /unknown arm/);
  assert.deepEqual(parseArm("none", catalog).denied, catalog.servers);
  assert.deepEqual(parseArm("without:plugin:openseo:openseo", catalog).denied, ["plugin:openseo:openseo"]);
  assert.equal(parseArm("plugin-off:openseo@openseo", catalog).pluginOff, "openseo@openseo");
  for (const bad of ["without:nothing", "plugin-off:graphify", "with:graphify", "", "without:"]) assert.throws(() => parseArm(bad, catalog), /unknown arm/);
});

test("an arm's settings deny its servers by name or switch its plugin off, and nothing else", () => {
  const rest = ({ hooks, ...others }) => others;
  assert.deepEqual(rest(armSettings(parseArm("all", catalog))), {});
  assert.deepEqual(rest(armSettings(parseArm("without:stagehand", catalog))), { deniedMcpServers: [{ serverName: "stagehand" }] });
  assert.deepEqual(rest(armSettings(parseArm("plugin-off:cloudflare@cloudflare", catalog))), { enabledPlugins: { "cloudflare@cloudflare": false } });
});

test("every arm's settings block every tool call with a hook, and allow nothing", () => {
  for (const arm of ["all", "none", "without:firecrawl", "plugin-off:openseo@openseo", "defer:firecrawl"]) {
    const s = armSettings(parseArm(arm, catalog), "C:\\Program Files\\nodejs\\node.exe");
    assert.deepEqual(s.hooks, { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "\"C:/Program Files/nodejs/node.exe\" -e \"process.exit(2)\"" }] }] }, arm);
    assert.equal(s.permissions, undefined, arm);
  }
  assert.ok(blockCommand().endsWith(" -e \"process.exit(2)\""));
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

test("a run in which the model tried a tool is not counted, and the row names the tool without its argument", () => {
  const row = rowOf({ summary: summary({ toolCalls: ["Read work/x.txt", "Bash", "Read work/y.txt"] }) });
  assert.equal(row.problem, "the model tried a tool: Read, Bash");
  assert.equal(row.toolCalls, 3);
  assert.equal(rowOf().toolCalls, 0);
});

test("the command line allows nothing and keeps no transcript", () => {
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

const summary = (over = {}) => ({ firstContext: 60000, calls: 1, toolCalls: [], init: { tools: ["Read"], plugins: ["cookbook"], skills: 3, login: "plan", model: "m", version: "2.1.325" }, result: { subtype: "success", isError: false, costUsd: 0.2, costReported: true }, ...over });
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

test("a deferred server is the user's own entry with alwaysLoad false, copied only when it is the recorded one and can hold no key", () => {
  const ok = { type: "http", url: "https://mcp.example.dev/v2/mcp", headersHelper: "helper", timeout: 5000 };
  const pin = (entry) => ({ a: entryFingerprint(entry) });
  assert.deepEqual(deferConfig("a", { mcpServers: { a: ok } }, pin(ok)), { mcpServers: { a: { ...ok, alwaysLoad: false } } });
  assert.equal(entryFingerprint({ url: ok.url, type: "http", timeout: 5000, headersHelper: "helper", alwaysLoad: false }), entryFingerprint(ok), "the order of the fields and alwaysLoad do not count");
  // An entry that passes every check of its text is still refused unless it is the recorded one.
  for (const changed of [{ ...ok, url: "https://mcp.example.dev/s3cr3t/mcp" }, { ...ok, url: "https://s3cr3t.example.dev/v2/mcp" }, { ...ok, headersHelper: "helper --key s3cr3t" }]) {
    assert.throws(() => deferConfig("a", { mcpServers: { a: changed } }, pin(ok)), /not the one recorded/);
  }
  assert.throws(() => deferConfig("a", { mcpServers: { a: ok } }), /not the one recorded/, "nothing recorded: nothing copied");
  assert.throws(() => deferConfig("a", { mcpServers: { a: ok } }, { b: entryFingerprint(ok) }), /not the one recorded/);
  for (const host of ["https://127.0.0.1/mcp", "https://[::1]/mcp", "https://localhost/mcp", "https://mcp.example.dev:8443/mcp", "https://a_b.example.dev/mcp", `https://${"a".repeat(40)}.example.dev/mcp`]) assert.ok(!plainUrl(host), host);
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
  for (const [n, entry] of Object.entries(refused)) assert.throws(() => deferConfig(n, { mcpServers: { [n]: entry } }, { [n]: entryFingerprint(entry) }), /could hold a key|its entry has/, n);
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
