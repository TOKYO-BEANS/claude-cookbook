// Run by `npm test` (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { zstdDecompressSync } from "node:zlib";
import { archiveAll, cleanTranscript } from "../plugins/cookbook/skills/cookbook/scripts/agent-log/archive.mjs";
import { resolveArchive, run } from "../plugins/cookbook/skills/cookbook/scripts/agent-log/agent-log-nightly.mjs";
import { buildDigest, digestParts, sessionSignals, signature } from "../plugins/cookbook/skills/cookbook/scripts/agent-log/digest.mjs";

// Built at run time so no credential shape sits in this file.
const fakeToken = "ghp_" + "a1B2".repeat(9);
const toolId = "toolu_0158op9sFw2ACD9PDpuWxQG6";
const assistant = (blocks) => JSON.stringify({ type: "assistant", timestamp: "2026-11-21T10:00:00Z", message: { content: blocks } });
const user = (content, extra = {}) => JSON.stringify({ type: "user", timestamp: "2026-11-21T10:01:00Z", message: { role: "user", content }, ...extra });

test("cleanTranscript masks credentials, keeps ids, drops signatures and images", () => {
  const counts = {};
  const out = cleanTranscript([
    assistant([{ type: "thinking", thinking: "hm", signature: "Eu8B" + "x".repeat(50) }, { type: "tool_use", id: toolId, name: "Bash", input: { command: `gh auth login --with-token ${fakeToken}` } }]),
    user([{ type: "tool_result", tool_use_id: toolId, content: [{ type: "image", source: { type: "base64", data: "A".repeat(2000) } }] }]),
    "not json " + fakeToken,
  ].join("\n"), counts);
  assert.ok(!out.includes(fakeToken));
  assert.equal(out.split("\n").filter((l) => l.includes(toolId)).length, 2, "the tool call and its result keep their id");
  assert.ok(!out.includes("A".repeat(1000)));
  assert.ok(counts["signature-dropped"] === 1 && counts["image-dropped"] === 1);
  assert.ok(counts["github-token"] >= 2);
});

