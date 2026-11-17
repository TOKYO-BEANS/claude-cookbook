# 17 November 2026: security costs, the follow-up of #104

**Why.** Stack-Atlas #217 (merged `e87ec83`, 17 November 2026) makes the Stack Atlas
standard write and check CodeQL's runner per repository and GitHub's AI Scan, so the line
in `recipes/security-costs.md` that said a new private repository needs the runner call by
hand no longer holds. #104's fallback review left three low findings for a follow-up
(its record: #104, comment 6948918625).

**What changed.**
- `recipes/security-costs.md`: the CodeQL entry says the standard sets the runner (the
  onboarding for its repository, `org --apply` for all) and `org --check` and the daily
  audit read it. The AI scanning entry reads "pushes since then have started no AI
  scanning session" (it did not parse).
- `recipes/ai-review.md`: the cost line reads "a day like 16 November (40 reviews) costs at
  least USD 17 to 27 in cash"; it had read as if those 40 reviews were paid in cash.
- A correction to `handoff/2026-11-17-security-platforms-and-budget.md` (a record file,
  left as it is): its "What changed" list leaves out `recipes/ci-releases.md`, which #104
  also changed.

**Outstanding.** The 18 November usage read: the scheduled task "Proof: GitHub AI Scan
billed nothing after the stop" (T3 Code, 19 November 2026 08:00 UTC) reads it, adds the
result to `recipes/security-costs.md` and to this entry in this pull request, and takes it
to merge. Until then this pull request stays a draft.

**Evidence.** `~/.local/share/stack-atlas/evidence/2026-11-17-ai-scan/`; Stack-Atlas
`HANDOFF.md`, "17 November 2026: the standard writes CodeQL's runner and AI Scan off (#217)".
