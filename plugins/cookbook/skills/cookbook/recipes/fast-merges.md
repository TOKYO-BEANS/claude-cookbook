# Fast merges

What a pull request waits on, measured over 3.3 days of sessions on 22 November 2026: CI is
1.5 to 6 minutes, a one-round pull request 5 minutes from open to merge. More than half of a
session's clock went to waiting on background tasks and hand-written `sleep` loops, and the
pull requests with a second review round took 47% of all open-to-merge time. These rules cut
the waits; none changes [the merge condition](ci-releases.md).

- **Merges queue up:** a push cancels `main`'s running CI; `merge-when-green.sh` waits for it,
  a hand merge must check first.
- **The merge scripts run in the background.** Start `merge-when-green.sh` and `after-merge.sh`
  with the Bash tool's `run_in_background` and a long timeout, then write the handoff entry
  while they run; their notification is the wake-up. Never poll with `sleep` and `gh`: 200 to
  300 such loops in 47 sessions, and two foreground `after-merge.sh` runs hit the 600-second
  Bash limit. After a T3 restart killed the task, read the script's log or verdict line
  instead of starting a loop.
- **A review with no high or medium finding ends the rounds.** Merge. Its low findings go into
  a follow-up pull request, as after the last round, and that may be the next change to the
  same repository: never a new round on this one. Only a round that had a high or medium
  finding counts against the budget of three. Not for a security finding of any severity
  (fixed, [ci-releases](ci-releases.md)) or a finding in a review thread
  ([review-threads](review-threads.md)).
- **Merge `main` in only for a real conflict.** The rulesets do not ask for a branch that is up
  to date, so a merge of `main` is a new head, new CI and a new review for nothing. In this
  repository, merge it when `main` changed `SKILL.md` or a page this pull request changes:
  two changes can each fit a limit and break it together.
- **Room before a push** (this repository): `node scripts/check.mjs --room` prints what is
  left in `SKILL.md` and every page within 150 bytes of its limit. It runs in 0.1 seconds, is
  not a test suite, and catches a byte-limit failure before boat-run and CI do.
- **The handoff entry goes in the job's own pull request** (owner, 22 November 2026), naming
  the release log the run will write. A separate handoff pull request only when the release
  check fails or an owner answer arrives after the merge, at most one per repository a day.
  Here `node scripts/new-handoff.mjs <slug> "<title>"` writes the entry with its five parts.
- **Tests before a push run in the background.** Start boat-run with `run_in_background`,
  write the pull request text meanwhile, and push only after exit 0. Never pipe its output
  into `tail` or `grep` without `set -o pipefail`: the exit code is then the pipe's, and 31
  failing runs read as passes that way.
- **Load the T3 tools in one call.** One `ToolSearch` with `select:` and every T3 tool the job
  will need (for a pull request: `link_pull_request`, `watch_pull_request`,
  `unwatch_pull_request`, `t3_thread_organize`), not one call per tool: sessions made a median
  of six such calls.
- **Ask the owner once per job.** Collect the decisions the job will need and ask them in one
  question dialog (up to four questions, each with a "not now"): [owner-questions](owner-questions.md).
