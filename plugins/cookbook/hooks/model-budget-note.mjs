#!/usr/bin/env node
// Hook of the Cookbook plugin (SessionStart, UserPromptSubmit, PostToolUse): tells a session
// which model the budget asks for, and nothing about the account's usage (the figures are
// printed only when the script is run). A session start gets the advice; later events are silent
// until the advice changes, so a long turn hears it while it can still switch. It reads the
// shared reading (at most one usage read per ten minutes for all sessions), writes only its
// own state folder, and never fails a session: any error ends in silence and exit code 0.
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const EVENTS = ["SessionStart", "UserPromptSubmit", "PostToolUse"];
const SESSION = /^[A-Za-z0-9_-]{1,80}$/;
const POINTER = "What to do with it: the Cookbook page recipes/model-budget.md.";
const KEEP_MS = 14 * 86400000;

const stdin = async () => {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
};

try {
  const input = JSON.parse(await stdin());
  const event = input?.hook_event_name;
  const id = input?.session_id;
  // A subagent's events are not the thread's: only the main session is told, and only it marks the advice as said.
  if (EVENTS.includes(event) && typeof id === "string" && SESSION.test(id) && !input.agent_id) {
    const { advice, decide, readUsage } = await import(new URL("../skills/cookbook/scripts/model-budget.mjs", import.meta.url));
    const sessions = join(homedir(), ".local", "share", "model-budget", "sessions");
    const seenFile = join(sessions, `${id}.json`);
    let seen = null;
    try {
      const key = JSON.parse(readFileSync(seenFile, "utf8"))?.key;
      if (typeof key === "string") seen = key;
    } catch {
      // first event of this session
    }
    const now = Date.now();
    // Only a session start may read over the network; a prompt or a tool event uses the saved reading.
    const r = await readUsage({ now, cacheOnly: event !== "SessionStart" });
    let text = "";
    // Only the advice goes into the session: no usage figures, times, counts or error text.
    if (!r.usage) {
      // Said at a session start, and once when a session's saved reading goes stale.
      if (event === "SessionStart" || seen !== "unknown") {
        text = "Model budget: unknown. Keep this thread's model.";
        mkdirSync(sessions, { recursive: true });
        writeFileSync(seenFile, JSON.stringify({ key: "unknown", at: now }));
      }
    } else {
      const d = decide(r.usage, now);
      const key = [d.model, d.redeem?.id ?? "", d.wait?.until ?? ""].join("|");
      const said = advice(d);
      if (event === "SessionStart" || seen === null) text = `${said} ${POINTER}`;
      else if (seen !== key) text = `Model budget changed. ${said} ${POINTER}`;
      if (text) {
        mkdirSync(sessions, { recursive: true });
        writeFileSync(seenFile, JSON.stringify({ key, at: now }));
      }
    }
    if (text) process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })}\n`);
    if (event === "SessionStart") {
      for (const name of readdirSync(sessions).slice(0, 500)) {
        const file = join(sessions, name);
        if (name.endsWith(".json") && now - statSync(file).mtimeMs > KEEP_MS) rmSync(file, { force: true });
      }
    }
  }
} catch {
  // silent: a broken note must never stop a session
}
process.exitCode = 0;
