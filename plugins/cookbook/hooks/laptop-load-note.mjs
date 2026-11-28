#!/usr/bin/env node
// UserPromptSubmit hook of the Cookbook plugin (recipes/sandboxes-boat-chat.md): at an owner's
// message in a T3 chat on this laptop, while the laptop nears a limit (laptop-load-lib.mjs),
// tells the chat to move off the laptop when its job fits: boat, or a cloud session for a job
// that needs no input. Once an hour per chat at most. Only where boat-chat is set up (its state
// file), so a chat on boat never hears it. Reads /proc, writes only its own state folder, and
// never fails a prompt: any error ends in silence and exit code 0.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SESSION = /^[A-Za-z0-9_-]{1,80}$/;

try {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  const input = JSON.parse(text);
  const id = input?.session_id;
  const home = process.env.COOKBOOK_HOME || homedir();
  const t3 = typeof process.env.T3CODE_THREAD_ID === "string" && process.env.T3CODE_THREAD_ID !== "";
  if (input?.hook_event_name === "UserPromptSubmit" && !input.agent_id && typeof id === "string" && SESSION.test(id) && t3 && existsSync(join(home, ".local", "share", "boat-chat", "state.json"))) {
    const { laptopLoad, noteDue, offloadNote } = await import("./laptop-load-lib.mjs");
    const proc = process.env.COOKBOOK_LAPTOP_PROC;
    const read = proc ? (path, enc) => readFileSync(join(proc, path.replace(/^\/proc\//, "")), enc) : readFileSync;
    const load = laptopLoad({ read });
    const dir = join(home, ".local", "share", "claude-cookbook", "laptop-load-note");
    const file = join(dir, `${id}.json`);
    let last = NaN;
    try {
      last = Number(JSON.parse(readFileSync(file, "utf8")).saidAt);
    } catch {}
    const now = Date.now();
    if (noteDue(load, last, now)) {
      const script = fileURLToPath(new URL("../skills/cookbook/scripts/boat-chat.mjs", import.meta.url));
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, `${JSON.stringify({ saidAt: now })}\n`);
      process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: offloadNote(load.reasons, script) } })}\n`);
    }
  }
} catch {}
process.exitCode = 0;
