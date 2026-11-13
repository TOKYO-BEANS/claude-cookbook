// The Cookbook's own consistency check: the tool file and the recipes agree.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkCookbook } from "./check.mjs";
import { CHANGELOG_HOSTS, SELF_UPDATING_TOOLS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const catalogText = read("plugins/cookbook/catalog.json");
const skillText = read("plugins/cookbook/skills/cookbook/SKILL.md");
const catalog = JSON.parse(catalogText);
const withTools = (fn) => JSON.stringify({ ...catalog, tools: fn(structuredClone(catalog.tools)) });
const errors = (o = {}) => checkCookbook({ catalogText, skillText, ...o });

test("the real files pass", () => {
  assert.deepEqual(errors(), []);
  assert.ok(catalog.tools.length >= 50);
});

test("file shape", () => {
  assert.deepEqual(errors({ catalogText: "{" }), ["catalog.json does not parse"]);
  assert.match(errors({ catalogText: '{"version":2,"tools":[]}' })[0], /exactly/);
});

test("ids are unique", () => {
  const text = withTools((t) => [...t, t[0]]);
  assert.ok(errors({ catalogText: text }).some((e) => /duplicate id/.test(e)));
});

test("every recipe heading exists", () => {
  const text = withTools((t) => (t.find((x) => x.id === "parallel").recipe = "No such heading", t));
  assert.ok(errors({ catalogText: text }).some((e) => /\(parallel\): recipe heading/.test(e)));
});

test("field rules", () => {
  assert.ok(broken({ extra: 1 }).some((e) => /unknown field extra/.test(e)));
  assert.ok(broken({ category: "Other" }).some((e) => /category/.test(e)));
  assert.ok(broken({ website: "http://git-scm.com/" }).some((e) => /website/.test(e)));
  assert.ok(broken({ lifecycle: "retiring" }).some((e) => /lifecycle/.test(e)));
  assert.ok(broken({ uses: ["node"] }).some((e) => /only workflows list uses/.test(e)));
  assert.ok(broken({ source: "github", repository: "" }).some((e) => /owner\/name/.test(e)));
});

const P = (name, extra = {}) => ({ name, installed: { kind: "command" }, feed: { kind: "none", reason: "test" }, ...extra });
const broken = (patch, id = "git") =>
  errors({ catalogText: withTools((t) => (Object.assign(t.find((x) => x.id === id), patch), t)) });
const part = (patch) =>
  errors({ catalogText: withTools((t) => ((t.find((x) => x.id === "git").parts[0] = { ...t.find((x) => x.id === "git").parts[0], ...patch }), t)) });
const withTop = (patch) => JSON.stringify({ ...catalog, ...patch });

test("parts: every tool has at least one, names are unique", () => {
  assert.ok(broken({ parts: [] }).some((e) => /at least one part/.test(e)));
  assert.ok(broken({ parts: [P("cli"), P("cli")] }).some((e) => /duplicate part cli/.test(e)));
  assert.ok(broken({ feed: { kind: "npm", package: "x" } }).some((e) => /unknown field feed/.test(e)));
});
test("installed: only known kinds and each kind's own fields", () => {
  assert.ok(part({ installed: { kind: "script" } }).some((e) => /installed kind/.test(e)));
  assert.ok(part({ installed: { kind: "command", run: "x --version" } }).some((e) => /installed field run is not allowed/.test(e)));
  assert.ok(part({ installed: { kind: "pinned", folder: "../x", package: "x" } }).some((e) => /installed folder/.test(e)));
  assert.ok(part({ installed: { kind: "project", repository: "a/b" } }).some((e) => /installed package/.test(e)));
});
test("feed: known kinds, own fields, changelog host on the allow list", () => {
  assert.ok(part({ feed: { kind: "pypi" } }).some((e) => /feed kind/.test(e)));
  assert.ok(part({ feed: { kind: "changelog", url: "http://x.test/" } }).some((e) => /feed url/.test(e)));
  assert.ok(part({ feed: { kind: "changelog", url: "https://evil.test/log" } }).some((e) => /feed host evil.test is not on the allow list/.test(e)));
  assert.ok(part({ feed: { kind: "none" } }).some((e) => /feed none needs a reason/.test(e)));
  assert.ok(part({ feed: { kind: "marketplace", repository: "a/b" } }).some((e) => /feed plugin/.test(e)));
  assert.ok(Object.isFrozen(CHANGELOG_HOSTS) && Array.isArray(CHANGELOG_HOSTS));
});
test("feed: each kind's own fields and values", () => {
  assert.deepEqual(part({ feed: { kind: "npm", package: "@scope/name", tag: "stable", updater: "x" } }), []);
  assert.deepEqual(part({ feed: { kind: "jevModels" } }), []);
  assert.deepEqual(part({ feed: { kind: "commit", repository: "a/b", path: "skills/x" } }), []);
  assert.ok(part({ feed: "npm" }).some((e) => /feed must be an object/.test(e)));
  assert.ok(part({ feed: { kind: "toString" } }).some((e) => /feed kind/.test(e)));
  assert.ok(part({ feed: { kind: "npm", package: "Not A Name" } }).some((e) => /feed package/.test(e)));
  assert.ok(part({ feed: { kind: "npm", package: "x", tag: "next" } }).some((e) => /feed tag/.test(e)));
  assert.ok(part({ feed: { kind: "github", repository: "https://github.com/a/b" } }).some((e) => /feed repository/.test(e)));
  assert.ok(part({ feed: { kind: "gitForWindows", repository: "a/b" } }).some((e) => /feed field repository is not allowed/.test(e)));
  assert.ok(part({ feed: { kind: "nodeDist", url: "https://x.test/" } }).some((e) => /feed field url is not allowed/.test(e)));
  assert.ok(part({ feed: { kind: "jevModels", updater: "x".repeat(201) } }).some((e) => /feed updater/.test(e)));
  assert.ok(part({ name: "Bad Name" }).some((e) => /part name/.test(e)));
});
test("lifecycle watching, dates and ignored", () => {
  assert.deepEqual(broken({ lifecycle: "watching" }), []);
  assert.ok(broken({ dates: [{ label: "Trial ends", on: "19 Nov" }] }).some((e) => /date on must be YYYY-MM-DD/.test(e)));
  assert.ok(errors({ catalogText: withTop({ ignored: [{ name: "ruff" }] }) }).some((e) => /ignored entry needs a reason/.test(e)));
});

test("a bold first choice must name a listed tool", () => {
  const skill = skillText.replace("**Graphify**", "**Sourcegraph**");
  assert.ok(errors({ skillText: skill }).some((e) => /"Sourcegraph" names no tool/.test(e)));
});

test("a tool with a recipe is named in the skill", () => {
  const text = withTools((t) => (t.find((x) => x.id === "openseo").name = "Open SEO Pro", t));
  assert.ok(errors({ catalogText: text }).some((e) => /\(openseo\): name not mentioned/.test(e)));
});

test("no dollar sign before a digit: Claude Code fills it with an argument", () => {
  assert.ok(errors({ skillText: `${skillText}\nCosts $5.` }).some((e) => /line \d+: dollar sign before a digit/.test(e)));
  assert.deepEqual(errors({ skillText: `${skillText}\nUse "\${1}", $ARGUMENTS and USD 30.` }), []);
});

test("version commands: every key names a command part and every command part has a key", () => {
  const good = { "git/cli": { argv: ["git", "--version"], pattern: /(\d+)/ } };
  const all = Object.fromEntries(catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind === "command").map((p) => [`${t.id}/${p.name}`, good["git/cli"]])));
  assert.deepEqual(errors({ commands: all }), []);
  assert.ok(errors({ commands: { ...all, "ghost/cli": good["git/cli"] } }).some((e) => /names no part/.test(e)));
  const notCommand = catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind !== "command").map((p) => `${t.id}/${p.name}`))[0];
  assert.ok(errors({ commands: { ...all, [notCommand]: good["git/cli"] } }).some((e) => /not command/.test(e)));
  const { "git/cli": _drop, ...missing } = all;
  assert.ok(errors({ commands: missing }).some((e) => /git\/cli has no version command/.test(e)));
});

