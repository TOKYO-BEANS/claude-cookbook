#!/usr/bin/env node
// PreToolUse hook of the Cookbook plugin: the Codex start gate (codex-start-gate-lib.mjs,
// recipes/codex.md). It always answers: whatever goes wrong here is a denial, and hooks.json
// sets onFailure "block", so a hook that cannot start or runs out of time blocks the call too.
import { readFileSync } from "node:fs";

let out;
try {
  const { DENIALS, decide, deny } = await import("./codex-start-gate-lib.mjs");
  try {
    out = decide({ input: JSON.parse(readFileSync(0, "utf8")), env: process.env });
  } catch {
    out = deny(DENIALS.unread);
  }
} catch {
  out = { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Codex is not started: the start check's hook could not run." } };
}
if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
process.exitCode = 0;
