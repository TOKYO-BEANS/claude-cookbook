# 18 November 2026: `/goal` in a T3 Code thread and in a boat-claude task

**Why.** The two "not tried yet" items on `recipes/goal-runs.md` (#137, #138).

**What was measured.**
- **T3 Code thread: works.** A scratch thread on `claude-haiku-5-5` (effort low, full access)
  whose first message was `/goal you have run echo goal-ok with the Bash tool and its output
  goal-ok appears in the transcript; stop after 3 turns`. The session (Claude Code 2.1.327,
  through the Agent SDK) logged the `/goal` command, `Goal set: ...` and the session-scoped
  Stop hook; the agent ran `echo goal-ok`; the evaluator's `goal_status` said `met: true`
  after the first turn; the goal then ended with no further evaluation. The thread's own
  Stop hooks run beside the goal: the owner-questions hook blocked the first stop once, and
  the thread settled itself on the next turn.
- **boat-claude task: does not work.** `boat-claude.mjs --model claude-haiku-5-5 --timeout 600
  --requests 20` with `/goal ...` as the first line of `TASK.md`. The script sends its own
  prompt ("Your task is in /home/user/TASK.md: read it first ..."), so the line reached the
  agent as file text: no `Goal set:`, no Stop hook, no `goal_status` event; the agent said it
  cannot run a slash command itself. Claude Code 2.1.327 in the sandbox, 6 proxied requests
  (about USD 0.006), finished, sandbox deleted. Per "simple first", stopped there: the
  script was not changed to send `/goal` as the prompt.

**What changed.** `recipes/goal-runs.md`: the "How" bullet names the T3 route, says `/goal`
does not work in a boat-claude task and why, and records the three tries (headless, T3,
boat) with date, version and model.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-18-goal-runs/`:
`t3-thread-goal-extract.jsonl` (the goal lines of the T3 session; the full transcript holds
private context and stays out), `boat-goal-task.md`, `boat-goal-run.log`,
`boat-goal-run-2.log`, `boat-goal-run-bx_njmdkfe6/` (`TASK.md`, `events.jsonl`, `RESULT.md`).

**Failures.** The first boat-claude run ended `not started: no result (boat limits exit 1)`,
exit 75, nothing ran. `boat limits --json` through the same key answered at once afterwards
(`canStart: true`), and the second run through the script started: a transient failure.

**Outstanding.** `/goal` in a boat run would need the script to send it as the prompt
itself; not built (no job needs it yet). The first real long goal should still record what
it cost against the weekly limit.

**Dead ends.** None.
