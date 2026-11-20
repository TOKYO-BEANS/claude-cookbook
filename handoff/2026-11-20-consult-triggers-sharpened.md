# 20 November 2026: the consult triggers in debugging and review

**Why.** The owner asked again why Codex consults are rare. Only 3 handoff entries mention a
consult and none records a consult's answer on real work. Since #140 the build step points at
one; the other two triggers on `recipes/codex-consult.md` (a diagnosis that failed twice, a
review finding Claude would dispute) were easy to pass by: `recipes/debugging.md` called the
first only "a case for" a consult, and `recipes/review-threads.md` never named the second.

**Owner decision** (question dialog, 20 November 2026): "Sharpen triggers", no wider triggers.

**What changed.** `recipes/debugging.md`: a second failed fix stops the attempts; one Codex
consult on the diagnosis comes before any third, then a rethink from the start. The old "after
three failed fixes" line now matches the owner's rule of 17 November 2026 (rethink after two).
`recipes/review-threads.md`: one Codex consult on a review finding before disputing it; its
verdict goes into the owner's question, and it never answers a thread itself.

**Verification.** See the pull request: tests on boat and every check on its head.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-consult-triggers/`: the
boat test log and the merge run's log.

**Dead ends.** None.

**Outstanding.** None from this job.