test("self-updating tools: each id names a tool in the catalog", () => {
  assert.ok(Object.isFrozen(SELF_UPDATING_TOOLS));
  const names = SELF_UPDATING_TOOLS.map((id) => catalog.tools.find((t) => t.id === id)?.name);
  assert.deepEqual(names.sort(), ["Adobe for creativity", "Claude Code", "Wix"]);
  assert.deepEqual(errors({ selfUpdating: [...SELF_UPDATING_TOOLS] }), []);
  assert.ok(errors({ selfUpdating: [...SELF_UPDATING_TOOLS, "ghost"] }).some((e) => /self-updating tools: ghost names no tool/.test(e)));
});

test("version commands: argv[0] is a bare name or {share}/ without .., and {share}, {bin} and {lib} are the only tokens", () => {
  const all = Object.fromEntries(catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind === "command").map((p) => [`${t.id}/${p.name}`, { argv: ["git", "--version"], pattern: /(\d+)/ }])));
  const withArgv = (argv) => errors({ commands: { ...all, "git/cli": { argv, pattern: /(\d+)/ } } });
  assert.deepEqual(withArgv(["{share}/boat/boat.exe", "--version"]), []);
  assert.ok(withArgv(["{share}/../evil.exe"]).some((e) => /bare command name/.test(e)));
  assert.ok(withArgv(["{share}/a/../b.exe"]).some((e) => /bare command name/.test(e)));
  assert.ok(withArgv(["/abs/git"]).some((e) => /bare command name/.test(e)));
  assert.ok(withArgv(["git", "{home}/x"]).some((e) => /unknown token/.test(e)));
});

