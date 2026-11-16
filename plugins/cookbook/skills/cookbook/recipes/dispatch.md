# Dispatch profiles

Six fixed profiles for running the pieces of a task (dispatcher phase B1, 3 November 2026). The
tables, the brief and report template, each side chat's start-up self-check and the proofs are in
`dispatch-profiles.md` in the skill's folder (10 KB: read it 30 lines at a time, or it comes back
cut). In T3 Code two providers are on, Claude and Codex (16 November 2026). A piece that needs
Codex's model or its own checkout goes to `delegate_task`; an opinion asked of Codex is a
consult, with its own rules: [consult](consult.md). The subagents work the same.

- **Subagents**, limited to a tool list and cheap to start: `cookbook:mechanical` (Haiku, low: one
  bounded edit or test run), `cookbook:research` (Sonnet, medium: a cited public answer from
  Parallel and Firecrawl, no shell or writes), `cookbook:review` (Opus, high: read-only, with Bash
  and Graphify).
- **Side chats** (`start_session`), for pieces the owner opens or approves in: code (Sonnet, medium,
  own worktree), design (Opus, medium), ops-deploy (Opus, medium, `default` permission mode). Nothing
  limits a side chat's tools, MCP servers or skills, so its brief carries the rules and its first
  step is the self-check.
- Every piece ends in the same report: a status line, changes, evidence, tests, open items, known
  failures and dead ends. Check the evidence, not the status line.
