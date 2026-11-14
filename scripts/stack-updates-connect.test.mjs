// Run by `npm test` (node --test). `run` is a fake and `home` a temp folder: no
// real CLI, no network and no key is touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChecks, dueDates, scrub, JEV_LOG, JEV_ANSWER_OUTCOMES } from "../plugins/cookbook/skills/stack-updates/scripts/lib/connect.mjs";
import { expandTokens } from "../plugins/cookbook/skills/stack-updates/scripts/lib/inventory.mjs";
import { CONNECTION_CHECKS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs";

const NOW = new Date("2026-11-14T07:00:00Z");
const tool = (id, name, lifecycle = "active", parts = [{ name: "cli", installed: { kind: "command" } }], extra = {}) => ({ id, name, lifecycle, parts, ...extra });
const catalogOf = (...tools) => ({ version: 1, tools, ignored: [] });
const checks = { svc: { argv: ["svc-cli", "--status"], ok: /^Signed in as \S+/m } };
const okRun = async () => ({ code: 0, stdout: "Signed in as someone\n", stderr: "" });
const home = mkdtempSync(join(tmpdir(), "stack-updates-connect-"));
test.after(() => rmSync(home, { recursive: true, force: true }));

test("a check whose output matches ok is neither broken nor unchecked", async () => {
  const calls = [];
  const run = async (argv, opts) => { calls.push({ argv, opts }); return okRun(); };
  const r = await runChecks(catalogOf(tool("svc", "Svc")), { run, home, now: NOW, checks });
  assert.deepEqual(r.broken, []);
  assert.deepEqual(r.unchecked, []);
  assert.deepEqual(r.working, ["Svc"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].argv, ["svc-cli", "--status"]);
  assert.equal(calls[0].opts.timeoutMs, 30_000);
  assert.equal(calls[0].opts.home, home);
});

test("a non-zero exit, a timeout or output that does not match is broken, with the first 200 characters of stderr", async () => {
  const cat = catalogOf(tool("svc", "Svc"));
  const long = "not signed in ".repeat(30);
  let r = await runChecks(cat, { run: async () => ({ code: 3, stdout: "", stderr: long }), home, now: NOW, checks });
  assert.equal(r.broken.length, 1);
  assert.equal(r.broken[0].service, "Svc");
  assert.equal(r.broken[0].error, long.trim().slice(0, 200).trimEnd());
  assert.deepEqual(r.working, []);
  r = await runChecks(cat, { run: async () => ({ code: null, stdout: "", stderr: "timed out after 30 s", timedOut: true }), home, now: NOW, checks });
  assert.match(r.broken[0].error, /timed out/);
  r = await runChecks(cat, { run: async () => ({ code: 0, stdout: "Signed out\n", stderr: "" }), home, now: NOW, checks });
  assert.equal(r.broken.length, 1);
  assert.match(r.broken[0].error, /did not show/);
  assert.ok(!r.broken[0].error.includes("Signed out"), "the stdout is not copied: it can hold account detail");
  r = await runChecks(cat, { run: async () => { throw new Error("spawn failed"); }, home, now: NOW, checks });
  assert.match(r.broken[0].error, /spawn failed/);
  r = await runChecks(cat, { run: async () => ({ code: 0, stdout: "Signed in as someone\n", stderr: "", truncated: true }), home, now: NOW, checks });
  assert.equal(r.broken.length, 0, "a matched line is proof even when the output was cut");
});

test("only a tool with a hosted part and no check is unchecked; skills, local CLIs and watching tools are not", async () => {
  const hosted = [{ name: "service", installed: { kind: "hosted" } }];
  const cat = catalogOf(
    tool("svc", "Svc"),
    tool("web", "Web", "trial", hosted),
    tool("skill", "Skill", "active", [{ name: "skill", installed: { kind: "skill" } }]),
    tool("pin", "Pin", "trial", [{ name: "cli", installed: { kind: "pinned" } }]),
    tool("idle", "Idle", "watching", hosted),
  );
  const r = await runChecks(cat, { run: okRun, home, now: NOW, checks });
  assert.deepEqual(r.unchecked, ["Web"]);
  assert.deepEqual(r.working, ["Svc"]);
  assert.deepEqual(r.broken, []);
});

test("checks run one after another", async () => {
  let open = 0, most = 0;
  const run = async () => { open++; most = Math.max(most, open); await new Promise((r) => setTimeout(r, 5)); open--; return okRun(); };
  const two = { a: checks.svc, b: checks.svc };
  await runChecks(catalogOf(tool("a", "A"), tool("b", "B")), { run, home, now: NOW, checks: two });
  assert.equal(most, 1);
});

test("the error text never holds an Authorization header or a token-looking value", async () => {
  const secret = "abcDEF0123456789_abcDEF0123456789-xyz";
  const bad = [
    `Authorization: Bearer ${secret}`,
    `request failed key=${secret} retry`,
    `token=${secret}`,
    `sent Bearer ${secret} to host`,
    `{"token": "${secret}"}`,
    `plain ${secret}${secret}`,
  ].join("\n");
  const r = await runChecks(catalogOf(tool("svc", "Svc")), { run: async () => ({ code: 1, stdout: "", stderr: bad }), home, now: NOW, checks });
  const text = r.broken[0].error;
  assert.ok(!text.includes(secret.slice(0, 20)), text);
  assert.ok(!/authorization/i.test(text), text);
  assert.ok(text.length <= 200);
  assert.ok(!scrub(`Bearer ${secret}`).includes("abcDEF"));
  assert.equal(scrub("exit 1: not signed in"), "exit 1: not signed in");
  assert.equal(scrub("\x1b[31mERROR\x1b[0m no session"), "ERROR no session", "colour codes are removed");
  assert.equal(scrub("[31mERROR[0m no session"), "ERROR no session", "colour codes are removed");
  // The secret is removed before the text is cut, so half a token cannot survive the cut.
  const edge = `${"y".repeat(170)} token=${secret}`;
  assert.ok(!scrub(edge).includes("abcDEF"));
});

test("a table argv has its tokens expanded to this PC's folders", async () => {
  const seen = [];
  const run = async (argv) => { seen.push(argv); return okRun(); };
  const table = { svc: { argv: ["cmd.exe", "/d", "/c", "{bin}/svc.cmd", "--status"], ok: checks.svc.ok }, two: { argv: ["node", "{bin}/with-key.mjs", "k", "E", "node", "{lib}/cloudflare-verify.mjs"], ok: checks.svc.ok } };
  await runChecks(catalogOf(tool("svc", "Svc"), tool("two", "Two")), { run, home, now: NOW, checks: table });
  assert.deepEqual(seen[0].slice(0, 3), ["cmd.exe", "/d", "/c"]);
  assert.equal(seen[0][3], join(home, ".local", "bin", "svc.cmd"));
  assert.equal(seen[1][1], join(home, ".local", "bin", "with-key.mjs"));
  assert.ok(/stack-updates[\\/]scripts[\\/]lib[\\/]cloudflare-verify\.mjs$/.test(seen[1][5]), seen[1][5]);
  assert.ok(!seen.flat().some((a) => /\{(bin|lib|share)\}/.test(a)));
});

test("expandTokens: {share}, {bin} and {lib}", () => {
  const out = expandTokens(["a", "{share}/x/y.exe", "{bin}/z.cmd", "{lib}/q.mjs", "--flag"], "/h", "/plugin/lib");
  assert.equal(out[0], "a");
  assert.equal(out[1], join("/h", ".local", "share", "x", "y.exe"));
  assert.equal(out[2], join("/h", ".local", "bin", "z.cmd"));
  assert.equal(out[3], join("/plugin/lib", "q.mjs"));
  assert.equal(out[4], "--flag");
});

test("claude mcp list: each hosted part's server is matched against its Connected line", async () => {
  const listing = [
    "Checking MCP server health…",
    "",
    "claude.ai Adobe: https://adobe-creativity.adobe.io/mcp - ✔ Connected",
    "plugin:parallel:parallel-search: https://search.parallel.ai/mcp (HTTP) - ✔ Connected",
    "graphify: https://api.graphify.com/mcp (HTTP) - ! Needs authentication",
    "firecrawl: https://mcp.firecrawl.dev/v2/mcp (HTTP) - ✗ Failed to connect",
    "",
  ].join("\n");
  const hosted = (server) => [{ name: "mcp", installed: { kind: "hosted", server } }];
  const cat = catalogOf(
    tool("parallel", "Parallel", "active", hosted("parallel-search")),
    tool("graphify", "Graphify", "active", hosted("graphify")),
    tool("firecrawl", "Firecrawl", "active", hosted("firecrawl")),
    tool("adobe-for-creativity", "Adobe for creativity", "trial", hosted("Adobe")),
    tool("openseo", "OpenSEO", "active", hosted("openseo")),
  );
  const calls = [];
  const run = async (argv) => { calls.push(argv); return { code: 0, stdout: listing, stderr: "" }; };
  const r = await runChecks(cat, { run, home, now: NOW, checks: {} });
  assert.equal(calls.length, 1, "one claude mcp list run for all servers");
  assert.deepEqual(calls[0], ["claude", "mcp", "list"]);
  assert.deepEqual(r.working.sort(), ["Adobe for creativity", "Parallel"]);
  assert.deepEqual(r.broken.map((b) => b.service).sort(), ["Firecrawl", "Graphify", "OpenSEO"]);
  assert.match(r.broken.find((b) => b.service === "Graphify").error, /Needs authentication/);
  assert.match(r.broken.find((b) => b.service === "OpenSEO").error, /not listed/);
  assert.deepEqual(r.unchecked, []);
});

test("claude mcp list: when the listing itself fails, one broken entry and the servers are unchecked", async () => {
  const cat = catalogOf(tool("graphify", "Graphify", "active", [{ name: "mcp", installed: { kind: "hosted", server: "graphify" } }]));
  const r = await runChecks(cat, { run: async () => ({ code: null, stdout: "", stderr: "timed out after 30 s", timedOut: true }), home, now: NOW, checks: {} });
  assert.deepEqual(r.broken.map((b) => b.service), ["claude mcp list"]);
  assert.deepEqual(r.unchecked, ["Graphify"]);
});

test("a tool with a check and a server is working only when both answer", async () => {
  const cat = catalogOf(tool("svc", "Svc", "active", [{ name: "mcp", installed: { kind: "hosted", server: "svc" } }]));
  const run = async (argv) => (argv[0] === "claude"
    ? { code: 0, stdout: "svc: https://x (HTTP) - ✗ Failed to connect\n", stderr: "" }
    : okRun());
  const r = await runChecks(cat, { run, home, now: NOW, checks });
  assert.deepEqual(r.working, []);
  assert.equal(r.broken.length, 1);
});

function writeJevLog(lines) {
  const dir = join(home, ".claude", "vendor", "compaction", "state");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "jev-turn-router-decisions.jsonl"), lines);
}
const jevCat = catalogOf(tool("jev", "TypeSafe / Jev", "active", [{ name: "models", installed: { kind: "hosted" } }]));
const noRun = async () => { throw new Error("Jev gets no call of its own"); };
const entry = (ts, outcome) => JSON.stringify({ ts, outcome, reason: "r" });
const jevState = async () => runChecks(jevCat, { run: noRun, home, now: NOW, checks: {} });

