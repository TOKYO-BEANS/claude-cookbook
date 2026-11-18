# 18 November 2026: before the Linux switch, every open chat landed or handed off

**Why.** This PC is wiped and moves to Ubuntu 26.04. T3 Code's threads, their worktrees and its
scheduled tasks do not survive the wipe. Every unsettled chat was read; each one either lands
before the switch through its own wake-up, or its next step is written down here and in its
own repository's handoff, so a Linux session can pick it up.

**What changed.** This entry only. It lists every T3 scheduled task that must be recreated on
Linux, with its schedule and what it does. The full prompts, with names, are in the private
wrap-up file `~/.local/share/linux-migration/thread-wrapup.md` (copied to the USB kit).

## Scheduled tasks to recreate on Linux

Recreate each with T3 Code's `schedule_task`: model Opus 5.5, effort high, full access, a new
thread in a worktree from `origin/main` unless the row says otherwise. Every prompt names
Windows paths (`C:\Users\<user>\...`): use the same names under `$HOME`. A task that was bound
to a thread (`continue`) loses it in the wipe: recreate it as a new thread that reads the job's
handoff entry first.

| Task | Schedule (UTC unless said) | What it does |
| --- | --- | --- |
| Daily sidebar sweep | daily 07:45 local, fresh session | `recipes/owner-questions.md`: mark chats that wait on the owner with `❓` and a pin, unmark answered ones, settle finished ones; changes no work |
| Weekly fixer | Mondays 08:30 local, fresh session | one workaround agents keep repeating becomes a real fix through one pull request; stale memory notes pruned |
| Proof that GitHub's AI scanning bills nothing | once, the first morning after the switch | reads the organisation's "Code Security AI Credits" usage for 17 and 18 November, checks no AI scanning run started after the switch-off, saves the evidence, finishes the draft #120 with the result and takes it to merge |
| SAM 3 access check | once, the first morning after the switch | the photo-mask test: if the model's licence request is approved, download it, run the four mask variants, judge them against the bar in the test's results file, finish the pull request; if not, one line and stop |
| Google consent check | once, 21 November 08:00 | the own Google accounts still work (consent "In production", no 7-day expiry) and the domain's two pages answer 200; anything failing goes to the owner |
| The GitHub plan before the trial ends | once, 26 November 08:00 (Fable) | the AI review needs draft pull requests, which a private repository has only on GitHub Team: read whether the plan is bought, ask the owner once, and if not, build the review request that needs no draft, through a new standard version |

The one-time wake-ups of 18 November (18:50 to 20:05 UTC) that take #136, #141 to #146 and
the standard's #223 to #227 to merge after Safe Chain's age hold lifts are recreated only if
they had not run when the PC was wiped. Each one's job and next step is in the wrap-up file.

**Verification.** Every unsettled chat's last message and every scheduled task (18, one of
them already run) were read from T3 Code on 18 November 2026; `node scripts/check.mjs` passed.

**Outstanding.** Recreate the tasks above on the first Linux session. Open pull requests at the
time of writing: #120 (draft, the AI scanning proof), #136, #141 to #146.

**Dead ends.** None.

**Evidence.** `~/.local/share/linux-migration/thread-wrapup.md` and
`scheduled-tasks-raw.json` beside it (no webhook secrets).
