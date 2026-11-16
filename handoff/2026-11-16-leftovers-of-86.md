# 16 November 2026 (late night): the leftovers of #86: its record, the key test's limit, the reset list file

**Why.** Three things were open after #86 (0.39.0, merged as `11460bb`): what happened after
its handoff entry was written was in no handoff; the Windows key test from #78 failed in full
runs on this PC; and the `resets.json` that 0.38.0 left on this PC was still there. No file of
the plugin changes, so there is no new version.

## The record of #86 (16 November 2026, times UTC)

- 20:15: opened at `061d1d5`. Both security threads on #80 (4589548572 and 4589716196) got a
  reply with the owner's choice for them, "Hold the advice (Recommended)".
- **The owner's two answers for #86** (question dialog; each for that pull request only, both
  written in a comment on it): "Merge #86 on sa-review (Recommended)", the `ai-review` job
  having said `review unavailable` (no API credit); and, for the neutral Graphify Formal
  Verification ("1/3 PR-changed function(s) verified · 2 not verified (2 vacuous)": it could
  not run `parseT3` and `percent` on their own), "Merge #86 once (Recommended)".
- **The gate's fallback record.** The first merge run was refused: since Stack Atlas #200
  (`3cebc1f`) the gate reads a fallback review recorded on the pull request ("Fallback review
  of <the head's full commit id>", "No findings.", from an owner's login) and no longer gives
  the reason the by-hand script of #81 expected. The record was written for `061d1d5`, and the
  script for #86 required the gate itself to allow (state "fallback"); the one thing it set
  aside by hand was the neutral check with that exact title.
- The second merge run: the gate allowed, and the merge failed on a conflict. #85 had merged
  (0.38.3); `HANDOFF.md`, the version file and `model-budget-setup.md` conflicted. `main` was
  merged in as `3b80457`; the change stayed 0.39.0.
- A mistake of mine, without effect: to see why the merge had failed I ran `gh pr merge 86
  --squash --match-head-commit` by hand, outside the script. It was refused for the conflict.
  Had the pull request been mergeable it would have merged without the script's checks and
  without the release check. `gh pr view` shows the reason and is what to use.
- **Three review rounds, the budget.** `sa-review` run `cookbook-86-review` on `061d1d5`:
  passed, no findings. `cookbook-86-review-2` on `3b80457`: one finding from the evidence,
  `npm test` exit 1, the key test below. `cookbook-86-review-3` on the same head: passed, no
  findings, `npm test` exit 0.
- **The merge.** A fallback record for `3b80457` was written, naming the failed run before
  it. Merged by the script as `11460bb`: every check passed but the neutral one, the gate
  allowed on the fallback review, no thread open, none new during the merge. Release event
  `verified`, execution 1594.
- **The install.** Plugin 0.39.0 (`claude plugin marketplace update claude-cookbook`, `claude
  plugin update cookbook@claude-cookbook`), at 21:06. The installed script has no
  `keepResets` and the installed hook no `GRACE_MS`. The installed hook on T3 Code's real
  file, the list taken out of every other copy, 12 events: two lines from the script alone,
  one said to the session; the state folder held `sessions` and `usage-tried.json` only.
- **The two security threads on #80** got a reply naming the merged fix and are resolved: the
  code they flag is gone from `main`.
- `sa-review` writes its own `npm-test.log` into the ledger folder, so this job's first full
  run was overwritten by it; `npm-test-merged.log` is the job's own run.

## The Windows key test waited too short a time

"Windows: a key saved by agent-key.ps1 reads the same by both routes"
(`scripts/with-key.test.mjs`) ended its start of `powershell.exe` after 140 seconds. Three
logs of full runs that day hold the failure, each at 140.03 to 140.05 seconds with
`null !== 0`: the first PowerShell call, the save, was ended by the test.

