# 23 November 2026: the AgentShield scan's first run on Linux, and a fixed-time run that is late

**Why.** The entry of 19 November left one job: after the scan's first run, set a cheaper
model on the task's thread and check that the next run keeps it. A one-time task did that
check at 08:00 UTC and found that the run had never started.

**What changed.**
- The cause, read on the laptop: the lid was closed from 07:42 to 08:32 local, and T3 Code
  0.1.11 drops a fixed-time run that is more than 10 minutes late (`MISSED_FIXED_TIME_GRACE_MS`
  in its code). The task showed `failed`, "Missed a scheduled run because the server was not
  running at that time", zero runs, the next run a week on. The daily sweep (07:45) was
  dropped the same way; the weekly fixer (08:30) was 2 minutes late and started.
- The missed scan was started by hand (`run_scheduled_task_now`, 08:03 UTC): one command
  (`scan.sh`), read-only scripts on its two output files, no change, no question.
  `MODE: no-baseline`, 462 findings (21 critical, 51 high, 320 medium, 61 low, 9 info),
  score 38/100, 170 files copied and read, 0 skipped, 0 blocked calls. Its summary found
  nothing likely real and repeats the three items the owner has not decided.
- The task's time is Mondays 09:30 local now (it was 08:00, a time Claude chose on 19
  November from the old task's start): the laptop was awake from 08:32, and the 09:00 tasks
  ran. The change made the task due again the same day, so a second run started at 09:30.
- The thread of the task is on Sonnet 5.5, high (`t3_thread_configure`). The 09:30 run used
  it: `executedModel` `claude-sonnet-5-5`, 28 seconds against 97 on Fable 5.2, the same
  totals, the same thread (run 2), while the task still stores Fable 5.2.
- Pages: `scheduled-runs.md` gains the 10-minute rule and what to do about it; its two "not
  yet proven" sentences (a thread's model, a bound thread reused) are proven and say so.
  `agent-audit.md` and `scheduled-runs.md` give the new time.
- No task for 30 November was made: the question it would have answered is answered.

**Verification.** The task store read before and after (run count 0 to 2, bound thread,
next run 30 November 08:30 UTC); the journal's suspend lines; both runs read in the task's
thread; the scan's log and header of each run. `npm test` in a boat sandbox on the commit,
and the pull request's checks. Release log:
`~/.local/share/claude-cookbook/evidence/release-cookbook-237-merge.log`.

**Outstanding.**
- A fixed-time task is still dropped when the laptop sleeps through its time and 10 minutes
  more. Nothing notices by itself: the task only shows `failed` in the task store. The daily
  sweep at 07:45 fell in the same sleep twice (22 and 23 November). Owner: Claude; cleared by
  moving that task or by a check of the task store in a run that is not dropped.
- The weekly fixer's run of 23 November started 0.6 seconds after the laptop woke and failed
  in "provision worktree: Git command failed". The cause was not read (no line in T3's
  server log). Owner: Claude, the fixer's own chat.
- The saved copy of the task's prompt in the private machine-setup repository still says
  "Mondays 08:00" in its first comment. Owner: Claude; cleared with that repository's next
  change.
- From the scan, for the owner, unchanged since 19 November: no baseline; the "auto-run"
  words in the global `CLAUDE.md`, "run env" in one project's agent instructions, and no
  deny rule for `sudo`, `chmod 777` and writes to `/dev/` in the user settings. New this
  run: a value taken out in two plugin skill pages that the scan cannot compare with the
  run of 19 November, whose list was not kept.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-23-agentshield-first-run/`:
the task store before and after, the suspend lines, the rule from T3 Code's code, the runs
of the thread with their models, the first run's log and header.
