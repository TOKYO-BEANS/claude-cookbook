# CodeQL in Depot CI

From Stack Atlas standard v28 (Stack-Atlas #252; owner's yes, 20 November 2026, Cookbook chat
"Replace GitHub Actions with Depot"), CodeQL scans our code in a Depot CI job instead of
GitHub's default setup, which runs on GitHub Actions. GitHub code scanning keeps the alerts.

- **What runs.** The standard's `codeql` job in `.depot/workflows/ci.yml`, with
  `.depot/codeql/scan.sh` and `.depot/codeql/suite` (managed: change them only through
  `stack-atlas-onboard`). On every pull request and push it downloads the pinned CodeQL
  bundle, scans each language GitHub lists for the repository (plus `actions` when it has
  workflow files) with the suite its default setup ran (`default`, or `extended` where that
  ran), and uploads the SARIF to GitHub code scanning under default setup's categories
  (`/language:<language>`) with Depot CI's `GITHUB_TOKEN` (`security-events: write`). It fails
  unless GitHub processed every upload.
- **The rule.** `Stack Atlas checks` requires the check `Depot CI / codeql` and keeps its
  code-scanning rule (tool `CodeQL`: errors, and security alerts high or higher, block).
  Alerts, pull request annotations and the `github-advanced-security` review threads work as
  before (proven on 20 November 2026). Depot CI does not run fork pull requests, so they get no
  CodeQL and the rule blocks them.
- **The move.** A repository moves when its onboarding pull request brings the job. GitHub
  refuses CodeQL uploads while default setup is on, so the onboarding saves the alerts, moves
  the repository to the organisation configuration `TOKYO-BEANS standard, CodeQL in Depot CI`
  (default setup off), runs the job once on the default branch and checks with
  `codeql-verify` that every alert and dismissal is still there. When the pull request does not
  merge, `codeql-switch --back <suite>` turns default setup on again.
- **Still on default setup** (no `codeql` job in its `ci.yml`; new repositories start there):
  leave it, on Depot runners when private and GitHub's when public
  ([security-costs](security-costs.md)). It moves only through its onboarding pull request:
  never add the job or switch its configuration by hand.
- **Never turn default setup on again for a moved repository**, in its settings, through
  `code-scanning/default-setup` or the first configuration: GitHub would refuse the job's
  uploads, `Depot CI / codeql` would fail and every pull request would block. `org --check`
  in Stack Atlas names it as drift.
- **Versions and suites.** The bundle is pinned, so a new CodeQL release arrives through a
  standard version. Raising a suite is its own step with its own triage.
- **History.** Alerts keep their numbers, states and dismissals. Default setup's old analyses
  stay as a stale configuration; deleting it deletes history and is the owner's call.
- **Cost.** About a minute a scan for this repository on a Depot sandbox, billed by Depot; a
  public repository loses the free GitHub minutes default setup used.
