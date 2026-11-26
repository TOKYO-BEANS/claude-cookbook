# 26 November 2026: two weighed options on the check page reworded for the audit

**Why.** The Stack Atlas end-state audit has reported two `words` drift items in
`options/check.md` every day since 20 November 2026: its pattern reads "OSV-Scanner in CI" and
"Gitleaks in CI" as the retired scanners still in use, though both are weighed alternatives.

**What changed.** `options/check.md`: "OSV-Scanner as a CI job (outside code only)" and
"Gitleaks CI scans (find a key after the push)". Same options, same reasons; the page keeps its
4,000-byte limit (1 left).

**Verification.** The audit's `retiredWords` on the new page prints `[]`; the Cookbook check
and the suite on boat.

**Outstanding.** None here; the Stack Atlas chat runs the audit again after the merge.

**Dead ends.** The suggested longer wording ("it vets only outside code, before an install";
"as a CI scan") put the page 12 to 42 bytes over its limit; the shorter wording keeps both points.

**Evidence.** The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-26-cookbook-check-options-ci-wording/release-check.log`.
