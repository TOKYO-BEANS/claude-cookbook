# Options weighed: keep healthy

Chosen by fit for the job on 15 November 2026. Each "checked" below was read from this PC that
day, not assumed.

- **Big output: context-mode.** It cuts any tool result over 8,192 bytes (4,096 by default; set
  on 22 November 2026, `recipes/context-mode.md`) and indexes the rest
  locally, so no project has to remember to do it. Weighed: ranged reads and `rg` by hand (the
  fallback); a subagent per large read (a whole context for one answer).
- **Compaction: Jev compaction.** Checked: it is the one that compacts, in T3 Code too (40
  compactions in 8 days, 32 by Jev, 8 handed to the built-in compactor, which is the
  fallback). Weighed: the built-in compactor alone (a summary written by the model, slower
  and less exact about tool calls).
- **Memory: `HANDOFF.md` and auto-memory.** Project state lives with the project and is
  reviewed in pull requests; the owner's preferences live in auto-memory, one fact per file.
  Weighed: Graphify notes and Parallel memory (shared stores for a single user); Mem0 and similar
  memory services (a hosted copy of private context).
- **Open questions: the sidebar plus a Stop hook.** Rules alone were forgotten (14 finished
  chats on 15 November 2026, three still holding a question). Weighed: an owner-facing page or
  queue (ruled out by the owner); a fixed phrase list (0.667 on held-out closings, so only the
  fallback); a model prompt hook (a full model call at every turn's end); a daily agent sweep
  (a recurring run, which is the owner's call).
- **Scheduled scripts: a systemd user timer.** Checked: `stack-updates-daily` runs there
  every day with no model. It reaches the OS key store and the pinned CLIs. Weighed: a
  Cloudflare Cron Trigger (right for a hosted product's own periodic work, cannot reach this
  PC); a scheduled agent session (about 300,000 tokens on a quiet day for a job a script
  does).
- **Scheduled agent runs: T3 Code scheduled tasks.** Checked: a one-off task ran on time in
  its own thread and worktree. The run shows up where the owner works, can be started by a
  webhook, and has the pull request tools. Weighed: Claude Desktop scheduled tasks (a
  model per task, but results land in an app the owner no longer works in; the three that
  ran there on Windows are T3 tasks or dropped since 19 November 2026); Claude Code cloud routines (no access to this PC's keys and CLIs);
  a timer that starts `claude -p` (right for one bounded read inside a script, not for
  a run that opens pull requests).
- **Updates: the `stack-updates` skill.** A script decides what is routine; a model only
  reads release notes, with no tools. Weighed: Dependabot and Renovate (repositories only,
  not the tools on this PC); each tool's self-update (unvetted, and it replaces a pinned copy).
- **Where a session runs: T3 Code.** Worktrees per thread, delegates, pull request watches and
  scheduled tasks around the Claude Code harness. Weighed: the Claude desktop app (its Code
  tab; home to Claude Design; no scheduled tasks since 19 November 2026); a plain terminal (the
  fallback).
- **Prompt cache and status rows: nothing owns this.** A mod can draw a row above the prompt
  of a terminal or desktop session. A T3 Code session is headless to mods (the compaction log
  calls it `headless-or-sdk`), so no row would show there; this is inferred, not tested.
