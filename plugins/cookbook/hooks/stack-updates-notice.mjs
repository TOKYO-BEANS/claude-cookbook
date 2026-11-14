#!/usr/bin/env node
// SessionStart hook of the Cookbook plugin: says that a daily update report is waiting.
// It only reads the state folder, prints at most one short note, and never fails a
// session: any error ends in silence and exit code 0.
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const here = dirname(fileURLToPath(import.meta.url));
  const scripts = join(here, "..", "skills", "stack-updates", "scripts");
  const { noticeText } = await import(new URL("../skills/stack-updates/scripts/lib/notice.mjs", import.meta.url));
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const stateDir = join(homedir(), ".local", "share", "stack-updates");
  const text = noticeText({ stateDir, today, script: join(scripts, "updates.mjs") });
  if (text) process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } })}\n`);
} catch {
  // silent: a broken notice must never stop a session
}
process.exitCode = 0;
