# Model routing (Jev Router)

Two ways to run it. Both make one Jev call per new prompt, and the tool loop keeps the chosen
model. Prompt text goes to TypeSafe on the `jev-compaction` key's free allowance.

**Not in T3 Code** (checked 15 November 2026). The plugin sees a T3 Code session as a headless
one and skips it: every T3 Code prompt from 11 to 15 November is logged `skipped` with the
reason `headless`, and the last routed turn is from 9 November. In T3 Code the model is the
thread's own setting, and a dispatch profile fixes it for a piece of work.

**In the desktop app and in terminal sessions: the `jev-turn-router` plugin.** It's on by default
(user scope, local `claude-local` marketplace, read from
`~/.claude/vendor/compaction/local-marketplace/jev-turn-router`).
- **What it does:** a Claude Code mod. Its `turn.start` hook asks Jev, and its `turn.step` hook
  names Haiku, Sonnet or Opus 5.5 for every request of that turn. The session keeps its own
  model setting, so `opus[1m]`'s 1M window and tool search stay as they are.
- **What is routed:** only the main loop of an Opus session a person works in, meaning a
  terminal REPL, or a Code-tab session recognised by the app's `mcp__ccd_*` tools.
- **What is left alone:** plain `claude -p` and SDK jobs, subagents, a model picked by hand,
  and turns that are only a machine message (task notifications, messages from other
  sessions). So follow-ups another session sends to a test session are never routed.
- **Guards:**
  - a prompt overrides Jev only by naming one model after "use" or "switch to", not negated
    and not inside code;
  - low confidence never steps down;
  - after the first turn it doesn't step down once the context passes 20k tokens (the cache
    would be rebuilt). A Code-tab session starts at about 150k tokens, so in practice only a
    session's first turn steps down, and later turns can step up;
  - a Jev error, or no answer within 2.5 s, keeps the current model. The prompt that first
    reads the key gets 6 s instead, because in the app the key is usually read then.
- **Day to day:** the status line shows the model that ran. `/jev-router` shows the last pick;
  `/jev-router off` or `on` switches it for the session.
- **Decision log:** `~/.claude/vendor/compaction/state/jev-turn-router-decisions.jsonl` (no
  prompt text). The engine has no debug log for Code-tab sessions, so read this log first when
  routing looks wrong.
- **Testing it:** test in a new Code-tab session and read the model from its transcript
  (`~/.claude/projects/<folder>/<session>.jsonl`). `claude plugin test <folder>` runs its tests.
  Haiku, Sonnet and Opus 5.5 all take 1M input tokens (`runtime.max_input_tokens` in
  Claude Code's model catalog); only Haiku 4.5 had 200k.

More: [the `jev-claude` terminal proxy](jev-router-terminal.md).
