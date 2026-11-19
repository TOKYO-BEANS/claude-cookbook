# 19 November 2026: the AgentShield scan is back, on Linux, as a T3 task

**Why.** The weekly AgentShield scan (a trial the owner approved on 2 October 2026) ran on the
Windows PC as a Claude Desktop scheduled task. Its scan folder was in no repository and not in
the migration kit, so the wipe of 18 November took the script, the pinned tarballs, the
sanitizer and the baseline. The owner decided on 19 November 2026, in the question dialog of
the chat that recreated the schedules: the three old Claude Desktop tasks become T3 tasks.
The standard's daily run already is one (07:30, the standard's project), the clean-up of the
desktop app's sidebar is dropped, and this scan is the third.

**What changed.**
- The scan is in the repository now: `scripts/agentshield/` in the cookbook skill (`scan.sh`,
  `scan.mjs`, `sanitize.mjs`, `compare.mjs`, `net-guard.mjs`, `install.sh`), with
  `scripts/agentshield.test.mjs`. `install.sh` copies it to
  `~/.local/share/stack-atlas/agentshield`, where the pin, the reports and a baseline live.
- The guarantees of the old script, rebuilt: the installed copy is checked against a pin
  (version, lockfile, a hash over every installed file) before it starts; the scanner reads
  only a copy made from a fixed list of files, with credential values taken out, and the
  copy goes through the sanitizer a second time before the scan; it runs under Node's
  permission model with no network, no child process and one output folder, with a guard
  that counts the attempts it stops; the output is `new-findings.md` with `NEW_FINDINGS`,
  `RESOLVED_FINDINGS` and `MODE` first.
- Different from the old one: the copy also holds what loads from each installed plugin
  (hooks, MCP servers, agents, skills), since that is where hooks and most servers are now;
  the copy is deleted when a run ends, and what the scanner quoted is masked again, more
  strictly, in everything the scan writes; a baseline is written only by
  `scan.sh --rebaseline`, never by a first run (`MODE: no-baseline` until then);
  `PREVIOUS_RUN` gives the totals of the run before; no HTML report; the scan refuses to
  start on a Node older than 25, where the permission model does not cover the network.
- Two rounds by a reviewer that did not build it, before the first push and after it. The
  first found values the sanitizer missed (an `env` name ending in `_KEY`, an argument after
  `--api-key`, a key in a URL path, a base64 `auth` value, two token families), two slow
  patterns, links followed out of their folder, the last report replaced before a late
  failure and an earlier result left in place by a crash. The second found one more slow
  pattern, more places for a value (a flag inside a command line, a list or a number under
  a secret name, a short header value) and masking that could hide a hook's text from the
  scanner. After the second the design changed, since a list of shapes is never complete:
  the second look is the sanitizer run again on its own result, JSON is read by structure
  in both passes, a `.json` file that is not JSON is left out, a link is followed only to a
  file of the same name, every text the scan writes passes a stricter mask (any run of 12
  or more letters and digits mixed), the outputs are replaced last, the copy is deleted,
  `scan.sh` stops a run after ten minutes, and `new-findings.md` says "did not finish" from
  a run's first moment to its end.
- AgentShield is a pinned copy in `~/.local/share/agentshield`: `ecc-agentshield@1.6.0`
  (published 10 September 2026) with zod 4.6.6, glob 14.0.2 and minimatch 11.0.1 as
  overrides, every package older than 24 hours. The catalog's part is `pinned` now.
