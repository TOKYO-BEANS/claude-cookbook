# 27 November 2026: fast-merges names the first onboarding's handoff entry

**Why.** The global rules (machine-setup#61) and Stack Atlas's `AGENTS.md` (Stack-Atlas#306)
name one more case for a handoff pull request of its own since 27 November 2026; the Cookbook's
copy of the rule still named two. The owner's answer, question dialog "Handoff rule",
27 November 2026: "May an onboarding's handoff entry have a pull request of its own from now
on?", option "Yes, allow it (Recommended)". This page mirrors that yes and adds no loosening.

**What changed.** `recipes/fast-merges.md`, the bullet "The handoff entry goes in the job's own
pull request": the handoff entry of a repository's first onboarding onto the Stack Atlas
standard goes in a pull request of its own after the merge, outside the one-a-day limit,
because that pull request may hold only the standard's own files. An upgrade's entry and every
other job's entry are as before.

**Verification.** The wording was read against the global rules and against Stack Atlas's
`AGENTS.md` at `de9dfd5`. A search of the plugin's pages for the one-a-day limit found only
`fast-merges.md`. `node scripts/check.mjs --room` passes; the suite ran in a Depot sandbox
from this commit, and the push followed only its exit 0.

**Outstanding.** None.

**Dead ends.** None.

**Evidence.** Stack-Atlas#306 (`de9dfd5`), machine-setup#61 (`7b0e0de`). Release log: the
`sa-release` run of this pull request.
