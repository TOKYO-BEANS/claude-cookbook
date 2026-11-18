# 18 November 2026: a consult step in the build recipe

**Why.** The owner noticed that Codex consults were almost never used and the ChatGPT plan
never drawn on. Findings: the Codex provider in T3 Code works (`orchestrator_capabilities`,
18 November 2026: provider `codex`, `gpt-6-astra`, `canRunChildTask: true`); the handoff
records only set-up and test runs, no consult on real work. The cause was the design: the
consult's "When" list is narrow, and `recipes/building.md`, the plan-and-build recipe, never
pointed at it (only `recipes/debugging.md` did, after two failed diagnoses). Most work since
has been routine pull requests, which get no consult.

**Owner decision** (question dialog, 18 November 2026): option 2, "only the build step".
Codex does not take over the fallback review of pull requests; that is another chat's job
(the Depot CI Claude token fallback), and the owner said the fallback is not meant to stay as
it is now.

**What changed.** `recipes/building.md`: a design or plan with a choice that is costly to
reverse gets one Codex consult on that choice before the build starts, under
`recipes/codex-consult.md`; routine changes get none.

**Verification.** #140 merged as `2f92977` on 18 November 2026 through `sa-release`. Every
check passed on head `0af7efb`: Depot CI test and semgrep, test (windows-2025), CodeQL. The
`ai-review` job said `review unavailable` (credit balance too low), so a `cookbook:review`
subagent did the fallback review, which found one low: this entry had no Verification and no
Dead ends line, added here. The first merge run was refused before that record existed; the
second merged it, and the release check read `verified`. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-18-consult-in-build`, both runs recorded with
`workflows.mjs record`.

**Dead ends.** None.

**Outstanding.** None from this job.
