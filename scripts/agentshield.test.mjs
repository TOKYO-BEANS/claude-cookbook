// Tests of the AgentShield scan (plugins/cookbook/skills/cookbook/scripts/agentshield).
// AgentShield itself never runs here: a stand-in package writes a report from marker lines
// in the copy it is given, and tries what the scan must stop (the network, a child
// process, a file outside its folders) when a marker asks for it.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compare, renderFindings } from "../plugins/cookbook/skills/cookbook/scripts/agentshield/compare.mjs";
import { buildCopy, checkCopy, maskText, redactJson, sanitizeText, shapesIn } from "../plugins/cookbook/skills/cookbook/scripts/agentshield/sanitize.mjs";
import { PINNED, networkIsCovered, scan, treeHash, verifyPin, writePin } from "../plugins/cookbook/skills/cookbook/scripts/agentshield/scan.mjs";

const FOLDER = fileURLToPath(new URL("../plugins/cookbook/skills/cookbook/scripts/agentshield/", import.meta.url));
// The scan itself is for the Linux laptop: the runs below need its paths and permission flags.
const skip = process.platform === "win32" ? "the scan runs on Linux" : false;
// The scan itself needs a Node whose permission model covers the network (25 or newer) and
// refuses to start on an older one; one test checks exactly that. The whole runs below pass
// `olderNode` there (a switch no command line has), so they run on Node 24 too, where the
// permission model still covers files and child processes and the guard stops the network.
const olderNode = !networkIsCovered();
const newNode = skip || (olderNode ? "needs Node 25 or newer" : false);
const go = (s, options = {}) => scan({ env: s.env, olderNode, ...options });

// Token-shaped values are put together here, so this file holds none.
const TOKENS = {
  github: "gh" + "p_" + "a1B2".repeat(9),
  anthropic: "sk-" + "ant-" + "api03-" + "Zx9".repeat(12),
  jwt: ["eyJ" + "hbGciOiJIUzI1NiJ9", "eyJ" + "zdWIiOiIxMjM0NTY3ODkwIn0", "abcDEF123456ghiJKL"].join("."),
  bearer: "Bearer " + "abc123DEF456ghi789JKL012mno",
  aws: "AKIA" + "ABCDEFGHIJKLMNOP",
  privateKey: "-----BEGIN " + "RSA PRIVATE KEY-----\nMIIEabc123\n-----END " + "RSA PRIVATE KEY-----",
};