test("Jev: only a real answer counts, and only within 48 hours", async () => {
  assert.ok(JEV_LOG.endsWith("jev-turn-router-decisions.jsonl"));
  assert.deepEqual([...JEV_ANSWER_OUTCOMES], ["routed"]);
  rmSync(join(home, ".claude"), { recursive: true, force: true });
  assert.deepEqual((await jevState()).unchecked, ["TypeSafe / Jev"], "no log");
  writeJevLog(entry("2026-11-13T08:00:00Z", "routed") + "\n");
  let r = await jevState();
  assert.deepEqual(r.working, ["TypeSafe / Jev"]);
  assert.deepEqual(r.unchecked, []);
  writeJevLog([entry("2026-11-14T03:00:00Z", "routed"), entry("2026-11-14T06:30:00Z", "skipped")].join("\n") + "\n");
  assert.deepEqual((await jevState()).working, ["TypeSafe / Jev"], "newest line skipped, answer 4 hours earlier");
  writeJevLog([entry("2026-11-14T05:00:00Z", "skipped"), entry("2026-11-14T06:00:00Z", "skipped")].join("\n") + "\n");
  assert.deepEqual((await jevState()).unchecked, ["TypeSafe / Jev"], "only skipped lines");
  writeJevLog([entry("2026-11-12T05:59:00Z", "routed"), entry("2026-11-14T06:00:00Z", "skipped")].join("\n") + "\n");
  assert.deepEqual((await jevState()).unchecked, ["TypeSafe / Jev"], "a real answer 49 hours old");
  writeJevLog([entry("2026-11-13T06:00:00Z", "routed"), "not json {"].join("\n") + "\n");
  assert.deepEqual((await jevState()).working, ["TypeSafe / Jev"], "an unparsable last line is ignored");
  writeJevLog([entry("2026-11-14T06:00:00Z", "error"), entry("2026-11-14T06:00:00Z", "timeout")].join("\n") + "\n");
  assert.deepEqual((await jevState()).unchecked, ["TypeSafe / Jev"], "error and timeout outcomes are not answers");
  writeJevLog(JSON.stringify({ outcome: "routed" }) + "\n");
  assert.deepEqual((await jevState()).unchecked, ["TypeSafe / Jev"], "no timestamp");
});

