# 19 November 2026: the last Windows text in the pages and scripts

**Why.** Step 8 of the laptop setup (`machine-setup` GUIDE.md, part 2): the Windows PC is gone,
so the Cookbook's pages describe the Linux laptop. Most of the list in the earlier Linux
entries was already done by #154 to #172; this change takes what was left outside the key
helpers (#173) and the Windows CI job (#174).

**What changed.**
- `scripted-runs-rules.md`: no `//c/` paths, Git Bash or PowerShell. Absolute rule paths are
  `//home/...`. Both rules proven again on the laptop (next section).
- `add-ons.md`: blast-radius stays out; its reasons are the Windows PC's and it was not tried
  on the laptop.
- `owner-questions.md` and the broker's comment: the 2 to 27 seconds were the Windows PC's
  store; the broker answers on a socket (a named pipe on Windows).
- The launchers `firecrawl-secure.mjs` and `parallel-secure.mjs`: comments name the OS key
  store and the `#!/bin/sh` launchers, not DPAPI, AppData and `.cmd` shims. `web-batch.mjs`
  and `pre-read.mjs`: two error messages and a comment no longer say DPAPI.
  `owner-questions-jev.mjs`, `boat-run.mjs`, `boat-claude.mjs`: comments.
- `catalog.json`: the gws grants are in GNOME Keyring. `stack-updates/SKILL.md`: "the `sudo`
  password", not "an admin prompt". `options/check.md` and `options/reach-outside.md`: Docker,
  not WSL, as the local alternative weighed; `semgrep-code-vs-codeql.md`: the timing was the
  Windows PC's.
- `scripts/measure/tasks.json`: the key-store task expects GNOME Keyring and `secret-tool
  store` from Proton Pass, not DPAPI and `-Mode save`.

**Verification.** Claude Code 2.1.328 on the laptop, Haiku, `--setting-sources ""`, nothing
private: under `dontAsk` with only `Read(//<dir>/in/**)`, Read, Grep and Glob worked inside and
were each refused outside; under `acceptEdits` with only an `Edit(...)` rule, an `echo >>` into
a file in the working folder outside the rule went through, and one outside the working folder
was held. Record: `~/.local/share/claude-cookbook/evidence/linux-pages-2026-11-19/`.
`node scripts/check.mjs` passes; `npm test` on boat (see the pull request).

**Left on purpose.**
- Windows branches in code that tests cover: `boat-route` (PowerShell parsing, Git for
  Windows' `git.exe`), `codex-start-check.mjs` (`.exe`), `daily.mjs`, `lib/inventory.mjs` and
  `measure/servers.mjs` (`taskkill`), `boat-run.mjs` (`boat.exe`), `parallel-secure.mjs`
  (`parallel-cli.exe`), the broker's named pipe, `pre-read.mjs` (UTF-16 logs), the `.exe`/`.cmd`
  twins of the inventory, the unused `gitForWindows` feed kind (its tests cover the
  platform-suffix version bound), `check.mjs`'s `install.ps1` and `cmd.exe` rules, the
  `PowerShell` tool name in `agents.mjs`, `hooks.json` and `dispatch-profiles.md`.
- History, dated: `reach-outside.md` (DPAPI before), `compaction.md`, `scheduled-runs.md`,
  `keep-healthy.md`, `vetting-sandbox-report.md`.
- Other chats' files: `with-key.mjs`, `key-header.mjs`, `agent-key.ps1` and `keys.md` (#173,
  #174); `security.md`, `safe-chain.md` and the catalog's Aikido entry ("Windows jobs
  included") change with the Windows CI job's retirement, not here.
- "This PC" stays: the laptop is the PC.

**Outstanding.**
- The owner-questions broker answered 1 of 171 checks on the laptop since 17:26 UTC on
  19 November; the other 170 fell back to the phrase list with "no broker yet" (its
  `log.jsonl`). This session has a D-Bus address, so it is not #173's cause. Owner: Claude, in
  its own chat. Clears: the log shows Jev answers again.
- After #174 merges: `security.md`, `safe-chain.md` and the Aikido entry still say "Windows jobs
  included". Owner: that chat.

**Dead ends.** Removing the unused `gitForWindows` feed kind: its test is the only cover for
an installed version with a platform suffix bounding the release notes, so it stays.

**Evidence.** `~/.local/share/claude-cookbook/evidence/linux-pages-2026-11-19/`
(`scripted-runs-proof.md`).

**The review.** The first head had one medium and one low finding, both fixed in the second
commit: the measurement task set is renamed `2026-11-19` with a note on why (its answer key
changed), and the Parallel CLI's updater names the release's linux-x64 zip, not windows-x64.

**After the merge.** #176 merged as `1f99aa9` (`merge-when-green.sh`, 5 checks, the review
allowed it with one low finding); the release check read **verified** (execution 1889). The
plugin was updated to `1f99aa9` and `firecrawl-secure.mjs` and `parallel-secure.mjs` copied to
`~/.local/bin` (both still start); `stack-updates-daily.mjs` was already the same. The first
run ended "NOT MERGED: the head is 7a6b4b7": GitHub had not yet seen the push of the merge
commit; the second run, after the review's medium finding was fixed, merged. The low finding
(the set note still said the old rule sets agree on L1-new-key) is fixed in the follow-up
pull request: the note says a pre-laptop side fails that task for the platform.
