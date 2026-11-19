# 19 November 2026: the AgentShield scan's merge, and the review's last finding

**Why.** #168 (the AgentShield scan on Linux, `handoff/2026-11-19-agentshield-linux.md`)
merged with one low finding of its second AI review open, as the merge condition allows:
`~/.claude.json` went through the ordinary 512 KB limit. The app keeps every project's usage
in that file, so it grows past the limit with use; left out, the scanner would see no MCP
server of the user's, a run would still end as a good one, and a compare would call those
findings resolved.

**What changed.**
- `sanitize.mjs`: `~/.claude.json` is read up to 32 MB (only its MCP servers go into the
  copy). The user's own four files (`~/.claude.json`, and `CLAUDE.md`, `settings.json` and
  `settings.local.json` in `~/.claude`) are required: one that exists and is left out, for
  any reason, is returned in `required`.
- `scan.mjs`: a run with a required file left out does not start the scanner and ends as
  `MODE: failed`, naming the file and the reason.
- `compare.mjs`: `new-findings.md` has a `SKIPPED` line and, when it is not 0, a list of the
  files left out with the reason for each. A plugin's or a project's file is counted there
  and does not stop a run.
- The record of #168: merged on 19 November 2026 at 20:27 UTC as `3d82640`, on the second
  `sa-release` run. The first was refused by the review gate (one medium finding, fixed in
  the next commit and answered in the pull request). The second review had this one low.

**Verification.**
- The release check of `3d82640`: `verified` and acknowledged, with five checks green on
  the merge commit (`release-cookbook-168-merge-2.log`).
- Three new tests: an 800 KB account file is copied with both its servers and none of its
  usage data; a broken account file and an oversized settings file are named as required;
  a whole run with a broken account file ends as failed with nothing scanned. `npm test` in
  a boat sandbox on Node 24, and the scan's tests on Node 26: passed before the push.
- On the laptop the scan was installed again from this branch and run: `SKIPPED: 0`,
  171 files, 477 findings. The 14 more than the run before are all in two files that other
  work added to two project folders in those fifteen minutes (an instruction file and a
  settings file): the scan saw the setup change, which is why there is no baseline yet.
- The task's prompt names the `SKIPPED` line now; it was read back from the task store.

**Outstanding.** What `handoff/2026-11-19-agentshield-linux.md` lists; nothing new.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-agentshield-linux/`:
`release-cookbook-168-merge.log` and `release-cookbook-168-merge-2.log` with their
`result-*.json`, `npm-test-follow-up.log`, `task-prompt.md` and `t3-scheduled-task.json`.
