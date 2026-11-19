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

**What it means.** A merge commit has 4 checks again (`Depot CI / test`, `Depot CI / semgrep`,
`Analyze (javascript-typescript)`, `Analyze (actions)`): `merge-when-green.sh ... 4`. Tests
that run only on `win32` now run nowhere.

**Outstanding.** The standard's `windows-ci` item reads `blocked`
(`owner-approval-required`) while the repository holds Windows files
(`agent-key.ps1` and three stack-updates test fixtures, `.ps1`/`.cmd`); it reads
`not-needed` once they go. Owner: Claude, the chat "Cookbook: Linux rewrite of
Windows-specific pages and scripts" for those files; the Stack Atlas handoff records the
owner's answer so the item is not put to the owner again.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-retire-windows-ci/`: the
ruleset before and after, the merge log.
