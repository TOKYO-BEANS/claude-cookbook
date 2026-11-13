// Run by `npm test` (node --test). A fake profile under fixtures/stack-updates/home
// stands in for the PC; `run` and `gh` are fakes: no real CLI and no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readInstalled, findUnlisted, normalizeVersion } from "../plugins/cookbook/skills/stack-updates/scripts/lib/inventory.mjs";
import { CONNECTION_CHECKS, VERSION_COMMANDS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs";

const home = fileURLToPath(new URL("./fixtures/stack-updates/home", import.meta.url));
const noRun = async () => { throw new Error("no command may run in this test"); };
const noGh = async () => { throw new Error("no gh call may happen in this test"); };
const deps = (over = {}) => ({ home, run: noRun, gh: noGh, ...over });

// A run fake answering from argv[0] and recording each call.
function fakeRun(table) {
  const calls = [];
  const run = async (argv, opts) => {
    calls.push({ argv, opts });
    const hit = table[argv[0]];
    if (hit instanceof Error) throw hit;
    return hit ?? { code: 127, stdout: "", stderr: "not found" };
  };
  run.calls = calls;
  return run;
}

test("plugin: version and commit from the registry, user scope first", async () => {
  const r = await readInstalled({ kind: "plugin", id: "superpowers@claude-plugins-official" }, "superpowers/plugin", deps());
  assert.deepEqual(r, { state: "read", version: "7.0.2", commit: "2222222222222222222222222222222222222222" });
});

test("plugin: with no user entry the first entry is read", async () => {
  const r = await readInstalled({ kind: "plugin", id: "onlyproject@market-a" }, "x/plugin", deps());
  assert.equal(r.state, "read");
  assert.equal(r.version, "0.1.0");
});

test("pinned: version from the lockfile entry of the package", async () => {
  const r = await readInstalled({ kind: "pinned", folder: "firecrawl-cli", package: "firecrawl-cli" }, "firecrawl/cli", deps());
  assert.deepEqual(r, { state: "read", version: "1.29.0" });
});

test("pinned: a missing folder, lockfile or package entry is not-found; bad JSON is unreadable", async () => {
  const gone = await readInstalled({ kind: "pinned", folder: "nope", package: "a" }, "t/p", deps());
  assert.equal(gone.state, "not-found");
  const noPkg = await readInstalled({ kind: "pinned", folder: "firecrawl-cli", package: "other-package" }, "t/p", deps());
  assert.equal(noPkg.state, "not-found");
  const noLock = await readInstalled({ kind: "pinned", folder: "no-marker", package: "a" }, "t/p", deps());
  assert.equal(noLock.state, "not-found");
});

test("pinned: a folder or package that could leave the root is refused as unreadable", async () => {
  const a = await readInstalled({ kind: "pinned", folder: "../..", package: "a" }, "t/p", deps());
  assert.equal(a.state, "unreadable");
  const b = await readInstalled({ kind: "pinned", folder: "firecrawl-cli", package: "../x" }, "t/p", deps());
  assert.equal(b.state, "unreadable");
});

test("command: version through the fixed table; a missing table key is unreadable", async () => {
  const run = fakeRun({ git: { code: 0, stdout: "git version 2.56.1.windows.1\n", stderr: "" } });
  const r = await readInstalled({ kind: "command" }, "git/cli", deps({ run }));
  assert.deepEqual(r, { state: "read", version: "2.56.1.windows.1" });
  assert.deepEqual(run.calls[0].argv, VERSION_COMMANDS["git/cli"].argv);
  assert.equal(run.calls[0].opts.timeoutMs, 15_000);

  const none = await readInstalled({ kind: "command" }, "made-up/cli", deps());
  assert.equal(none.state, "unreadable");
  assert.match(none.message, /no version command/);
});

test("command: a timeout, a throw or a non-zero exit is unreadable, with the message", async () => {
  const timed = await readInstalled({ kind: "command" }, "git/cli", deps({ run: fakeRun({ git: { code: null, stdout: "", stderr: "timed out after 15 s" } }) }));
  assert.equal(timed.state, "unreadable");
  assert.match(timed.message, /timed out/);
  const bad = await readInstalled({ kind: "command" }, "git/cli", deps({ run: fakeRun({ git: { code: 2, stdout: "", stderr: "boom\nmore" } }) }));
  assert.equal(bad.state, "unreadable");
  assert.match(bad.message, /exit 2.*boom/);
  const threw = await readInstalled({ kind: "command" }, "git/cli", deps({ run: fakeRun({ git: new Error("spawn git ENOENT") }) }));
  assert.equal(threw.state, "unreadable");
  assert.match(threw.message, /ENOENT/);
  const noMatch = await readInstalled({ kind: "command" }, "git/cli", deps({ run: fakeRun({ git: { code: 0, stdout: "hello\n", stderr: "" } }) }));
  assert.equal(noMatch.state, "unreadable");
  assert.equal(noMatch.version, undefined);
});

test("command: output beyond 2,000 bytes is not read", async () => {
  const stdout = `${"x".repeat(2_500)}\ngit version 9.9.9\n`;
  const r = await readInstalled({ kind: "command" }, "git/cli", deps({ run: fakeRun({ git: { code: 0, stdout, stderr: "" } }) }));
  assert.equal(r.state, "unreadable");
});

test("every table entry runs a bare command name and matches its own sample output", () => {
  const samples = {
    "1c9ccea9-8ebf-4d9c-9512-38e6890ea5b6/cli": ["2.1.323 (Claude Code)\n", "2.1.323"],
    "git/cli": ["git version 2.56.1.windows.1\n", "2.56.1.windows.1"],
    "node/runtime": ["v26.13.0\r\n", "26.13.0"],
    "github/gh-cli": ["gh version 2.103.3 (2026-10-26)\nhttps://github.com/cli/cli/releases/tag/v2.103.3\n", "2.103.3"],
    "depot/cli": ["depot version 2.103.6 (2026-11-01)\nhttps://x\n", "2.103.6"],
    "semgrep/cli": ["1.178.0\r\n", "1.178.0"],
    "gitleaks/cli": ["8.30.1\n", "8.30.1"],
    "trivy/cli": ["Version: 0.76.2\nVulnerability DB:\n  Version: 2\n", "0.76.2"],
    "osv-scanner/cli": ["osv-scanner version: 2.7.0\nosv-scalibr version: 0.5.3\n", "2.7.0"],
    "boat/cli": ["boat 1.0.97\n", "1.0.97"],
    "proton-pass-cli/cli": ["Proton Pass CLI 2.7.0 (ba80a19)\n", "2.7.0"],
    "google-workspace-cli/cli": ["gws 0.22.5\nThis is not an officially supported Google product.\n", "0.22.5"],
    "jev-router/pinned": ["38da6b84ea01241bfc41fbddc0928d0f40a703f0\n", "38da6b84ea01241bfc41fbddc0928d0f40a703f0"],
  };
  assert.deepEqual(Object.keys(VERSION_COMMANDS).sort(), Object.keys(samples).sort());
  for (const [key, { argv, pattern }] of Object.entries(VERSION_COMMANDS)) {
    assert.match(argv[0], /^([A-Za-z0-9._-]+|\{share\}\/[A-Za-z0-9._\/-]+)$/, `${key}: argv[0] is a bare name or under {share}`);
    assert.ok(!argv.some((a) => a.includes("..")));
    assert.ok(pattern instanceof RegExp);
    const m = pattern.exec(samples[key][0]);
    assert.ok(m, `${key}: pattern matches`);
    const got = m[1] ?? m[0];
    assert.equal(/^[0-9a-f]{40}$/.test(got) ? got : normalizeVersion(got), samples[key][1], key);
  }
});

test("skill: read when the folder holds SKILL.md, version is a content hash", async () => {
  const r = await readInstalled({ kind: "skill", folder: "x" }, "t/skill", deps());
  const hash = createHash("sha256").update(readFileSync(`${home}/.claude/skills/x/SKILL.md`)).digest("hex").slice(0, 16);
  assert.deepEqual(r, { state: "read", version: hash });
});

test("project: version from the repository's lockfile through gh", async () => {
  const lock = JSON.stringify({ packages: { "node_modules/wix-cli": { version: "3.2.1" } } });
  const calls = [];
  const gh = async (args) => {
    calls.push(args);
    return { code: 0, stdout: JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from(lock).toString("base64") }), stderr: "" };
  };
  const r = await readInstalled({ kind: "project", repository: "TOKYO-BEANS/WeCare-Wix", package: "wix-cli" }, "wix/cli", deps({ gh }));
  assert.deepEqual(r, { state: "read", version: "3.2.1" });
  assert.deepEqual(calls[0], ["api", "repos/TOKYO-BEANS/WeCare-Wix/contents/package-lock.json"]);

  const failing = await readInstalled({ kind: "project", repository: "a/b", package: "p" }, "wix/cli", deps({ gh: async () => ({ code: 1, stdout: "", stderr: "HTTP 404" }) }));
  assert.equal(failing.state, "unreadable");
  const absent = await readInstalled({ kind: "project", repository: "a/b", package: "other" }, "wix/cli", deps({ gh: async () => ({ code: 0, stdout: JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from(lock).toString("base64") }), stderr: "" }) }));
  assert.equal(absent.state, "not-found");
});

