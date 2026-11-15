# Options weighed: check

Chosen by fit for the job on 15 November 2026. Security has had one owner per job since
3-5 November 2026; the reasons are repeated here so the whole design is in one place.

- **CI: Depot CI.** Fast cached runners, run diagnostics, and one place for tests and
  container builds. Weighed: GitHub Actions (kept only for two documented exceptions: the
  Windows checks and CodeQL default setup); CircleCI and Buildkite (a second vendor for the
  same job).
- **Review of every pull request: the `ai-review` job.** It runs on every same-repository pull
  request with a fixed rubric and no tools, and its comment on the head commit is part of the
  merge condition. Weighed: CodeRabbit (ruled out by the owner: do not use it); Greptile and
  similar hosted reviewers (one more service reading every private diff); tstack's `sol-loop`
  and `council` (a second provider's model through T3 Code: only the Claude provider is on,
  and switching another on costs money); `sa-review` (the fallback, and the owner of a range
  that has no pull request).
- **Our code: CodeQL.** Native to GitHub and required through the ruleset. Weighed: Semgrep
  Code (its code rules were dropped so that one scanner owns the job); Snyk Code (a second vendor).
- **Dependencies: Semgrep Supply Chain.** It blocks only on a reachable high or critical
  vulnerability. Weighed: Dependabot alerts (off in the organisation configuration: one owner); OSV-Scanner
  in CI (kept for outside code only); Snyk and Socket (a second vendor for the same job).
- **Keys at push: GitHub Secret Protection.** It blocks before the key lands and checks
  validity. Weighed: Gitleaks in CI (finds a key after the push).
- **Packages at install: Aikido Safe Chain.** It checks a package before its install script
  runs. Weighed: Socket (a second vendor); `npm ci --ignore-scripts` alone (stops scripts, not a
  malicious package that is imported later).
- **Dependency updates: Dependabot version updates.** Weighed: Renovate (more control than
  weekly grouped updates need).
- **Outside code before an install: three scanners, then one boat sandbox run.** The scanners
  read the code; the sandbox shows what it does. Weighed: scanners alone (they cannot see
  behaviour); a run on this PC or in WSL (that is the machine being protected).
- **Visual check of a live site: being built.** Screenshots at desktop and phone size, judged
  against the intended design by an agent that did not build the change. Candidates for the
  screenshots: the `browse` CLI, Stagehand, the built-in browser. The recipe arrives from the
  chat that builds the check.
- **Agent configuration: AgentShield.** A security scan of permissions, hooks and MCP servers
  on a sanitized copy. Weighed: reading the settings by hand (no baseline to compare with).
- **The Claude setup and its instructions: doctor-plus.** It audits the instruction files
  against current context-engineering practice and reports before fixing. Weighed: `/doctor`
  alone (installation health only, the fallback).
