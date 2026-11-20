# 20 November 2026: CodeQL in Depot CI, in the map and the pages

**Why.** The owner said yes on 20 November 2026 (Cookbook chat "Replace GitHub Actions with
Depot") to moving CodeQL from GitHub's default setup, which runs on GitHub Actions, into a
Depot CI job. Stack Atlas standard v28 (TOKYO-BEANS/Stack-Atlas#252) builds it: the managed
`codeql` job runs the pinned CodeQL bundle, scans the languages GitHub lists with the suite
default setup ran, and uploads SARIF to GitHub code scanning; each repository moves to the
configuration `TOKYO-BEANS standard, CodeQL in Depot CI` (default setup off) when its
onboarding pull request brings the job.

**What changed.** The map's "Scan our code" row names the Depot `codeql` job ("else default
setup": a repository not yet moved), and links the new page `recipes/codeql.md` (what runs, the rule, the
move, a repository still on default setup, never turning default setup on again for a moved
repository, versions, history, cost). `recipes/security.md`, `recipes/security-costs.md`,
`options/check.md` (GitHub Actions now kept for Probiz's Windows job and for default setup
until a repository moves) and the GitHub and Depot entries of `catalog.json` say the same.

**Verification.** `npm test` in the pull request's Depot CI `test` job (boat refused to start,
below). The page sizes were measured before the push: `options/check.md` is at exactly the
4000-byte Read limit, so a few neighbouring lines were rewrapped or shortened to fit.
`SKILL.md` is 13962 bytes: its tests add a 36-byte row and must stay under 14000, so the map
row is terse and the detail is in `recipes/codeql.md`.

**Outstanding.** The pages describe Stack-Atlas #252, which was a draft when this was written;
if it changes before it merges, these pages follow. No repository has moved yet; the
rollout starts with claude-cookbook (#252, "Not in this PR").

**Dead ends.** `boat-run` would not start the local test run ("the plan's starts are nearly
used"), so the tests ran only in Depot CI. The first push failed `npm test` because this entry
lacked its "Dead ends" and "Evidence" parts, and the second because `SKILL.md` at 13996 bytes
left no room for the tests' added row; each fixed in a following commit.

**Evidence.** The proof these pages rest on is Stack-Atlas #252's:
`~/.local/share/stack-atlas/evidence/2026-11-20-codeql-depot/proof.md`.
