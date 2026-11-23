# 23 November 2026: a dropped fixed-time run is started by the daily sweep

**Why.** The entry of the same day (`2026-11-23-agentshield-first-run.md`) left three items:
a fixed-time T3 task that is more than 10 minutes late is dropped and nothing notices; the
weekly fixer's first run failed in "provision worktree" with the cause not read; and the
saved copy of the scan's prompt still said 08:00.

**What changed.**
- Weighed first, moving tasks out of the laptop's sleep: the journal holds every boot since
  19 November and shows two suspends in all (19 November 15:08 to 15:43, 23 November 07:42
  to 08:32). That is no pattern to move a task by, so no task was moved for it.
- The route taken, with no timer and no hook change: T3 Code 0.1.11 drops only a
  `fixed_time` task (read in its code: the tick runs every other due task however late). The
  task "Daily sidebar sweep" is now an interval task, every 24 hours, same bound thread and
  fresh session, and its prompt has a new first step: one read-only `sqlite3` query on the
  task store for enabled fixed-time tasks whose last error starts with "Missed a scheduled
  run", then `run_scheduled_task_now` for each row, and nothing else. Its reply's first line
  names what it started. Schedule and prompt were Claude's choices of 16 November; the
  sweep's own job (`owner-questions.md`) is word for word as before.
- An interval task counts 24 hours from its last run, by schedule or by hand, so a late run
  moves its time. It ran by hand at 09:50 local, after the last Monday morning task (the
  scan, 09:30): a Monday morning's dropped runs are started the same morning.
- The other route (a check in the daily update script and its session note) needs the
  owner's yes for the hook, tells a session a day later and starts nothing. Not built.
- The fixer's failure, read in its thread without changing it: the run was requested 0.3
  seconds after the laptop woke, the network was up 5 seconds after, and the first run's
  `git fetch` failed ("Git could not reach the remote"). The task shows `failed`, yet the
  workspace was ready 5 minutes 48 seconds later and the run completed, in a worktree at
  the `origin/main` of that moment. Who retried (T3 or a person) was not read. A task bound
  to a thread sends to that thread and prepares no workspace.
- Page: `scheduled-runs.md` says the sweep is an interval task and why, how a dropped run
  is started, and that a run at wake-up can show `failed` though its thread ran.
- The private machine-setup repository: the scan's saved prompt and the guide say Mondays
  09:30, and the sweep's prompt has a saved copy beside the scan's.

**Correction.** The earlier entry says the sweep "fell in the same sleep twice (22 and 23
November)". It was dropped once: the run of 22 November completed (run 6 of its thread,
06:45 UTC).

**Verification.** The step's query on the real store before the change: one row, the
dropped sweep. The task read back after the change (interval, 86,400,000 ms, the same
thread, fresh session, next run 24 November 08:50 UTC). Run 7 of the sweep's thread, with
the new prompt: "No dropped runs: the query returned no rows", 0 marked, 1 left, settled, 49
seconds. `node scripts/check.mjs --room`, `npm test` in a boat sandbox on the commit, and
the pull request's checks. Release log:
`~/.local/share/claude-cookbook/evidence/release-cookbook-239-merge.log`.

**Outstanding.**
- Not yet seen on a real sleep: an interval task that is due while the laptop sleeps runs
  at wake-up (read in the code only), and the sweep calling `run_scheduled_task_now` from
  its own run (a chat did it on 23 November for the scan). Owner: Claude; cleared by the
  first sleep through a task's time: read the sweep's first line and the task store.
- The sweep's thread runs on Opus 5.5 (the note of 16 November says Sonnet 5.5, on the
  Windows PC). Not changed here. Owner: Claude, with the next change to the sweep.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-23-dropped-runs/`: the task
store before, the query's row, the sweep's task and stored prompt after, the suspend lines
of every boot, the network at wake-up, the fixer's first run, the rules from T3 Code's code.