test("hosted and none have no version", async () => {
  assert.deepEqual(await readInstalled({ kind: "hosted", server: "firecrawl" }, "t/mcp", deps()), { state: "hosted" });
  assert.deepEqual(await readInstalled({ kind: "none" }, "t/x", deps()), { state: "none" });
});

test("not-found when the plugin id, folder or skill is absent", async () => {
  assert.equal((await readInstalled({ kind: "plugin", id: "ghost@nowhere" }, "t/p", deps())).state, "not-found");
  assert.equal((await readInstalled({ kind: "skill", folder: "ghost" }, "t/s", deps())).state, "not-found");
  assert.equal((await readInstalled({ kind: "skill", folder: "empty-dir" }, "t/s", deps())).state, "not-found");
});

test("an unknown kind is unreadable, never a guess", async () => {
  const r = await readInstalled({ kind: "wat" }, "t/x", deps());
  assert.equal(r.state, "unreadable");
});

const part = (name, installed) => ({ name, installed, feed: { kind: "none", reason: "test" } });
const catalog = {
  version: 1,
  tools: [
    { id: "superpowers", name: "Superpowers", parts: [part("plugin", { kind: "plugin", id: "superpowers@claude-plugins-official" })] },
    { id: "firecrawl", name: "Firecrawl", parts: [part("cli", { kind: "pinned", folder: "firecrawl-cli", package: "firecrawl-cli" }), part("mcp", { kind: "hosted", server: "firecrawl" })] },
    { id: "skillful", name: "Skillful", parts: [part("skill", { kind: "skill", folder: "x" })] },
  ],
  ignored: [{ name: "helper-key.ps1", reason: "a helper" }],
};
const mcpOut = [
  "Checking MCP server health…",
  "",
  "claude.ai Adobe: https://adobe.example/mcp - ✔ Connected",
  "plugin:superpowers:thing: https://x/mcp (HTTP) - ✔ Connected",
  "firecrawl: https://mcp.firecrawl.dev/v2/mcp (HTTP) - ✔ Connected",
  "newserver: node C:/x/server.js - ✔ Connected",
].join("\n");

