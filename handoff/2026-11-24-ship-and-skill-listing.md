# 24 November 2026: `/ship` weighed; skill descriptions no longer dropped

**Why.** The owner asked whether Claude Code's `/ship` command
(<https://code.claude.com/docs/en/ship-command>) should be used, and whether every skill or
command that waited for the owner to name it is now started on Claude's own judgement.

**What changed.** `options/ship.md` records `/ship` and `/steward` as weighed, not used: typed by
hand only, not offered in T3 sessions, no watch in bypass mode, the merge left to a person, and our
tool and git hooks skipped during a watch; `ai-review`, `ai-fix`, `sa-release` and T3's
`watch_pull_request` already do the job. `connector-register.md` records the skill-listing budget.
Outside this repository: `skillListingBudgetFraction: 0.02` in the user settings, through
`machine-setup`.

**Verification.** A frontmatter scan of the user skills and every enabled plugin found
`disable-model-invocation: true` only on context-mode's three skills, as on 23 November. The
budget: two `claude -p` runs (Opus 5.5, plan login, only the setting changed) listed which of 111
skills showed no description: 27 at 0.01 (the seven deliberate `name-only` and 20 dropped by the
budget), 7 at 0.02; input at the start 21,714 and 24,756 tokens. The Cookbook check and the suite on
boat.

**Outstanding.** None. The seven `name-only` skills stay so: their names say what they are for.

**Dead ends.** `claude doctor` prints nothing without a terminal, so it cannot measure the listing
from a script; the two runs did.

**Evidence.** The docs page read with Firecrawl. The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-24-cookbook-ship-and-skill-listing/release-check.log`.
