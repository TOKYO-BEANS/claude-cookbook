# 17 November 2026: the old reset list file is moved; the record of #89

**Why.** Two things were open after #89 (the key test's limit, merged 16 November 2026 as
`1e043de`): the `resets.json` that 0.38.0 left on this PC was still there, and what happened
after the handoff entry of #89 was written stood only in an evidence folder. This is a handoff
file only: no file of the plugin changes.

## The reset list file is moved (17 November 2026, times UTC)

Plugin 0.39.0 and later never read `~/.local/share/model-budget/resets.json`; sessions that
started before the install (16 November, 21:06) ran the older hook and rewrote it. Two
conditions had to hold before it was moved, and both held at 08:01:00:

- **No older session ran.** Windows had started at 07:15:14 that day. Five `claude.exe`
  processes ran, started 07:26:33, 07:28:40, 07:29:28, 07:37:33 and 08:00:13: none before the
  install. No session was ended to get there.
- **The file's time had stopped moving.** Written 16 November 23:30:12, 8.5 hours old, 209
  bytes. (It was still rewritten after the 22:06:06 seen during #89.)
- The installed plugin (commit `2086054`) names `resets.json` and `keepResets` in no file.

At 08:01:26 the file was moved, not deleted, to
`~/.local/share/backups/model-budget-resets-2026-11-17/resets.json`: the same SHA-256 before
and after, the same size and time. At 08:02:48, with eight sessions running, the folder held
`sessions`, `usage.json` and `usage-tried.json` and no new `resets.json`. The copy stays in
the backups folder; nothing reads it.

## The record of #89, after its handoff entry (16 November 2026, times UTC)

The entry is `handoff/2026-11-16-leftovers-of-86.md`.

- 21:48: opened at `5a0340d` (one commit, base `20b4777`). The `ai-review` job said `review
  unavailable` (no API credit). Every check passed; Graphify Formal Verification was neutral
  with the title "Formal verification did not run", which the gate sets aside itself, so the
  owner was not asked.
- **One review round.** `sa-review` run `cookbook-89-review` on `5a0340d`: passed. `npm test`
  exit 0, Semgrep Supply Chain 0, CodeQL 0 introduced, one reader on another model. **One low
  finding:** on a loaded PC the key test can wait up to its own limit (about 11.5 minutes),
  past the roughly 600 seconds `sa-review` gives its own `npm test`. It was already the
  entry's second outstanding item; nothing was changed for it. The reviewer cited line 156;
  the limit is at line 244.
- `main` moved to `b617956` during the review (#88, which edits the same test file about 80
  lines higher). Nothing was pushed: the head was merged with it in a detached checkout
  (`17a3e3b`, never pushed), `node scripts/check.mjs` passed, and the two key test files ended
  with 35 tests, 33 pass, 2 skipped, none failed (the key test took 344 seconds, the PC being
  busy).
- **The fallback record** for `5a0340d` is comment 6930807709 on #89 ("1 finding.", the low
  one, with its answer inside the record).
- **The merge.** `sa-release` run `cookbook-89-merge` (`merge: true`): the gate allowed on the
  fallback review, no thread open, none new after the merge. Merged as `1e043de` at 22:07.
  The three checks on the merge commit passed (`Depot CI / test`, `Depot CI / semgrep`,
  `Analyze (javascript-typescript)`).
- **The first release check read `unknown`, not a pass** (execution 1599, reason
  `security_not_verified`): its collection of 22:10:06 holds `scanState: passed` and
  `reviewState: unavailable`. The review state is the release collector's read of GitHub's
  open alerts (critical and high code-scanning alerts, and secret-scanning alerts); one of
  those three reads failed or was unreadable at that moment. Which one, and why, is not
  known: the collector keeps no error text. The same three reads by hand at 22:12 answered 0,
  0 and 0, with 4,803 of 5,000 API calls left.
- **The second read `verified`.** `sa-release` run `cookbook-89-release` (`kind: "merge"`, the
  same commit): release event `verified`, execution 1600.
- Nothing to install: no file of the plugin changed.

## Verification

- The two conditions, the move and the look afterwards, above (`check.md`).
- `node scripts/check.mjs` on this branch: passed (the entry's name, `HANDOFF.md` unchanged).

## Outstanding

- **The key test's wait on a loaded PC,** up to about eight minutes (its own limit: about
  11.5). `sa-review` ends `unknown` when its own `npm test` runs past about 600 seconds: run
  it again when the PC is quieter. Owner: Claude. Clears if `agent-key.ps1` crosses fewer
  scans (its `Import-Module` is four of the eight), or if the scan's wait is tuned by whoever
  manages the security software, which is not ours to change.
- **A neutral Graphify Formal Verification with a title the installed gate does not set
  aside** is still asked of the owner, per pull request.
- **The release collector says `reviewState: unavailable` without saying which read failed.**
  Owner: Claude, in the release maintenance tool's own repository, not here. Clears when the
  collector keeps the failed call's name and error code in its detail. Seen once (execution
  1599); the collector installed on 17 November (07:46 UTC) still keeps no error. Until then:
  when a release event does not read `verified`, read the collection file it names before
  running the check again.

No longer open: the reset list file (moved), the record of #89 (this file), and the shared
test file with #88 (merged as `b617956`; the merged test passed, above).

## Evidence

`~/.local/share/claude-cookbook/evidence/2026-11-17-reset-list-file/check.md` (the check, the
move, the collector read). For #89:
`~/.local/share/claude-cookbook/evidence/2026-11-16-key-test-powershell-wait/`
(`after-merge-record.md`, `result-cookbook-89-review.json`, `with-key-merged-with-88.log`,
`release-cookbook-89-merge.log`, `release-cookbook-89-release.log`).
