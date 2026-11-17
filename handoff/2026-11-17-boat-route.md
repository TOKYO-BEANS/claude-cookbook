# 17 November 2026: the boat route hook (#108)

**The job.** The owner's outcome: the PC stops throttling because heavy jobs run on boat. Measured
before (the opening chat): RAM 12.5 of 14.8 GB, CPU 67%; 5 `node --test`, 3
`semgrep-core-proprietary` and 5 `merge-when-green` runs live on this PC; boat 730 seconds used
of 2,000,000 this month.

**What changed.** #108 merged as `37630c9`. `hooks/boat-route.mjs` (`PreToolUse`, `Bash|PowerShell`)
denies a local `npm test`, `node --test`, `pytest` or `semgrep scan|ci` in a repository on
boat-run's upload list and names the `boat-run.mjs` command to use (`semgrep ci`: the CI job,
since the token does not go into a sandbox). A run that needs Windows or this PC ends
`# local-run: <why>` (ten characters or more). It is a route, not a gate: a command holding a
command substitution, a backtick or a here-document (bash), or a subexpression, block comment
or here-string (PowerShell), and any error, let the call run. `recipes/boat.md` and
`recipes/boat-setup.md` carry one line each. On the PC (not in git): `stack-atlas` and
`release-maintenance` were added to the upload list (the owner's own, private; code and test
identifiers only, no data-shaped files), so the hook covers them too.

**What runs where, checked.** `merge-when-green.sh` runs no tests or Semgrep itself (it waits on
CI). sa-review's evidence step runs the caller's test commands locally: give it the boat-run
command as its test command (a failing one is still a blocking fact). Its Semgrep step runs
`semgrep-supply-chain.mjs` with the token, which the hook does not see and boat may not take
without the owner's yes: the three `semgrep-core-proprietary` processes come from there.

**Verification.** Suite on boat at each head (668 tests, 661 pass, 0 fail, 7 Windows-only
skipped at `f23e04a`; 670 and 663 on this entry's branch, `main` at `37630c9` plus the entry;
about 30 seconds in a `small` sandbox, against about 150 seconds locally). Stack-Atlas's
suite on boat with `npm ci --ignore-scripts`: 743 tests, 740 pass, 1 fail ("this repository's own
tree holds no scanner ignore file", in the Desktop clone's working tree, not looked into here).
All eight checks passed on `9e989af`; release check `verified` (execution 1694). The installed
plugin is `37630c9`; its hook, run as a process, denies `npm test` in the Stack-Atlas clone with
the boat-run command and lets the `# local-run:` form through.

**The review.** The `ai-review` job was unavailable on every head (the API credit balance);
the owner chose fallback reviews over a top-up. Five fallback rounds by a `cookbook:review`
subagent. Rounds one and two (on `cccadcc` and `e0b2ec9`: 1 medium and 4 low, 1 medium and 2
low) were not posted as records; their fixes are commits `f23e04a` and `61ec434`. Rounds three
to five are records on #108: 2 medium and 4 low, 1 medium and 4 low, then none. Rounds four and
five were the owner's yes past the three-round budget (the fifth on the delta only). Graphify's
advisory review was not answered on #108; its points are under Outstanding.

**Failure and dead end.** A hand-written shell reader drew new parse findings each round
(nested quotes in `"$(...)"`, here-documents, redirections). After two rounds of fixes the
approach changed instead of a third variant: the reader stops modelling and lets anything it
does not read through. Owner rule of 17 November 2026, simple first.

**Measured after** (15:40, minutes after the plugin update): boat 650 of 2,000,000 seconds used
(`subscriptionQuotaSeconds` minus `subscriptionRemainingSeconds` of `boat limits --json`), 0
sandboxes running. That is below the opening chat's 730 although about fifteen runs went in
between: the two readings do not measure the same thing, and the opening chat's field is not
known. Read the same two fields next time; RAM 13.0 of 14.8 GB, CPU 82%; 6 `node --test` and 5
`npm test` processes, all started by sessions that predate the update (a plugin hook loads at a
session's start), 0 `semgrep-core`, 0 `merge-when-green`. The effect shows once sessions restart:
measure again then.

**Outstanding.**
- Follow-up pull request, the two open low findings of round four: the suggestion for `yarn
  test`, `pnpm test`, `poetry run pytest` and `py -3 -m pytest` assumes npm or uv; information
  calls (`pytest --version`, `npm test -- --help`) are denied as runs.
- Graphify's advisory review of `9e989af` (each "Escalate, medium", none blocking): `find()`'s
  coupling (Ca·Ce 15); `python script.py -m pytest` read as a pytest run (an extra denial);
  `--push "<top>"` unescaped (a Windows path holds no `"`); the fixed node path in `hooks.json`
  (as the other hooks, for the desktop app's short PATH). The first two go with the follow-up.
- Stack Atlas: sa-review's Semgrep Supply Chain run with the token stays on this PC. For a pull
  request head, reading the CI `semgrep` job instead would take it off; a token in a sandbox needs
  the owner's yes.
- Next job, not taken on here: the per-session MCP servers (stagehand, context-mode and the
  `with-key.mjs` wrappers, about 11 of each) and the 474 unsettled T3 chats, most of them idle
  `merge`, `apply` and `Workflow` children.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-17-boat-route/`:
`release-cookbook-108-merge.log`, `boat-npm-test-f23e04a.log`, `boat-npm-test-handoff-75f7367.log`,
`boat-stack-atlas-test.log`, `upload-allowed-after.txt`. The records of rounds three to five are
comments on #108.
