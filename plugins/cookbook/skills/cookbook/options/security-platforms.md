# Options weighed: one security platform

The owner asked on 17 November 2026 whether one tool could do all of it better than the
split in [check](check.md). Researched the same day (four `sa-research` runs and the
vendors' pricing pages) for one committer and eight repositories. Result: none.

- **Blocking a key at push** in a private repository exists only as GitHub Secret Protection
  (USD 19 a committer a month): <https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection>.
  Every other tool finds the key after the push.
- **Aikido.** Free: 2 users, 10 repositories, code, dependency and secret scanning, but no
  pull request gating, no malware detection and no review. Paid: USD 350 a month for 10 users
  (<https://www.aikido.dev/pricing>). Its free plan was in use and removed on 3 November 2026.
- **Semgrep**, already here for dependencies. Free up to 10 contributors and 10 private
  repositories, with code rules; Secrets is not in it. Its code rules in place of CodeQL
  would save USD 30 a month; measured on our code, they found none of CodeQL's 78 alerts
  ([semgrep-code-vs-codeql](semgrep-code-vs-codeql.md)).
- **GitHub for all of it** (Dependabot alerts in place of Semgrep): the same USD 49, and the
  reachability filter is lost.
- **Snyk.** Free has 100 code tests a month, too few for our pull requests; Team is USD 25 a
  developer a month (<https://snyk.io/plans/>). No block at push.
- **Socket**: packages only (<https://socket.dev/pricing>). **SonarQube Cloud**: free gating
  only after the merge (<https://docs.sonarsource.com/sonarqube-cloud/improving/pull-request-analysis/>).
  **Arnica**: free scans weekly and cannot block a merge; USD 30 an identity a month does
  (<https://www.arnica.io/pricing>).
- **Review of a pull request inside a platform.** GitHub Copilot's review needs a paid
  Copilot seat and is billed by use on top
  (<https://docs.github.com/copilot/concepts/agents/code-review>); Aikido's is in the paid
  plan; Semgrep, Snyk and Sonar review security or quality rules only. Macroscope: about five
  times our own review for each pull request, measured on 17 November 2026. None is cheaper
  than one review on the Claude plan.
- **Depot's larger plan** (USD 200 a month, 20,000 runner minutes): CodeQL needs under 2,000.
- **Not found**: an independent 2025 or 2026 comparison of finding quality between CodeQL,
  Semgrep, Snyk Code and Aikido. Hence the measurement on our own code (Semgrep only).
- Prices are list prices read on 17 November 2026; a claim without a link here was in a
  research run's sources and is not checked against the vendor's page.
