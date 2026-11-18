# 17 November 2026: Semgrep's code rules measured against CodeQL

**Why.** The owner chose "Measure first" for the purchase when GitHub's Advanced Security
trial ends (about 28 November 2026): Semgrep's free code rules against the CodeQL alerts we
have, by 24 November, then the owner chooses.

**What was measured.** The result and the method are in
`options/semgrep-code-vs-codeql.md`. In short: Semgrep found none of CodeQL's 78 alerts
(20 of them fixed in product code); on all eight default branches it found 89 things of its
own, all hints, none with outside input reaching the line on reading; Semgrep's free tier
has no Secrets (refused with our key). Nothing was uploaded: local `semgrep scan` with the
`semgrep` key from the DPAPI store, `--metrics=off`.

**What changed.** The Cookbook: `options/semgrep-code-vs-codeql.md` is new;
`options/security-platforms.md` and `recipes/security-costs.md` point to it. No tool was
added, changed or retired.

**Verification.** `npm test`. The counts come from the scripts in the evidence folder; the
CodeQL alerts were read on 17 November.

**Outstanding.**
- The purchase, due before the trial ends (about 28 November 2026). Asked in the question
  dialog on 18 November 2026 (both for USD 49, recommended; Secret Protection only for
  USD 19; not now): the owner answered "Not now". Owner: the owner. Nothing is bought,
  cancelled or changed until the owner answers. If the trial ends with Code Security not
  bought, the `Stack Atlas checks` ruleset's CodeQL rule blocks every pull request in the
  seven private repositories: GitHub blocks a merge when "a required tool is not configured
  for the repository" (<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets>).
  Removing that rule is a weakened check, which is the owner's too.
- Two findings Semgrep alone raised (unsanitised catalogue HTML rendered in a shop's
  storefront) go to triage in that repository. Owner: Claude, a chat of its own.
- The three open CodeQL alerts in one repository stay with `sa-triage` there.

**Failures and dead ends.**
- Semgrep's Pro engine on Windows is slow: 44 minutes for a 218-file repository, with
  cross-file timeouts; three large repositories were scanned with `--pro-intrafile`.
- Semgrep on Linux in WSL failed twice (no `pip` or `venv` without sudo; the CLI's
  `semgrep-core` needs the musl loader); not tried a third time. boat was not used: the
  Pro rules need the key, and a key in a sandbox needs the owner's yes.
- Semgrep's default ignore skips `test/` folders: the alerts in tests were scanned a second
  time with that ignore list emptied in the local copy.
- Whether GitHub keeps old code-scanning alerts readable after Code Security ends was not
  found in its docs; the alerts are exported.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-17-semgrep-vs-codeql/`:
`codeql/` (alerts, setup, analyses, run times per repository), `codeql-alerts-flat.json`,
`semgrep/` (every scan's JSON and seconds), the scripts and `hist-plan.txt`.
