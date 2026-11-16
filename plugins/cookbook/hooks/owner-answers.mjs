#!/usr/bin/env node
// PreToolUse and PostToolUse hook of the Cookbook plugin: the owner-answers list and the
// look at other chats before a new one starts (owner-answers-lib.mjs,
// recipes/parallel-chats.md). It never fails a session: whatever goes wrong here, the tool
// call goes ahead.
import { readFileSync } from "node:fs";

let out = null;
try {
  const { run } = await import("./owner-answers-lib.mjs");
  const { openStore } = await import("./owner-answers-store.mjs");
  out = run({ input: JSON.parse(readFileSync(0, "utf8")), env: process.env, io: openStore(process.env) });
} catch {
  out = null;
}
if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
process.exitCode = 0;