test("Jev: only the last 200 lines are read", async () => {
  const filler = Array.from({ length: 200 }, () => entry("2026-11-14T06:00:00Z", "skipped"));
  writeJevLog([entry("2026-11-14T05:00:00Z", "routed"), ...filler].join("\n") + "\n");
  assert.deepEqual((await jevState()).unchecked, ["TypeSafe / Jev"]);
});

const withDate = (on) => catalogOf(tool("t", "T", "active", undefined, { dates: [{ label: "L", on }] }));
const days = (c, today) => dueDates(c, today).map((d) => d.days);

test("dueDates: 14, 7, 3, then daily from 2 days", () => {
  const c = withDate("2026-11-19");
  assert.deepEqual(days(c, "2026-11-05"), [14]);
  assert.deepEqual(days(c, "2026-11-06"), []);
  assert.deepEqual(days(c, "2026-11-12"), [7]);
  assert.deepEqual(days(c, "2026-11-16"), [3]);
  assert.deepEqual(days(c, "2026-11-15"), []);
  assert.deepEqual(days(c, "2026-11-17"), [2]);
  assert.deepEqual(days(c, "2026-11-18"), [1]);
  assert.deepEqual(days(c, "2026-11-19"), [0]);
  assert.deepEqual(days(c, "2026-11-20"), []);
  assert.deepEqual(dueDates(c, "2026-11-17"), [{ label: "L", on: "2026-11-19", days: 2 }]);
});

