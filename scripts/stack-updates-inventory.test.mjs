// Run by `npm test` (node --test). A fake profile under fixtures/stack-updates/home
// stands in for the PC; `run` and `gh` are fakes: no real CLI and no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readInstalled, findUnlisted, normalizeVersion } from "../plugins/cookbook/skills/stack-updates/scripts/lib/inventory.mjs";
import { VERSION_COMMANDS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs";

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
  };
  assert.deepEqual(Object.keys(VERSION_COMMANDS).sort(), Object.keys(samples).sort());
  for (const [key, { argv, pattern }] of Object.entries(VERSION_COMMANDS)) {
    assert.match(argv[0], /^[A-Za-z0-9._-]+$/, `${key}: argv[0] is a bare command name`);
    assert.ok(pattern instanceof RegExp);
    const m = pattern.exec(samples[key][0]);
    assert.ok(m, `${key}: pattern matches`);
    assert.equal(normalizeVersion(m[1] ?? m[0]), samples[key][1], key);
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
  const found = await findUnlisted(catalog, { home, run });
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
  const found = await findUnlisted(cat, { home, run });
  const keys = found.map((f) => `${f.kind}:${f.name}`).sort();
  assert.deepEqual(keys, ["pinned:other-tool", "plugin:onlyproject@market-a", "skill:unlisted-skill"]);
  assert.match(found.unreadable.join(" "), /claude mcp list/);
});

test("normalizeVersion", () => {
  assert.equal(normalizeVersion("v0.8.0"), "0.8.0");
  assert.equal(normalizeVersion("boat 1.0.97"), "1.0.97");
  assert.equal(normalizeVersion("git version 2.56.1.windows.1"), "2.56.1.windows.1");
  assert.equal(normalizeVersion("2.1.323 (Claude Code)"), "2.1.323");
  assert.equal(normalizeVersion("nothing here"), "");
});
