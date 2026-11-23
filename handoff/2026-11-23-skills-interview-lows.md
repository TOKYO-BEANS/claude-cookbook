# 23 November 2026: the review's two lows from #247

**Why.** #247 (the interview read against the numbers) merged as `312ff6c` on a review with
two low findings and no high or medium one. The lows go here, with the record of its
release check.

**What changed.**

- `options/skills-compared-interview.md`: the row on types, tests and linters now says "CI
  and CodeQL on every pull request". Semgrep here checks dependencies only, so naming it
  beside the author's linters overstated it.
- `recipes/architecture-review.md`: the count of old defects is marked as the fix pull
  request's own, still in review, in place of a settled result.

**Verification.** The Cookbook check and the suite on boat for this commit. #247's release
check read `verified` on its second run. The first ended `COLLECT FAILED:
COLLECTOR_BUSY_OR_INTERRUPTED`: another run's collector had left its lock three minutes
before and its process had ended. The lock was recovered with its own code, as the script's
message says (`node collector.mjs recover-lock`, state kept), and `after-merge.sh` was run
again for the merge commit.

**Outstanding.** As in the entry for #247. When the product's fix pull request merges, its
count of defects can be written as settled: the next change to the architecture page does it.

**Dead ends.** None.

**Evidence.** #247:
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-skills-interview/`
(`release-check.log` is the merge and the failed collect, `release-check-after-merge.log`
the verified run). This pull request's release check writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-skills-interview-lows/release-check.log`.
