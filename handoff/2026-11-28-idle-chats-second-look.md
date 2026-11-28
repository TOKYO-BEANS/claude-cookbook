# 28 November 2026: idle-chats looks again before each kill, and its state and run are tested

**Why.** The AI review of #296 had two low findings on `scripts/idle-chats/idle-chats.mjs`:
`main` read /proc, then T3's runs, then sent SIGTERM with no second look, so a run that started
in the gap had its process ended; and nothing tested `chatRuns` or `main`.

**What changed.**
- Before each kill, `changedSince` reads /proc and that chat's runs again and keeps the process
  when it is gone or is no longer that chat, when a shell now runs under it, when its runs
  differ from the first read, or when T3's state cannot be read again. Each skip is a
  `keep <pid>: <why>` line.
- `main` is exported and takes options for the tests only (a stand-in /proc and state file, the
  clock, the kill, the log folder); the timer's call is unchanged. `chatProcesses` lists pids in
  number order.
- `scripts/idle-chats.test.mjs`: `chatRuns` on a `node:sqlite` file with T3's own table
  definition (field mapping, nothing opened for no chats, a missing state throws and is not
  created, so the open is read-only); `main` on a stand-in /proc and state, where the first kill
  starts a run in one chat and a shell under another, and both are kept; dry run, `--thread`, an
  unreadable state and a bad `--idle`.

**Verification.** The suite ran in a Depot sandbox, plus a check that the gap test fails with
the second look taken out (see the pull request). The new version copied to
`~/.local/bin/idle-chats.mjs` after the merge, and one `--dry-run` there.

**Evidence.** The pull request's sandbox runs. Release log: the `sa-release` run of this pull
request.

**Dead ends.** None.

**Outstanding.** None from this job.
