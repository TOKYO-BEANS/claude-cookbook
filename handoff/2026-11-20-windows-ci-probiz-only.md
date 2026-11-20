# 20 November 2026: Windows CI is Probiz's only

**What changed.** The owner retired the Windows CI job in Stack-Atlas and release-maintenance
(question dialog, 20 November 2026, "Retire it (Recommended)" for each) and kept Probiz's ("Keep
it (Recommended)"). Stack-Atlas#247 (`4415e0b`) and release-maintenance#49 (`a00f61b`) deleted
the jobs, after release-maintenance#47 took the check out of both release profiles and
release-verifier#28 re-synced the Worker. So "Windows jobs included" in `recipes/security.md`,
`recipes/safe-chain.md` and the Aikido entry of `catalog.json` now names Probiz's Windows job,
and the Windows exception check in the ruleset row is Probiz's alone.

**Verification.** `npm test` passes. On GitHub after both merges: `checks-ruleset` reads `valid`
for Stack-Atlas and release-maintenance, and both release checks verified (executions 1953 and
1952).

**Outstanding.** None for these pages.

**Dead ends.** None.

**Evidence.** Stack Atlas `HANDOFF.md`, entry of 20 November 2026 on the retired Windows CI jobs.
