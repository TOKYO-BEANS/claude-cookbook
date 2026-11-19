# 20 November 2026: the model budget reads T3 Code's saved reading on Linux

**Why.** On the Ubuntu laptop 32 of the 46 sessions since the move were told "Model budget:
unknown", every one of the last 19. Found by the migration audit of 20 November 2026 (five
auditors, each gap re-checked by a second agent).

**Root cause.** While T3 Code runs, the script's own read of the usage endpoint mostly answers
429, and T3 Code's saved reading (`~/.t3/caches/claudeAgent.json`) is meant to stand in.
`readOwnFile` in `model-budget.mjs` took that file only when it was "writable by no one else",
tested as `mode & 0o022`. Ubuntu gives every user a group of their own and a umask of 002, so
T3 Code writes the file as 664: group-writable, and the group has one member. The script threw
the reading away. Windows never showed it (no user id there, so the test was skipped), and the
tests wrote their T3 file as 600 "whatever the umask", so no test met a 664 file.

Proved before the change, on the real file: read as written (664) the script said "unknown";
the same bytes copied at 600 gave a reading with source `t3`, 22 seconds old.

**What changed.**
- `model-budget.mjs`: a file writable by everyone is refused as before. One writable by its
  group is read only when that group is the user's alone: `/etc/group` lists the group once
  with no member but the user, and `/etc/passwd` names the user once and no other user with
  that group as their own. A group that cannot be read as that (a network directory, a missing
  or odd file) is refused. `readUsage` takes `accountFiles` so a test can give its own two files.
- `scripts/model-budget.test.mjs`: one test, 13 cases (the user's own group at 664 and 660;
  another member; another user with the group as their own; a second name for the user id; a
  group not listed, listed twice; a user not listed; either file missing; 666 and 646; 644 with
  no file to ask). It failed on the first case before the change.

**Verification.**
- `node --test scripts/model-budget.test.mjs`: 70 of 70. The full `npm test` on boat and CI on
  the pull request.
- The worktree's script on the real file at 00:21 on 20 November: a line with figures, "Source:
  T3 Code's saved reading", where the installed one said "unknown (the usage read answered 429)"
  a minute earlier.
- Sessions that get a real reading after the merge and `claude plugin update`: recorded in the
  entry of the pull request that closes the audit's other Cookbook findings.

**Dead ends.** None.

**Outstanding.** Nothing tells anyone when most sessions read "unknown": this fault ran for
half a day and was found by an audit, not by the setup. Not built here.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-audit-findings/`:
`model-budget-probe.txt`, `model-budget-sessions-before.json`.