test("dueDates: every tool, soonest first, across a month end", () => {
  const c = catalogOf(
    tool("a", "A", "active", undefined, { dates: [{ label: "later", on: "2027-02-13" }, { label: "soon", on: "2026-12-01" }] }),
    tool("b", "B", "trial", undefined, { dates: [{ label: "sooner", on: "2026-11-30" }] }),
    tool("c", "C"),
  );
  assert.deepEqual(dueDates(c, "2026-11-30").map((d) => d.label), ["sooner", "soon"]);
  assert.deepEqual(dueDates(c, "2026-11-30").map((d) => d.days), [0, 1]);
  assert.deepEqual(dueDates(c, "2026-12-30"), []);
});

test("the real table: frozen, at most one paid check, no Jev entry", () => {
  assert.ok(Object.isFrozen(CONNECTION_CHECKS));
  assert.ok(Object.values(CONNECTION_CHECKS).filter((c) => c.paid).length <= 1);
  for (const c of Object.values(CONNECTION_CHECKS)) assert.ok(c.ok instanceof RegExp);
  assert.ok(!("jev" in CONNECTION_CHECKS));
});

test("the real table: each ok pattern matches the line a working service prints", () => {
  const sample = {
    github: "some-login\n",
    depot: "Organization ID,Name\nabc123,org\n",
    firecrawl: "  Authenticated via FIRECRAWL_API_KEY\n  Credits: 1,033 / 1,000 (103% left this cycle)\n",
    boat: '{"accessTier":"trial","billingStatus":"trialing","canStart":true}',
    browserbase: '[\n  {\n    "id": "x",\n    "concurrency": 25\n  }\n]',
    "google-workspace-cli": '{"ok":true,"client":true,"accounts":[{"account":"a","works":true}]}',
    cloudflare: "active\n",
    parallel: '{\n  "status": "ok",\n  "results": []\n}',
  };
  for (const [id, text] of Object.entries(sample)) {
    assert.ok(CONNECTION_CHECKS[id], `${id} has a check`);
    assert.ok(CONNECTION_CHECKS[id].ok.test(text), `${id} ok pattern`);
  }
  assert.ok(!CONNECTION_CHECKS["google-workspace-cli"].ok.test('{"ok":true,"accounts":[{"works":false}]}'));
  assert.ok(!CONNECTION_CHECKS.parallel.ok.test('{"status":"error"}'));
});

