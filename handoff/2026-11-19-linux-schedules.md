# 19 November 2026: the schedules are back on the Ubuntu laptop

**Why.** The Windows PC's schedules died with its wipe on 18 November. The two entries of that
day (`2026-11-18-linux-switch-scheduled-tasks.md`, `2026-11-18-linux-switch-other-schedules.md`)
listed ten: six T3 Code tasks, three Claude Desktop tasks and one Windows Task Scheduler task.
This is step 6 of the rebuild guide, "Recreate every schedule".

**What changed.** This entry only, in the repository. On the laptop:

| Schedule | State on 19 November | Next run |
| --- | --- | --- |
| Daily sidebar sweep | T3 task, Cookbook project, fresh session | daily 07:45 local |
| Weekly fixer | T3 task, Cookbook project, fresh session | Mondays 08:30 local, first 23 November |
| SAM 3 access check | T3 task, Cookbook project, once; its time had passed | 19 November 17:55 UTC |
| Google consent check | T3 task, Cookbook project, once | 21 November 08:00 UTC |
| Proof that GitHub's AI scanning bills nothing | T3 task, the standard's project, once; its time had passed | 19 November 18:20 UTC |
| The GitHub plan before the trial ends | T3 task, the standard's project, once | 26 November 08:00 UTC |
| `stack-updates-daily` | systemd user timer and service written, timer not enabled yet | 07:00 local once enabled |
| `stack-atlas-standard-daily`, `agentshield-weekly`, `daily-sidebar-cleanup` | waiting on Claude Desktop | none |

- Every T3 task is a new thread (or a fresh session) in a worktree from `origin/main`, with
  full access. The prompts are the saved ones with the Windows paths written as `/home/<user>/...`.
- The SAM 3 check was bound to a chat that no longer exists. It is a new thread now, and its
  prompt carries the job: the handoff entry on draft #148's branch, the notes in the evidence
  folder, and what differs on Linux (the photo tool is not installed and its vetting folder did
  not come over; the runner measures through PowerShell).
- The two prompts that need the release tooling or the standard's source clone say what to do
  while another chat is still installing them: stop before the merge and say what is owed.
- The timer: `stack-updates-daily.timer` (`OnCalendar=*-*-* 07:00:00`, `Persistent=true`, so a
  missed run starts at the next login) and `stack-updates-daily.service` (`/usr/bin/node` on
  `~/.local/bin/stack-updates-daily.mjs`, a 100-minute limit above the script's own 90, and
  `ConditionPathExists` on the script) in `~/.config/systemd/user/`.

**Verification.**
- Each T3 task was read back with `list_scheduled_tasks` and from T3 Code's task store: six
  tasks, all enabled, the schedules and next runs above, `new_thread` or `fresh_session`,
  worktree from `origin/main`. Before this job the list was empty.
- `systemd-analyze --user verify` on both unit files: exit 0. `systemd-analyze calendar` reads
  the next run as 20 November 07:00 CET.
- `node scripts/check.mjs` passed.

**Outstanding.**
- `stack-updates-daily`: `~/.local/bin/stack-updates-daily.mjs` was not on the laptop at
  17:35 UTC; the chat that installs the CLIs and the release tooling brings it. Then:
  `systemctl --user enable --now stack-updates-daily.timer`, and read it back with
  `systemctl --user list-timers`. Owner: Claude. `update-check.md` and `scheduled-runs.md` still
  name Windows Task Scheduler; they change with the other Windows-specific pages.
- The three Claude Desktop tasks wait on the app's install (the same chat). Then, in a Claude
  Desktop session, create each with the app's scheduled-task tool from the Linux-ported prompts
  in the evidence folder, and read the list back. Not known: whether the Linux app has
  scheduled tasks at all. If it has none, they become T3 tasks, as the 18 November entry says.
  - `stack-atlas-standard-daily` (07:30 local) would also do the standard's open rollout.
  - `agentshield-weekly` needs more than the app: its scan script, pinned tarballs and
    baseline were not in the migration kit, and its triage rules name Windows helpers. It is
    rebuilt from `recipes/agent-audit.md` first, with a new baseline (the owner decides a
    baseline).
  - `daily-sidebar-cleanup` tidies the desktop app's own sidebar; it is only wanted if the app
    is used for Code chats on Linux.
- The task tool takes no model: all six tasks stored the model of the chat that made them
  (Fable 5.2, high). On Windows five of them ran on Opus 5.5 high. The session's model budget
  hook sets a run's model; if a run should be cheaper, set it on the task's thread.
- The two late one-time tasks report in their own threads. The AI scanning proof may stop
  before its merge when the release tooling is not installed yet; the merge of #120 and its
  release check are then owed by that thread.
- Not part of this job, still open in the standard's handoff: the release check of its merge
  `030ee9f`, and the rollout of the standard's newest version to the other repositories.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-linux-schedules/`:
`t3-scheduled-tasks.json` (the six tasks as stored, full prompts, no webhook secrets),
`systemd/` (the two unit files) and `claude-desktop-tasks-linux/` (the three prompts with Linux
paths). The Windows originals: `~/.local/share/linux-migration/`.