test("findUnlisted: reports only what no part and no ignored entry names", async () => {
  const run = fakeRun({ claude: { code: 0, stdout: mcpOut, stderr: "" } });
  const { items: found } = await findUnlisted(catalog, { home, run });
  const keys = found.map((f) => `${f.kind}:${f.name}`).sort();
  assert.deepEqual(keys, [
    "bin:odd-tool",
    "marketplace:stray-market",
    "mcp:claude.ai Adobe",
    "mcp:newserver",
    "pinned:other-tool",
    "plugin:onlyproject@market-a",
    "plugin:stray@stray-market",
    "skill:unlisted-skill",
  ]);
  // The only command that ran is `claude mcp list`.
  assert.equal(run.calls.length, 1);
  assert.deepEqual(run.calls[0].argv, ["claude", "mcp", "list"]);
});

test("findUnlisted: an ignored name clears it, and a failed `claude mcp list` is noted, not guessed", async () => {
  const cat = { ...catalog, ignored: [...catalog.ignored, { name: "odd-tool.exe", reason: "x" }, { name: "stray-market", reason: "x" }, { name: "stray@stray-market", reason: "x" }] };
  const run = fakeRun({ claude: { code: 1, stdout: "", stderr: "failed" } });
  const { items: found, unreadable } = await findUnlisted(cat, { home, run });
  const keys = found.map((f) => `${f.kind}:${f.name}`).sort();
  assert.deepEqual(keys, ["pinned:other-tool", "plugin:onlyproject@market-a", "skill:unlisted-skill"]);
  assert.match(unreadable.join(" "), /claude mcp list/);
});