test("version commands: {bin}/ and the fixed cmd.exe shape are allowed; .., a second token and other cmd.exe forms are not", () => {
  const all = Object.fromEntries(catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind === "command").map((p) => [`${t.id}/${p.name}`, { argv: ["git", "--version"], pattern: /(\d+)/ }])));
  const withArgv = (argv) => errors({ commands: { ...all, "git/cli": { argv, pattern: /(\d+)/ } } });
  assert.deepEqual(withArgv(["cmd.exe", "/d", "/c", "{bin}/boat.cmd", "limits"]), []);
  assert.deepEqual(withArgv(["node", "{bin}/with-key.mjs", "k", "E", "node", "{lib}/cloudflare-verify.mjs"]), []);
  assert.deepEqual(withArgv(["{bin}/tool.exe", "--version"]), []);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{bin}/../evil.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{bin}/a/b.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{share}/x.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{bin}/x.exe"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/k", "{bin}/boat.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/c", "{bin}/boat.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "echo", "{bin}/boat.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe"]).length > 0);
  assert.ok(withArgv(["cmd", "/d", "/c", "{bin}/boat.cmd"]).length > 0);
  assert.ok(withArgv(["powershell", "-File", "x"]).length > 0);
  assert.ok(withArgv(["{bin}/../x.exe"]).length > 0);
  assert.ok(withArgv(["{bin}/a/b.exe"]).length > 0);
  assert.ok(withArgv(["git", "{bin}/{share}/x"]).some((e) => /unknown token/.test(e)));
  assert.ok(withArgv(["git", "{share}/a/{bin}/b"]).some((e) => /unknown token/.test(e)));
  assert.ok(withArgv(["git", "--x={share}/a"]).some((e) => /unknown token/.test(e)));
  assert.ok(withArgv(["git", "{bin}/../x"]).some((e) => /unknown token/.test(e)));
});

const goodCheck = { argv: ["gh", "api", "user"], ok: /\S/ };
test("connection checks: every key names a tool id", () => {
  assert.deepEqual(errors({ checks: { github: goodCheck } }), []);
  assert.ok(errors({ checks: { github: goodCheck, ghost: goodCheck } }).some((e) => /connection checks: ghost names no tool/.test(e)));
});
test("connection checks: at most one entry is paid", () => {
  assert.deepEqual(errors({ checks: { github: { ...goodCheck, paid: true }, depot: goodCheck } }), []);
  assert.ok(errors({ checks: { github: { ...goodCheck, paid: true }, depot: { ...goodCheck, paid: true } } }).some((e) => /connection checks: at most one check may be paid/.test(e)));
});
test("connection checks: argv follows the table rules and ok is a RegExp", () => {
  assert.ok(errors({ checks: { github: { argv: ["cmd.exe", "/k", "x"], ok: /x/ } } }).some((e) => /connection checks: github/.test(e)));
  assert.ok(errors({ checks: { github: { argv: ["gh", "{home}/x"], ok: /x/ } } }).some((e) => /unknown token/.test(e)));
  assert.ok(errors({ checks: { github: { argv: ["gh"], ok: "x" } } }).some((e) => /ok must be a RegExp/.test(e)));
  assert.ok(errors({ checks: { github: { argv: ["gh"], ok: /x/, paid: "yes" } } }).some((e) => /paid must be true/.test(e)));
});

test("connection checks: no token after the cmd.exe shim", () => {
  assert.deepEqual(errors({ checks: { github: { argv: ["cmd.exe", "/d", "/c", "{bin}/boat.cmd", "limits"], ok: /x/ } } }), []);
  assert.ok(errors({ checks: { github: { argv: ["cmd.exe", "/d", "/c", "{bin}/boat.cmd", "{share}/x"], ok: /x/ } } }).some((e) => /token after the shim/.test(e)));
  assert.ok(errors({ checks: { github: { argv: ["cmd.exe", "/d", "/c", "{bin}/boat.cmd", "{lib}/x"], ok: /x/ } } }).some((e) => /token after the shim/.test(e)));
});
