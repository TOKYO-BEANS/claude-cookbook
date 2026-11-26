# Options weighed: check

Chosen by fit for the job on 15 November 2026. Security has had one owner per job since
3-5 November 2026; one platform for it all: [security-platforms](security-platforms.md).

- **CI: Depot CI.** Fast cached runners, run diagnostics, and one place for tests and
  container builds. Weighed: GitHub Actions (kept only for Probiz's Windows job, on a
  Depot runner, and CodeQL default setup until a repository moves); CircleCI and Buildkite (a
  second vendor); Blacksmith (runners only: [measured](ci-depot-vs-blacksmith.md)).
- **Review of every pull request: the `ai-review` job.** It runs once on a same-repository pull
  request, when marked ready for review, with a fixed rubric and no tools, and its comment on the head commit is part of the
  merge condition. Weighed: CodeRabbit (ruled out by the owner: do not use it); Greptile and
  similar hosted reviewers (one more service reading every private diff); Macroscope (the same,
  paid per review, and its GitHub app asks for write access to code and workflows; installed
  and removed on 16 November 2026); tstack's `sol-loop` and `council` (not in use, though
  Codex is now on: the reasons are in "ship"; a consult is advice, never the review);
  `sa-review` (the owner of a range with no pull request; the fallback is in the ai-review recipe).
- **Our code: CodeQL in the Depot `codeql` job.** Alerts in GitHub, required by the ruleset.
  Weighed: default setup (GitHub Actions); Semgrep Code (one scanner owns the job); Snyk Code (a second vendor).
- **Dependencies: Semgrep Supply Chain.** It blocks high or critical ones not classed
  unreachable. Weighed: Dependabot alerts (off in the organisation configuration: one owner);
  OSV-Scanner as a CI job (outside code only); Snyk and Socket (a second vendor).
- **Keys at push: GitHub Secret Protection.** It blocks before the key lands and checks
  validity. Weighed: Gitleaks CI scans (find a key after the push).
- **Packages at install: Aikido Safe Chain.** It checks a package before its install script
  runs. Weighed: Socket (a second vendor); `npm ci --ignore-scripts` alone (stops scripts, not a
  malicious package that is imported later).
- **Dependency updates: Dependabot version updates.** Weighed: Renovate (more control than
  weekly grouped updates need).
- **Outside code before an install: three scanners, then one boat sandbox run.** The scanners
  read the code; the sandbox shows what it does. Weighed: scanners alone (they cannot see
  behaviour); a run on this PC or in Docker (that is the machine being protected).
- **Visual check of a live site: the site's own script.** The repository's Playwright (its
  own dependency) and a plain Chromium take the pictures; a plan-token `claude -p` on a
  model other than the builder's judges them. Weighed for the pictures, on the same four
  screenshots: the `browse` CLI and Stagehand (a cloud browser cannot reach a
  local build, and neither emulates a phone) and the built-in browser (a model call per
  step, the visible window only). Weighed for the judge: TypeSafe / Jev (a typed probability
  cannot carry the faults in words, with their place on the page).
- **Agent configuration: AgentShield.** A security scan of permissions, hooks and MCP servers
  on a sanitized copy. Weighed: reading the settings by hand (no baseline to compare with).
- **The Claude setup and its instructions: doctor-plus.** It audits the instruction files
  against current context-engineering practice and reports before fixing. Weighed: `/doctor`
  alone (installation health only, the fallback).
