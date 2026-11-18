# 18 November 2026: the model-budget note after a tool starts Node once per five minutes

**The job.** The owner's outcome from the PC-load job (17 November 2026): the PC stops
throttling. The outstanding item "Hooks under load" in
[2026-11-17-idle-session-load.md](2026-11-17-idle-session-load.md): at 17:15 on 17 November a
bare Node start took about 5 s, hooks missed their time limits, and the owner saw "hook did not
answer in time". The Cookbook's share was `model-budget-note.mjs` on `PostToolUse` with no
matcher: one Node start after every tool call, a subagent's included (which it then ignored).

**Measured before** (`measure-hooks.mjs`, every transcript of the last two days: 312
transcripts, 22,852 tool calls, 7,531 of them in subagents, 1,005 turns with tools): the note
started Node 22.7 times per turn with tools, once per tool call. All other hooks start 2.39 Node
processes per tool call (context-mode before and after, and the Cookbook's other three). A
matcher alone was weighed: `Bash|PowerShell` halves the note's starts (10.6 per turn), not
"far less often", and `Agent|Task|Skill|delegate_task` leaves 74 of 189 long turns (20 or more
tool calls) unchecked from start to end.

**What changed.**
- `hooks/model-budget-gate.sh`: `hooks.json` sources it (`. file root`) on `PostToolUse` in
  place of `node model-budget-note.mjs`. A probe (a headless run with a logging hook) showed
  that Claude Code 2.1.327 runs every hook command in Git Bash's `bash -c`, and that a
  subagent's hook input names `agent_id` with the parent's `session_id`. So the gate uses bash
  builtins only, in the shell that already starts: it reads the input's first 1,024
  characters, skips a subagent's call, and starts Node at most once per five minutes per session
  (`sessions/<id>.gate`, the epoch second it opens again). The input reaches Node whole. Any
  doubt (no session id found, no state folder yet, an unreadable gate, a gate further ahead than
  one window) starts Node, as before.
- `model-budget-note.mjs`: its header names the gate; the session start's 14-day cleanup also
  removes `.gate` files. Its logic is unchanged.
- `recipes/model-budget.md`: one sentence (both model-budget pages sit at the 4,000-byte limit,
  so "(not signed; a point or two behind)" left; `model-budget-setup.md` still says it).
- Tests in `scripts/model-budget.test.mjs`: `hooks.json` sources the gate with no matcher; a
  stub note shows Node starts once per window per session, with the input byte for byte (past
  1,024 characters, not ASCII); never for a subagent; always without a session id or state
  folder; and the real note says "Model budget changed" after the window.

**The promise kept.** The note's header promises that a long turn hears a changed advice while
it can still switch. The reading behind the advice changes at most once per ten minutes (one
network read for all sessions, or T3 Code's saved reading). Simulated on the same two days
(`simulate-gate.mjs`): the longest stretch of a long turn with no check went from 4.6 to 6.6
minutes (median), 10.7 to 13.4 (90th percentile); three minutes would give 5.5 and 12.7 for
1.68 starts per turn, so five stays.

**Measured after** (the same transcripts, the gate simulated): 22.7 to 1.24 note Node starts per
turn with tools, 95% fewer; 3 per long turn (median). Per tool call, all hooks: 3.39 to about
2.44 Node starts. Timed on this PC at rest: a gated call 160 ms (the bash start, about 145 ms,
was already paid by every hook; the 1,024-character read adds about 9 ms), a call that starts
Node 284 ms.

**Outstanding.**
- context-mode's hooks (a third-party plugin, not changed here) start Node before and after
  shell, read, search and edit calls, and after every MCP call, each with a 5-second limit: most of
  the 2.44 Node starts per tool call. A change there is its maintainer's or a fork's; nothing
  is planned. Owner: Claude, only if "hook did not answer in time" comes back; cleared by a
  load measurement with no such warning.
- The `ai-review` credit is out: this pull request takes a fallback review.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-18-hook-node-starts/`:
`before.json`, `gate-300.json`, `gate-180.json`, the two scripts that made them, `probe/` (the
probe's hook settings and what it logged) and `gate-tests-windows.txt`.
