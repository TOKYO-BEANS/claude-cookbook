# 19 November 2026: the Windows CI job is retired

**Why.** The Windows PC is gone; the owner works on the Ubuntu laptop. The owner said yes on
18 November 2026 to retiring the job `test (windows-2025)` (`.github/workflows/ci.yml`, the
Windows exception of 17 November 2026, #101). The yes covers the change by hand to that file
and to the required checks; nothing else is loosened.

**What changed.**
- `.github/workflows/ci.yml` is deleted: GitHub Actions runs no job here now, only CodeQL
  default setup. Every test runs in Depot CI (`Depot CI / test`, on Linux).
- The ruleset `Stack Atlas checks` (id 26753037) no longer requires `test (windows-2025)`; it
  requires `Depot CI / semgrep` and `Depot CI / test` and keeps the CodeQL rule. Changed by
  hand before this pull request opened, so the pull request was not held by a check that no
  longer runs. It is the body the standard's `checks-ruleset` builds for a repository with no
  Windows workflow.
- `recipes/keys.md`: the old Windows key route is no longer tested in CI.

**What it means.** A merge commit has 3 checks (`Depot CI / test`, `Depot CI / semgrep`,
`Analyze (javascript-typescript)`): `merge-when-green.sh ... 3`. Tests that run only on
`win32` now run nowhere.

**Verification.** `npm test` on boat: 724 pass, 0 fail, 10 skipped (the Windows-only
tests). The ruleset read back after the change: `active`, `Depot CI / semgrep` and
`Depot CI / test`.

**Dead ends.** `Analyze (actions)` failed on this pull request: "CodeQL could not process any
code written in GitHub Actions". CodeQL default setup still lists `actions`, and with the last
workflow gone the pull request's scan finds nothing. GitHub updates default setup's languages
by itself when a language leaves the default branch; dropping it by hand before the merge
removes a check, so it went to the owner: "Drop 'actions' now" (owner, 19 November 2026,
question dialog). Default setup now lists `javascript-typescript` only; the enforced
organisation configuration accepted the change.

**Left on purpose.** `security.md`, `safe-chain.md` and the catalog's Aikido entry keep
"Windows jobs included": Probiz, Stack-Atlas and release-maintenance still run a Windows job
in `.github/workflows/ci.yml`. Whether those go is the owner's call, not asked here.

**Outstanding.** The standard's `windows-ci` item reads `blocked`
(`owner-approval-required`) while the repository holds Windows files (`agent-key.ps1`,
three stack-updates fixtures). #178 removes them; it merges after this pull request, since
it fails the Windows job by design. Owner: Claude, the chat "Cookbook: Linux rewrite of
Windows-specific pages and scripts". Clears when the item reads `not-needed`; the Stack
Atlas handoff records the owner's answer, so the item is not put to the owner again.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-retire-windows-ci/`: the
ruleset and the CodeQL default setup before and after, the merge logs.