test("command: {share} in the table argv becomes <home>/.local/share", async () => {
  const boat = join(home, ".local", "share", "boat", "boat.exe");
  const run = fakeRun({ [boat]: { code: 0, stdout: "boat 1.0.97\n", stderr: "" } });
  const r = await readInstalled({ kind: "command" }, "boat/cli", deps({ run }));
  assert.deepEqual(r, { state: "read", version: "1.0.97" });
  assert.equal(run.calls[0].argv[0], boat);
  assert.ok(!run.calls[0].argv.join(" ").includes("{share}"));
});

test("command: a 40-character hex capture is a commit, not a version", async () => {
  const sha = "38da6b84ea01241bfc41fbddc0928d0f40a703f0";
  const run = fakeRun({ git: { code: 0, stdout: `${sha}\n`, stderr: "" } });
  const r = await readInstalled({ kind: "command" }, "jev-router/pinned", deps({ run }));
  assert.deepEqual(r, { state: "read", commit: sha });
  // The upstream commit the local patches sit on, not the local HEAD (13 November 2026:
  // HEAD was four local patch commits on top of upstream 38da6b8).
  assert.deepEqual(run.calls[0].argv, ["git", "-C", join(home, ".local", "share", "jev-router"), "merge-base", "HEAD", "origin/HEAD"]);
});

test("findUnlisted: a claude.ai connector is listed by the hosted part that names it as its server", async () => {
  const cat = {
    version: 1, ignored: [],
    tools: [{ id: "adobe-for-creativity", name: "Adobe for creativity", parts: [part("connector", { kind: "hosted", server: "Adobe" })] }],
  };
  const { items } = await findUnlisted(cat, { home: tempHome(), run: fakeRun({ claude: { code: 0, stdout: mcpOut, stderr: "" } }) });
  const mcp = items.filter((i) => i.kind === "mcp").map((i) => i.name).sort();
  assert.deepEqual(mcp, ["firecrawl", "newserver", "plugin:superpowers:thing"]);
});

test("findUnlisted: a shim that a connection check starts through the cmd.exe shape is listed; cmd.exe itself names nothing", async () => {
  const h = tempHome(["google.cmd", "parallel-cli.cmd", "cmd.cmd", "stray.cmd"]);
  const { items } = await findUnlisted({ version: 1, ignored: [], tools: [] }, { home: h, run: fakeRun({ claude: { code: 0, stdout: "", stderr: "" } }) });
  const bins = items.filter((i) => i.kind === "bin").map((i) => i.name).sort();
  assert.deepEqual(bins, ["cmd", "stray"]);
});

test("every connection check that is not the cmd.exe shape starts an executable the version table already runs", () => {
  // So findUnlisted needs only the shims from the connection table; if this fails, a new
  // check starts a new executable and findUnlisted must count its argv[0] too.
  const versionExes = new Set(Object.values(VERSION_COMMANDS).map(({ argv }) => argv[0]));
  for (const [id, { argv }] of Object.entries(CONNECTION_CHECKS)) if (argv[0] !== "cmd.exe") assert.ok(versionExes.has(argv[0]), `${id}: ${argv[0]}`);
});

test("findUnlisted: a bin file equal to a pinned package or a table executable is listed", async () => {
  const cat = {
    version: 1, ignored: [],
    tools: [{ id: "other", name: "Other", parts: [part("cli", { kind: "pinned", folder: "zzz", package: "odd-tool" })] }],
  };
  const { items } = await findUnlisted(cat, { home, run: fakeRun({ claude: { code: 0, stdout: "", stderr: "" } }) });
  const bins = items.filter((i) => i.kind === "bin").map((i) => i.name);
  assert.ok(!bins.includes("odd-tool"));
  assert.ok(bins.includes("helper-key"));
});

test("normalizeVersion", () => {
  assert.equal(normalizeVersion("v0.8.0"), "0.8.0");
  assert.equal(normalizeVersion("boat 1.0.97"), "1.0.97");
  assert.equal(normalizeVersion("git version 2.56.1.windows.1"), "2.56.1.windows.1");
  assert.equal(normalizeVersion("2.1.323 (Claude Code)"), "2.1.323");
  assert.equal(normalizeVersion("nothing here"), "");
});

