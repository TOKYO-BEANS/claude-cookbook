// Run by `npm test` (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { census, report } from "../plugins/cookbook/skills/cookbook/scripts/usage-census.mjs";

const now = Date.parse("2026-11-02T12:00:00Z");
const recent = "2026-11-01T10:00:00Z";
const old = "2026-09-01T10:00:00Z";

const assistant = (ts, blocks) => JSON.stringify({ type: "assistant", timestamp: ts, message: { content: blocks } });
const call = (id, name, input = {}) => ({ type: "tool_use", id, name, input });
const user = (uuid, ts, text) => JSON.stringify({ type: "user", uuid, timestamp: ts, message: { role: "user", content: text } });

test("counts each tool_use id and each slash message once, inside the window", async () => {
  const root = mkdtempSync(join(tmpdir(), "mcp-use-"));
  try {
    mkdirSync(join(root, "proj-a"));
    const lines = [
      assistant(recent, [call("t1", "Skill", { skill: "superpowers:writing-plans" })]),
      assistant(recent, [call("t1", "Skill", { skill: "superpowers:writing-plans" })]), // same id again
      assistant(recent, [call("t2", "Skill", { skill: "/stop-slop" })]),
      assistant(old, [call("t3", "Skill", { skill: "be-ambitious" })]), // outside the window
      assistant(recent, [call("t4", "mcp__a__b", {})]),
      user("u1", recent, "<command-name>/sa-build</command-name>\n<command-args>x</command-args>"),
      user("u1", recent, "<command-name>/sa-build</command-name>"), // same message again
      user("u2", old, "<command-name>/doctor-plus</command-name>"), // outside the window
    ];
    writeFileSync(join(root, "proj-a", "s.jsonl"), lines.join("\n") + "\n");
    const r = await census({ root, days: 30, now });
    assert.deepEqual([...r.skills], [["superpowers:writing-plans", 1], ["stop-slop", 1]]);
    assert.deepEqual([...r.slash], [["sa-build", 1]]);
    assert.equal(r.servers.get("a").calls, 1);
    assert.equal(r.servers.get("a").tools.get("b"), 1);
    const text = report(r, 30);
    assert.match(text, /^a: 1 calls, 1 tools, 1 project folders/m);
    assert.match(text, /^Skill superpowers:writing-plans 1$/m);
    assert.match(text, /^Slash sa-build 1$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
