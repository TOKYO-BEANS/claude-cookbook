# Dispatch profiles

Eight fixed profiles for running the pieces of a task: six from dispatcher phase B1 (3 November
2026) and the two reader profiles (16 November 2026). The tables, the brief and report template,
each side chat's start-up self-check and the proofs are in `dispatch-profiles.md` in the skill's
folder (13 KB: read it 30 lines at a time, or it comes back cut). In T3 Code a piece that needs its own checkout goes to `delegate_task`; the subagents
work the same. Codex, the second provider there since 16 November 2026, takes no piece of
work: it gives a second opinion, a consult, under its own rules ([codex](codex.md)).

- **Subagents**, limited to a tool list and cheap to start: `cookbook:mechanical` (Haiku, low: one
  bounded edit or test run), `cookbook:research` (Sonnet, medium: a cited public answer from
  Parallel and Firecrawl, no shell or writes), `cookbook:review` (Opus, high: read-only, with Bash
  and Graphify), `cookbook:reader` (Sonnet, medium: Read, Grep and Glob only) and
  `cookbook:reader-graph` (the same plus four Graphify read tools).
- **Effort follows the piece, not the stakes of the task.** More effort is a bigger bet that the
  piece needs thinking: on a clear, small piece it invents work (a refactor next door, a case that
  cannot happen) and only costs time. Low for a known edit, medium to read and judge, high to
  review or design. `xhigh` and `max` only on a named need: published runs (August 2026) show the
  strongest models gain a few points past high for several times the cost and time.
- **A step that reads text other people wrote** (a diff, evidence, a brief, finding titles) runs
  on a reader profile: it has no shell, no file write, no tool search and no subagent, so the
  tool list is the limit, not the prompt. A Workflow step takes one with `agentType`.
- **Side chats** (`start_session`), for pieces the owner opens or approves in: code (Sonnet, medium,
  own worktree), design (Opus, medium), ops-deploy (Opus, medium, `default` permission mode). Nothing
  limits a side chat's tools, MCP servers or skills, so its brief carries the rules and its first
  step is the self-check.
- Every piece ends in the same report: a status line, changes, evidence, tests, open items, known
  failures and dead ends. Check the evidence, not the status line.