- The T3 task "AgentShield weekly scan": Mondays 08:00 local, a fresh session, the Cookbook
  project. The old task's time was not recorded; its run of Monday 12 October 2026 started
  at 06:01 UTC, which is 08:01 local. The prompt has Linux paths, a `no-baseline` step and
  triage rules for this laptop (the key helper `key-header.mjs`, the hosted servers that
  `claude mcp list` shows, the scan's own file layout).
- Pages: `scheduled-runs.md` (no task runs in Claude Desktop any more; today's tasks),
  `scheduled-runs-desktop.md` deleted, the map's fallback for a scheduled agent run is "—",
  `options/keep-healthy.md`, `agent-audit.md`.
- `pinned-vet.sh` found its own folder after a `cd`: started by a relative path it ended
  with exit 127 at the sandbox step. It reads the folder first now; one test.

**Verification.**
- Vetting of `ecc-agentshield@1.6.0`, 19 November. As published (61 packages, no install
  script): OSV-Scanner 1 high (zod 3.25.76, GHSA-mrhx-c7xc-m3w5) and 2 medium (glob 11.1.0,
  minimatch 10.2.6); Trivy the same two medium. With the three overrides (51 packages):
  OSV-Scanner and Trivy 0. Gitleaks 8 hits either way: 3 in `@types/node`'s `https.d.ts`,
  3 in zod's own test files, 2 in AgentShield's built-in attack-corpus sample. Sandbox run
  quiet: the npm registry only during the install, nothing during the start, no file outside
  the project, no process left. In one sandbox both trees gave the same 49 findings and
  score on a fixture and the same exit from the corpus gate. The owner saw these numbers and
  chose the install with the fixed versions (question dialog, this chat, 19 November).
- Tests: `scripts/agentshield.test.mjs`, 22 tests. `npm test` in a boat sandbox on Node 24
  (Depot's version): 731 tests, 722 pass, 9 skip, 0 fail. Two of the skips are here (the command-line run and the proof
  that the permission model alone refuses the network: both need Node 25). On Node 26 in
  the same sandbox, this file and `vetting.test.mjs`: 47 pass, 2 skip (the two that skip are the
  refusals on an older Node).
- Runs on the laptop (19:22 to 20:04 UTC), the last with the final code: 169 files copied,
  all 169 read by the scanner, nothing skipped, a value taken out in 3 files (a package
  folder name and two documentation examples, none a credential), 0 blocked calls, 3
  seconds; 463 findings (21 critical, 54 high, 318 medium, 61 low, 9 info), score 38/100.
  The owner saw the first run: 460 findings from 165 files, before a linked personal skill
  and three hook scripts without a known ending were read too. Gitleaks on the sanitized
  copy, as a cross-check while the copy was still kept (two runs): no leaks.
- The task was read back from T3 Code's task store: enabled, `fixed_time` 08:00 on
  weekday 1, `fresh_session`, a worktree from `origin/main`, the prompt equal to the saved
  one (after its update for the final scan too), next run 23 November 07:00 UTC.

**Outstanding.**
- The copy's sanitizer is best effort by design: a short or unusual value in free text
  (not after a flag, a name or a header) can reach the copy. The scanner is offline, the
  copy is deleted and the outputs are masked more strictly, so it stops there. Owner:
  Claude; nothing clears it, the recipe says so.
- No baseline. The owner saw the first run's totals and its critical and high findings and
  answered (19 November 2026) that a baseline makes no sense while the laptop is still being
  set up. Owner: the owner. Cleared by `scan.sh --rebaseline` on the owner's yes once the
  setup has settled; until then every run is `no-baseline` and says so.
- Findings the owner saw with no decision yet; the task repeats each as "needs owner
  review": the words "without asking" in two instruction files, "run env" in one project's
  agent instructions, and no deny rule for `sudo`, `chmod 777` and writes to `/dev/` in
  the user settings (noise on Windows, not on Linux). Owner: the owner.
- The task stores the model of this chat (Fable 5.2, high); on Windows it ran on Sonnet 5.5.
  After the first run on 23 November, set a cheaper model on the task's thread and check
  that the next run keeps it. Owner: Claude.
- Depot CI has Node 24, so two tests skip there (above), and the whole runs start through
  a switch only the tests have (`olderNode`). They run as on the laptop when the job's Node
  is 26; that line is in the standard's workflow file. Owner: Claude, with the standard.
- The 8 Gitleaks hits were accepted by the owner for this version only: a new version is
  vetted again and its hits shown again.
- An update of the pinned copy stops the scan (`MODE: failed`, "differs from the pinned
  copy") until the version line in `scan.mjs` is changed through a pull request and
  `scan.sh --pin` is run: intended, and the update report does not say it yet.

**Dead ends.**
- No copy of the old `scan.sh` exists: the migration kit, the standard's evidence folder
  and its git history hold only the task's prompt and three handoff paragraphs.
- A first-run baseline, as the old script made one: set aside, because a scheduled run
  would then decide a baseline by itself.
- Gitleaks as the scan's own second look: set aside for a fixed list of shapes that the
  tests can pin; Gitleaks was run by hand on the copy instead.
- A second look that searched the finished copy's text for the same shapes: it disagreed
  with the first pass on JSON (an escape in front of a run of characters made it longer),
  which would have failed every run on a harmless file. Replaced by running the sanitizer
  again and asking whether anything changes.
- Closing each gap the reviews found with one more shape: two rounds each found new ones.
  The outputs are masked by a rule that needs no list instead.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-agentshield-linux/`:
`vetting/` (both lockfiles, the three scanners' reports with and without the overrides, the
sandbox logs, the comparison script), `first-run/` (the last run's report and
`new-findings.md`, the pin),
`task-prompt.md`, `t3-scheduled-task.json` (the task as stored, no webhook secret) and
`npm-test.log` (the suite on Node 24, then the two test files on Node 26).
