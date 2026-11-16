#!/usr/bin/env node
// Hook of the Cookbook plugin (SessionStart, UserPromptSubmit, PostToolUse): tells a session
// which model the budget asks for, and nothing about the account's usage (the figures are
// printed only when the script is run). A session start gets the advice; later events are silent
// until the advice changes, so a long turn hears it while it can still switch. Only a session
// start may read over the network (one read per ten minutes for all sessions); every other
// event uses a saved reading, the script's own or T3 Code's. The list of banked resets is used
// only while T3 Code's file shows it, and saved nowhere; in the minutes that file has none, a
// session keeps the advice it has, for an hour at most. It writes only its own state folder,
// and never fails a session: any error ends in silence and exit code 0.
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
    const { RULES, advice, decide, readUsage } = await import(new URL("../skills/cookbook/scripts/model-budget.mjs", import.meta.url));
    const sessions = join(homedir(), ".local", "share", "model-budget", "sessions");
    const seenFile = join(sessions, `${id}.json`);
    let seen = null;
    let state = {};
    try {
      const saved = JSON.parse(readFileSync(seenFile, "utf8"));
      if (typeof saved?.key === "string") {
        seen = saved.key;
        state = saved;
      }
    } catch {
      // first event of this session
    }
    const now = Date.now();
    // Only a session start may read over the network; a prompt or a tool event uses a saved reading.
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
      // Every input of the advice text is in the key, so a change of advice is always said.
      const key = [d.model, d.redeem?.id ?? "", d.wait?.until ?? "", d.held ? "held" : ""].join("|");
      const said = advice(d);
      const resets = r.usage.resetsRead === true;
      // T3 Code's file has the list of banked resets only in the minutes its own read of them got
      // through (none for ten minutes and more at times), and the script saves no copy: that file
      // is not signed. So the advice is held here instead. A change of advice that comes while the
      // list is missing waits until the list is back, for RULES.staleMs (an hour) at most, unless a
      // limit is spent; after the hour the resets are "not read" and the change is said. The
      // session's file says whether the list was read at its last event (resets) and, while it is
      // missing after having been read, since when (lostAt); both are kept current on every
      // event, said or not. It holds what was said, never the list.
      const before = Number.isFinite(state.lostAt) && state.lostAt <= now ? state.lostAt : undefined;
      const lostAt = resets ? undefined : state.resets === true ? now : before;
      const waits = event !== "SessionStart" && seen !== null && seen !== key && seen !== "unknown" && lostAt !== undefined && d.model !== "wait" && !d.held && now - lostAt < RULES.staleMs;
      if (!waits) {
        if (event === "SessionStart" || seen === null) text = `${said} ${POINTER}`;
        else if (seen !== key) text = `Model budget changed. ${said} ${POINTER}`;
      }
      if (text || state.resets !== resets || state.lostAt !== lostAt) {
        mkdirSync(sessions, { recursive: true });
        writeFileSync(seenFile, JSON.stringify({ key: text ? key : seen, at: text ? now : state.at, resets, lostAt }));
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
