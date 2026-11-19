# 19 November 2026: vetting on Linux, and a stopped check takes its CLI with it

**Why.** Three things the Linux move left: the vetting pages still exempted "the Windows
binary installed here" from the sandbox run, `pinned-install.sh` could not do a first install
(it stopped copying an earlier lockfile that did not exist), and the AI review of #156 found
that a connection check that times out on Linux stops only the launcher, not the CLI it
started with the key in its environment.

**What changed.**
- `lib/inventory.mjs`: on Linux `stopTree` lists everything below the process from `/proc`
  before the kill and stops it too. Not a process group: the commands stay in the terminal's
  group, so Ctrl+C reaches them as before.
- `pinned-install.sh`: a folder with neither `package.json` nor `package-lock.json` is a first
  install: no backup, the vetted lockfile is installed, `--back` has nothing to put back. A
  folder with only one of the two is still an error. The three vetting scripts read `$HOME`
  (the Windows fallback path is gone).
- `vetting-sandbox-report.md`, `vetting-sandbox.md`, `connecting.md` and the update skill's
  install table: one exemption is left (a plugin or skill copy). A pinned binary is the Linux
  build now and gets the sandbox run after its checksum. The table's winget row is apt, with
  the owner's password through the masked window.
- `scheduled-runs.md` names the handoff file it points at; `options/keep-healthy.md` no
  longer says AppData.

**Verification.** `npm test` passes. New tests: the tree read from a stand-in `/proc`; a
launcher that starts a program and times out (the program is gone afterwards); a first
install (failed, then done, then an ordinary one); a folder with one of the two files.
The first-install path was needed for real on 19 November: four pinned copies were installed
by hand with `npm ci --ignore-scripts` because the script stopped.

**Outstanding.**
- boat, the Proton Pass CLI and gws were installed on Linux on 19 November on their
  checksums, before the exemption went: each gets the sandbox run at its next update.
- The update report still says "an admin prompt or an elevated shell" and "winget" for a
  `command` part (`lib/apply.mjs`, `lib/report.mjs`): it changes with the catalog's Linux pass.
- `daily.mjs` stops only its own child on Linux; under the timer the service's control group
  ends the rest (its comment says so now). Copy it to `~/.local/bin` again after the merge.
- The `cmd.exe /d /c` launcher shape in `scripts/check.mjs` and `lib/connect.mjs` goes with
  the Windows CI job.

**Dead ends.** A process group for each command (`detached: true` and a kill of the group):
set aside before trying, because a command would then no longer get the terminal's Ctrl+C
and would outlive an interrupted run.

**Evidence.** None beyond the pull request's checks.