test("archiveAll copies new and grown sessions only, private and compressed", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-log-"));
  try {
    const root = join(home, "projects", "proj-a");
    mkdirSync(root, { recursive: true });
    const file = join(root, "s1.jsonl");
    writeFileSync(file, user(`my key is ${fakeToken}`));
    const dest = join(home, "archive");
    const sources = [{ name: "claude", root: join(home, "projects") }, { name: "codex", root: join(home, "missing") }];
    assert.equal(archiveAll({ sources, dest }).copied, 1);
    assert.equal(statSync(dest).mode & 0o777, 0o700);
    const stored = join(dest, "claude", "proj-a", "s1.jsonl.zst");
    assert.equal(statSync(stored).mode & 0o777, 0o600);
    assert.ok(!zstdDecompressSync(readFileSync(stored)).toString().includes(fakeToken));
    assert.deepEqual([archiveAll({ sources, dest }).copied, archiveAll({ sources, dest }).skipped], [0, 1]);
    writeFileSync(file, `${user("one")}\n${user("two")}`);
    utimesSync(file, new Date(), new Date(Date.now() + 5000));
    assert.equal(archiveAll({ sources, dest }).copied, 1);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("signature folds numbers, paths and quoted values together", () => {
  assert.equal(signature("Bash", "Exit code 2: /home/a/x.txt missing"), signature("Bash", "exit code 17: /tmp/b/y.md missing"));
  assert.notEqual(signature("Bash", "exit code 2"), signature("Read", "exit code 2"));
});

test("sessionSignals finds tool errors by tool and only what the owner typed", () => {
  const records = [
    JSON.parse(assistant([{ type: "tool_use", id: "t1", name: "Bash", input: {} }])),
    JSON.parse(user([{ type: "tool_result", tool_use_id: "t1", is_error: true, content: "rm -rf denied" }])),
    JSON.parse(user("no, use the boat run")),
    JSON.parse(user("<command-name>/clear</command-name>")),
    JSON.parse(user("subagent prompt", { isSidechain: true })),
  ];
  const s = sessionSignals(records, { project: "p", session: "abc" });
  assert.deepEqual(s.errors.map((e) => e.tool), ["Bash"]);
  assert.deepEqual(s.owner, ["no, use the boat run"]);
});

test("buildDigest lists an error only when it came back in another session", () => {
  const err = (text) => ({ tool: "Bash", text, sig: signature("Bash", text) });
  const md = buildDigest([
    { project: "p", session: "aaaaaaaa1", start: "2026-11-20", errors: [err("denied rm -rf 1")], owner: ["stop"] },
    { project: "p", session: "bbbbbbbb2", start: "2026-11-21", errors: [err("denied rm -rf 2"), err("only once")], owner: [] },
  ], { days: 7, now: Date.parse("2026-11-21T12:00:00Z") });
  assert.match(md, /2 sessions, 2 times/);
  assert.doesNotMatch(md, /only once/);
  assert.match(md, /aaaaaaaa \(1 errors\)\n- stop/);
});

test("digestParts splits a long week between sessions and loses nothing", () => {
  const sessions = Array.from({ length: 30 }, (_, i) => ({ project: "p", session: `s${String(i).padStart(7, "0")}x`, start: `2026-11-${10 + (i % 9)}`, errors: [], owner: ["x".repeat(300), `last ${i}`] }));
  const md = buildDigest(sessions, { days: 7, now: Date.parse("2026-11-21T12:00:00Z") });
  const parts = digestParts(md, 2_000);
  assert.ok(parts.length > 2);
  for (const p of parts) assert.ok(Buffer.byteLength(p) <= 2_000);
  for (let i = 0; i < 30; i += 1) assert.equal(parts.filter((p) => p.includes(`- last ${i}\n`)).length, 1);
  assert.match(parts[0], /read part 2 next/);
  assert.deepEqual(digestParts("short", 2_000), ["short"]);
});

test("an id field keeps a random id but not a credential", () => {
  const out = cleanTranscript(JSON.stringify({ id: fakeToken, tool_use_id: toolId, input: { session_id: [fakeToken] } }));
  assert.ok(!out.includes(fakeToken));
  assert.ok(out.includes(toolId));
});

// A home with the plugin registry; `installPath` is where the registry says the plugin is.
function fakeHome(installPath) {
  const home = mkdtempSync(join(tmpdir(), "agent-log-home-"));
  const plugins = join(home, ".claude", "plugins");
  mkdirSync(plugins, { recursive: true });
  const entries = installPath === null ? [] : [{ scope: "user", installPath: installPath(home) }];
  writeFileSync(join(plugins, "installed_plugins.json"), JSON.stringify({ plugins: { "cookbook@claude-cookbook": entries } }));
  return home;
}
function placePlugin(dir) {
  mkdirSync(join(dir, "skills", "cookbook", "scripts", "agent-log"), { recursive: true });
  writeFileSync(join(dir, "skills", "cookbook", "scripts", "agent-log", "archive.mjs"), "export const archiveAll = () => ({ copied: 2, skipped: 0, bytesIn: 0, bytesOut: 0, counts: {} }); export const defaultSources = () => [];\n");
}

test("resolveArchive finds the user's plugin and refuses one outside ~/.claude/plugins", async () => {
  const inside = fakeHome((h) => join(h, ".claude", "plugins", "cache", "cookbook"));
  const outside = fakeHome((h) => join(h, "elsewhere"));
  const missing = fakeHome(null);
  try {
    placePlugin(join(inside, ".claude", "plugins", "cache", "cookbook"));
    placePlugin(join(outside, "elsewhere"));
    assert.match(resolveArchive(inside), /agent-log\/archive\.mjs$/);
    assert.throws(() => resolveArchive(outside), /outside/);
    assert.throws(() => resolveArchive(missing), /not installed/);
    const ok = await run({ home: inside });
    assert.equal(ok.copied, 2);
    assert.equal(JSON.parse(readFileSync(join(inside, ".local", "share", "agent-log", "last-run.json"), "utf8")).ok, true);
    const failed = await run({ home: outside });
    assert.equal(failed.ok, false);
    const note = JSON.parse(readFileSync(join(outside, ".local", "share", "agent-log", "last-run.json"), "utf8"));
    assert.equal(note.ok, false);
    assert.match(note.error, /outside/);
  } finally { for (const h of [inside, outside, missing]) rmSync(h, { recursive: true, force: true }); }
});
