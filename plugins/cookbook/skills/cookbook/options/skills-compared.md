# Options weighed: the `mattpocock/skills` set against ours, measured

The owner asked on 23 November 2026 for a test of each of the 27 skills against the tool
with the same job here. Result: none replaces an owner. One is added as our adapted copy
(`pr-text`) and one gave the weekly lessons four lines. The skills with no match here, how
it was run and the limits: [the second page](skills-compared-single.md).

**Measured** 23 November 2026 (upstream commit `abeeaf9`, Superpowers 7.0.2): one made-up
task per job, fresh runs on Sonnet 5.5 medium with his skill, ours and none. A cell is the
score, then the cost of a run in USD at list rates; the runs per arm are in brackets.

| Job and task | His | Ours | No skill |
| --- | --- | --- | --- |
| Debug: 16 hidden tests (2) | 16, 0.11 | 16, 0.10 | 16, 0.07 |
| Test-first: 32 hidden tests, 10 mutants (2) | `tdd` 32, 0.14; `implement` 32, 0.32 | 32, 0.16 | 32, 0.10 |
| Interview to a specification: 10 hidden owner decisions, then questions asked (2) | `grilling` 10, 15; `grill-with-docs` 10, 11.5 | 10, 10.5 | 9.5, 8 |
| Build from a specification: 46 hidden cases (2) | 46, 0.21 | 46, 1.85 | 46, 0.12 |
| Review: 8 seeded defects, then false alarms (2) | 8, 0.5, 0.15 | profile 8, 0.5, 0.11; Superpowers 8, 1.5, 0.25 | 7, 1.5, 0.12 |
| Research: 8 facts, each with a primary source (2) | 8, 0.21 | 8 | 8, 0.11 |
| Write a skill; a Haiku agent then follows it: 8 rules (2 skills, 3 uses each) | 7.2 | 7.2 | 7.2 |
| Retrospective: 7 seeded problems (5) | 7.0, 0.20 | 6.0, 0.13 | 5.6, 0.12 |
| Handoff: 10 facts kept (5) | 9.6 | 9.0 | 10.0 |
| Pull request text: 8 reviewer facts, two tasks (5 and 4) | 7.8 and 6.3 | 8.0 and 6.3 | 5.4 and 5.0 |

**What it shows:**

- **Coding** (debug, test-first, build): no arm failed, and on Haiku 5.5 one run in 19
  dropped one case. A skill added cost, not result. Superpowers' plan with a subagent per
  task did run (10 subagents, about 55 own tests) and cost 15 times the plain build, in 9
  minutes against under 1. [building](../recipes/building.md) now sizes the method to the job.
- **Interviews:** the same decisions captured. `grilling` asks the most and `tdd` asks the
  owner to confirm its test points; the owner wants few questions.
- **Review:** the `cookbook:review` profile matches his at the lowest cost.
- **Retrospective:** his list of things to look for finds what a hunt for repeats misses: an
  instruction no session follows, a check nothing runs. Four lines of it are now in
  [learning-loop](../recipes/learning-loop.md); with them our method found 7 of 7 in five runs.
- **Handoff:** all three carry the facts. Our copy's miss is the scorer's wording: four of
  its five documents name the rejected approach.
- **Pull request text, the one win:** with the skill 1.3 to 2.6 more of 8 facts, mostly the
  rollback and the new tests' names. On Opus 5.5 high (3 runs): 8.0 against 6.0 on the first
  task, 6.0 to 6.7 against 5.7 on the second. Our copy is a third of his size and pasted real
  test output in 15 of 15 runs, his in 4 of 15. Added as `cookbook:pr-text`, at `trial`.

Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-23-skills-compare/` (the harness,
the tasks, and every run's stream, score and verdict).