test("claude mcp list fails but the tool's own check passed: working, not unchecked", async () => {
  const withServer = tool("svc", "Svc", "active", [{ name: "mcp", installed: { kind: "hosted", server: "svc" } }]);
  const noCheck = tool("graphify", "Graphify", "active", [{ name: "mcp", installed: { kind: "hosted", server: "graphify" } }]);
  const run = async (argv) => (argv[0] === "claude" ? { code: null, stdout: "", stderr: "timed out after 30 s", timedOut: true } : okRun());
  const r = await runChecks(catalogOf(withServer, noCheck), { run, home, now: NOW, checks });
  assert.deepEqual(r.working, ["Svc"]);
  assert.deepEqual(r.unchecked, ["Graphify"]);
  assert.deepEqual(r.broken.map((b) => b.service), ["claude mcp list"]);
  const bad = await runChecks(catalogOf(withServer), { run: async (argv) => (argv[0] === "claude" ? { code: 1, stdout: "", stderr: "boom" } : { code: 1, stdout: "", stderr: "not signed in" }), home, now: NOW, checks });
  assert.deepEqual(bad.broken.map((b) => b.service).sort(), ["Svc", "claude mcp list"]);
});

const hex32 = "0123456789abcdef0123456789abcdef";
test("scrub: key names with a prefix, separators =, : and whitespace, known prefixes, long mixed runs, e-mail", () => {
  const gone = (text, ...parts) => { const out = scrub(text); for (const p of parts) assert.ok(!out.includes(p), `${p} left in: ${out}`); return out; };
  gone(`FIRECRAWL_API_KEY=fc-${hex32}`, hex32);
  gone(`BROWSERBASE_API_KEY=bb_live_abcdefghij0123456789ABCDEFGH`, "abcdefghij0123456789");
  gone(`Invalid API key fc-${hex32}`, hex32);
  gone(`bad token: ghp_abcdefghijklmnopqrstuvwxyz0123456789`, "abcdefghijklmnop");
  gone(`github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyz`, "abcdefghijklmnop");
  gone(`key sk-proj1234567890abcdefghijkl failed`, "1234567890abcdef");
  gone(`secret ABCDEFGHIJKLMNOPQRST1234 expired`, "ABCDEFGHIJKLMNOPQRST");
  gone(`id a1b2c3d4e5f6a7b8c9d0e1f2a3b4 seen`, "a1b2c3d4e5f6");
  assert.equal(scrub("mail me@example.com or Ann.Lee+x@mail.example.org now"), "mail <email> or <email> now");
  // Ordinary text stays readable.
  assert.equal(scrub("Error: This operation requires an authenticated client"), "Error: This operation requires an authenticated client");
  assert.equal(scrub("token expired, please sign in again"), "token expired, please sign in again");
  assert.equal(scrub("this-is-a-long-hyphenated-words-only-run"), "this-is-a-long-hyphenated-words-only-run");
});

test("scrub: the cut at 4,000 characters cannot leave part of a secret", () => {
  const secret = "ABCDEFGHIJ0123456789abcdefghij0123456789";
  assert.equal(secret.length, 40);
  const out = scrub(`${" ".repeat(3_975)}token=${secret}`);
  for (let i = 0; i + 6 <= secret.length; i++) assert.ok(!out.includes(secret.slice(i, i + 6)), out);
  assert.ok(out.length <= 200);
});

