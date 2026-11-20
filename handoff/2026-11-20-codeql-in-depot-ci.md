# 20 November 2026: CodeQL in Depot CI, in the map and the pages

**Why.** The owner said yes on 20 November 2026 (Cookbook chat "Replace GitHub Actions with
Depot") to moving CodeQL from GitHub's default setup, which runs on GitHub Actions, into a
Depot CI job. Stack Atlas standard v28 (TOKYO-BEANS/Stack-Atlas#252) builds it: the managed
`codeql` job runs the pinned CodeQL bundle, scans the languages GitHub lists with the suite
default setup ran, and uploads SARIF to GitHub code scanning; each repository moves to the
configuration `TOKYO-BEANS standard, CodeQL in Depot CI` (default setup off) when its
onboarding pull request brings the job.

**What changed.** The map's "Scan our code" row names the Depot `codeql` job, with default
setup until onboarding, and links the new page `recipes/codeql.md` (what runs, the rule, the
move, a repository still on default setup, never turning default setup on again for a moved
repository, versions, history, cost). `recipes/security.md`, `recipes/security-costs.md`,
`options/check.md` (GitHub Actions now kept for Probiz's Windows job and for default setup
until a repository moves) and the GitHub and Depot entries of `catalog.json` say the same.

**Verification.** `npm test` (see the pull request's checks).

**Outstanding.** The pages describe Stack-Atlas #252, which was a draft when this was written;
if it changes before it merges, these pages follow. No repository has moved yet; the
rollout starts with claude-cookbook (#252, "Not in this PR").