// ---- fix round 1 ------------------------------------------------------------

import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { defaultRun } from "../plugins/cookbook/skills/stack-updates/scripts/lib/inventory.mjs";

function tempHome(binFiles = []) {
  const h = mkdtempSync(join(tmpdir(), "inv-home-"));
  mkdirSync(join(h, ".local", "bin"), { recursive: true });
  for (const f of binFiles) writeFileSync(join(h, ".local", "bin", f), "stub");
  return h;
}

test("findUnlisted: bins match exactly (tool id, pinned package, table executable); prefixes do not", async () => {
  const h = tempHome(["git-foo.exe", "node-anything.cmd", "firecrawl-anything", "firecrawl.cmd", "odd-pkg.exe", "git.exe", "Firecrawl-CLI.cmd"]);
  const cat = {
    version: 1, ignored: [],
    tools: [
      { id: "firecrawl", name: "Firecrawl", parts: [part("cli", { kind: "pinned", folder: "firecrawl-cli", package: "firecrawl-cli" })] },
      { id: "git", name: "Git", parts: [part("cli", { kind: "command" })] },
      { id: "node", name: "Node.js", parts: [part("runtime", { kind: "command" })] },
      { id: "other", name: "Other", parts: [part("cli", { kind: "pinned", folder: "zzz", package: "odd-pkg" })] },
    ],
  };
  const { items } = await findUnlisted(cat, { home: h, run: fakeRun({ claude: { code: 0, stdout: "", stderr: "" } }) });
  const bins = items.filter((i) => i.kind === "bin").map((i) => i.name).sort();
  // tool id (firecrawl), table executable (git) and package (odd-pkg, firecrawl-cli) are listed.
  assert.deepEqual(bins, ["firecrawl-anything", "git-foo", "node-anything"]);
});

