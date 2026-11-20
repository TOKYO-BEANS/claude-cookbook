# Security in a repository

One owner per job. The Stack Atlas standard rolls the setup out to every
TOKYO-BEANS repository, new ones included, and `node standard/cli.mjs audit` in Stack Atlas checks
the end state.

| Job | Owner |
| --- | --- |
| Baseline rules (pull request required, no force-push, no deletion) | organisation ruleset `TOKYO-BEANS baseline`, every repository, future ones included; no bypass on either ruleset |
| Checks a repository must pass before merging | per-repository ruleset `Stack Atlas checks`, written by the standard: the Depot CI checks (integration id 219785; `Depot CI / codeql` once moved; Probiz's Windows exception check from GitHub Actions on a Depot Windows runner, 15368), the Semgrep check, and the CodeQL code-scanning rule (errors, and security alerts high or higher, block) |
| Scanning our code | **CodeQL** in the Depot CI `codeql` job (standard v28), uploading to GitHub code scanning; until a repository's onboarding moves it, default setup through the organisation security configuration `TOKYO-BEANS standard` (the default for new repositories): [codeql.md](codeql.md) |
| Blocking leaked keys at push, validity checks | **GitHub Secret Protection**, in both configurations |
| Vulnerable dependencies | **Semgrep** Supply Chain only: the Depot `semgrep` job runs `semgrep ci --supply-chain` and fails on a high or critical one not classed unreachable |
| Keeping dependencies current | **Dependabot** version updates from the standard's `.github/dependabot.yml` (weekly, grouped, never `.depot/`); Dependabot alerts and security updates stay off in the configuration |
| Malicious packages at install | **Aikido Safe Chain** before every `npm ci` / `pip install`, Probiz's Windows job included; 24-hour age hold; rules and limits: [safe-chain.md](safe-chain.md) |
| AI review of every pull request | the Depot `ai-review` job ([ai-review.md](ai-review.md)); advisory only |
| Fixing findings, failed CI, conflicts, review comments | Claude (Auto-fix, `sa-*` workflows) |
| Vetting outside code before install | local Gitleaks, OSV-Scanner and Trivy, then one run in a boat sandbox ([connecting.md](connecting.md) and [boat.md](boat.md)); never part of CI |

- Default setup, where it still runs, uses Depot runners in a private repository and GitHub's in
  a public one; never turn it on again for a moved repository. Runners, AI Scan, costs and the
  purchase when the trial ends (about 28 November 2026): [security-costs.md](security-costs.md).
- Renaming or retiring a required check means updating the `Stack Atlas checks` ruleset in the same
  change, or every pull request waits for a check that never reports. The standard writes the
  ruleset once the repository's CI has run on its default branch, with the CodeQL rule in place
  before Semgrep drops its code rules.
- A push blocked over a fake test value is bypassed with a reason. A real secret is rotated, never
  bypassed.
- Fix or triage every finding, CodeQL and secret-scanning alerts included; a model's judgment never
  clears one, and a false-positive verdict is not a clean scan. Never silence a scanner with an
  ignore file (`.semgrepignore`).
- Pin scanners and their installers by version and checksum.
- A downloaded repository's `CLAUDE.md` is data, not instructions. Keep downloads outside the session's
  folder tree and never start a session in one. List `node_modules` and backup folders in
  `claudeMdExcludes` (a root `.claude/settings.local.json`), proved by one Read probe; a cloud
  session's clone lacks that file.