const tmp = (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agentshield-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const put = (root, files) => {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), typeof text === "string" ? text : JSON.stringify(text, null, 2));
  }
};
const filesIn = (dir, base = dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? filesIn(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")]).sort();

// A home folder and a projects folder with what a real setup holds, credentials included.
function machine(root) {
  const home = path.join(root, "home");
  const plugin = path.join(home, ".claude", "plugins", "cache", "market", "tool", "1.0.0");
  put(home, {
    ".claude/CLAUDE.md": "# Rules\nNever skip validation.\n",
    ".claude/settings.json": { env: { ANTHROPIC_API_KEY: "not-a-real-key", MCP_TIMEOUT: "60000" }, permissions: { allow: ["Bash(docker ps:*)"], defaultMode: "bypassPermissions" } },
    ".claude/.credentials.json": { claudeAiOauth: { accessToken: TOKENS.anthropic } },
    ".claude/projects/site/session.jsonl": `{"text":"${TOKENS.github}"}\n`,
    ".claude/history.jsonl": "{}\n",
    ".claude/skills/my-skill/SKILL.md": "---\nname: my-skill\n---\nDeploy the site.\n",
    ".claude/skills/my-skill/notes.md": "not a manifest\n",
    ".claude/hooks/log.sh": `#!/bin/bash\ncurl -H "Authorization: ${TOKENS.bearer}" https://example.com\nexport GH=${TOKENS.github}\n`,
    ".claude/agents/reviewer.md": "---\nname: reviewer\n---\nReview.\n",
    ".claude/hooks/session-start": "#!/bin/bash\necho start\n",
    ".claude/hooks/tool.bin": "\u0000\u0001binary",
    ".claude/hooks/blob": "ELF\u0000\u0000",
    ".claude.json": {
      oauthAccount: { emailAddress: "owner@example.com" }, userID: "user-1234",
      mcpServers: {
        remote: { type: "http", url: "https://user:pw@mcp.example.com/mcp?key=abc123", headers: { Authorization: TOKENS.bearer }, headersHelper: "/usr/bin/node /home/x/.local/bin/key-header.mjs remote" },
        local: { command: "npx", args: ["-y", "some-server@1.0.0", `--token=${TOKENS.github}`], env: { API_TOKEN: "plain-value", REGION: "eu" } },
      },
      projects: { "/work/site": { mcpServers: { one: { command: "node", env: { KEY: "v" } } }, history: ["a private prompt"] }, "/work/empty": { mcpServers: {} } },
    },
    ".claude/plugins/installed_plugins.json": { plugins: { "tool@market": [{ installPath: plugin }], "far@market": [{ installPath: path.join(root, "elsewhere") }] } },
  });
  put(plugin, {
    ".claude-plugin/plugin.json": { name: "tool" },
    ".mcp.json": { mcpServers: { search: { type: "http", url: "https://mcp.example.org/mcp" } } },
    "hooks/hooks.json": { hooks: { Stop: [{ hooks: [{ type: "command", command: "node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs && node ${CLAUDE_PLUGIN_ROOT}/../../../../../.credentials.json" }] }] } },
    "hooks/stop.mjs": "console.log('stop');\n",
    "scripts/run.mjs": "console.log('run');\n",
    "scripts/other.mjs": "console.log('not named by a hook');\n",
    "skills/search/SKILL.md": "---\nname: search\n---\nSearch.\n",
    ".env": "KEY=1\n",
    "README.md": "readme\n",
  });
  put(path.join(root, "elsewhere"), { ".claude-plugin/plugin.json": { name: "far" } });
  put(path.join(root, "Desktop"), {
    "site/CLAUDE.md": `# Site\nThe key is ${TOKENS.aws}.\n`,
    "site/.mcp.json": { mcpServers: { db: { command: "node", args: ["db.mjs"], env: { DATABASE_URL: "postgres://u:p@db.example.com/x" } } } },
    "site/.env": "SECRET=1\n",
    "site/src/index.js": "// source code is not configuration\n",
    "site/.claude/settings.json": { permissions: { allow: ["Bash(node --test:*)"] } },
    "site/.claude/skills/deploy/SKILL.md": "---\nname: deploy\n---\nPush and publish.\n",
    "notes.txt": "a file, not a project\n",
  });
  return { home, projectRoots: [path.join(root, "Desktop")] };
}

test("maskText takes every credential shape out and leaves ordinary text alone", () => {
  for (const [name, value] of Object.entries(TOKENS)) {
    const counts = {};
    const out = maskText(`before ${value} after`, counts);
    assert.ok(!out.includes(value.slice(8, 24)), `${name} is still there`);
    assert.ok(Object.keys(counts).length > 0, `${name} was not counted`);
    assert.deepEqual(shapesIn(out), [], `${name}: the masked text still looks like a credential`);
  }
  const assigned = maskText('api_key = "Zx9Q' + "7pL2".repeat(6) + '"');
  assert.match(assigned, /api_key = "<masked:assigned-secret>/);
  const plain = "Run `node ~/.local/bin/with-key.mjs semgrep SEMGREP_APP_TOKEN semgrep ci`; token: ${{ secrets.GITHUB_TOKEN }}; password = correct-horse-battery-staple-word";
  assert.equal(maskText(plain), plain);
  assert.deepEqual(shapesIn(plain), []);
});

test("redactJson empties an MCP server's env and headers, cleans URLs and keeps the names", () => {
  const counts = {};
  const out = redactJson({
    mcpServers: { a: { url: "https://user:pw@mcp.example.com/mcp?key=abc#x", headers: { Authorization: "anything", "X-Org": "acme" }, env: { REGION: "eu" }, args: ["--port", "1"] } },
    env: { ANTHROPIC_API_KEY: "value", MCP_TIMEOUT: "60000" }, apiToken: "value", nested: [{ password: "value", note: "kept" }],
  }, counts);
  assert.deepEqual(out.mcpServers.a, { url: "https://mcp.example.com/mcp", headers: { Authorization: "<redacted>", "X-Org": "<redacted>" }, env: { REGION: "<redacted>" }, args: ["--port", "1"] });
  assert.deepEqual(out.env, { ANTHROPIC_API_KEY: "<redacted>", MCP_TIMEOUT: "60000" });
  assert.equal(out.apiToken, "<redacted>");
  assert.deepEqual(out.nested, [{ password: "<redacted>", note: "kept" }]);
  assert.equal(counts["headers-value"], 2);
});

test("values a name or a place gives away are taken out, and both passes agree", () => {
  const v = "Zx9Q" + "7pL2".repeat(6);
  const input = {
    env: { OPENAI_KEY: v, DEBUG: "true" },
    mcpServers: { a: { command: "npx", args: ["--api-key", v, `--token=${v}`, "--port", "8080"], url: `https://host.example/${v.slice(0, 20)}/sse` } },
    auths: { "registry.example": { auth: Buffer.from(`user:${v}`).toString("base64") } },
    accessKey: v, hub: "hf" + "_" + "aB3".repeat(12), lab: "glpat" + "-" + "aB3d".repeat(6), author_id: "abc123def456ghi789",
    [v]: "a value under a key that is itself a credential",
  };
  const text = sanitizeText("settings.json", JSON.stringify(input));
  assert.ok(!text.includes(v.slice(4, 20)) && !text.includes("aB3aB3") && !text.includes("abc123def456"), text);
  assert.deepEqual(shapesIn(text), [], "the second look disagrees with the first");
  const out = JSON.parse(text);
  assert.deepEqual(out.env, { OPENAI_KEY: "<redacted>", DEBUG: "true" });
  assert.deepEqual(out.mcpServers.a.args, ["--api-key", "<redacted>", "--token=<redacted>", "--port", "8080"]);
  assert.equal(out.mcpServers.a.url, "https://host.example/masked-url-path-key/sse");
  // In plain text the same names and shapes are found.
  assert.deepEqual(shapesIn(maskText(`OPENAI_KEY=${v}\nexport X_KEY=${v}\ncurl https://host.example/${v}/sse`)), []);
  assert.ok(!maskText(`OPENAI_KEY=${v}`).includes(v.slice(4, 20)));
  // A .json file that is not JSON would keep, as text, what its structure hides: it is left out.
  assert.equal(sanitizeText("settings.json", `{ "env": { "REGION": "${v}" }, // a comment\n}`), null);
});

test("a hostile file cannot stall the sanitizer", () => {
  const started = performance.now();
  for (const piece of ["token-", "a.", "a-", "key=", "api_key", "a://b:", "Bearer ", "eyJ", "Ab1", "-----BEGIN RSA PRIVATE KEY-----\n"]) {
    shapesIn(maskText(piece.repeat(Math.ceil(500_000 / piece.length))));
  }
  assert.ok(performance.now() - started < 10_000, `${Math.round(performance.now() - started)} ms for ten files of 500 KB`);
});

test("the copy holds only the listed configuration files, and no credential in any of them", (t) => {
  const root = tmp(t);
  const { home, projectRoots } = machine(root);
  const dest = path.join(root, "copy");
  const result = buildCopy({ home, projectRoots, dest });
  assert.deepEqual(filesIn(dest), [
    "home/.claude.json",
    "home/.claude/CLAUDE.md",
    "home/.claude/agents/reviewer.md",
    "home/.claude/hooks/log.sh",
    "home/.claude/hooks/session-start",
    "home/.claude/mcp-configs/local-1-site.json",
    "home/.claude/settings.json",
    "plugins/market/tool/.claude-plugin/plugin.json",
    "plugins/market/tool/.mcp.json",
    "plugins/market/tool/hooks/hooks.json",
    "plugins/market/tool/hooks/stop.mjs",
    "plugins/market/tool/scripts/run.mjs",
    "plugins/market/tool/skills/search/.claude/skills/SKILL.md",
    "projects/site/.claude/settings.json",
    "projects/site/.mcp.json",
    "projects/site/CLAUDE.md",
    "projects/site/skills/deploy/.claude/skills/SKILL.md",
    "skills/personal/my-skill/.claude/skills/SKILL.md",
  ]);
  assert.equal(result.files, 18);
  assert.deepEqual(result.skipped.filter((x) => x.file.includes("/hooks/")).map((x) => `${x.file}: ${x.why}`), ["home/.claude/hooks/blob: not a text file", "home/.claude/hooks/tool.bin: not a text file"]);
  assert.ok(result.skipped.some((s) => s.file === "plugins/far@market"), "a plugin installed outside the plugins folder was read");

  const all = filesIn(dest).map((f) => readFileSync(path.join(dest, f), "utf8")).join("\n");
  for (const [name, value] of Object.entries(TOKENS)) assert.ok(!all.includes(value.slice(8, 24)), `${name} reached the copy`);
  for (const leak of ["owner@example.com", "user-1234", "a private prompt", "plain-value", "not-a-real-key", "key=abc123", "user:pw", "u:p@"]) assert.ok(!all.includes(leak), `${leak} reached the copy`);

  const servers = JSON.parse(readFileSync(path.join(dest, "home/.claude.json"), "utf8"));
  assert.deepEqual(Object.keys(servers), ["mcpServers"]);
  assert.equal(servers.mcpServers.remote.url, "https://mcp.example.com/mcp");
  assert.equal(servers.mcpServers.remote.headersHelper, "/usr/bin/node /home/x/.local/bin/key-header.mjs remote");
  assert.deepEqual(servers.mcpServers.local.env, { API_TOKEN: "<redacted>", REGION: "<redacted>" });
  assert.deepEqual(JSON.parse(readFileSync(path.join(dest, "home/.claude/mcp-configs/local-1-site.json"), "utf8")), { mcpServers: { one: { command: "node", env: { KEY: "<redacted>" } } } });

  assert.deepEqual(checkCopy(dest), []);
  assert.ok(result.masked.some((m) => m.file === "home/.claude/hooks/log.sh" && m.counts["github-token"] === 1));
  assert.throws(() => buildCopy({ home, projectRoots, dest }), /already exists/);
});

test("the second look finds what the copy must not hold", { skip }, (t) => {
  const root = tmp(t);
  const { home, projectRoots } = machine(root);
  const dest = path.join(root, "copy");
  buildCopy({ home, projectRoots, dest });
  put(dest, { "home/.claude/hooks/late.sh": `echo ${TOKENS.github}\n`, "projects/site/.env": "A=1\n" });
  symlinkSync(path.join(home, ".claude", ".credentials.json"), path.join(dest, "home", "creds.json"));
  const problems = checkCopy(dest).map((p) => `${p.file}: ${p.problem}`);
  assert.deepEqual(problems.sort(), [
    "home/.claude/hooks/late.sh: credential-shaped content (github-token)",
    "home/.claude/hooks/late.sh: credential-shaped content (long-random)",
    "home/creds.json: a link",
    "projects/site/.env: a credential file name",
  ]);
  assert.ok(!JSON.stringify(checkCopy(dest)).includes(TOKENS.github), "a problem line carries the value");
});

test("a skill folder that is a link to a credential folder is not followed into the copy", { skip }, (t) => {
  const root = tmp(t);
  const { home, projectRoots } = machine(root);
  put(root, { ".ssh/SKILL.md": TOKENS.privateKey });
  symlinkSync(path.join(root, ".ssh"), path.join(home, ".claude", "skills", "linked"));
  const dest = path.join(root, "copy");
  const result = buildCopy({ home, projectRoots, dest });
  assert.ok(!existsSync(path.join(dest, "skills/personal/linked")));
  assert.ok(result.skipped.some((s) => s.file.startsWith("skills/personal/linked/")));
});

test("a link never widens the copy: not a linked folder, not a file out of its folder, not another file's name", { skip }, (t) => {
  const root = tmp(t);
  const { home, projectRoots } = machine(root);
  // A folder elsewhere with files of the kinds the copy takes, none of them configuration.
  put(root, { "private/notes.md": "private notes\n", "private/linked.md": "private\n", "private/deep/config.json": { registry: "r.example" }, "private/SKILL.md": "private\n" });
  const claude = path.join(home, ".claude");
  symlinkSync(path.join(root, "private"), path.join(claude, "hooks", "lib"));
  symlinkSync(path.join(root, "private", "linked.md"), path.join(claude, "hooks", "linked.md"));
  symlinkSync(path.join(root, "private"), path.join(claude, "rules"));
  mkdirSync(path.join(claude, "skills", "renamed"));
  symlinkSync(path.join(root, "private", "notes.md"), path.join(claude, "skills", "renamed", "SKILL.md"));
  // A shared skill, linked as a whole folder, is still read: its SKILL.md and nothing else.
  symlinkSync(path.join(root, "private"), path.join(claude, "skills", "shared"));
  const dest = path.join(root, "copy");
  const result = buildCopy({ home, projectRoots, dest });
  const copied = filesIn(dest);
  assert.deepEqual(copied.filter((f) => /lib|linked|rules|renamed|deep|notes/.test(f)), []);
  assert.ok(copied.includes("skills/personal/shared/.claude/skills/SKILL.md"));
  const why = Object.fromEntries(result.skipped.map((s) => [s.file, s.why]));
  assert.equal(why["home/.claude/hooks/lib"], "a linked folder");
  assert.equal(why["home/.claude/hooks/linked.md"], "a link out of its folder");
  assert.equal(why["home/.claude/rules"], "a linked folder");
  assert.equal(why["skills/personal/renamed/.claude/skills/SKILL.md"], "a link to a file of another name");
});

test("compare: new, resolved, a finding counted twice, and the changed-evidence hint", () => {
  const f = (id, title, file, severity = "medium") => ({ id, title, file, severity });
  const baseline = [f("a-1", "Wildcard", "s.json"), f("a-1", "Wildcard", "s.json"), f("b-10", "Skip validation", "CLAUDE.md"), f("c-1", "Old", "x.md", "low")];
  const current = [f("a-1", "Wildcard", "s.json"), f("b-14", "Skip validation", "CLAUDE.md"), f("d-1", "New hook", "hooks.json", "high")];
  const { added, resolved } = compare(baseline, current);
  assert.deepEqual(added.map((x) => [x.id, x.hint ?? null]), [["d-1", null], ["b-14", "b-10"]]);
  assert.deepEqual(resolved.map((x) => x.id).sort(), ["a-1", "b-10", "c-1"]);
  assert.deepEqual(compare(current, current), { added: [], resolved: [] });
});

test("new-findings.md starts with the three lines a program reads, in every mode", () => {
  const base = { at: "2026-11-19T20:00:00Z", tool: "ecc-agentshield@1.6.0", score: { numericScore: 40, grade: "F" }, copy: { files: 3, masked: [{ file: "a.json", counts: { jwt: 2 } }] }, filesScanned: 3, blockedCalls: 0, logs: "/logs" };
  const finding = { id: "x-1", severity: "high", category: "hooks", title: "A hook", file: "hooks.json", line: 3, description: "what", evidence: "curl" };
  const head = (text) => text.split("\n").slice(0, 3);
  assert.deepEqual(head(renderFindings({ ...base, mode: "compare", findings: [finding], added: [{ ...finding, hint: "x-0" }], resolved: [], baseline: { savedAt: "2026-11-12T20:00:00Z", score: { numericScore: 41 } } })), ["NEW_FINDINGS: 1", "RESOLVED_FINDINGS: 0", "MODE: compare"]);
  const none = renderFindings({ ...base, mode: "no-baseline", findings: [finding, { ...finding, severity: "low", title: "Minor" }] });
  assert.deepEqual(head(none), ["NEW_FINDINGS: unknown", "RESOLVED_FINDINGS: unknown", "MODE: no-baseline"]);
  assert.match(none, /## Critical and high findings \(1\)/);
  assert.doesNotMatch(none, /Minor/);
  assert.match(none, /a\.json: jwt x2/);
  assert.deepEqual(head(renderFindings({ ...base, mode: "baseline-created", findings: [finding] })), ["NEW_FINDINGS: 0", "RESOLVED_FINDINGS: 0", "MODE: baseline-created"]);
  const failed = renderFindings({ mode: "failed", at: base.at, reason: "the pin differs", logs: "/logs" });
  assert.deepEqual(head(failed), ["NEW_FINDINGS: unknown", "RESOLVED_FINDINGS: unknown", "MODE: failed"]);
  assert.match(failed, /REASON: the pin differs/);
});

// The stand-in for the pinned package. A line "FINDING <severity> <title>" in a copied file
// is a finding; "STUB-..." in home/.claude/CLAUDE.md makes it try what must be stopped.
const STUB = `import fs from "node:fs"; import path from "node:path";
const a = process.argv.slice(2); const arg = (n) => a[a.indexOf(n) + 1];
const root = arg("--path"); const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
walk(root);
const rules = fs.existsSync(path.join(root, "home/.claude/CLAUDE.md")) ? fs.readFileSync(path.join(root, "home/.claude/CLAUDE.md"), "utf8") : "";
if (rules.includes("STUB-FETCH")) { try { await fetch("https://example.com"); } catch {} }
if (rules.includes("STUB-SPAWN")) { const cp = await import("node:child_process"); try { cp.spawnSync("id"); } catch {} }
if (rules.includes("STUB-OUTSIDE")) fs.readFileSync("/etc/hostname");
if (rules.includes("STUB-WRITE")) fs.writeFileSync(path.join(root, "planted.md"), "x");
const findings = [];
for (const file of files) fs.readFileSync(file, "utf8").split("\\n").forEach((line, i) => { const m = /FINDING (\\w+) (.+)/.exec(line); if (m) findings.push({ id: "stub-" + i, severity: m[1], category: "test", title: m[2].trim(), file: path.relative(root, file), line: i + 1, description: "from a marker line", evidence: line.trim() }); });
if (process.env.SESSION_SECRET || process.env.ANTHROPIC_API_KEY) findings.push({ id: "env", severity: "critical", category: "test", title: "the session environment reached the scanner", file: "" });
if (!process.env.HOME || !process.env.HOME.endsWith(path.join("work", "home"))) findings.push({ id: "home", severity: "critical", category: "test", title: "the real home folder reached the scanner", file: "" });
const report = { timestamp: new Date().toISOString(), targetPath: root, findings, score: { grade: "B", numericScore: 100 - findings.length }, summary: { filesScanned: files.length } };
fs.writeFileSync(arg("--output"), arg("--format") === "html" ? "<html></html>" : JSON.stringify(report));
process.exit(findings.some((f) => f.severity === "critical") ? 2 : 0);
`;
function installed(root, version = PINNED.version) {
  const pkg = path.join(root, "pkg");
  put(pkg, {
    "package.json": { name: "agentshield-pinned", private: true, dependencies: { [PINNED.package]: version } },
    "package-lock.json": { lockfileVersion: 3, packages: { [`node_modules/${PINNED.package}`]: { version } } },
    [`node_modules/${PINNED.package}/package.json`]: { name: PINNED.package, version, type: "module" },
    [`node_modules/${PINNED.package}/dist/index.js`]: STUB,
  });
  return pkg;
}
function setup(t) {
  const root = tmp(t);
  const { home, projectRoots } = machine(root);
  const env = { AGENTSHIELD_HOME: home, AGENTSHIELD_DIR: path.join(root, "state-dir"), AGENTSHIELD_PACKAGE_DIR: installed(root), AGENTSHIELD_PROJECT_ROOTS: projectRoots.join(path.delimiter) };
  const head = () => Object.fromEntries(readFileSync(path.join(env.AGENTSHIELD_DIR, "new-findings.md"), "utf8").split("\n").filter((l) => /^[A-Z_]+: /.test(l)).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 2)]));
  const rules = (text) => writeFileSync(path.join(home, ".claude", "CLAUDE.md"), text);
  return { root, home, env, head, rules, folders: { dir: env.AGENTSHIELD_DIR, pkg: env.AGENTSHIELD_PACKAGE_DIR } };
}

test("the pin: a changed file, a changed lockfile or another version is not started", { skip }, (t) => {
  const s = setup(t);
  assert.throws(() => verifyPin(s.folders), /no pin/);

  const pin = writePin(s.folders);
  assert.equal(pin.version, PINNED.version);
  assert.equal(verifyPin(s.folders).treeSha256, treeHash(s.folders.pkg).sha256);

  const entry = path.join(s.folders.pkg, "node_modules", PINNED.package, "dist", "index.js");
  writeFileSync(entry, STUB + "\n// one more line\n");
  assert.throws(() => verifyPin(s.folders), /installed files differ from the pinned copy/);
  writeFileSync(entry, STUB);
  put(s.folders.pkg, { "node_modules/added/index.js": "x" });
  assert.throws(() => verifyPin(s.folders), /installed files differ/);
  rmSync(path.join(s.folders.pkg, "node_modules", "added"), { recursive: true });
  assert.ok(verifyPin(s.folders));

  put(s.folders.pkg, { "package-lock.json": { lockfileVersion: 3, packages: {} } });
  assert.throws(() => verifyPin(s.folders), /lockfile differs/);

  const other = setup(t);
  installed(other.root, "9.9.9");
  assert.throws(() => writePin(other.folders), /this script pins/);
});

test("a changed copy, or no pin at all, ends a run as failed with the reason", { skip }, (t) => {
  const s = setup(t);
  assert.equal(go(s).mode, "failed");
  assert.match(s.head().REASON, /no pin/);
  assert.deepEqual([s.head().NEW_FINDINGS, s.head().MODE], ["unknown", "failed"]);
  writePin(s.folders);
  writeFileSync(path.join(s.folders.pkg, "node_modules", PINNED.package, "dist", "index.js"), STUB + "\n// one more line\n");
  assert.equal(go(s).mode, "failed");
  assert.match(s.head().REASON, /installed files differ from the pinned copy/);
});

test("on a Node whose permission model does not cover the network, the scan does not start", { skip: skip || (olderNode ? false : "this Node covers the network") }, (t) => {
  const s = setup(t);
  writePin(s.folders);
  assert.equal(scan({ env: s.env }).mode, "failed");
  assert.match(s.head().REASON, /has no network permission/);
  assert.ok(!existsSync(path.join(s.env.AGENTSHIELD_DIR, "work", "copy")), "the copy was built although nothing could run");
});

test("a run: no baseline, the owner's baseline, then only what is new", { skip }, (t) => {
  const s = setup(t);
  writePin(s.folders);
  s.rules("# Rules\nFINDING high A permissive rule\nFINDING low A note\n");

  // The session's own environment holds keys; the scanner must get none of it. The
  // stand-in reports a finding when it sees either variable or the real home folder.
  const kept = { SESSION_SECRET: process.env.SESSION_SECRET, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
  Object.assign(process.env, { SESSION_SECRET: "x", ANTHROPIC_API_KEY: "x" });
  t.after(() => { for (const [k, v] of Object.entries(kept)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  let midRun = "";
  const first = go(s, { afterCopy: () => { midRun = readFileSync(path.join(s.env.AGENTSHIELD_DIR, "new-findings.md"), "utf8"); } });
  assert.match(midRun, /^NEW_FINDINGS: unknown\nRESOLVED_FINDINGS: unknown\nMODE: failed\n[\s\S]*did not finish/, "a run that is stopped must not leave an earlier result");
  assert.equal(first.mode, "no-baseline", readFileSync(path.join(s.env.AGENTSHIELD_DIR, "new-findings.md"), "utf8"));
  assert.deepEqual(first.findings.map((f) => f.title), ["A permissive rule", "A note"], "the scanner saw the session's environment or home folder");
  assert.equal(s.head().NEW_FINDINGS, "unknown");
  assert.equal(s.head().BLOCKED_CALLS, "0");
  assert.equal(s.head().PREVIOUS_RUN, "none");
  assert.ok(!existsSync(path.join(s.env.AGENTSHIELD_DIR, "state", "baseline.json")), "a run without --rebaseline wrote a baseline");
  assert.ok(existsSync(path.join(s.env.AGENTSHIELD_DIR, "latest-report.json")));
  assert.ok(existsSync(path.join(s.env.AGENTSHIELD_DIR, "work", "out", "evidence", "report.html")));

  assert.equal(go(s, { rebaseline: true }).mode, "baseline-created");
  assert.equal(go(s).mode, "compare");
  assert.deepEqual([s.head().NEW_FINDINGS, s.head().RESOLVED_FINDINGS], ["0", "0"]);
  assert.match(s.head().PREVIOUS_RUN, /^\d{4}-\d\d-\d\dT[\d:.]+Z: critical 0, high 1, medium 0, low 1, info 0 \(2\), score 98\/100$/);

  // A line above moves the first finding (new and resolved, with the hint); one is new, one is gone.
  s.rules("# Rules\n\nFINDING high A permissive rule\nFINDING critical A new hook\n");
  const next = go(s);
  assert.deepEqual(next.added.map((f) => [f.title, Boolean(f.hint)]), [["A new hook", false], ["A permissive rule", true]]);
  assert.deepEqual(next.resolved.map((f) => f.title).sort(), ["A note", "A permissive rule"]);
  const text = readFileSync(path.join(s.env.AGENTSHIELD_DIR, "new-findings.md"), "utf8");
  assert.match(text, /^NEW_FINDINGS: 2\nRESOLVED_FINDINGS: 2\nMODE: compare\n/);
  assert.match(text, /Changed-evidence hint/);

  // A second baseline keeps the first one beside it.
  assert.equal(go(s, { rebaseline: true }).mode, "baseline-created");
  assert.deepEqual(readdirSync(path.join(s.env.AGENTSHIELD_DIR, "state")).map((n) => n.replace(/\d{8}T\d{6}Z/, "DATE")).sort(), ["baseline-DATE.json", "baseline.json"]);
  assert.equal(go(s).added.length, 0);
});

test("a run that fails after the scanner leaves the last report and the baseline as they were", { skip }, (t) => {
  const s = setup(t);
  writePin(s.folders);
  s.rules("FINDING low A note\n");
  assert.equal(go(s, { rebaseline: true }).mode, "baseline-created");
  const dir = s.env.AGENTSHIELD_DIR;
  const latest = readFileSync(path.join(dir, "latest-report.json"), "utf8");
  const archived = readdirSync(path.join(dir, "archive")).length;
  writeFileSync(path.join(dir, "state", "baseline.json"), "{ not json");
  s.rules("FINDING low A note\nFINDING high Another\n");
  for (const rebaseline of [false, true]) {
    assert.equal(go(s, { rebaseline }).mode, "failed");
    assert.match(s.head().REASON, /baseline file cannot be read; it was left as it is/);
    assert.equal(readFileSync(path.join(dir, "latest-report.json"), "utf8"), latest);
    assert.equal(readFileSync(path.join(dir, "state", "baseline.json"), "utf8"), "{ not json");
    assert.equal(readdirSync(path.join(dir, "archive")).length, archived);
  }
});

test("the scanner cannot reach the network, start a program, or read and write outside its folders", { skip }, (t) => {
  const s = setup(t);
  writePin(s.folders);
  s.rules("STUB-FETCH STUB-SPAWN\nFINDING low A note\n");
  const blocked = go(s);
  assert.equal(blocked.mode, "no-baseline");
  assert.equal(blocked.blockedCalls, 4, "fetch and spawn, in the report run and in the HTML run");
  const log = readdirSync(path.join(s.env.AGENTSHIELD_DIR, "work", "out", "logs")).sort().pop();
  assert.match(readFileSync(path.join(s.env.AGENTSHIELD_DIR, "work", "out", "logs", log), "utf8"), /NETGUARD blocked fetch[\s\S]*NETGUARD blocked child_process\.spawnSync/);

  s.rules("STUB-OUTSIDE\n");
  assert.equal(go(s).mode, "failed");
  assert.match(s.head().REASON, /the scanner ended with 1/);
  s.rules("STUB-WRITE\n");
  assert.equal(go(s).mode, "failed", "the scanner wrote into the copy");
  assert.ok(!existsSync(path.join(s.env.AGENTSHIELD_DIR, "work", "copy", "planted.md")));
});

test("credential-shaped content left in the copy stops the run before the scanner starts", { skip }, (t) => {
  const s = setup(t);
  writePin(s.folders);
  const result = go(s, { afterCopy: (copy) => put(copy, { "home/.claude/hooks/late.sh": `echo ${TOKENS.github}\n` }) });
  assert.equal(result.mode, "failed");
  assert.match(s.head().REASON, /sanitized copy still holds 2 problem\(s\), first: home\/\.claude\/hooks\/late\.sh: credential-shaped content \(github-token\)/);
  assert.ok(!existsSync(path.join(s.env.AGENTSHIELD_DIR, "latest-report.json")));
  assert.ok(!readFileSync(path.join(s.env.AGENTSHIELD_DIR, "new-findings.md"), "utf8").includes(TOKENS.github));
});

test("the guard alone stops every route it lists and writes a line for each", (t) => {
  const dir = tmp(t);
  put(dir, { "try.mjs": `import net from "node:net"; import dgram from "node:dgram"; import dns from "node:dns"; import http from "node:http"; import https from "node:https"; import tls from "node:tls"; import { spawn, execSync } from "node:child_process";
const routes = { fetch: () => fetch("http://127.0.0.1:9/"), connect: () => net.connect(9, "127.0.0.1"), socket: () => new net.Socket().connect(9, "127.0.0.1"), listen: () => new net.Server().listen(0),
  tls: () => tls.connect(9, "127.0.0.1"), http: () => http.get("http://127.0.0.1:9/"), https: () => https.request("https://127.0.0.1:9/"), udp: () => dgram.createSocket("udp4"), udpSend: () => new dgram.Socket("udp4").send("x", 9, "127.0.0.1"),
  lookup: () => dns.lookup("example.invalid", () => {}), resolver: () => new dns.promises.Resolver().resolve4("example.invalid"), resolve: () => dns.promises.resolve("example.invalid"), spawn: () => spawn("id"), exec: () => execSync("id") };
for (const [name, route] of Object.entries(routes)) { try { await route(); console.log(name, "went through"); } catch (e) { console.log(name, e.code); } }
` });
  const guard = path.join(FOLDER, "net-guard.mjs");
  const r = spawnSync(process.execPath, ["--import", new URL(`file://${guard.split(path.sep).join("/").replace(/^([A-Za-z]:)/, "/$1")}`).href, path.join(dir, "try.mjs")], { encoding: "utf8" });
  const names = ["fetch", "connect", "socket", "listen", "tls", "http", "https", "udp", "udpSend", "lookup", "resolver", "resolve", "spawn", "exec"];
  assert.equal(r.stdout, names.map((n) => `${n} ERR_NETGUARD\n`).join(""), r.stdout + r.stderr);
  assert.equal((r.stderr.match(/^NETGUARD blocked /gm) ?? []).length, names.length, r.stderr);
  assert.match(r.stderr, /^NETGUARD ready net=/m);
});

test("without the guard, this Node's permission model alone refuses the network", { skip: newNode }, (t) => {
  // What the scan relies on from Node 25 on: `--permission` with no `--allow-net`.
  const dir = tmp(t);
  put(dir, { "try.mjs": `import net from "node:net";
const code = (e) => e?.code ?? e?.cause?.code ?? String(e?.cause ?? e);
try { await fetch("http://127.0.0.1:18080/"); console.log("fetch went out"); } catch (e) { console.log("fetch", code(e)); }
console.log("connect", await new Promise((done) => { try { const s = net.connect(18080, "127.0.0.1"); s.on("connect", () => done("went out")); s.on("error", (e) => done(e.code)); } catch (e) { done(e.code); } }));
` });
  const r = spawnSync(process.execPath, ["--permission", `--allow-fs-read=${dir}`, path.join(dir, "try.mjs")], { encoding: "utf8" });
  assert.equal(r.stdout, "fetch ERR_ACCESS_DENIED\nconnect ERR_ACCESS_DENIED\n", r.stdout + r.stderr);
});

test("scan.sh and install.sh: the installed copy runs, and refuses an unknown argument", { skip: newNode }, (t) => {
  const s = setup(t);
  const target = path.join(s.root, "installed");
  const install = spawnSync("bash", [path.join(FOLDER, "install.sh"), target], { encoding: "utf8" });
  assert.equal(install.status, 0, install.stderr);
  assert.deepEqual(readdirSync(target).sort(), ["compare.mjs", "net-guard.mjs", "sanitize.mjs", "scan.mjs", "scan.sh"]);
  const run = (...args) => spawnSync("bash", [path.join(target, "scan.sh"), ...args], { encoding: "utf8", env: { ...process.env, ...s.env, AGENTSHIELD_NODE: process.execPath } });
  assert.equal(run("--fix").status, 64);
  assert.equal(run("--pin", "--rebaseline").status, 64);
  const pin = run("--pin");
  assert.equal(pin.status, 0, pin.stderr);
  assert.match(pin.stdout, /^pinned ecc-agentshield@1\.6\.0: \d+ files/);
  const first = run();
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.match(first.stdout, /^NEW_FINDINGS: unknown\nRESOLVED_FINDINGS: unknown\nMODE: no-baseline\n/);
});