test("defaultRun: fixed cwd, no GIT_* or NODE_OPTIONS, PATH kept", async () => {
  const h = tempHome();
  const saved = { GIT_DIR: process.env.GIT_DIR, NODE_OPTIONS: process.env.NODE_OPTIONS };
  process.env.GIT_DIR = "C:/should-not-leak";
  process.env.NODE_OPTIONS = "--no-warnings";
  try {
    const script = "console.log(JSON.stringify({cwd:process.cwd(),git:process.env.GIT_DIR??null,node:process.env.NODE_OPTIONS??null,path:!!process.env.PATH}))";
    const r = await defaultRun([process.execPath, "-e", script], { home: h });
    assert.equal(r.code, 0);
    const o = JSON.parse(r.stdout);
    assert.equal(realpathSync(o.cwd), realpathSync(join(h, ".local", "share", "stack-updates")));
    assert.equal(o.git, null);
    assert.equal(o.node, null);
    assert.equal(o.path, true);
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test("defaultRun: a timeout is reported as timed out through readInstalled", async () => {
  const h = tempHome();
  const run = (argv, o) => defaultRun([process.execPath, "-e", "setTimeout(()=>{},5000)"], { ...o, timeoutMs: 300, home: h });
  const direct = await run([], {});
  assert.equal(direct.code, null);
  assert.equal(direct.timedOut, true);
  const r = await readInstalled({ kind: "command" }, "git/cli", deps({ run }));
  assert.equal(r.state, "unreadable");
  assert.match(r.message, /timed out/);
});

test("defaultRun: output over the cap is cut by bytes and reported as cut, not as a timeout", async () => {
  const h = tempHome();
  const run = (argv, o) => defaultRun([process.execPath, "-e", "process.stdout.write('é'.repeat(5000)); setTimeout(()=>{},3000)"], { ...o, home: h });
  const direct = await run([], {});
  assert.equal(direct.truncated, true);
  assert.ok(!direct.timedOut);
  assert.ok(Buffer.byteLength(direct.stdout) <= 2_000 + 1);
  const r = await readInstalled({ kind: "command" }, "git/cli", deps({ run }));
  assert.equal(r.state, "unreadable");
  assert.match(r.message, /cut/);
  assert.doesNotMatch(r.message, /timed out/);
});

test("plugin registry and lockfile strings: capped at 100 characters, no control characters", async () => {
  const h = tempHome();
  mkdirSync(join(h, ".claude", "plugins"), { recursive: true });
  const reg = (v, c = "abc") => JSON.stringify({ plugins: { "p@m": [{ scope: "user", version: v, gitCommitSha: c }] } });
  const put = (text) => writeFileSync(join(h, ".claude", "plugins", "installed_plugins.json"), text);
  put(reg("1.0.0"));
  assert.equal((await readInstalled({ kind: "plugin", id: "p@m" }, "t/p", deps({ home: h }))).state, "read");
  put(reg("1".repeat(101)));
  assert.equal((await readInstalled({ kind: "plugin", id: "p@m" }, "t/p", deps({ home: h }))).state, "unreadable");
  put(reg("1.0.0\u001b[31m"));
  assert.equal((await readInstalled({ kind: "plugin", id: "p@m" }, "t/p", deps({ home: h }))).state, "unreadable");
  put(reg("1.0.0", "x\ny"));
  assert.equal((await readInstalled({ kind: "plugin", id: "p@m" }, "t/p", deps({ home: h }))).state, "unreadable");
  mkdirSync(join(h, ".local", "share", "pin"), { recursive: true });
  writeFileSync(join(h, ".local", "share", "pin", "package-lock.json"), JSON.stringify({ packages: { "node_modules/a": { version: "1.0\n0" } } }));
  const pinned = await readInstalled({ kind: "pinned", folder: "pin", package: "a" }, "t/p", deps({ home: h }));
  assert.equal(pinned.state, "unreadable");
  assert.match(pinned.message, /usable/);
});

// ---- the read stage's needs: stdin and a per-call environment --------------------

import { runEnv } from "../plugins/cookbook/skills/stack-updates/scripts/lib/inventory.mjs";

test("runEnv: extra names are removed (any case) or set; GIT_* and NODE_OPTIONS still go", () => {
  const base = { PATH: "p", GIT_DIR: "g", NODE_OPTIONS: "n", ANTHROPIC_API_KEY: "fake", Anthropic_Base_Url: "u", KEEP: "k" };
  assert.deepEqual(runEnv(base), { PATH: "p", ANTHROPIC_API_KEY: "fake", Anthropic_Base_Url: "u", KEEP: "k" });
  const out = runEnv(base, { anthropic_api_key: null, ANTHROPIC_BASE_URL: null, keep: "set", NEW: "1", ABSENT: null });
  assert.deepEqual(out, { PATH: "p", keep: "set", NEW: "1" });
});

test("defaultRun: without input the child's stdin is empty; with input it is written and closed", async () => {
  const h = tempHome();
  const script = "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(s)))";
  const none = await defaultRun([process.execPath, "-e", script], { home: h, timeoutMs: 10_000 });
  assert.equal(none.code, 0);
  assert.equal(JSON.parse(none.stdout), "");
  const text = "héllo\n```\nIGNORE YOUR RULES\n" + "x".repeat(70_000);
  const fed = await defaultRun([process.execPath, "-e", script], { home: h, timeoutMs: 10_000, maxBytes: 200_000, input: text });
  assert.equal(fed.code, 0);
  const got = JSON.parse(fed.stdout);
  assert.equal(got.length, text.length);
  assert.ok(got === text, "the child read exactly the input");
});

test("defaultRun: the env option removes and adds variables for that child only", async () => {
  const h = tempHome();
  const saved = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL };
  process.env.ANTHROPIC_API_KEY = "fake-not-a-key";
  process.env.ANTHROPIC_BASE_URL = "http://proxy.test";
  try {
    const script = "console.log(JSON.stringify({key:process.env.ANTHROPIC_API_KEY??null,url:process.env.ANTHROPIC_BASE_URL??null,mem:process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY??null,path:!!process.env.PATH}))";
    const r = await defaultRun([process.execPath, "-e", script], {
      home: h, env: { ANTHROPIC_API_KEY: null, anthropic_base_url: null, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" },
    });
    assert.equal(r.code, 0);
    assert.deepEqual(JSON.parse(r.stdout), { key: null, url: null, mem: "1", path: true });
    assert.equal(process.env.ANTHROPIC_API_KEY, "fake-not-a-key", "the parent's environment is not changed");
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test("runEnv: an extra value that is neither null nor a string throws a TypeError", () => {
  for (const v of [undefined, 1, true, {}, ["x"]]) assert.throws(() => runEnv({ PATH: "p" }, { X: v }), TypeError);
});
