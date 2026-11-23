# 23 November 2026: the review's two lows from #242

**Why.** #242 (the architecture-review skill) merged as `8d2b5ba` on a review with two low
findings and no high or medium one; its release check read `verified`. The lows go here.

**What changed.** `README.md`: the architecture-review sentence now follows the sentence
about the morning run and the SessionStart hook, so "it" in that sentence is the update check
again. `scripts/check.mjs`: the check reads every skill folder under
`plugins/cookbook/skills/` from the disk (`otherSkillFiles`), so a new skill is checked for
the typed-only flag and the dollar-sign rule without being listed; a test fails when a folder
is missing from `OTHER_TEXTS`.

**Verification.** The Cookbook check and the suite on boat for this commit.

**Outstanding.** As in the entry for #242: no candidate from the trial is built yet, and the
catalog entry stays at `trial` until one is. The README still says "A Windows task" for the
morning run, which is a systemd user timer on the laptop: not this job's sentence, left for
the next change to the README.

**Dead ends.** None.

**Evidence.** #242's merge and release check:
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-architecture-review-skill/release-check.log`.
This pull request's release check writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-architecture-review-lows/release-check.log`.