**The cause, found before anything was changed.** The PC's script scan holds each PowerShell
script block for 30.2 seconds while many processes start (the entry for 0.38.2 in
`HANDOFF.md`). One run of `agent-key.ps1` crosses eight scans. The same call as the test's,
with a time written at six places in a copy of the script, during a burst of 16 workers
starting `git --version`: 242.1, 242.5, 243.4 and 242.1 seconds, four of four, split the same
way each time: 30 before the script's first line, 120 in its `Import-Module`, 30 at the
block that compares the saved key, 60 at the first `Write-Output`. Without the burst: 1.5 to
20 seconds. So 140 seconds was a guess under the slowest run there is; nothing hung.

**Can the test stop depending on PowerShell? No, not without testing less.** It is the one
place the real store script runs: it proves that what `agent-key.ps1` writes is what the
direct route reads, and that the launcher's own PowerShell runner gets the same from the
script's `headers` mode. The other tests make their DPAPI blob in Node, in the format the
test's author believes the store uses; only this test checks that belief. A blob cannot be
kept as a fixture (it is bound to the Windows user). Starting PowerShell another way to get
past the scan is not done: the scan is a security control.

**What changed.** The limit of each store run is the slowest run plus a minute (8 scans of
30.2 seconds, 301.6 seconds), named in the test with the measurement; the test's own limit
is the sum. A run ended by the limit now says it hung. Nothing else in the test changed, and
no file of the plugin.

**Test first.** `storm-test.mjs` runs that one test during the same burst. Before the
change: failed after 140.04 seconds, `null !== 0`, as in the three logs. After: passed in
425.9 seconds.

**What it costs.** On a loaded PC this test takes up to about eight minutes where it failed
after 140 seconds; alone and unloaded it takes 12 to 20 seconds. At 21:40, with other chats
working and no burst of mine, the file alone took 253 seconds. Test files run side by side,
so the suite waits for its slowest file, not the sum.

## The reset list file stays for now

`~/.local/share/model-budget/resets.json` was rewritten at 21:22:42, sixteen minutes after
the install. Five `claude.exe` sessions that started before 21:06 (19:12, 19:17, 19:27, 20:15
and 20:38) were still running at 21:24 and run the 0.38.x hook until they end. The file was
left where it is. 0.39.0 and later never read it.

## Verification

- The probe and the two runs of `storm-test.mjs`, above.
- `node --test scripts/with-key.test.mjs`: 20 tests, 19 pass, 1 skipped (no right to make a
  link), none failed.
- `npm test` on this PC, other chats working (21:43 to 21:47): 606 tests, 603 pass, 3
  skipped, none failed, 243 seconds. The key test took 139.5 seconds of it (`npm-test-1.log`).

## Outstanding

- `resets.json` (above). Owner: Claude. Clears when no `claude.exe` that started before
  21:06 UTC on 16 November 2026 still runs and the file's time has stopped moving: then move
  it to `~/.local/share/backups/` (never delete it) and say so in a handoff file.
- The key test's wait on a loaded PC, up to about eight minutes. `sa-review` ends `unknown`
  when its own `npm test` runs past about 600 seconds: run it again when the PC is quieter.
  Owner: Claude. Clears if `agent-key.ps1` crosses fewer scans (its `Import-Module` is four
  of the eight; the script is byte for byte the PC's and was not changed here), or if the
  scan's wait is tuned by whoever manages the security software, which is not ours to change.
- A by-hand merge is still needed for one thing only: a neutral Graphify Formal Verification
  with a title the installed gate does not set aside (the owner is asked per pull request).
- #88 (open, the key-read paths) edits `scripts/with-key.test.mjs` too, about 80 lines above
  this test. No shared lines.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-16-key-test-powershell-wait/`:
`phase-probe.mjs` and `phase-probe.log` (the eight scans), `storm-test.mjs` and
`storm-test.log` (the test before and after). For #86:
`~/.local/share/claude-cookbook/evidence/2026-11-16-model-budget-hold-advice/`:
`after-merge-record.md`, the three `merge-by-hand-cookbook-86*.log`,
`installed-hook-0.39.0.log`, `npm-test-merged.log`.