test("a cmd.exe path holding a shell character or a space does not run", async () => {
  const odd = join(home, "my home & more");
  mkdirSync(odd, { recursive: true });
  const calls = [];
  const table = { svc: { argv: ["cmd.exe", "/d", "/c", "{bin}/svc.cmd", "--status"], ok: checks.svc.ok } };
  const r = await runChecks(catalogOf(tool("svc", "Svc")), { run: async (a) => { calls.push(a); return okRun(); }, home: odd, now: NOW, checks: table });
  assert.equal(calls.length, 0);
  assert.deepEqual(r.broken, [{ service: "Svc", error: "unsafe path for cmd.exe" }]);
  const fine = await runChecks(catalogOf(tool("svc", "Svc")), { run: async (a) => { calls.push(a); return okRun(); }, home, now: NOW, checks: table });
  assert.equal(calls.length, 1);
  assert.deepEqual(fine.working, ["Svc"]);
});

test("an MCP line matches a part by its server name, not by the tool's name", async () => {
  const listing = "claude.ai Adobe: https://adobe-creativity.adobe.io/mcp - ✔ Connected\n";
  const run = async () => ({ code: 0, stdout: listing, stderr: "" });
  const hosted = (server) => [{ name: "connector", installed: { kind: "hosted", server } }];
  const r = await runChecks(catalogOf(tool("adobe-firefly", "Adobe Firefly", "trial", hosted("firefly-boards")), tool("adobe", "Adobe for creativity", "trial", hosted("Adobe"))), { run, home, now: NOW, checks: {} });
  assert.deepEqual(r.working, ["Adobe for creativity"]);
  assert.deepEqual(r.broken.map((b) => b.service), ["Adobe Firefly"]);
  assert.match(r.broken[0].error, /not listed/);
});

test("runChecks needs the home folder", async () => {
  await assert.rejects(() => runChecks(catalogOf(tool("svc", "Svc")), { run: okRun, now: NOW, checks }), /needs the home folder/);
});

test("Jev: a timestamp more than 5 minutes ahead is not an answer", async () => {
  writeJevLog([entry("2026-11-13T06:00:00Z", "routed"), entry("2026-11-14T07:10:00Z", "routed")].join("\n") + "\n");
  assert.deepEqual((await jevState()).working, ["TypeSafe / Jev"], "the older real answer still counts");
  writeJevLog(entry("2026-11-14T07:10:00Z", "routed") + "\n");
  assert.deepEqual((await jevState()).unchecked, ["TypeSafe / Jev"]);
  writeJevLog(entry("2026-11-14T07:03:00Z", "routed") + "\n");
  assert.deepEqual((await jevState()).working, ["TypeSafe / Jev"], "3 minutes ahead is clock drift");
});

test("the real table: no ok pattern matches an error line, a help text or a not-signed-in line", () => {
  const negatives = [
    "Error: not signed in\n",
    "error\n",
    "null\n",
    "Usage: tool [OPTIONS] <COMMAND>\n\nCommands:\n  info  Show information\n  login  Log in\n\nOptions:\n  -h, --help  Print help\n",
    "You are not signed in. Run login first.\n",
    "Error: This operation requires an authenticated client\n",
    "Command is not logout there is no session\n",
    "Not authenticated\n",
    '{"error":"unauthorized","message":"not signed in"}',
    '{"status":"error"}',
    "Organization ID,Name\n",
    "[]",
    '{"ok":false,"accounts":[]}',
  ];
  for (const [id, c] of Object.entries(CONNECTION_CHECKS)) {
    for (const text of negatives) assert.ok(!c.ok.test(text), `${id} pattern matched ${JSON.stringify(text)}`);
  }
  // Proton Pass: its own error and usage lines never match, whatever else is printed.
  const pass = CONNECTION_CHECKS["proton-pass-cli"].ok;
  assert.ok(!pass.test("Release track: stable\nError: This operation requires an authenticated client\n"));
  assert.ok(!pass.test("Usage: pass-cli.exe info [OPTIONS]\nOptions:\n"));
  assert.ok(pass.test("Username: someone\nRelease track: stable\n"));
  // The real signed-in answer of pass-cli 2.7.0 (14 November 2026): a list of "- Key: value" lines.
  assert.ok(pass.test("- Release track: stable\n- Personal Access Token: [Agent] claude-pc\n- Session has lock: no\n"));
  assert.ok(!pass.test("- Release track: stable\nError: This operation requires an authenticated client\n"));
});

test("the real table: Cloudflare's pattern needs the word active alone on a line", () => {
  const cf = CONNECTION_CHECKS.cloudflare.ok;
  assert.ok(!cf.test("inactive\n") && !cf.test("not active\n") && !cf.test("HTTP 401\n"));
});
