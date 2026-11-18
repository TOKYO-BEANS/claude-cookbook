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

**Outstanding.** None from this job.
