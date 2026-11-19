# Measured: Semgrep's code rules against CodeQL

The owner asked on 17 November 2026 to measure before the trial ends (about 28 November):
could Semgrep's free code rules replace GitHub Code Security (USD 30 a committer a month)?
Measured the same day on our eight repositories, one committer.

- **Semgrep's free tier, read and tried with our key.** Code (Pro rules, cross-file
  analysis) and Supply Chain, up to 10 contributors and 10 private repositories
  (<https://semgrep.dev/pricing>). Secrets is not in it: a secrets scan with our key was
  refused, "None of the requested products are available for this deployment". So nothing
  replaces Secret Protection (USD 19).
- **How.** The Semgrep CLI on this PC, `semgrep scan --pro --config p/default --metrics=off`:
  only the rules are downloaded, nothing is uploaded (read in the CLI's source; `semgrep ci`
  posts findings). CodeQL's alerts read with `gh api .../code-scanning/alerts`.
- **CodeQL's 78 alerts** (5 repositories; by path 26 in product code, 52 in tests; 35 fixed, 3 open,
  40 dismissed): each alert's files were scanned at the alert's commit, tests included.
  Semgrep flagged **none** of the 78 weaknesses, the 20 fixed in product code among them
  (file-system races, file data sent over HTTP, network data written to a file, insecure
  randomness, ReDoS, tag filters, double escaping, incomplete sanitising) and the 3 open ones. Three lines nearby carried a
  different rule. Not analysed in full: four alerts' files timed out (the open stack-trace
  alert and three in tests) and one parsed only in part.
- **What only Semgrep found**, on all eight default branches (three large ones with
  `--pro-intrafile`, cross-file being too slow here): 89 findings, 24 of them in
  files the standard writes. By rule: child process 17, non-literal RegExp 19, `replaceAll`
  escaping 18, `Object.assign` 13, Dependabot cooldown 8, dynamic URL fetch 4, wildcard
  `postMessage` 4 (a theme's vendor code), raw HTML 3, key patterns in a test 2, format
  string 1. Read one by one, none showed outside input reaching the flagged line; a reading
  clears nothing. All 89 are listed in the evidence and go to triage in their
  repositories, two first: a shop's catalogue HTML rendered unsanitised.
- **Time.** CodeQL on Depot runners: 45 to 100 seconds for JavaScript and TypeScript, about
  35 for Actions (the five repositories with Depot runs). Semgrep's Pro engine on the Windows PC:
  4 to 48 minutes a repository, with cross-file timeouts; Linux in CI may be faster, not
  measured. On a pull request `semgrep ci` scans the changed files only.
- **Not covered by either:** Liquid templates.
- **A move would cost:** a standard version (the `semgrep` job runs `--code` too and gates
  code findings; the org policy blocks on nothing today); the `Stack Atlas checks`
  ruleset's CodeQL rule removed in the same change, or every pull request waits; the
  security configuration's default setup off and the audit's CodeQL check changed;
  `sa-triage` rewritten for Semgrep code findings; the 3 open alerts fixed first. Whether
  GitHub keeps the old alerts readable after Code Security ends is not confirmed: they are
  exported to the evidence folder.
- **Result:** keep CodeQL. On our code Semgrep found none of what CodeQL found, and audit
  rules of its own; the saving is USD 30 a month. The purchase is the owner's.
