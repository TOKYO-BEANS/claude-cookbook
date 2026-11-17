# 17 November 2026: a Windows CI job

**Why.** The standard's `windows-ci` item read `blocked` (`owner-approval-required`) here after
v19 (#100): the repository holds Windows code (PowerShell scripts, `.cmd` shims) and had no CI
job on a Windows runner. The owner said yes to a Windows job on 17 November 2026 (question
dialog in the Stack Atlas chat about the OpenTelemetry lock: "Yes, open a job for it").

**What changed (#101).**
- `.github/workflows/ci.yml`, the Windows exception to Depot-only CI: one job,
  `test (windows-2025)`, runs `npm ci` and `npm test` (the whole suite), with the standard's
  Safe Chain step for Windows before the install. No secrets; `contents: read`.
- It runs Node 26, not the Depot job's 24. The key helpers read the DPAPI store through
  `node:ffi`, which Node 24 lacks; on 24 the six tests of that route skipped on the runner.
- `.gitattributes`: every text file is checked out with LF (`* text=auto eol=lf`).
- `boat-run.mjs`: the copy for the Linux sandbox holds the repository's own bytes
  (`git archive` runs with `core.autocrlf=false` and `core.eol=lf`), with a test that sets
  the machine's Git either way.

**What the first Windows run found.** 639 passed, 6 failed, all on line endings. Git for
Windows ships `core.autocrlf=true`, so the runner checked the files out with CRLF; this PC's
own Git configuration says `input`, which is why it never showed here. Five were tests whose
patterns end a line at `\n`. The sixth was a real fault: on a default Windows Git, `boat-run`
uploaded CRLF copies to the Linux sandbox, because `git archive` converts as a checkout does.

**The runner is GitHub's, not Depot's.** Stack Atlas runs its Windows job on
`depot-windows-2025`. That does not work here as things are: this repository is public, the
organisation's Default runner group has "Allow public repositories" off (read with `gh api
orgs/<org>/actions/runner-groups`), and Depot's docs say its runners take a public
repository's jobs only with that setting on. GitHub's own `windows-2025` runner is free for a
public repository and needs no setting. The owner was asked (question dialogs, this chat):
first chose to make the repository private and use Depot's runner, then, shown what that
costs (below), leaned to keeping it public. Nothing was made private and no setting was
changed. If the repository turns private, switch the job to `depot-windows-2025`.

**Verification.**
- Stack Atlas, standard v19, `node standard/cli.mjs check <folder> --ref HEAD`: `windows-ci`
  `in-place`; `safe-chain`, `.github/workflows/ci.yml#install-steps`, `in-place`. Without
  `--ref` the command reads `origin/HEAD`, so a local commit still reads `blocked`.
- `test (windows-2025)` on `79470b4` (run 44067871839, Node 26.13.1, 1 min 32 s): 652 passed,
  0 failed, 4 skipped, the same four as on this PC (a symbolic link, the Gitleaks scan, POSIX
  file modes, SIGTERM). The six `Windows:` tests of the DPAPI route ran and passed.
- The same commit: `Depot CI / test`, `Depot CI / semgrep`, `Analyze (javascript-typescript)`
  and `CodeQL` passed.
- The new line-endings test failed before the fix on this PC (`'one\r\n' !== 'one\n'`) and
  passes after it.

**Seen on the way: the GitHub Actions budget.** Not this job's; handed the same day to its
own chat ("Security tooling: one tool for all of it? And the GitHub Actions budget"), with the
owner's question whether one tool could do what GitHub, Semgrep and the others do. The
organisation's Actions budget is $0 with a hard stop. CodeQL default setup runs on GitHub's
runners, free for a public repository and counted against the plan's 3,000 included minutes
for a private one. On 17 November the private repositories had used 2,637 of them, about 155
a day, so CodeQL stops there around 19 to 20 November unless something changes. This
repository used 1,014 minutes in the same days, at no cost while it is public: that is what
turning it private would add.

**Outstanding.**
- The `Stack Atlas checks` ruleset does not require `test (windows-2025)` yet. The onboarding
  skill writes it from the checks the workflows post, once the workflow has run on `main`.
  Owner: this chat, after the merge. Cleared by an onboarding run that reads `checks-ruleset`
  `in-place` with the new check in it.
- The runner: revisit if the repository turns private or Depot CI gets Windows sandboxes.
- Node 26 on the runner follows the newest 26; this PC is updated by hand. `node:ffi` is
  experimental: if a Node update changes it, the direct-route tests fail here first.
