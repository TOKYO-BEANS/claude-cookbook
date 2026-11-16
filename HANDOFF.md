# Handoff

## 16 November 2026 (night): the key read no longer waits on a script scan (0.36.4)

**Why.** While #75 was verified, `boat limits --json` through `~/.local/bin/with-key.mjs`
took 32 seconds once and over 90 once, and `boat-run` refused three of six runs at its
60-second limit. The 37-second refusal in #70's entry was the same fault.

**The cause, found before anything was changed.** The PC's security software scans every
PowerShell script block (AMSI; it is the only scanner registered), and while many processes
start, each scan can wait about 30 seconds. `with-key.mjs` read a key by starting
`agent-key.ps1`, which crosses several scans: the script itself and each module import.
- Windows' PowerShell event log: in every slow read PowerShell was ready in under 2 seconds
  and then waited before compiling the script. 33 of the day's 313 reads took over 3
  seconds; 14 waits sit at 30.2 to 30.4 seconds, a time limit inside the scanner.
- A traced read of 32.7 seconds: 9.7 before the script's first line, 18.0 in
  `Import-Module`, 0.07 decrypting. A one-line block made in memory waited 12.7 seconds; a
  plain file read in the same run took 5 ms. So: the scan, not file access and not DPAPI.
- Made to happen on demand: 16 workers starting `git --version` for 45 seconds gave one
  read of 47 seconds; with no burst, 27 runs took 0.7 to 2.5 seconds.
- Ruled out: two and four key reads at the same moment (0.9 to 2.0 seconds), and
  PowerShell's own start.

**What changed.**
- The helpers were in no repository. On the owner's word (16 November 2026) they live here:
  `skills/cookbook/scripts/with-key.mjs` and `agent-key.ps1` (the latter byte for byte as it
  was on the PC). Callers keep using the copies in `~/.local/bin`.
- `with-key.mjs` reads the key in its own process: Node calls `CryptUnprotectData` through
  `node:ffi` (Node 26.13.1, no flag; experimental). No PowerShell starts. The store and its
  files are unchanged. Same checks as `agent-key.ps1`: the name pattern, no link.
- The PowerShell route stays as the fallback where `node:ffi` is missing. It is ended after
  15 seconds and the launcher says why. A failure message holds only the launcher's own
  words or an error code, never what PowerShell printed.
- New: `with-key.mjs --headers <name>`, the header object for an MCP `headersHelper`.
- `recipes/keys.md` (new; the map row links it); `catalog.json` notes for the two copies.

**Verification.**
- 16 tests in `scripts/with-key.test.mjs` (15 pass, the link test skips on this PC: no right
  to make a link). On Windows they read a synthetic DPAPI key by the direct route with
  PowerShell forbidden, start the launcher as a process by five spellings of its path, and
  save a key with `agent-key.ps1` and read it by both routes. CI runs on Linux with Node 24:
  the Windows tests skip there, the rest run.
- The real `boat` key, both routes side by side during a 60-second burst of process starts:
  PowerShell 1 read in 86.8 seconds; the new launcher 38 reads, 0.6 to 1.4 seconds, none
  failed. The key from both routes has the same SHA-256.
- `npm test` passed on this PC.

**Outstanding.**
- The merge, the release check, the copy to `~/.local/bin` and the proof from there are
  reported in the chat of this pull request and in the next entry.
- Other PowerShell key reads still stall the same way: an MCP `headersHelper` that calls
  `agent-key.ps1 -Mode headers`, and the launchers `firecrawl-secure.mjs`,
  `parallel-secure.mjs` and `browserbase-key.ps1` in `~/.local/bin`, which are in no
  repository either. Owner: Claude. Cleared by moving each to `with-key.mjs`.
- `with-key.mjs` still starts the program without its variable when the key cannot be read
  (the owner-questions broker relies on it), still ends with code 1 when a signal kills its
  child, and has no handler for a child that cannot start. Unchanged here: one fault per
  pull request. Owner: Claude.
- `node:ffi` is experimental. If a Node update changes it, reads fall back to PowerShell and
  can stall again, for at most 15 seconds, with the reason on stderr.
- A recommendation for whoever manages the security software, not acted on: its script scan
  holds PowerShell up to 30 seconds per block under load. Its settings were not touched.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-16-with-key-stall/`:
`FINDINGS.md`, the probes (`stall-probe.mjs`, `sampler.mjs`, `phase-split.ps1`,
`storm.mjs`, `storm-compare.mjs`, `eventlog-gaps.mjs`, `dpapi-ffi.mjs`) and their logs.

## 16 November 2026 (night): the first site's name out of the files; a project part names a key (0.36.3)

**Why.** #75 took a customer's site name out of `options/check.md`. The same site, and the
name of its private repository, were still in eight other places on `main`. This repository
is public: no project or client names. None of the eight was there on the owner's word.

**What changed.**
- **Prose.** `recipes/visual-check.md` and `recipes/visual-check-build.md` say "the first
  site's repository"; four lines of older entries below say "the first site" (and one path
  inside that project is now described, not spelled out). Which site and repository are
  meant is a reference note in memory on this PC.
- **The catalog names a key, not a repository.** The ts-rust trial entry held the
  repository's full name, and the update check used it to read that repository's lockfile.
  A `project` part now reads `{ "kind": "project", "project": "first-site", "package": … }`;
  `~/.local/share/stack-updates/projects.json` on the PC, outside every repository, maps
  the key: `{ "<key>": "owner/name" }`. `readInstalled` resolves the key there and reads the
  lockfile through `gh api` as before. No file, an unknown key or a value that is not
  owner/name is "unreadable" with its reason ("could not check" in the report), and `gh` is
  not called. The report on this PC still names the repository (`projectRepository`).
- **The catalog check keeps it out.** `scripts/check.mjs` refuses `repository` on a
  `project` part and anything but a key (lower-case letters, digits, hyphens) in `project`.
- The inventory test's fixture is a made-up repository; the fixture home has its own
  `projects.json`. `recipes/update-check.md` and the `stack-updates` skill say where the map
  is.

**Verification.** Tests first: with the implementation taken out, 3 of the 95 tests in the
three changed test files failed (the inventory file on the missing export, the catalog check,
the end-to-end run); with it, all pass. `npm test` in a boat sandbox: 504 tests, 503 passed,
1 skipped (no Gitleaks there). The Windows job of CI is the check for this PC's platform.
Live on this PC, with the map written: the installed plugin (0.36.2, repository in the
catalog) and the new code (key in the catalog) gave the same answer for two packages in
that repository's lockfile, one read with its version and one "not in the lockfile"; with no
map file the answer is "unreadable" and says which file is missing. Log:
`~/.local/share/claude-cookbook/evidence/2026-11-16-project-key/live-read.log` (the
repository's name is replaced in it).

**Outstanding.**
- **Git history keeps the old text.** The names are in earlier commits of `main` and in the
  merged pull requests' diffs. History is not rewritten here (no force-push): this is known
  and left as it is.
- A PC without `projects.json` reports the ts-rust part as "could not check" until the file
  is written by hand. This PC has it.
- The ts-rust trial package is not in that repository's lockfile today, so the update check
  reports the part as missing; it did before this change too (the state file has had no
  installed version since 14 November 2026). Whether the trial is still on is a question
  for that project, not this one.
- One more name is in two places and was not part of this job: the owner's own product, in
  `recipes/sign-ins-mail-and-access.md` (a site key of the site login, in use) and in one
  line of an older entry here. The owner, asked on 16 November 2026: take it out. A job of
  its own, opened as a new chat once this pull request is merged.

## 16 November 2026 (late evening): boat-run follow-up, one count and a time limit (0.36.2)

**Why.** The last AI review on #70 left two low findings, both in
`skills/cookbook/scripts/boat-run.mjs`, and #70's entry did not yet say how it was merged.

**What changed.**
- **One count.** The script read boat's count of sandboxes first and took its place among
  this PC's runs after. With 9 sandboxes running from elsewhere (the vetting step), runs
  started together each read "9" and each took a place: up to 19 at once. Now a run takes
  its place first and asks boat after, and the gate adds the other runs from this PC that
  hold a place and have no sandbox yet (`waiting`, counted by `takeSlot` at the moment the
  place is taken). A run marks its place (`.up` on its file) when boat's "ready" line has
  come: from then on it is in boat's count and is not added a second time. Between
  "created" and "ready" a run can be counted twice, never left out.
- **A time limit.** `boat limits --json` and `boat delete` are ended after 60 seconds
  (`CALL_SECONDS`). A `limits` that hangs is "no result" and nothing starts; a `delete`
  that hangs is a failed removal, with the "may still exist" line. Before, a hung call held
  the run and its place for good. `recipes/boat.md`: that one refusal is run again, once
  (the page was trimmed elsewhere to fit: a page test adds a line to it, so it needs 51
  bytes of room under the limit, which the sandbox run caught).
- `options/check.md` named a customer's site in the visual check point. The rule for this
  public repository is no project or client names; the name came in with #54, before the
  rule, and not on the owner's word. It now says "the first site".
- #70's entry below now says what happened after its last commit.
- 44 tests in `scripts/boat-run.test.mjs` (7 new): boat reporting 9 with two runs arriving
  together (one starts, the other is refused), a run whose sandbox is ready not counted
  twice, the order (place, then boat), a real hung process ended by the limit, and both
  hung calls through `main`.

**Verification.** The new tests failed first (7 of 44) and pass after. `npm test` in a boat
sandbox through the changed script, on the state merged with `main` (#74): 501 tests, 500
passed, 1 skipped (no Gitleaks there), 8 seconds. On this PC the whole suite passed before
that merge and before the last edit of `recipes/boat.md`; after them the Windows job of CI
is the check.
Live, a short run: its place was `run-…` at the start, `run-….up` 5 seconds later when
boat said "ready", and gone at the end (`live-slot-up.log`). The limit was also seen live,
unplanned, twice in five runs: `boat limits` gave no answer for 60 seconds and the run ended
with `BOAT-RUN: not started: no result (boat limits did not answer in time)`, exit 75. A call
whose child holds the pipes (the key helper around boat) came back in 531 ms at a limit of
500. Logs: `~/.local/share/claude-cookbook/evidence/2026-11-16-boat-run-followup/`.

**Merged.** #75 merged as db475dc through `sa-release` on the first run (review gate allowed,
no review threads), release event verified, execution 1573, plugin 0.36.2 installed; evidence
`~/.local/share/claude-cookbook/evidence/2026-11-16-boat-run-followup/release-cookbook-75-merge.log`.
The squash commit's title says 0.36.1; the plugin version is 0.36.2 (#74 took 0.36.1 while
#75 was open).

**Outstanding.**
- The slow call is the key helper on this PC, not boat. Of ten `boat limits` calls in a
  row, eight took 1.4 to 1.7 seconds, one 32 seconds and one over 90; in both slow ones
  `boat.exe` had not started after 8 seconds and the helper's `powershell.exe` (the read
  from the DPAPI store) was still running (`limits-probe.log`). Why PowerShell stalls is
  not known. It explains the 37-second refusal in #70's entry, and it touches every tool
  that gets its key this way. Here a stalled call is now a refusal after 60 seconds: run
  again. The helper is not in this repository: a job of its own, opened as a new chat on
  16 November 2026.
- On Windows the limit ends the key helper only; the `powershell.exe` or `boat.exe` under
  it is left to end by itself. It holds no place and no sandbox.
- Ten runs started a few seconds apart can see one of them refused while there is room (the
  double count between "created" and "ready"). It is "not started": run it again.
- The same site, and its repository, are still named in eight other places: two recipe
  pages, three lines of older entries here, one catalog entry (in use: the update check
  reads that repository's lockfile) and one test. Done in 0.36.3, the entry above (the count
  of older lines was four, not three).
## 16 November 2026 (evening): the model budget leaves T3 Code's reset list out (0.36.1)

**Why.** #72 merged as `aaf25de` (release event `verified`, execution 1570; merged by hand on
the owner's "Merge #72 once", past a neutral Graphify Formal Verification titled "0/5
PR-changed function(s) verified"; the gate allowed it with every security thread closed by a
fix or the owner's yes). Plugin 0.35.4 was installed, and the first live runs disagreed: "use
Fable" and, twenty seconds later, "use Opus", from the same T3 Code reading.

**What was found.** T3 Code's file holds the banked resets (`resetCredits`) only in the minutes
its own read of them got through, about every other one (sampled for seven minutes). With a
Fable reset banked and Fable ahead of pace, the advice therefore changed every minute, and each
change tells a thread to switch model. One timed read of the endpoint by the script (16:28:10
UTC, 200) showed why the script itself never saw a reset: to its read the endpoint answers
`cedar_ember.eligible: false` with no grants, while T3 Code, reading as Claude Code, is shown
one weekly and one Fable reset. So "Banked resets: none" in 0.35.0 to 0.35.4 was never a
reading.

**What changed.** `parseT3` no longer takes the reset list from T3 Code's file, so the advice is
the same in every minute. A reading says whether the resets were read (`resetsRead`), and the
line says "not read (see T3 Code: Usage, Limits)" when they were not, never "none".

**Verification.** 54 tests in `scripts/model-budget.test.mjs`; `npm test`.

**Owner decision, 16 November 2026.** Asked whether the acceptance of T3 Code's unsigned
reading ("Accept it as built", given on #72) holds when GitHub's security review raises that
same finding again, the owner answered "Yes, for this file from now on": it stands for that
finding on later pull requests to the model budget script, until the owner says otherwise.
The owner's yes is then written in the thread with these words and this date. Any other
finding is fixed or asked.

**Outstanding (Claude, next chat).** The script cannot see the banked resets, so the rules for
when to redeem one never fire and a banked Fable reset does not lift the pace rule. Clears when
the resets have a source that holds from minute to minute: either the script's read is made
eligible (the difference from T3 Code's read is the `claude-cli` User-Agent and
`skip_spend=1`; which of the two matters is not known), or the last list seen in T3 Code's
file is kept between its reads. Each is a decision with a cost: the first names the script as
another client, the second stores what an unsigned file said. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-16-model-budget-reading/`
(`merge-by-hand-cookbook-72.sh` and `.log`, `raw-grants-read.mjs` and `.json`, `timed-read.mjs`).

## 16 November 2026 (evening): boat on the paid plan, used by default (0.36.0)

**Why.** The owner ended the boat trial and took the USD 20 plan on 16 November 2026, and
asked that it be used as well as it can be. The recipe still held the trial's terms: 2
sandboxes at once, no private code without a yes per task, and a trial date in the catalog.
In its first week boat had run for 223 seconds in all.

**The owner's two answers (question dialog, 16 November 2026).**
- How many sandboxes: "set an allowance, use your own judgment to decide how much for each
  individual parallel work or job; the plan allows 100 and has a 20$ budget a month". So
  Claude sizes each job, inside an allowance held by a script (below). The allowance's
  numbers are my own, not the owner's words.
- Private code: "Standing yes, code only". The code of the owner's own repositories may be
  pushed, with `--no-env`; customer data and credentials still need a yes per task.

**The owner's two answers on the security review threads (question dialog, 16 November
2026), after three review rounds were used.**
- The upload list can go stale: "Add a data-file check (Recommended)". Built, see below.
- An approval step before every run: "Accept: no approval per run (Recommended)". Runs stay
  unprompted inside the script's limits; the yes is written in that thread.

**What changed.**
- `skills/cookbook/scripts/boat-run.mjs`, the one route to a sandbox for a job, after two
  findings of GitHub's security review on #70 (an upload of the folder with no safeguard;
  sizing left to a model with no hard limit). The limits are numbers in the script: 10
  sandboxes at once (the plan's count, and 10 slot files for runs started together), an hour
  of the plan's time per run, a fifth of the month kept back, nothing while extra starts are
  on or the wallet holds money or the plan cannot be read. `--push` sends a copy: tracked
  files with their uncommitted edits (`git stash create`, `git archive`), no untracked
  file, no symbolic link, and only after Gitleaks passed it with its default rules.
  37 tests in `scripts/boat-run.test.mjs`. The numbers are mine, inside the owner's
  allowance; the owner can change them.
- After the next review round on the script itself: `--keep` is gone (a kept sandbox ran on
  outside the limits); each run holds a file of its own and counts the others, so two that
  arrive together cannot both pass; Gitleaks runs with `--ignore-gitleaks-allow`; and
  `--push` needs the repository on an upload list outside every repository
  (`~/.local/share/boat-run/upload-allowed.txt`), because no script can tell code from
  customer data. This repository is on the list of this PC (it is public).
- After the fourth round: the reserve counts the other nine places as full runs; the copy's
  own `.gitleaksignore` is moved out for the scan (it did quiet Gitleaks: checked by hand,
  and the test now writes the finding's real fingerprint); a state folder that cannot be
  written is "not started", not a crash. And, on the owner's answer below, every upload is
  read for data-shaped files (spreadsheets, databases, dumps, mail exports, archives): one
  that the list does not name for that repository stops the run. A fifth round found that
  an upload of a subfolder compared those names under the wrong folder: they are now taken
  from the top of the repository (`git rev-parse --show-prefix`).
- After the sixth: a run that did not start exits 75, not 2 (a command's own exit 2 looked
  the same); boat's own last line is read, and a run that ends without "deleted" gets its
  sandbox deleted or a warning. boat deletes on a timeout itself (exit 124, seen live).
- After the eighth: an environment variable could move the upload list and the count of
  runs to a folder of the caller (it was there for a live proof); the place is fixed now,
  with a test. A plan without a readable `canStart` is "no result". The scan test makes
  its key when it runs (`generateKeyPairSync`): no key-shaped text is put together from
  parts anywhere in the tests.
- `scripts/stack-updates-connect.test.mjs`: Gitleaks flagged three key-shaped strings as
  `generic-api-key` on the first upload of this repository, and the script rightly refused
  the run. I first joined them when the test runs; the AI review called that a model
  clearing a scanner finding, and it was right. They are now plain repeated patterns,
  written out. Whether the old values were ever real keys was asked of the owner, who
  answered "dont know? but they do look like they are made up. could you run some kind of
  test to see if they are real or not?". The tests, 16 November 2026: none of the 19 keys
  in the DPAPI store holds or is held by any of the three or their halves (a script that
  printed only "match" or "no match"); Browserbase answered 401 to the `bb_live_` one;
  each came into the repository on 13 November 2026 in the two commits that wrote the
  scrubber's tests, and is in that one file only; GitHub secret scanning has no alert on
  the repository, open or resolved. Nothing to rotate.
- `recipes/boat.md`: used by default (tests on Linux before a push, a CI-only or Linux-only
  failure, long and parallel jobs, beside the vetting step); the script, the two answers,
  tests that need an install (AI review, low); what still needs a yes now names everything
  that can bill past the plan and sharing a snapshot. `boat cp` was wrong (no such command).
- `recipes/boat-setup.md`: the plan as `boat limits --json` printed it, the trial text gone,
  the API key's end date, today's proofs.
- `recipes/debugging.md`: a failure only in CI or on Linux is reproduced in a sandbox.
- The map row names the new uses. boat's own CI (`runs-on: boat`) was weighed and left:
  Depot keeps the required checks (the options page had no room for the line).
- `catalog.json`: boat is `active`; its date is now the API key's end, 10 February 2027.
- `scripts/vetting.test.mjs`: one test compared a folder listing in the machine's sort
  order. It passed here and on Depot and failed in the sandbox (another locale); it sorts now.

**Verification.** On the paid plan: `npm test` in a `small` sandbox, 13 seconds with the
upload (one failure, the test above; green after the fix); five sandboxes at once
(`boat list` showed 5); `large` reported 8 CPUs and 15 GB; `boat list --all` empty after.
Through `boat-run.mjs`: the first run was refused on the three Gitleaks findings, the next
uploaded 176 tracked files and passed `npm test` in 22 seconds, no slot file was left.
`npm test` on this PC passed. Logs: `~/.local/share/claude-cookbook/evidence/2026-11-16-boat-paid-plan/`.

**After the last commit (added with 0.36.2).** The first `sa-release` run refused the merge:
the AI review of the last commit had left `HANDOFF.md` out, so it was a partial review. This
entry was then read by a `cookbook:reader` subagent, which had no finding that needed a
change, and that reading was answered in the pull request. The second run merged #70 as
`692bd2a`; the release check was verified (execution 1571) and plugin 0.36.0 was installed.
Evidence, in the folder above: `summary-cookbook-70-merge.json` (the refusal),
`summary-cookbook-70-merge-2.json` and `release-cookbook-70-merge-2.log` (the merge). The
last review also left two low findings on `boat-run.mjs`; they are fixed in 0.36.2, above.

**Outstanding.**
- What happens when the month's time runs out was read from boat's terms, not tested.
- The standing yes covers code only. Gitleaks finds key-shaped text, not customer data: a
  repository that tracks customer data is not uploaded without a yes for that task.
- The vetting scripts keep their own fixed `boat run` command and do not go through
  `boat-run.mjs`.
- The upload list is filled by Claude under the standing yes (code only), one repository
  at a time. The owner's product repositories are not on it yet: each is added when a job
  first needs it, after a look at what it tracks.
- A refusal took 37 seconds once (reading the plan took 13); the usual time is 2 seconds.
  Not explained.
- Saved snapshots (10 in the plan) are unused: a snapshot with a repository's dependencies
  installed would start faster. Worth it only for a repository whose install is slow.

## 16 November 2026 (afternoon): the model budget reads T3 Code's saved reading (0.35.4)

**Why.** The usage read answered 429 on nearly every try, so the budget said "unknown" and no
thread switched model.

**What was found.** A read that succeeds closes the endpoint to the sign-in for about two
minutes (429 at 103 seconds after a success, 200 at 119). T3 Code reads it about every 61
seconds for banked resets, and its Claude Code probe reads every five minutes, so T3 Code takes
every slot and gets 429 on about half of its own reads (its server trace, 13:30 to 14:17 UTC).
The 429 therefore never ends while T3 Code runs; no cache length or retry pause fixes it. One
read timed 119.0 seconds after T3 Code's last success answered 200 (14:16:26 UTC) and cost
T3 Code its next two reads. T3 Code keeps its own reading in `~/.t3/caches/claudeAgent.json`
(`usageLimits`), rewritten every minute; its figures trailed the direct read by one and two
points.

**What changed.** `readUsage` takes the script's own signed reading while it is under ten
minutes old, else a session start reads over the network (one read per ten minutes, failed or
not). When that gives nothing, the script's own signed reading stands in while it is under an
hour old, and T3 Code's saved one (under an hour old too) only when the script has none
(`parseT3`: every value checked, anything odd is no reading, nothing from it stored). The first version took T3 Code's reading ahead of the network read;
GitHub's security review flagged an unsigned file as a fresh source, and its suggested fix was
taken: T3 Code's reading only when there is no signed one under an hour old and none can be
read. A prompt or tool event still
never reads over the network, and now has T3 Code's reading too. The
`usage.lock` and its takeover are gone: the reading (`usage.json`) and the mark of a failed read
(`usage-tried.json`) are two signed files, so a failed read cannot replace a reading. The
script run by hand names the source when it is not a direct read. T3 Code's file is read only
when it is a regular file and no link, and outside Windows only when the user owns it and no
one else can write it (the review's third thread; Node cannot read an owner on Windows).

**Owner decisions, 16 November 2026.**
- The three Gitleaks `generic-api-key` hits in `scripts/stack-updates-connect.test.mjs` (the
  0.32.2 entry's outstanding item): "Fix them (fixture values a scanner does not read as
  keys), never ignore or dismiss; if one is a real key, stop and tell the owner." Done here:
  the three made-up strings are put together at run time, and `gitleaks dir` reports none.
- GitHub's security review asked for T3 Code's unsigned reading to be removed altogether.
  Asked with what the file can and cannot do, the owner answered "Accept it as built
  (Recommended)"; the yes is written in that review thread.

**Verification.** 53 tests in `scripts/model-budget.test.mjs`; `npm test`; a live session-start
run gave the advice.

**Limits (known).** T3 Code's file is not signed: while the signed read is refused, whoever can
write that file can move the advice among its fixed lines; it cannot add text. Its `checkedAt`
is when T3 Code asked, not the age of the figures. A change of that file's shape in a T3 Code
update means "no reading": the session then says "unknown" whenever the direct read is refused,
and `parseT3` is the place to fix.

## 16 November 2026 (evening): `sa-build`'s reviewers without a shell (0.35.3)

**Why.** TOKYO-BEANS/Stack-Atlas#190 moves `sa-build`'s three reviewer steps onto
`cookbook:reader`, as #188 did for `sa-review` and `sa-triage`. What those reviewers needed a
shell for (building and counting the review package, the no-change checks) runs in a runner
step before each review, so a task takes three agents and the workflow's budget goes from 8
to 11. The workflows recipe states each workflow's budget, so it changes with it.

**What changed.**
- `recipes/workflows.md`: `sa-build`'s budget 11; the reviewer point says all three workflows
  now run their reviewers without a shell, and why `sa-build`'s budget grew.
- Plugin 0.35.3.

**Verification.** `npm test` passes in this repository. No code, hook or agent definition
changes; the dispatch profiles stay as #65 made them.

## 16 November 2026 (later afternoon): a security review thread stops the merge (0.35.2)

**Why.** On 16 November 2026 #62 merged with four `github-advanced-security` review threads
unread, and #64 merged six seconds before a fifth arrived. The merge commands read the
`ai-review` comment and the checks, never the review threads. The owner's job: a pull request
cannot be merged by our merge commands while a security review thread on it is unanswered or
unfixed, and the rule is where every merge loads it. This entry is the rule text; the gate is
TOKYO-BEANS/Stack-Atlas#187 (`b643b8a`) and the merge script
TOKYO-BEANS/release-maintenance#14 (`92a3bed`). It tightens the merge condition and loosens
nothing.

**What changed.**
- `recipes/ci-releases.md`: the merge condition names the threads, and a new point holds the
  rule. Only a reply in the thread closes it for the merge: `Fixed in <commit>` (a later
  commit of the pull request that fixes the finding) or
  `Owner's yes (<date>): <the owner's words>`, written only after the owner has said yes to
  that thread. "With the owner" means that yes: telling or asking the owner, a planned
  follow-up or an answer leaves the thread open.
- `recipes/review-threads.md` (new, linked from that point; the first page is at its size
  limit): what the threads are, how to read them (`pulls/<n>/comments`;
  `gh pr view --json comments` does not show them), a fix, the owner's decision, what the gate
  reads, and a thread that arrives after the merge.
- `recipes/codex.md`: one point that was an interim step in Stack Atlas's handoff. Codex reads
  the Cookbook of Claude's last plugin update, so before a start that leans on a page changed
  since, compare the clone's plugin version with `main`. The next job turns the start check,
  this comparison included, into a tested script.
- Plugin 0.35.2.

**Verification.** `npm test`: 449 tests pass, 0 fail, with the page-size check.

**Outstanding.**
- The installed plugin moves with the next plugin update. Until then a session loads the old
  `ci-releases.md`; the gate in code refuses the merge either way. Owner: Claude, with the
  `stack-updates` rules.
- The Codex start check as a tested script that validates the repository name (the open
  security thread on #64) and compares the clone's version with `main`. Owner: Claude, as the
  next Cookbook job.

## 16 November 2026 (afternoon): model budget follow-up (0.35.1)

**Why.** The low findings of #67's AI review, moved here under the review-round budget.

**What changed.** The usage lock holds its owner's mark and only the owner removes it; a dead
lock is taken over through a gate file created with `wx`, so one process wins. With a limit
every model shares spent, the advice for a reset says to stop at a safe point, not to use
Opus. A session whose saved reading is over an hour old is told "unknown" once.

**Verification.** 46 tests in `scripts/model-budget.test.mjs`. #67 merged as `f8be85b`, release
event `verified` (execution 1557); plugin 0.35.0 installed. Its first live read answered 429
(T3 Code reads the same endpoint with the same sign-in), and the hook said "unknown" as
designed. #69 was merged by hand as `4784217` (release event `verified`, execution 1562) on
the owner's "Merge #69 once", past a neutral Graphify Formal Verification titled "1/4
PR-changed function(s) verified · 3 not verified"; every other check had passed. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-16-model-budget/`
(`merge-by-hand-cookbook-69.sh` and `.log`).

**Owner decision, 16 November 2026.** A banked reset is not redeemed automatically: when the
budget says it is worth using, the session asks the owner each time (the owner chose this over
a script calling the undocumented reset endpoint).

**Outstanding (Claude, next chat).** The usage endpoint kept answering 429 `rate_limit_error`
(retry-after 0) from 13:20 to 13:45 UTC on 16 November 2026, whatever the User-Agent; it
answered 200 at 12:42 and 12:52. While it does, the budget is "unknown" and threads keep their
model. Cleared by 0.35.4 (the first entry).

## 16 November 2026 (afternoon): the model budget, Fable or Opus by a script (0.35.0)

**Why.** The plan has one weekly limit and a Fable limit inside it (Fable may take half the
week, and its use is gone for Opus too). The owner wants the work never to stop on a limit,
no bought usage, Fable spent fully before the week resets, and a banked reset used where it
is worth most, without deciding any of it.

**What changed.** `skills/cookbook/scripts/model-budget.mjs` reads the usage endpoint with
Claude Code's stored sign-in (at most once per ten minutes, cached in
`~/.local/share/model-budget`, the token never stored) and applies fixed rules: Fable on pace,
Opus when ahead or from 90% of the Fable share, wait when spent, and when to redeem each kind
of banked reset. `hooks/model-budget-note.mjs` gives a session the advice alone (no figures,
times or counts: GitHub's security review on #67 flagged usage details going into the
session) at start and when it changes (SessionStart, UserPromptSubmit, PostToolUse). After
two more security findings: only a session start reads over the network (later events read
the cache only), and the cache is signed with the sign-in token (HMAC), so a tampered file
is ignored. One usage read at a time across processes (a `usage.lock`), and a reset
suggested only when it lets work run, after two AI review findings. Recipe pages `model-budget.md`
and `model-budget-setup.md`; the map row "The model for a session or a piece" now points
there. T3 Code's settings were set outside the repository: default Fable 5.2 high, fallback
Opus 5.5 high, auto-resume of limited threads on (backup of the earlier file in
`~/.local/share/backups/t3-settings/`).

**Verification.** 41 tests in `scripts/model-budget.test.mjs`; a live run printed week 38%,
Fable 61%, pace 58%, "Use Fable 5.2 high". The self-switch was proved: `t3_thread_configure`
to Opus, then a queued `t3_thread_send`; the queued turn ran on `claude-opus-5-5` (transcript
of the session, 12:54:32 UTC).

**Outstanding.** Redeeming a reset stays the owner's click (T3 Code: Usage, Limits, Use reset):
a session asks with the question dialog. Automatic redemption would post to an undocumented
endpoint on the owner's account; asked of the owner on 16 November 2026. Several
subscriptions through CLIProxyAPI: weighed, not set up (spending, ban risk).

**Dead ends.** Claude Code's `fallbackModel` never acts on a usage limit; the status line has
no Fable limit; the usage endpoint answers 429 when read often.

## 16 November 2026: open questions for the owner, kept by a Stop hook (0.34.0; record 0.35.1)

**Why.** The owner asked for one place that always shows what waits on them, guaranteed in
every chat and not only when asked. On 15 November 14 finished chats sat unsettled, three still
holding a question written as a paragraph at the end of a closing message.

**What changed.**
- `hooks/owner-questions.mjs` (Stop hook, beside the SessionStart one), with
  `owner-questions-lib.mjs` (pure decisions), `owner-questions-jev.mjs` (two Nouls) and
  `owner-questions-broker.mjs` (holds the Jev key in memory, answers on a named pipe).
- `recipes/owner-questions.md` and a map row under "Keep healthy"; a note in
  `options/keep-healthy.md`; the catalog's `cookbook` purpose names the hook.
- Tests first: `scripts/owner-questions.test.mjs` (22 tests), fixtures from today's real
  closing messages with names removed (`scripts/fixtures/owner-questions/closings.json`).
- 0.34.0, after #65 (0.33.0).

**Evidence, each checked on this PC.**
- A plugin Stop hook runs in a real T3 thread: a probe plugin logged the input, its block was
  obeyed, and the second stop came with `stop_hook_active: true`; the input carries
  `last_assistant_message`. The probe is uninstalled; its log is in
  `~/.local/share/stop-hook-proof/probe-2026-11-16.jsonl`.
- The sidebar, captured from the live window: one list across projects, pinned chats on top,
  a pending dialog shows "Waiting", about 28 title characters visible, hence the 2-character
  marker `❓ ` instead of `ANSWER: `.
- A `claude -p` started inside a T3 thread inherits `CLAUDE_CODE_ENTRYPOINT=t3-code` and the
  thread id, so the environment cannot tell it apart; the transcript can (no T3 tools listed).
- A detached process outlives a hook (written 15 s after the hook ended).
- Jev against the phrase list, 49 labelled plus 30 held-out closings (labels never sent). Held
  out: Jev (v1 wording, 0.6) 0.900 with no miss; phrase list 0.667 with 3 misses. A narrower
  wording (v2) missed one. Bar written first: 0.92 with at most one miss; Jev missed none but
  stayed under 0.92 by false alarms, and was chosen because a false alarm costs one short turn.
- Key read from the DPAPI store: 2 to 27 s, hence the broker. End to end: cold 2.2 s, warm
  0.5 s.
- About 250 Jev calls a day (T3 turns, 11 to 16 November), about USD 0.01 a day.

**Dead ends.** Reading the key at every turn (too slow). The environment as the scripted-run
signal (inherited). The phrase list as the judge (falls apart out of sample).

**Backstop.** Until the sweep below, no daily agent run could reach T3's sidebar: the three daily
runs are Claude Desktop tasks without T3 tools, and T3 had no scheduled task. T3's CLI (`t3 thread list --json`, run
from a folder other than `C:\`) lists title, status and settled, so a plain script could count
waiting chats; it cannot see pins. The owner chose a daily T3 agent sweep (below).

**Merged, released, installed and proved (after #66).**
- Merged as `9366fab` by hand, on the owner's one-time yes: Graphify Formal Verification ended
  neutral ("No PR-changed functions were verified") and was the only check not passing. The
  gate is unchanged.
- Review: an independent `cookbook:review` subagent (one high, two medium, all fixed with
  tests) and three AI-review rounds. The medium finding on the hard-coded
  `C:/Program Files/nodejs/node.exe` was answered twice: it follows the owner's absolute-path
  rule, and a missing Node fails open.
- Release check `verified` and acknowledged (execution 1556); the workflow itself ended
  `unknown` for the skipped `ai-review` job, as on every merge commit.
- Plugin 0.34.0 installed. Proved from the installed path in a new T3 thread: a "Decision for
  you" closing was stopped once and the thread obeyed; a mid-job closing passed; a "say yes and
  I start it" closing was stopped with Jev (0.99, 337 ms). The broker's first key read took
  35 s, so the first two turns used the phrase list and said so. Log copy:
  `~/.local/share/claude-cookbook/evidence/2026-11-16-owner-questions/hook-log-proof.jsonl`;
  the Jev evaluation scores are beside it (no message text).
- First real use: the pinned packaging chat that still waits on the owner is now
  "❓ Packaging firm: go?" (its old title: "Packaging Kept In-House Decision"). The live sidebar
  shows the new title after a short delay.
- The global `CLAUDE.md` sidebar bullet names the marker and the hook.

**The daily sidebar sweep** (the owner's choice on 16 November 2026, a recurring spend): a T3
scheduled task in this project, "Daily sidebar sweep", 07:45 every day, with a fresh session per
run. It was created without a thread; its first run made one and bound the task to it
(`boundThreadId`, checked with `list_scheduled_tasks`). That later runs reuse it is not yet
proven. It marks, unmarks or settles chats idle for more
than 2 hours, never answers or continues one, and settles its own thread. A run now: about a
minute, nothing old enough to touch. Its thread is set to Sonnet 5.5 after that run.

**Outstanding.**
- Whether the 17 November run reuses the bound thread and uses Sonnet 5.5 (a thread's model for a scheduled run is not yet
  proven, `recipes/scheduled-runs.md`): read that run's `executedModel`. Owner: Claude, in the
  next Cookbook chat.
- Graphify Formal Verification ends neutral ("No PR-changed functions were verified") on every
  Cookbook pull request that changes code, and the merge gate counts that as not passing. Three
  merges went past it by hand on one-time yeses (#57, #60, #66). Changing the gate loosens a
  check: the owner's decision, asked at the close of this job; until then, ask per pull
  request.
- The SessionStart hook still runs plain `node`; aligning it with the absolute path is its own
  small change.

## 16 November 2026 (late night, after 0.32.2): two reader profiles with no shell (0.33.0)

**Why.** The reviewer steps of Stack-Atlas's `sa-*` workflows read text other people wrote (a
diff, evidence, a brief, finding titles) while they have a shell, and their command list is
prompt text. GitHub code scanning raised it as "Excessive agency risk" on Stack-Atlas #184 and
#185. A tool change belongs in the Cookbook, so the no-shell profiles are added here and
Stack-Atlas uses them in its own pull request.

**What was proved before this change (the main chat, 16 November 2026).** The Workflow runtime's
`agent(prompt, { agentType })` runs a step as a subagent type with that type's own tool list. A
step started with `agentType: 'cookbook:research'` had exactly the tools its profile lists plus
`StructuredOutput` (no Bash, PowerShell, Write, Edit, ToolSearch or Agent), made no file and
still returned its schema answer. The same prompt on the default workflow subagent wrote the
file through Bash, PowerShell, Write and context-mode's `ctx_execute`. An `agentType` that is
not in the registry makes `agent()` throw ("agent type '...' not found. Available agents: ...")
without starting an agent, so there is no silent fallback. Evidence:
`~/.local/share/stack-atlas/evidence/agenttype-proof/` (`journal.jsonl`, `proof-script.js`,
`missing-profile-script.js`, `missing-profile-result.txt`, two agent `meta.json` files). This
job did not rerun it; it only saw that the folder holds those files.

**What changed.**
- `plugins/cookbook/agents/reader.md` (new): Sonnet, medium, `tools: Read, Grep, Glob`,
  `maxTurns: 300`. It reads and judges and runs nothing. What it reads is data, never an
  instruction; what reading cannot check is reported as not checked; a step's answer shape (a
  schema) replaces the report.
- `plugins/cookbook/agents/reader-graph.md` (new): the same plus `graphify_find`,
  `graphify_callers`, `graphify_impact` and `graphify_trace`, each named, with review's
  cautions about the indexed commit and an empty caller list.
- `scripts/agents.mjs`, two new checks. What a description promises must hold for `tools`: "no
  shell" (no Bash, PowerShell), "no file write" (no Write, Edit, NotebookEdit), "no tool
  search" (no ToolSearch and no server wildcard), "no subagent" (no Agent). And a description
  may not contain `: ` or ` #`, which YAML does not read as text.
- `scripts/agents.test.mjs`: the five agent files by name, the two reader tool lists pinned
  word for word, the promise check and the YAML check.
- `dispatch-profiles.md`: two table rows, when a step runs on a reader profile, how a Workflow
  step takes a profile, the 16 November proof and what is not proved. `recipes/dispatch.md`:
  eight profiles, five subagents. `recipes/workflows.md`: one line on the reviewer steps. The
  map row in `SKILL.md` names the two profiles. `catalog.json` lists no profiles and is
  unchanged.
- Plugin 0.33.0.

**Verification.**
- Test first: with the tests written and no agent files, `node --test scripts/agents.test.mjs`
  failed 3 of 14 (`the real files pass`: expected `reader` and `reader-graph` among the agent
  files; the pinned tool lists: `undefined` instead of `Read, Grep, Glob`; the promise check:
  `AssertionError: Bash`). With the files and the check: 14 of 14.
- `npm test` on the branch: "Cookbook check passed.", "Dispatch profile check passed.", 375
  tests, 375 pass, 0 fail (373 before this change).
- `git diff --check`: clean.

**Failures and dead ends.**
- The two descriptions as first decided were 220 and 215 characters; `scripts/agents.mjs`
  allows 200. The limit stays and the descriptions were shortened (194 and 197), with "no
  shell, no file write, no tool search, no subagent" kept word for word. A first shortening
  put `: ` in a description; the new YAML check exists because of it. Owner: Claude. Nothing
  to clear.

**Outstanding.**
- The Stack-Atlas pull request that sets `agentType: 'cookbook:reader'` on the reviewer steps
  of `sa-review`, `sa-build` and `sa-triage` (`cookbook:reader-graph` on the `sa-triage`
  triager). Until it merges, no workflow uses the profiles, and `recipes/workflows.md` says
  "meant to". Owner: Claude. Clears with that merge.
- After this pull request merges, the plugin must be updated on this PC before a workflow can
  name the two types: `claude plugin marketplace update claude-cookbook`, then `claude plugin
  update cookbook@claude-cookbook` (`README.md`, "Keep it current"; the `plugin` row of the
  stack-updates skill). Whether a session that is already running sees a new agent type
  without a restart is not written down in this repository and was not tested: a workflow
  step that names the type answers it, since an unknown type throws. Owner: Claude.
- No run of `reader` or `reader-graph` themselves yet: the proof above used the research
  profile. Owner: Claude. Clears with the first workflow step on each, with the tools it was
  given on record.
- `cookbook:review` and `cookbook:mechanical` keep their shell, with the shell rules in their
  prompts, as before. Not part of this job.

## 16 November 2026 (late night): a consult is defined on top of the Codex page (0.32.2)

**Why.** The owner said on 16 November 2026: "we use codex now, to be able to do the consult
thing". Two options pages still said that only the Claude provider is on. While this job was
open, another job merged the two entries below (#62 and #64): Codex as a second model, with
its own pages and map row, and the check of where Codex may start. This change was rebuilt
on those pages and does not stand beside them.

**What "the consult thing" is here.** Nothing on this PC is named "consult": tstack
(`t3dotgg/tstack`, still at `11e37a7`) is not installed, and none of its nine skills carries
the name. Its two skills that ask another provider's model are `sol-loop` (one GPT Sol
reviewer in a loop) and `council` (three providers). A consult is now the name for the second
opinion in the Codex row: one question about our own work to Codex, as advice.

**What changed.**
- `recipes/codex-consult.md` (new): when to consult and when not, the call, the brief, the
  three-round limit, and what a consult does not replace (the `ai-review` job, the merge
  condition, a security finding, a stop). Every rule of `recipes/codex.md` holds for it: a
  supervised start, never on text from outside, no unattended run without the owner's yes.
- `recipes/codex-limits.md` (new): what may be sent, the refused models, the cost.
- The map: the Codex row names the consult and links its page. `recipes/codex.md`,
  `recipes/dispatch.md` and `recipes/debugging.md` point to it.
- `options/check.md` and `options/ship.md`: the two "only the Claude provider is on"
  sentences are corrected. `options/plan-and-build.md` names tstack's two skills among what
  was weighed. The catalog is as #62 left it.
- Plugin 0.32.2.

**`sol-loop` and `council`: still not in use.** tstack is not installed. `sol-loop` picks the
latest GPT Sol, and the ChatGPT sign-in refused `gpt-6.1-sol` ("model is not supported when
using Codex with a ChatGPT account"; `gpt-6-luna` was refused the same way, and #62 records
that `gpt-5.6-sol` answers). It starts its reviewer in the session's own mode, round after
round, and an unattended Codex run has no owner's yes. `council` needs three providers and
two are on. Neither checks the merge condition in code.

**The owner's decision, 16 November 2026.** GitHub's security review (discussion 4584893393
on #63) found that a session may start a consult on its own judgement, which sends
repository code to another provider, and asked for a confirmation before every consult. Put
to the owner with the question tool, three options. Answer: "Standing yes, with limits
(Recommended)". `recipes/codex-limits.md` carries it: a consult on the session's own
judgement is allowed for code in the owner's own repositories; secrets, customer data,
personal data and files outside the repository are never sent; anything else is asked
first. That yes is about who may start a consult and what it may read. It is not the yes for
an unattended run, which #62 leaves open with the owner.

**The owner's second decision, the same day.** After the page said what really leaves the PC
and that the sandbox does not fence reading, the security review raised two more findings
on `recipes/codex-limits.md` (discussions 4585127375 and 4585127408): nothing technical
limits what a Codex run reads, and a session should not start a consult on its own
judgement at all. The three review rounds were used, so both went to the owner with the
question tool, three options: ask before each consult (the reviewer's fix), only when the
owner says so, or keep the standing yes. Answer: "Keep the standing yes". Both findings
are accepted by the owner as they stand and are recorded as such on their threads; they
are not fixed. The three checks before a call stay.

**Verification.**
- `npm test` passed.
- One real consult on this change: `delegate_task` to Codex (`gpt-6-astra`), completed, two
  findings, both agreed and fixed (the page told an agent to try another model, which T3
  Code's rules forbid; and it sent a consult to Codex also from a session that runs on Codex).
- AI review of the first commit (comment 6914545236): one medium and one low finding. The
  medium one, that "read-only" was only a sentence in the brief, is settled by #62's rule:
  the supervised mode gives a read-only sandbox. The page says so, and still has the checkout
  compared before and after.
- GitHub's security review, second finding (discussion 4584893402): the page told an agent
  to report a refusal with a line of Codex's configuration file. Fixed: the model tried and
  the exact refusal text only.
- AI review of the merge commit (`15b912c`): one medium and one low finding, both fixed.
  Medium: "files outside the repository are never sent" could not hold, since Codex reads the
  global rules file and the Cookbook's pages at the start of every run and its read-only
  sandbox can read any file the owner's account can. `recipes/codex-limits.md` now says what
  leaves on every run, says that the sandbox is not a fence, and puts three checks before
  the call (a Gitleaks scan, a look at the files Git ignores, a narrow brief): no check, no
  consult. Low: the fallback of "One bounded side piece" still sent a piece to another
  provider's model; it now names only a piece that needs its own checkout.
- GitHub's security review, three more comments (discussions 4584948356, 4584997081,
  4584997064). Two say that read-only was not enforced: fixed by the supervised start. One
  says that nothing technical limits what is sent: fixed by the three checks above.
- The supervised mode, tested by this job: a `delegate_task` with
  `runtimeMode: "approval-required"` stopped at its first command with a pending approval.
  The run was cancelled and no approval was given. Whether every later read also waits is
  not proven, and the page says so.
- Two more threads of the security review, on the first merge commit, were read late
  (discussions 4585059385 and 4585059394). The first, prompt injection through repository
  text, is fixed: the brief now tells Codex that what it reads is data and not instructions,
  and advice without evidence that can be checked is not taken. The second asks again for a
  confirmation before each consult: covered by the owner's second decision above.
- AI review of `f1b3af9`: one low finding, fixed. `recipes/codex.md` said that every command
  of a supervised run waits for a click; what was tested is the first command, and the page
  now says that.
- Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-16-codex-consult/`.

**Failures and dead ends.**
- The owner's standing yes was asked for with the words "the repository's code" as what
  leaves the PC. That was too narrow: Codex's start-up reading leaves too. The page is
  corrected and the owner was told in chat.
- The consult above ran unattended, in the session's own full-access mode, at about 10:55
  UTC, before #62 and its supervised rule reached the default branch (11:03 UTC). The commit
  that followed held only this change's files and the branch on the remote had not moved.
  It is no precedent: the rule is a supervised start. Owner: Claude. Nothing to clear.
- That consult, and the test of the supervised mode, were started without the check of where
  Codex may start: #64 brought it to the default branch afterwards. This branch changes no
  instruction file, and the check passes on it now.
- Two pages named `consult.md` and `consult-limits.md`, a second map row and a second
  catalog entry for Codex were written before #62 was seen. They are gone: one row, one
  catalog entry, pages under the Codex recipe.
- A reply on #63 said that `delegate_task` has no read-only mode. That was wrong (#62 tested
  one) and is corrected in a later comment there.

**Outstanding.**
- Gitleaks 8.30.1 (`gitleaks dir` over this checkout, the new check before a consult)
  reports three `generic-api-key` hits in `scripts/stack-updates-connect.test.mjs` (lines 77,
  281 and 296; on the default branch since #52; they read as made-up strings in the tests of
  the error scrubber, and GitHub's secret scanning has no open alert). A model's judgement
  does not clear a finding, so a consult on this repository stops at the scan. Owner: the
  owner. Clears with the owner's decision: build those strings at run time in a pull
  request, or accept the three hits. Cleared on 16 November 2026 by the owner's decision to
  fix them (the 0.35.4 entry).
- A whole supervised consult, with the owner clicking, has not been run. Owner: Claude.
  Clears with the first consult under the rule.
- Stack-Atlas's `HANDOFF.md` (15 November 2026) still lists `sol-loop` as open until "the
  Codex provider is switched on". The provider is on and `sol-loop` is still not in use.
  Owner: Claude. Clears with a line in that repository's next pull request.
## 16 November 2026 (night): Codex and project instruction files (0.32.1)

**Why.** GitHub's security review commented four times on #62, and #62 was merged (as
`ef4390b`) before those comments were read: the merge script's gate reads the `ai-review`
comment, not review threads. Two comments ("excessive agency") were already met by the head
that merged, which requires the supervised mode. Two ("prompt injection": Codex told to read
a repository's `CLAUDE.md` as rules) were not. This change fixes them.

**What changed.**
- `recipes/codex.md`, "Where it may start": Codex loads the working tree's `AGENTS.md` into
  its instructions by itself, so a sentence that asks it to distrust that file is not a
  control. The control is where Claude starts it: only in a checkout whose instruction files
  (`AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`, at any depth, tracked or not) equal those
  of GitHub's default head of a `TOKYO-BEANS` repository. The head comes from GitHub
  (`gh api repos/TOKYO-BEANS/<repo>/commits/HEAD`), with the name taken from the task, so a
  local remote or ref cannot stand in for it. Tried on a Stack Atlas worktree: clean passes,
  an untracked nested `AGENTS.md` is caught. A step that fails or cannot run means no Codex
  there: the piece goes to a `cookbook:review` subagent.
- The page was at its size limit, so the rules, tools, model route and proof moved to
  `recipes/codex-setup.md`. There: project files add to the global rules and never override
  one or lift a stop, and `~/.codex/AGENTS.md` tells Codex the same as a second line.
- Plugin 0.32.1.

**Lesson.** Before a merge, read the pull request's review threads
(`gh api repos/<owner>/<repo>/pulls/<n>/comments`) as well as the `ai-review` comment. A
security comment is fixed before the merge or goes to the owner.

**Outstanding.**
- The four threads on #62 and the one on #64 are answered and left open for the owner; a
  security comment is never dismissed by Claude.
- The start check is three commands on a page, run by Claude. Owner: Claude. Clears when it
  is a tested script that the delegation cannot skip; that belongs with the next job in
  Stack Atlas (the merge gate that does not read review threads).

## 16 November 2026 (late): Codex added as a second model (0.32.0)

**Why.** The owner's job, with a yes, 16 November 2026: "bring Codex's global setup in line
with Claude's, so a task delegated to Codex from T3 Code follows the same rules as Claude
does", and "Whether Codex belongs in the stack as a second opinion, and for which jobs, is
decided in the Cookbook, through a pull request there."

**What changed.**
- `catalog.json`: Codex, a trial, with no update feed (the desktop app updates itself). No new
  spend: it runs on the ChatGPT account the owner already has.
- The map: one new row, "a second opinion on our own work from a model that is not Claude",
  owner Codex as a supervised T3 `delegate_task` run, fallback a `cookbook:review` subagent.
  No other owner changes.
- `recipes/codex.md`: what it is for and not for, how to start it, where its rules come from,
  the model route, the proof. `options/plan-and-build.md`: why, and what was weighed.
- Plugin 0.32.0.

**Done outside the repository.** In `~/.codex` (backups in
`~/.codex/backups/claude-parity-20261116/`): `AGENTS.md` now holds no rules, only pointers to
`~/.claude/CLAUDE.md`, this Cookbook and a repository's `CLAUDE.md`, plus what differs for
Codex; `TOOL-STACK.md` is a pointer to the Cookbook; `config.toml` gained the Parallel Search
and Stagehand servers (keys at run time, as in Claude) and lost the unused
`[model_providers.context-mode]` block, which held a device key as a literal.
`approval_policy = "never"` and `sandbox_mode = "danger-full-access"` were read and left as
the owner set them (they match Claude's `bypassPermissions`); changing them needs the owner.
The owner named both values in the job ("The config has `approval_policy = "never"` and
`sandbox_mode = "danger-full-access"`") and reserved any change to them ("Ask the owner
before: ... changing Codex's approval or sandbox settings"). So the recipe keeps Codex
to our own work: it reads and reports, a piece that edits is not among its jobs, and text
from outside (a fork's pull request, an issue, a web page, a dependency) never goes to it
but to a `cookbook:review` subagent. T3 Code's one narrower mode was tested:
`runtimeMode: "approval-required"` gave a read-only sandbox with `approval_policy =
"untrusted"`, and the first command waited for a person. There is no unattended read-only
mode, so the recipe requires the supervised mode for this job. An unattended full-access
run for it needs the owner's yes, which is not recorded; the question was put to the owner
on 16 November 2026.

**Verified.** A delegated run on each model (`gpt-5.6-sol`, `gpt-6-astra`) answered eleven
questions on the rules correctly from its own instructions and named the files it read;
both listed the two new servers. Evidence:
`~/.local/share/stack-atlas/evidence/codex-parity-20261116/`.

**Outstanding.**
- Servers and skills connected in Codex that are not in the catalog (`agit`, `aikido`,
  `firecrawl-local`, `magic-workflow`, `shinkai`, `windmill`, `n8n`, the Waggle plugin, the
  Disler, Caveman and RTK skills and guides). Codex is told not to use them. Removing them is
  an uninstall. Owner: the owner. Clears with a yes.
- The gateway's device key is still in one older backup,
  `~/.codex/config.toml.bak-20261116-before-gateway-removal`, and passed through a session.
  Owner: the owner. Clears when it is revoked at the gateway, or when the owner says the
  account is closed, and that backup is deleted.
- Not proven, and so not a job in the recipe: a Codex piece that writes code.
- Unattended Codex runs for the map row. Owner: the owner. Clears with the owner's yes to
  full-access unattended runs on our own work (then record it in `recipes/codex.md`), or
  when T3 Code gains a read-only unattended mode, or when the owner changes Codex's sandbox
  setting. Until then the row means a supervised run.

## 16 November 2026 (evening): Macroscope weighed and not added (0.31.5)

**Why.** The owner asked whether the hosted reviewer Macroscope should be part of the
standard, after installing its GitHub app on the organisation the same morning.

**What changed.**
- `options/check.md` names Macroscope among the hosted reviewers weighed for "review of
  every pull request", with the reasons. The owner of that job is unchanged: the
  `ai-review` job, with `sa-review` as the fallback. No tool was added.
- Plugin 0.31.5.

**What was found.** Usage-priced ($0.05 per KB of diff, $0.50 minimum per review, $0.05 per
commit for its Status reports); code goes to several model and inference providers; the
GitHub app held write access to contents, workflows, pull requests and issues on all
repositories. On a third-party snapshot of the Martian Code Review Bench (October 2026) it
was 7th of 14 (60.0% F1, 77.5% precision). The `ai-review` job has not been measured
against it.

**Done outside the repository, on the owner's word.** The app was uninstalled from the
organisation and its sign-in authorization revoked on the owner's GitHub account, both in
the built-in browser (GitHub has no API for an owner to uninstall an app; the owner
confirmed with GitHub Mobile). Verified: the organisation's installations no longer list it,
it had posted no comment and left no branch.

**Outstanding.** The Macroscope workspace itself could not be opened after the uninstall,
so it was not deleted there. Owner: the owner. Clears with a request to Macroscope's
support, if the owner wants the workspace and its data removed.

## 16 November 2026 (later): the owner clicks in a window before a gated Adobe run (0.31.4)

**Why.** GitHub's security review on the last commit of #57 (comment 4582851565) said that
the yes in `--owner-yes` is self-attested: an agent that runs `scripts/adobe-session.mjs`
can write a yes that passes, and nothing independent confirms that a person said it. It
proposed a `--confirm` code worked out from the inputs. That was not added: the script
would print the code, so the same agent could copy it. Put to the owner with the question
tool, four options. Answer: "Merge, window as next job (Recommended)". This pull request is
that window. Reply on #57:
https://github.com/TOKYO-BEANS/claude-cookbook/pull/57#discussion_r4582883218

**What changed.**
- A run with a `--send` file or a tool outside `READ_ONLY` opens a window on the owner's
  screen, after every existing check has passed and before anything is copied or started. It
  shows each file by name and folder, every Adobe tool in `--allow` (marked read-only or
  not), the yes as the child session will get it, and the credits that yes states. Only a
  click on "Go ahead" starts the run. "Stop", a closed window, five minutes without a click,
  or no window (not Windows, no desktop, the window's file missing, a window that broke)
  ends the run with exit code 2: nothing is copied and no session starts. A read-only run
  and `tools` open no window.
- The checks of `--owner-yes` are unchanged: the window is added and nothing is removed.
  `stageFiles` is split into its checks (`checkStage`, made before the window and again
  after the click) and the copy; what it accepts and refuses is the same.
- Nothing skips the window: no flag and no environment variable, no file switches it off,
  and a click is not remembered. The script's own text reads no environment variable
  (`claude` and `taskkill` are still found through `PATH`, and the temporary and home
  folders through the system's variables, as before; none of that decides about the
  window). The window's process is Windows PowerShell by its fixed path with a fixed
  environment (`SystemRoot` and nothing of the caller's); the text goes in on standard
  input, not on a command line. Its answer counts as a go-ahead only with a clean exit and
  a random mark made for that one run. The session checks the click again itself
  (`clickHeld`).
- The window is `scripts/adobe-window.ps1` beside the script: Windows Forms through Windows
  PowerShell 5.1, no dependency. Only the mouse presses "Go ahead": the button answers a
  left mouse button let go over it, has no place in the Tab order, and is off for the first
  two seconds. "Stop" has the focus and takes Enter and Esc. Only ASCII, Latin letters and
  punctuation show as they are; every other character is written out (`<U+202E>`).
- `--dry-run` opens no window and prints, under `window`, whether a real run would and the
  text it would show. A new command, `window`, shows the window alone with sample text and
  starts nothing: the trial below. Its button is "It works (trial)"; "Go ahead" is on a
  real run's window only, and that window's first line says that it is a real run.
- What the window does not stop is said in the script's header, on the setup page and on
  the new page: an agent that controls the desktop can click it, an agent that can change
  the script or the window's file can change what they do, an agent with a shell can start
  a session of its own without the script, and an agent can ask the owner to click. It is
  a second, independent channel, not a proof of identity.
- Pages. `recipes/photos-adobe-connector.md` and `recipes/photos-adobe-connector-setup.md`
  say that such a run waits for the click, and the setup page says what the window does not
  stop. Both were within 30 bytes of the 4,000 limit of `scripts/check.mjs` and the full
  text went about 500 over, so it has a page of its own, linked from both:
  `recipes/photos-adobe-connector-window.md`. Moved to it from the setup page: what the
  script reads in the yes. Cut to make room, each still recorded elsewhere: "(109 tool
  names: why it was switched off)" (`connector-register.md`), "its server is the direct
  one that Adobe refuses" (the dead-ends page), and "so ask with a yes that says all four"
  (now "refuses one that does not name all four").
- Tests: ten new ones in `scripts/adobe-session.test.mjs`: when a window is needed, what
  it is given to show, how each answer ends the run, the window's process and its file,
  that nothing skips it (flags, the script's own text, and `main` run in a temporary
  folder with a stand-in window and session), the dry run, and the checks without the copy.
- Plugin 0.31.4 (#59 took 0.31.3, below).

**Tried by hand, 16 November 2026**, with the owner told first each time (question tool,
"Open it now (Recommended)" three times). `node scripts/adobe-session.mjs window`:
- First try: no window appeared, and the command ended after five minutes with "timeout"
  and started nothing. Failure, found by a probe: the script starts the window's process
  with its console hidden (`windowsHide`), and Windows then hides the first showing of the
  process's window as well (no visible window handle; without `windowsHide` the window was
  there). Fix in `adobe-window.ps1`: the window is shown once, hidden, and shown again;
  the second showing is seen. A test holds that order in the file.
- Dead end: a blank first form to take the hidden showing. Reason: it had no title bar, and
  the real window stayed hidden. Owner: nobody; the fix above replaced it.
- Second try, after the fix: the window appeared, the owner clicked "Go ahead", and the
  command printed `window: shown, and it ended with "go". Nothing was started`, exit 0,
  five seconds after it started (the trial's button was still called "Go ahead" then).
- Third try, after the review's fixes (the mouse-only button, the trial's own button; the
  owner told first again, "Open it now (Recommended)"): the owner clicked with the mouse and
  the command printed `window: shown, and it ended with a click on "It works (trial)".
  Nothing was started`, exit 0, six seconds after it started.
- Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-16-adobe-owner-window/`
  (`window-trial.txt`, `window-trial-mouse.txt`, `window-hidden-probe.txt`,
  `mouse-probe.txt`, `dry-run-gated.json`).
- Not tried by hand: "Stop", the close button, a key on the window, and the window of a
  real run. The tests cover how the script reads each answer, the probe covers the keys,
  and the first try above showed the time limit ending a window nobody could click.

**From #59** (the entry below, the servers measured, from another chat). It merged as
`2ee5882` on 16 November 2026 while this pull request was open and took 0.31.3, so this one
is 0.31.4; this branch took `main` in by a merge commit (`HANDOFF.md` was the only
conflict). Its release check and install are that chat's to report: not known here.

**From #57** (two entries below), after it merged. This answers what the entry below says
is still owed for #57. #57 merged as `c004774` on 16 November
2026, by `gh pr merge --squash --match-head-commit a8e1b2c`, not through `sa-release`: its
run `cookbook-57-merge` had ended `failed` on the neutral `Graphify Formal Verification`
check, and the owner answered "Merge #57 once (Recommended)". On the merged head `a8e1b2c`
that check was again the only one not passing ("0/2 PR-changed function(s) verified · 2
not verified (1 vacuous, 1 unsupported)").
- Review round 2 of #57 (`6175fbc`): one low finding from the AI review (grouped numbers
  such as "1'000 credits" passed), fixed in `a8e1b2c`. The AI review of `a8e1b2c`: no
  findings. Two of the three rounds were used.
- GitHub's security review on `a8e1b2c`: the comment under **Why** above.
- Release check of `c004774`: `verified` and acknowledged (execution 1535). The `sa-release`
  run `cookbook-57-release` (kind `merge`) ended `unknown` for the skipped `ai-review` job,
  as on every merge commit. Both runs are recorded in
  `~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-yes-whole-words/release/`
  (`progress.md`, `summary-*.json`, `release-*.log`).
- Plugin 0.31.2 was installed on this PC (from 0.31.1) and proved from the installed path:
  `--dry-run` refused "credits are fine" and "the background is fine" for the cut-out
  (`proof-installed-0.31.2/dry-run-refusals.txt` in that evidence folder), and one real run
  with `--allow adobe_mandatory_init,get_account_type,font_search`, no `--send` and no yes,
  made those three calls, sent no file, was denied nothing and exited 0
  (`proof-installed-0.31.2/run-output.txt`, `out/`, `out.adobe-session/`). USD 0.18 of plan
  usage as Claude Code reports it; the connector's calls report no cost: unsettled.

**Reviewed before the first push** by a `cookbook:review` subagent that did not build it
and was told not to open the window. Nothing high. It found no way for a run started from
the command line to reach the session without a go-ahead, and the checks of the yes
unchanged. One medium, fixed: once "Go ahead" switched on, Tab or an arrow key could move
the focus to it and Enter or Space pressed it (the button answered `Click`); it answers the
mouse alone now, and a probe on an off-screen copy of the window showed `PerformClick`,
`Click`, a right button, a left button outside the button and a switched-off button all
leaving the answer at "closed", and a left button over it giving "go"
(`mouse-probe.txt` in the evidence folder). Four low, all taken: the wording on files and
environment variables claimed more than the code does (both above); the rule for
characters that do not show listed what may not show and missed fillers and
right-to-left letters, and now lists what may; the trial had the same "Go ahead" button as
a real run, so an owner could be asked to click it "as a test"; and the session's own
check of the click was tested by its text alone. Also taken from its notes: the page says
to give the command more time than the window's five minutes.

**Review rounds.** Three, set before the first push.

**Review round 1**, on `59e020a` (the commit that took `main` in). The AI review: one low
finding, fixed. The window showed the folder a `--send` file was given in; with a folder in
that path that is a link to another place, it showed the link's harmless name while the
copy came from the other place. It now shows the folder the file is really in, and the
given one beside it when they differ. Graphify's review: no issues by static checks, and
three notes on coupling (`parseArgs`, `windowText` and `main` call more functions than
before), which are not findings about behaviour and were left. GitHub's security review:
one comment (4583768687), fixed. `main` is exported with a window and a session that the
tests can replace, so a program that imported the script could give it a window of its
own that answers "go" and reach the real session. `main` now refuses a stand-in window
unless the session is a stand-in too (`realWindowOnly`): only the real window's go-ahead
starts the real session. `Graphify Formal Verification` on that commit: neutral ("0/3
PR-changed function(s) verified · 3 not verified (2 vacuous, 1 unsupported)").

**Review round 2**, on `93be055`. The AI review: one low finding, fixed. The folder a file
is really in was read when the window opened and not again in a way that held it: a link
in the path turned to another place during the five minutes would have been copied from
there. The real place is now read once before the window (`pinned`), shown, compared after
the click (a file that is somewhere else by then ends the run, nothing copied) and used
for the copy. GitHub's security review of that commit: no new comment.

**Review round 3**, the last, on `e2efa4a`. The AI review: one low finding, fixed. Only the
place of a file was held, not its content: a file written over in place while the window
was open would have been sent. `pinned` now also takes the SHA-256 of each file before the
window; after the copy a staged file with other content is taken out again, with every
other copy of that run, and the run ends. GitHub's security review of that commit: no new
comment. The three rounds are used: a low finding on the next commit goes into a
follow-up pull request; a high or medium one, or any security finding, still blocks the
merge and goes to the owner.

**Proved for this pull request.** `npm test` passes (373 tests with `main` taken in). `--dry-run` of a run with
a file and `image_select_subject` printed `"opens": true` and the window's text and made
no folder; a read-only one printed `"opens": false`. The trial above. No upload was made,
and no `--owner-yes` was passed to a real run.

**Outstanding.**
- The first photo run through the script: it needs the owner's yes and now the owner's
  click, and will show which asset tools an upload takes and which steps (a PUT to a
  presigned link, a download) the calling chat does itself, since the child has no shell.
- The Adobe plan started as a 7-day trial on 10 November 2026 and turns paid on day 7.
  Keeping or cancelling it is the owner's decision.
- The merge commit, the release check, the install and the proof run of this pull request
  go into the next Cookbook pull request.
- The merge gate and a `Graphify Formal Verification` that ran and ended neutral (two
  entries below): a Stack Atlas job, and the owner's yes, since it changes a check. That check
  arrives about four minutes after a push; #55 and #58 merged before it did.
- The window is Windows only. On another system a run that needs it ends with exit code 2;
  a window for another system is not built.
- The rest of the outstanding lists of the two entries below stands.

## 16 November 2026: each MCP server measured; Firecrawl deferred, OpenSEO in its projects only (0.31.3)

**Why.** After the Adobe connector came back "on demand only" (#55) the owner asked: "shouldnt
we do exactly that for all things? or is that too much?". The answer then: not for all, and
with a measurement per server first. This is that job.

**Measured** (Claude Code 2.1.325, Opus 5.5, the plan login, tool search on): the input tokens
of a new headless session's first request with the user's own settings, plugins and servers.
With all nine servers 67,356; with none 48,100. A server's cost is every server on minus that
one left out, two runs each (three for every server on); repeats agreed to within 10 tokens.

| Server | Tokens | Sessions that called it (of 557 in 30 days) | Calls |
| --- | --- | --- | --- |
| firecrawl | 11,407 | 35 | 204 |
| OpenSEO | 2,303 (2,339 with its skills) | 32 | 186 |
| parallel-search | 1,783 | 75 | 471 |
| Claude Docs | 1,656 | 5 | 54 |
| graphify | 965 | 78 | 478 |
| context-mode | 885 | 79 | 3,455 |
| cloudflare (plugin) | 91 (272 with its skills) | 10 | 23 |
| cloudflare-docs | 52 | 10 | 30 |
| stagehand | 39 | 1 | 3 |

- The servers cost 19,256 tokens together, not the 8,000 to 15,000 estimated on 15 November.
- Why two plain runs differed by thousands of tokens: a server reaches a session a moment
  after it starts, and a prompt sent at once is answered without the ones still connecting.
  The script holds the prompt back until the debug log shows each server connected.
- Tool search already keeps tool definitions out. Firecrawl was the exception: its author
  marks five tools to load in full. `"alwaysLoad": false` in the user's entry for the server
  overrules that (Claude Code's MCP docs, 2.1.287 or later): measured 57,325, so 10,031 saved,
  with all 33 tools still listed.
- T3 Code's own server is not in a headless run: not measured.

**Asked once** (question tool, 16 November 2026), each with the saving, the use and the cost
of the move. Firecrawl: "Defer (Recommended)". OpenSEO: "Only in its projects (Recommended)".
Claude Docs: "Leave as is (Recommended)". Cloudflare (both) and Stagehand: "Leave all three
(Recommended)".

**What changed on this PC.**
- `firecrawl` in `~/.claude.json` has `"alwaysLoad": false` (`claude mcp remove`, then
  `add-json`, user scope; the headers helper is unchanged).
- `openseo@openseo` is `false` in `~/.claude/settings.json` (`claude plugin disable`). It was
  already `true` in the `.claude/settings.local.json` of the two site projects that use it,
  which now decide. The register's note that it moved on 2 November had not held.
- Nothing else: no deny entry, no connector, no sign-in.

**What changed here.** `scripts/measure/servers.mjs` with `servers.json` (this PC's servers)
and `scripts/measure-servers.test.mjs`; a new page `recipes/connecting-load.md` (the table and
the three ways out of a session start), linked from `connecting.md`; one bullet each on
`firecrawl.md` (load the tool with `ToolSearch` first), `seo.md` (where OpenSEO loads) and
`scripted-runs.md` (hold the prompt back); the register's Firecrawl row and a new OpenSEO row.

**Verification.**
- After the moves a session start is 55,308 tokens (two runs, 55,307 and 55,309): 12,048 fewer.
- A new session found `firecrawl_scrape` through `ToolSearch` and called it: every tool
  result ok, no call denied.
- Start-up probes without a prompt (no cost): OpenSEO connects in both site folders and not
  in an empty one. In a child session (`--setting-sources "" --plugin-dir <cache folder>`) it
  connects with its stored sign-in.
- `npm test` passes (363 tests with `main` taken in, 17 of them in `scripts/measure-servers.test.mjs`).

**AI review round 1** (of three): three low findings, all fixed. A limit that was reached
ended the session again on every tick: it now runs once, and where a signal can be ignored a
SIGKILL follows after five seconds. The `defer` arm copied an entry unless it had `headers`
or a key-like `env` name, so a key in the URL or in the arguments would have gone into the
temporary file: it now copies only a remote entry with `type`, `url`, `headersHelper` and
`timeout`, whose URL has no user part, no query and no long path segment, and refuses
everything else (Stagehand's entry among them; Firecrawl's passes). A folder is checked
against the model that was asked for, not the one the session reports, so an alias in
`--model` no longer blocks the next run.

**Review round 2**, on `0818d74` (the commit that took `main` in). GitHub's security review:
the URL check of the `defer` arm still let a short path segment or a host name carry a key
into the temporary file. Its proposal (a root path only) would have refused Firecrawl's own
`/v2/mcp`, and no check of an entry's text can prove it holds no key. So the entry is now
pinned: `servers.json` records the SHA-256 fingerprint of the one entry a person has read
(`servers.mjs fingerprint --server firecrawl`), and any other entry is refused, also one
that passes every text check. The text checks stay and are stricter: a plain DNS host name,
no IP address, no port. Graphify: `run()` called 13 functions; one run is now its own
function. A second comment of the security review, on the debug log: the temporary folder
and its files are now made for this user only (modes 700 and 600 where the system has them),
the debug log exists before the session starts, deleting is tried again while a file is
held, and a folder that still cannot be deleted has its files emptied, is named without its
path and stops the batch with exit code 3. The AI review of `0818d74` (one low): a headers
helper is free text and was copied as it is. The fingerprint already refuses any helper but
the recorded one; a helper whose own text carries a header or a key (`echo "Authorization:
Bearer ..."`) is now refused as well, recorded or not. My reply to the first security comment
landed under the second by mistake; both threads were answered again in the right place.

**The final script was run once more** after these changes (`runs-after`, run 3): it ended
well and left no temporary folder. It measured 55,030 tokens, 278 fewer than the two runs
an hour before, with the same servers, tool, skill and plugin counts. The cause is not
known (the other chat had installed Cookbook 0.31.2 in between; a server may also have
changed its own text). So compare arms within one sitting only.

**Review round 3**, the last of the three. The AI review of `63d97dc`, one low: the script
said a run "can call nothing", but a run loads the user's own settings, and `dontAsk`
honours their allow rules (24 on this PC, for Bash and MCP tools). Every arm's settings now
add a PreToolUse hook that refuses every tool call, and a run in which the model tried a
tool is not counted. A deny rule or `--tools ""` was not used: either would change what is
measured. Proved with two capped runs (`checks/hook-blocks-tools.json`): with the hook a
Read of a file in the run's folder was refused, without it the Read worked. A measuring run
with the hook gave 55,035 tokens against 55,030 without, so the hook is not in the context.
None of the 32 measuring runs before it called a tool (each made one request). The rule is
on `recipes/scripted-runs-rules.md`.

**After round 3**, the AI review of `f3d0826`, one low: `recipes/seo.md` named the two site
projects, and this repository is public (the register says: no project names or paths). The
names are gone from the page and from this entry; they are in memory on this PC. They were
in three pushed commits of this pull request's branch (`78fa830` to `f3d0826`), which a
squash merge keeps out of `main`; the owner was told. A fourth push, for this alone.

**Spend.** USD 8.32 at list prices, on the plan login: 33 measuring runs (7.71, limit 15), the
hook proof (0.02) and
the Firecrawl call (0.59, and four Firecrawl credits).

**Not proved.** An OpenSEO call from a child session (it connected; no call was made, since
its calls spend credits). OpenSEO in a T3 worktree thread of its two projects: the local
settings file is not in git, so it will not load there; open SEO work in the project folder.

**Dead end.** The `claude-code-guide` agent had no web tool in this session and answered
nothing; the docs were read through Parallel instead.

**Evidence:** `~/.local/share/claude-cookbook/evidence/2026-11-15-mcp-on-demand/` (`RESULT.md`,
`runs/`, `runs-after/`, `checks/`, the census). Copies from before:
`~/.local/share/backups/mcp-on-demand-20261116/`.

**From #57** (the entry below, the Adobe follow-up, from another chat). It merged as `c004774`
on 16 November while this job ran and took 0.31.2; this branch took `main` in by a merge
commit, and the plugin here is 0.31.3. Its release check, install and proof run are that
chat's to report: not known here, so they are still owed to the next Cookbook pull request.

**From #58** (two entries below). It merged as `d951c09`. The release check of that commit is
`verified` and acknowledged (execution 1534; `sa-release` itself ended `unknown` for the
skipped `ai-review` job, as on every merge commit). No plugin file changed, so the installed
plugin stayed 0.31.1. Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`.

**Outstanding.**
- The merge commit, the release check and the install (0.31.3) of this pull request go into
  the next Cookbook pull request.
- Stagehand's review is on 28 November (the owner chose to keep it, do not ask again). It
  starts a process with the Browserbase key at every session start, for 39 tokens and one
  session in 557: a point for that review.
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- The older list in the entries below stands.

## 16 November 2026: the owner's yes is read by whole words and a number of credits (0.31.2)

**Why.** Two things #55 left open, both in how `scripts/adobe-session.mjs` reads the owner's
yes (`yesGaps`). This pull request closes them and removes no stop: a yes that passed before
and is refused now is the only change in behaviour.

**What changed.**
- An operation word is matched as a whole word, with the boundary rule that file names
  already had (`namedIn`; both now use one function). A plural still counts: "masks" names
  `mask`, "uploads" names `upload`. "unmasked", "cropped", "uploaded" and a file called
  `mask.jpg` do not. A tool's own name is matched whole as well, without a plural, and so
  is "Adobe" (a file called `adobe.jpg` named the account). A letter of any alphabet joins
  a word, also for file names. Words are read, not meanings: "no masks" names a mask.
- "background" is no longer a word for `image_remove_background`: "the background is fine"
  named the cut-out. "cut-out", "cutout", "cut out" and the tool's own name remain.
- The yes must state a number of credits in front of the word: "0 credits", "up to 300
  credits". The word "credits" alone, "no credits", "zero credits" and a number with a
  separator ("1,000") are refused. 0 is valid. The script checks that the number is there;
  it cannot measure what a run spends and holds no run to the number.
- The two pages that describe the yes check say so (`recipes/photos-adobe-connector.md`,
  `recipes/photos-adobe-connector-setup.md`). Tests: two new ones in
  `scripts/adobe-session.test.mjs`.

**The owner's decision on the credits.** GitHub's security review on the last commit of #55
asked for a numeric credit cap in code and for "0 credits" to be refused. Put to the owner
on 15 November 2026 with that comment, and with the reasoning that the connector's calls
have shown no charge and that the script cannot measure spend, so a cap in the script would
be a number it cannot hold a run to. Answer: "Merge now, rest in a follow-up (Recommended)".
The owner then set this follow-up's scope in its brief, 15 November 2026: "The yes must
state a number of credits, not only the word "credit" ("0 credits", "up to 300 credits"). 0
stays valid." This pull request does that and no more of the comment: no cap is held in
code.

**Round 4 of #55**, the push the owner allowed beyond the three rounds. The AI review of its
last commit (`a365479`): one low finding, that `yesGaps` matched operation words as plain
substrings; fixed here. GitHub's security review added two comments on that commit: the
credits number (above, taken into this pull request) and the brief again (it goes into the
prompt, fenced; the review proposed stripping instructions from it). The second is the
earlier finding on the brief with another proposed fix; the owner accepted it with the same
answer. That acceptance covers that comment and no other finding.

**From #55** (the Adobe connector on demand, 0.31.0, three entries below). It merged as
`e5a2527` on 15 November 2026. The release check of that commit is `verified` (execution
1532); the `sa-release` run `cookbook-55-merge` ended `unknown` because the `ai-review` job
is skipped on a merge commit, as on every one. Plugin 0.31.0 was then installed on this PC
and proved: a run from the installed path made three read-only Adobe calls
(`adobe_mandatory_init`, `get_account_type`, `font_search`) and exited 0. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-connector-on-demand/`
(`proof-installed-0.31.0/`, `release/`).

**From #56 and #58** (the two entries below), which merged while this pull request was
open. #56 took 0.31.1, so this one is 0.31.2; this branch took `main` in by a merge commit
(`HANDOFF.md` was the only conflict). #58 merged as `d951c09`; the release check of that
commit is `verified` and acknowledged (execution 1534; log `release-cookbook-58-merge.log`
in `~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`).

**The merge gate stopped this pull request, and the owner decided.** The `sa-release` run
`cookbook-57-merge` (15 November 2026, late) ended `failed` and merged nothing: the check
`Graphify Formal Verification` had run on the head commit (`0fed36e`) and ended neutral
("0/2 PR-changed function(s) verified · 2 not verified (1 vacuous, 1 unsupported)"). The
merge script sets that check aside only when its title says it did not run; a neutral one
that ran counts as not passed. It cannot pass here: it proves that old and new code behave
the same, and this change alters behaviour on purpose. Every other check had passed and
the AI review had no findings. Put to the owner with the question tool: merge #57 once as
an exception for this pull request only, change the gate first in Stack Atlas, or leave it
open? Answer: "Merge #57 once (Recommended)". That covers this pull request and no other;
the gate is unchanged. The run is recorded in
`~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-yes-whole-words/release/`.
- Dead end: getting that check to pass on a pull request that changes what a function does.
  Reason: above. Owner: the owner (a change to the gate loosens a check). Clears when the
  gate in Stack Atlas (`merge-when-green.sh`, `outsideGate`) has a rule for a run that
  found nothing different, or Graphify reports such a run as passed.
- Seen beside it: Graphify posts that check about four minutes after a push. #55 and #58
  merged before it arrived (on #58's head it ended neutral 102 seconds after the merge), so
  the gate never saw it there. Not changed here: it is Stack Atlas's script.

**Reviewed before the first push** by a `cookbook:review` subagent that did not build it:
nothing high; one medium (this entry did not show the owner's words on 0; they are quoted
above now) and five low, all taken: the credits pattern read "1 000" and a minus sign as
numbers, "Adobe" was still a plain substring, a letter outside a–z did not join a word, a
comment claimed more than the word list does, and three behaviours had no test.

**Review round 1** (of three), on `0fed36e`: the AI review had no findings, Graphify's
review none, and GitHub's security review did not comment.

**Review round 2**, on `6175fbc` (the commit that took `main` in). The AI review: one low
finding. The credits pattern listed the marks that may not stand before the number, so
"1  000 credits" (two spaces), a narrow no-break space and "1'000 credits" still passed on
their last digit group. The pattern now says what may come before the digits instead: the
start of the yes, an opening bracket, or white space that does not follow another digit.

**Proved for this pull request.** `npm test` passes (346 tests with `main` taken in).
`--dry-run` refuses a yes with the word
"credits" and no number, and one that says "the background is fine" for the cut-out, and
accepts "0 credits" with "masks". No upload was made and no `--owner-yes` was passed to a
real run.

**Outstanding.**
- The first photo run through the script: it needs the owner's yes, and will show which asset
  tools an upload takes and which steps (a PUT to a presigned link, a download) the calling
  chat does itself, since the child has no shell.
- The Adobe plan started as a 7-day trial on 10 November 2026 and turns paid on day 7. Keeping
  or cancelling it is the owner's decision.
- The merge commit, the release check, the install and the proof run of this pull request go
  into the next Cookbook pull request.
- The merge gate and a `Graphify Formal Verification` that ran and ended neutral (above):
  a Stack Atlas job, and the owner's yes, since it changes a check.
- The fixed set of tasks measured before and after is done (#56, two entries below); the
  rest of that entry's outstanding list stands: what was not measured, the unproven T3
  scheduled task, Stagehand's review date of 28 November (the owner chose to keep it: do
  not ask again), the Proton Pass CLI reported signed out on 15 November and not rechecked,
  the two register pages still read in ranges, the token counter not retried.
## 15 November 2026 (late night): the measuring script, two findings from the last review of #56

No plugin file changes, so the plugin stays 0.31.1.

**What changed** in `scripts/measure/measure.mjs`, both from the AI review of #56's head
commit (two low findings, left for this pull request because #56's three rounds were spent):
- `run` does not score a run that ended in an error (`is_error`, or a subtype other than
  `success`, such as a run cut off by the spend cap): it prints the subtype, stops the batch
  and keeps the run as a `discarded` row, so its cost counts against the batch limit (a run
  with no result at all is counted at the full cap) while the report leaves it out and names
  it. The AI review's first round (medium) asked for the cost to count: without it, a task
  that kept hitting the cap could have passed the limit across reruns. Round 2 (two low): a
  result that reports no cost is also counted at the cap, and a run that succeeds without a
  cost is not scored; `report` applies its check for another task set or model to every row,
  the discarded ones included. Scored, such a run would have counted as wrong answers. None of the
  48 runs of the first measurement was one (every row: exit 0, `isError` false, `success`).
- `--side` must be `before` or `after`; any other name stops the command before a run. A row
  under another name would have cost money and been left out of the report.

**Verification.** `npm test` passes (344 tests, 17 of them in `scripts/measure.test.mjs`).
No paid run was made for this pull request.

**From #56** (the entry below). It merged as `187cfc2`. The release check
of that commit is `verified` and acknowledged (execution 1533; `sa-release` itself ended
`unknown` for the skipped `ai-review` job, as on every merge commit; log
`release-cookbook-56-merge.log` in the evidence folder). Plugin 0.31.1 was installed the same
night (from 0.31.0, which the Adobe job had installed) and proved with a new headless
session that loaded it from `cookbook/0.31.1` (`newsession-0.31.1.jsonl`). Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`.

**Outstanding.** The list in the entry below stands, less its first item. The merge commit
and the release check of this pull request go into the next Cookbook pull request. The order
the owner set on 15 November 2026 is complete.

## 15 November 2026 (night): a fixed set of tasks, measured before and after (0.31.1)

The last step of the order the owner set on 15 November 2026 (the map #51, the removals #52,
the diet #53, the visual check's recipe #54, then this).

**What was compared.** "Before" is the global rules file as it was before the diet (36,078
bytes, from `~/.local/share/backups/claude-md-diet-20261115/CLAUDE.md`) with Cookbook 0.28.4
(`52aead6`, a 94,928-byte skill). "After" is today's file (8,411 bytes) with Cookbook 0.30.2
(`b75dbaf`, an 11,730-byte map and one page per recipe). The removed tools were not
reinstalled (an install needs the owner's yes), so the removal step (#52) is not in these
numbers; what is recorded for it is the tool count of a full session start, 205 before and
173 after (`evidence/2026-11-15-remove-jobless-tools/`).

**The task set**, chosen by the owner with the question tool ("12 tasks, twice
(Recommended)"), is in `scripts/measure/tasks.json`: six tool choices (who calls a function,
a JS-heavy page, merging a finished pull request, vetting outside code, a scripted
`claude -p` run, a live Wix change), four stops (a paid plan, dismissing a finding, merging
without waiting, publishing without a visual check) and two rule lookups (a new key,
force-push). Each task asks for the answer in named fields. The key (38 checks, each a
pattern on one field) was written before any run and holds only answers both rule sets give.

**How.** `scripts/measure/measure.mjs`: headless runs on the Claude plan login, Opus 5.5,
tools Skill, Read, Glob and Grep only, no MCP servers, no user settings or plugins, a cap of
USD 1 a run and a stop at USD 30 for the batch. Each side is a folder with that side's rules
file and plugin. 12 tasks, two sides, two repeats: 48 runs, none failed, no tool call denied.

**Results** (sums over the 24 runs of a side; the table per task is in the evidence folder).

| | Before | After | Change |
| --- | --- | --- | --- |
| Checks passed | 76 of 76 | 76 of 76 | none |
| Input tokens, all requests | 1,627,339 | 1,109,261 | 32% fewer |
| First request of a run (mean) | 22,254 | 12,459 | 44% smaller |
| Largest request of a run (mean) | 50,190 | 17,544 | 65% smaller |
| Output tokens | 10,615 | 10,635 | the same |
| Requests (turns) | 62 | 94 | 52% more |
| Seconds (as Claude Code reports them) | 140 | 152 | 9% more |
| Cost at list prices (plan usage, no invoice) | USD 7.75 | USD 2.46 | 68% lower |

- Nothing was lost and nothing was gained in correctness on this set: both sides passed every
  check, stops and rules that left the global file included. The set cannot show a gain: its
  key holds only answers both sides give.
- The saving is in size and cost, not in speed. After loads a short map and then reads the
  page of the job (19 page reads and 7 searches in 24 runs); before loaded the whole skill and
  read nothing else. That is why after needs more requests and a little more time.
- Two tasks cost after more input tokens than before, as means: merging without waiting
  (65,671 against 51,129) and force-push (64,879 against 51,090). In both, after took five
  requests to find the rule on a page, and one of before's two runs answered from the global
  file without loading the skill. Their cost was still lower (USD 0.12 against 0.24).
- Before was less steady: three of its second-repeat runs skipped the skill (22,000 tokens
  against 80,000 with it). After loaded the skill in 22 of 24 runs; the two without were the
  dismissal stop, which both sides answer from the global file.
- The first request shrank by 9,795 tokens, which matches the diet's own measurement (9,798).

**A flaw found before the batch, and fixed.** `--setting-sources project` does not keep the
user's `~/.claude/CLAUDE.md` out: a probe run named both rules files, so both sides had
today's file on top. The first trial run and two probes are void (kept in `void/`). The runs
now pass `--settings` with `claudeMdExcludes`; `measure.mjs probe` showed one rules file per
side before the batch. The rule is on `recipes/scripted-runs-rules.md`.

**Spend.** The batch: USD 10.21 at list prices, on the plan login (`apiKeySource` `none` in
every run). Outside it, the void trial, the probes and the scope proof: USD 0.87.

**To measure a later change:** build the two sides (`git archive <commit> plugins/cookbook`
into `<side>/plugin`, the rules file as `<side>/work/CLAUDE.md`), then `probe`, `run` and
`report`. Results compare within one task set only: a changed task or check takes a new
`set` name.

**Verification.** `npm test` passes (341 tests, 14 of them in `scripts/measure.test.mjs`; the run's allow list is one of the things they pin). The 48
stored answers were scored again from the raw streams after the last change to the parser:
152 of 152, none moved.

**Checks and review on the pull request (#56).** The first push failed `Depot CI / test`: a new
test assumed a Windows path; the Read rule and its test now hold on Linux too. CodeQL then
raised one high finding (`js/clear-text-logging`, alert 3): the probe printed the stream's
`apiKeySource` label. It is no key, but the finding was fixed, not answered: the runner records
only whether a run was on the plan login. AI review round 1 (of three), two low findings, both
fixed: a `--cap`, `--limit` or `--reps` that is no positive number stops the command (it would
have switched the batch stop off), as does a flag without a value; and `run` and `report`
refuse a folder that holds results of another task set or model. Round 2, from GitHub's
security review: a run wrote its whole stream to the output folder, and the model's text can
quote the rules file it was given. The stream, the run's stderr and the probe's stream are now
written only with `--transcripts yes`, and a search is recorded without its pattern; by
default the folder holds numbers, tool names and which checks passed. The first measurement
was made before this, so its folder holds every stream; it is on this PC only, in no
repository. Round 3, the last: requests are counted for the model the session reports, so an
alias in `--model` no longer leaves the request columns at 0, and a run with a result but no
counted request stops the batch; the header comment names both scripted-runs pages.

**After the third round, one more finding, about isolation, so it was fixed here and not in a
follow-up.** The runs allowed `Glob` and `Grep` without a path, so a run could have searched
any file the user can read, the user's own rules file included. None did: the 48 stored
streams hold 26 file-tool calls (19 Read, 7 Grep), every one inside the run's own side
folder, so the numbers above stand. The fix: only `Skill` and the one Read rule are allowed.
One capped run proved it (`checks/scope-probe-read-rule-only.jsonl` in the evidence
folder): Grep, Glob and Read worked inside the side folder and all three were refused
outside it. The rule is on `recipes/scripted-runs-rules.md`.

**And one from GitHub's security review on that commit:** `probe` printed the model's answer,
which holds the paths and first headings of the rules files. It now prints a verdict it
works out itself (clean or not, how many rules files, whether the side's own and the user's
own are among them) and ends with exit code 1 when a side is not clean; the answer is shown
only with `--transcripts yes`. The line `run` prints per run names the tools without their
arguments; the pages read stay in `summary.jsonl`.

**Evidence:** `~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`
(`RESULT.md`, `runs/report.md`, `runs/summary.jsonl`, one stream per run, both sides in
`arms/`, the void runs in `void/`).

**From #55** (the entry below, the Adobe connector on demand, 0.31.0). It merged as `e5a2527`
while this job ran; this branch took `main` in by a merge commit, and the plugin is 0.31.1.
The release check of `e5a2527` is `verified` and acknowledged (execution 1532; log in
`~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-connector-on-demand/release/`).
Plugin 0.31.0 was not installed on this PC when this was written. The measurement's "after"
side is 0.30.2, as stated: #55 added one map row and three pages after it.

**From #54.** It merged as `b75dbaf`; the release check of that commit is `verified` and
acknowledged (execution 1530; `sa-release` itself ended `unknown` for the skipped
`ai-review` job, as on every merge commit). Plugin 0.30.2 was installed the same evening and
proved with a new headless session. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-15-visual-check-recipe/`.

**Outstanding.**
- The merge commit, the release check and the install of this pull request (0.31.1) go into
  the next Cookbook pull request.
- Not measured: the removal step by itself, and a session with every MCP server on (two such
  runs differ by thousands of tokens). A per-server measurement belongs to a job of its own
  (memory `whole-design-one-owner`).
- "Adobe for creativity" stays connected in claude.ai: #55 reversed the earlier request to
  disconnect it. Nothing waits on the owner there.
- Open from #55, the owner's: the yes for the first photo run through the script, and keeping
  or cancelling the Adobe plan (a 7-day trial from 10 November 2026 that turns paid on day 7).
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- Stagehand's review date is 28 November (`connector-register.md`); the owner chose to keep
  it, do not ask again.
- Still open from #54: the Proton Pass CLI was reported signed out on the morning of
  15 November and not rechecked; `dispatch-profiles.md` and `connector-register.md` are
  still read in ranges; the Claude API's token counter was not retried.

## 15 November 2026 (late evening): the Adobe connector is back, on demand only (0.31.0)

**Why.** #52 switched "Adobe for creativity" off because the map gave it no job and its page
said "connected but not yet used for a task". That was wrong: in a business-website project it
had made 26 masks under a colour fix on 14 photos, plus straighten, blur, expand and a cut-out
(10 November 2026). The owner, 15 November 2026: "it really helped alot with photos/images on
camilla site" and "can we make it so it is not auto loaded in evry session/chat but you can
grab it if you need it?". This pull request is that, and it removes no stop.

**What changed.**
- A map row ("Edit a real photo: masks, cut-out, straighten, colour by region"), the tool in
  `catalog.json`, a register row, and three pages: `recipes/photos-adobe-connector.md` (the use,
  the stops, what the first job taught), `recipes/photos-adobe-connector-setup.md` (the child
  session and its limits) and `recipes/photos-adobe-connector-dead-ends.md`.
- `scripts/adobe-session.mjs` in the skill's folder starts a child session that loads only this
  connector, in `dontAsk` mode and without a shell: it reads the files staged for it, writes
  in a folder made new for the run, and calls the Adobe tools named on its command line; tests
  in `scripts/adobe-session.test.mjs`. The only files of the owner's it can see are the ones
  named with `--send`, and each must be named in `--owner-yes` by its whole file name; a tool
  that is not read-only needs that yes too. The upload gate of
  `recipes/photos.md` is unchanged and is repeated on the new page.
- On this PC nothing in `~/.claude/settings.json` changed: `claude.ai Adobe` and the plugin's
  server stay denied and the plugin stays disabled, so an ordinary session loads no Adobe tool.
  The connector stays connected in claude.ai: the owner is asked **not** to disconnect it (the
  earlier entries asked for the opposite).

**Proved** (15 November 2026, Claude Code 2.1.325). One run of the script with three read-only
tools: `adobe_mandatory_init`, `get_account_type` and `font_search` answered; no file was sent
and nothing was created. Limits measured with the final script: allowed were a read of the
staged file and a write and a read in the run's own folder; denied were an Adobe tool not on
the list, an older file in the output folder, a Glob of it, the staged file's original, the
script's own files and a write anywhere but the run's folder; a shell command had no tool to
run in. A one-minute time
limit stopped a long run with exit code 3. An earlier version that could be given a shell rule
for curl also ran `whoami` and `node --version` (Claude Code runs commands it reads as
read-only once a shell is on), which is one reason the shell is gone. An ordinary headless
session on the same day listed no Adobe server, tool, skill or plugin.

**Reviewed before the first push** by a `cookbook:review` subagent that did not build it. Nine
findings, all fixed in the second commit. The main ones: the child could read every file the user can (the
user settings' deny rules for secrets do not reach it), it could overwrite the script's own
settings and log, the check for other servers never saw one (it now reads the debug log after
the run), any command was accepted as a shell rule (the shell is gone since), the output folder was
not checked, the yes sat in the same prompt as the brief (now in the system prompt), and the
child process was not ended cleanly.

**Review round 1** (of three). The AI review: a folder given for reading could contain the
script's own log folder. GitHub's security review: nothing in code tied the owner's yes to
the files that could be sent, and the log kept every event word for word. Fixed in the third
commit by taking away rather than adding: no extra folders and no shell at all, the files to
send are named with `--send` and must each be named in the yes, and the log keeps tool names,
denials and cost only. The session's debug log is deleted after it has been read.

**Review round 2.** The AI review: the child could read everything in an output folder that
already held files; the yes was matched as a piece of text, so `a.jpg` passed on a yes for
`banana.jpg`; and a link could be sent as its target. Graphify: the output folder could be
inside `.git`, and two runs shared one settings file. Fixed in the fourth commit. A live test
then showed that a write rule on a folder also lets the child read it, so the child has no
rule on the output folder at all: it reads `to-adobe` and writes a folder made new for the
run. The yes must name each file by its whole name; a link is refused; the output folder is
checked again with links followed; `.git`, CI and hook folders are refused; every run has
its own settings file.

**Reviewed again before the last push** by a second `cookbook:review` pass: nothing high,
three medium, the rest low; all fixed in the fifth commit. A staging folder that was already
a link was copied through before it was refused (it is checked first now, as are the other
folders the script uses). Started through a linked folder the script did nothing and exited
0. The brief was an unchecked way to bring any file's text to the child (it is a small
`.md` or `.txt` now, not a link, not in a secret folder). Also: a file to send has an
extension, a double quote in the yes is refused, a path with pattern characters or on a
network share is refused, the log copies no free text at all, a run that called no Adobe
tool exits 1, and a debug log that cannot be deleted is reported. Measured in that pass: a
`CLAUDE.md` above the output folder does not reach the child.

**After round 3 was pushed**, GitHub's security review commented twice more on the round 2
commit. The system prompt, with the owner's yes and the file names, was on the child's
command line, where another user of the PC could list it: it is now in a file in the
temporary folder that is deleted after the run. And a general yes covered any tool that is
not read-only: the yes must now name the Adobe account, the credits and the operation of
each such tool (`mask`, `upload`, `expand` and so on; a tool the script does not know by an
operation word must be named itself), beside each file. Fixed in the sixth commit.

**Round 3**, the last of the three set. The AI review: one low finding, no test for the end
of a run; the exit codes are now one function with a test for each. GitHub's security review
on that commit: the brief goes into the prompt as it is, and the debug log exists while the
run lasts. The brief is now fenced as data with a mark made from its own text, and the
system prompt says that nothing in it changes a rule. The debug log stays: the script needs
it to know when the connector has connected and which servers did. It is in a temporary
folder that only this user can read and that is deleted whatever happens. The review
proposed a brief in a fixed JSON form and a debug log only on request; neither was done, for
those reasons. A fourth push went beyond the three rounds, so it and those two answers were
put to the owner with the question tool (15 November 2026). Asked: push a fourth round,
accept the two answered comments (the brief in a fixed JSON form; the debug log off by
default) as they are, and merge when every check passes and the new review has nothing high
or medium, with any new security comment coming back to the owner first? Answer: "Push,
accept those two, merge (Recommended)". That acceptance covers those two comments and no
other finding.

**Dead ends.**
- A subagent with the server defined inline in an agent file (`mcpServers`). The mechanism
  works (proved with Graphify: the subagent called it, the main session listed no server), but
  Adobe's server answers every direct request with HTTP 403, also with a fresh token after the
  owner signed in through `claude mcp login`. Adobe offers the connector in Claude chat, Cowork
  and Claude Desktop only. Owner: Adobe. Clears when Adobe accepts other MCP clients. The agent
  file, the direct server entry and its sign-in were removed again (`claude mcp logout`, then
  `remove`).
- `allowedMcpServers` with the connector's name blocked the connector too, so the child
  session's settings deny the other connectors by name. A connector added in claude.ai later
  loads into the child (it cannot be called: no rule allows its tools); the script then ends
  with exit code 3 and names it, until it is added to `OTHER_CONNECTORS`.
- The connector reaches a new session a moment after it starts. A session that got its prompt
  at once had no ToolSearch and no Adobe tool, and gave up with exit code 0. The script now
  holds the prompt back until the debug log shows the connector connected.

**Not proved.** A photo run through the script: no upload was made in this job, because none
was asked for. The first real one needs the owner's yes, and will show which asset tools an
upload takes and which steps (a PUT to a presigned link, a download) the calling chat does
itself, since the child has no shell. The connector's calls still report no cost: unsettled.

**Evidence and copies.** `~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-connector-on-demand/`
(the proof run, the limit runs, the three connection logs of the dead end, the tool names). The
removed agent file and sign-in folder, and a copy of the unchanged settings file:
`~/.local/share/backups/adobe-connector-20261115/`.

**From the entry below (#54).** It merged as `b75dbaf`; the release check of that commit is
`verified` (execution 1530).

**Outstanding.**
- The first photo run through the script: it needs the owner's yes, and will show which asset
  tools an upload takes and which steps the calling chat does itself.
- The Adobe plan started as a 7-day trial on 10 November 2026 and turns paid on day 7. Keeping
  or cancelling it is the owner's decision.
- The merge commit and the release check of this pull request go into the next Cookbook pull
  request.
- Next job, in its own chat: a fixed set of tasks measured before and after.
- Stagehand's review date is 28 November (`connector-register.md`): with calls from only one
  or two projects it moves to project scope.
- The Proton Pass CLI was reported signed out by the daily update check on the morning of
  15 November; not rechecked.
- `dispatch-profiles.md` and `connector-register.md` (about 10 KB each) are still read in
  ranges.
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- Not retried: the Claude API's token counter for measuring what a file costs a session. It
  needs a workspace ID in the request (see the entry below).

## 15 November 2026 (evening): the visual check has its row and its pages (0.30.2)

**The map.** The row "Visual check of a live site before a customer-visible change" no longer
says "being built". Its owner is the site's own check script, in the site's repository; its
fallback is to ask the owner; its page is `recipes/visual-check.md` (when a pass lifts the
stop, how to use a check, what a pass never covers), with `recipes/visual-check-build.md`
(how a site gets one: the four layers, the capture traps, the proofs, the record). Both are
general. What is specific to the first site stays in that project (`CLAUDE.md`, section
"Visual check", and the findings file of the job that built it), where the check was built and
proved on 15 November 2026.

**The stop is not loosened.** The page quotes the owner's global rule (15 November 2026,
"How we work", stop 3): "A change customers see on a live site (Wix, Shopify or any other
host), unless that change has passed the site's visual check: screenshots at desktop and
phone size, judged against the intended design by an agent that did not build the change.
Until a site's check is recorded in that project's `CLAUDE.md` and the owner has said yes to
it once, always ask." The page adds limits and takes none away: this page lifts no stop, a
check that merely exists lifts none, and a change to a check's thresholds, routes, judge or
pass rule needs the owner's yes. The ground rules in `SKILL.md` are unchanged.

**Two owner answers, asked with the question tool in this chat (15 November 2026).**
- Stagehand. Asked "Remove it?", with the finding that nothing uses it and the recommendation
  to remove it. Answer: "so i want to keep stagehand and use it instead of playwright, theot3
  also said it is faster and better." Asked again, with the correction that the other chat
  found Stagehand better than the `browse` CLI and not better than Playwright, and that for
  the visual check it cannot open a local build, ignored phone emulation and runs only
  inside a session: "So where should Stagehand be used?" Answer: "In-session browser work
  (Recommended)". So Stagehand stays installed (nothing was uninstalled) and has a job: the
  map row "Several steps on a public page inside a session", with the `browse` CLI as its
  fallback. `browse` keeps "A public page from a script, or one step". The visual check
  stays on the site repository's Playwright.
- The Wix page. `recipes/wix-ask-first.md` said to ask before every publish or release, which
  is stricter than the global rule and held beside it. Asked "May the Wix page name that one
  exception?" Answer: "Name the exception (Recommended)". The page now excepts a release of
  a code change that has passed the site's visual check, where the check and the owner's yes
  are recorded in the project's `CLAUDE.md`; publishing from the editor or the dashboard and
  creating a site still ask.
- The rollback after a failed check is not a new exception. It is the owner's global rule
  (15 November 2026, "How we work"), quoted: "A failed release check means: roll back to the
  last good version first, then fix through a new pull request." `recipes/ci-releases.md`
  already held it; the two pages now quote it and limit it to the version that was live
  before the release, with the owner told at once. (The AI review's first round asked for
  this.)

**What uses Stagehand, checked on this PC.** Only its own user-scope MCP entry. No hook,
script in `~/.local/bin`, scheduled task or project file names it. Its tools were called 18
times, all in the first site's project on 14 and 15 November (the screenshot trial of job 25).

**Verification.** `npm test` passes. Three review rounds were set before the first push.
Before it, a `cookbook:review` subagent that did not write the change read the diff: no stop
loosened, three gaps closed (release exactly the build that was judged; a change to what the
capture hides or skips needs the owner's yes; `recipes/workflows.md` and
`recipes/cloudflare.md` now also name "recorded in the project's `CLAUDE.md` with the
owner's yes"). Evidence of the Stagehand check and the owner's answers:
`~/.local/share/claude-cookbook/evidence/2026-11-15-visual-check-recipe/`.

**Corrections to the entry below (#53).** It merged as `987bbea`; the release check of that
commit is `verified` (execution 1528; `sa-release` itself ended `unknown` for the skipped
`ai-review` job, as on every merge commit). Plugin 0.30.1 was installed the same evening.
Its numbers are now the final ones, and its "dead end" is corrected: a workspace ID for the
`anthropic-api` key can be read with `depot ci vars list --repo <the first site's repository>`
(variable `ANTHROPIC_WORKSPACE_ID_REVIEW`), as that site's check does.

**Outstanding** is carried in the entry above.


## 15 November 2026 (later): the global rules file is cut to the hard rules (0.30.1)

**On this PC.** The owner's global `~/.claude/CLAUDE.md` now holds the machine's hard rules,
"How we work", the sign-in rule and one paragraph that points at the Cookbook. It went from
36,078 to 8,411 bytes (9,201 before the four rules below left it, once 0.30.1 was
installed). Measured in a new headless session with no tools and no MCP servers: the
session's input fell from 18,233 to 8,435 tokens, so 9,798 fewer at every session start. In
the measure the job was set in (about 4.24 bytes a token) that is about 8,500 to about
2,000; the model's own count is higher on both sides.

**Nothing was loosened.** Every stop and every "never" of the old file is listed with where it
lives now in `placement.md` (evidence folder below): kept in the global file, held by
`SKILL.md`, or held by a recipe page. The stops the old file had in three places (an access
change, an uninstall, an update that is not routine, a security finding, a first publication, a
message to other people) are now in its one stop list. The owner answered three questions
before the file was saved (15 November 2026):
- "May they leave the global file?" about the rules held only on a recipe page: "Yes, a page
  counts".
- "Update the installed plugin to the newest version after the pull request is merged and
  verified?": "Yes, update it".
- "Correct the page to match the global rule?" about `recipes/sign-ins.md`, which said Claude
  never adds a vault item, against the owner's global rule of 14 November 2026 ("Claude can
  add to the vault itself ... That covers a login for a user made for Claude. A login that is
  the owner's own ... is still added by the owner, never typed in chat."): "Yes, correct the
  page". The page now says that and no more: Claude still never edits or moves an item, and
  each new login needs the owner's yes to that login in the current chat (added after GitHub's
  security review asked for a gate at the moment of creation; the global rule already says a
  route is set up "on the yes").

**In this pull request.**
- Four rules that were in the global file and on no page are on their page: `firecrawl.md`
  (an agent run's `effort`, a monitor's schedule and monthly estimate), `code-navigation.md`
  (`set_workspace`, `remember`, private data), `research.md` (Parallel's keys, monitors and
  private uploads) and `judgement.md` (community demos, literal fallbacks). Each adds a limit.
- The map row "From a finished change to a merged pull request" is decided: `sa-release` with
  `merge: true`. The comparison with tstack's `full-send` (Stack-Atlas's `HANDOFF.md`,
  15 November 2026) is summed up in `options/ship.md`; what it taught is in
  `recipes/ci-releases.md`: three review rounds set up front, a pull request the AI review can
  read whole, and one reviewer that did not build a large change.

**Proved with a new session** (headless, the Skill tool only): it listed the five headings of
the new global file, quoted the credential and Sophos rules, counted seven stops, and loaded
the `cookbook` skill from the installed 0.30.0. The installed plugin was 0.29.0 when this job
started and 0.30.0 when that session ran: the chat that merged #52 installed it on the owner's
yes.

**Memory indexes.** Stack-Atlas's went from 18,165 to 5,635 bytes and Probiz's from 16,117 to
4,624: one short line per memory. Where a long line named something its memory file did not,
the line's text was added to that file (13 files). Removed, because wrong or about something
that is gone: `jev-router-setup`, `claude-code-addons`, `claude-compaction-plugins` (it said
Jev compaction runs in Stack-Atlas only), `deploy-approval-timing`, `fixer-paid-checks` and
`autonomous-queue-oct21` in Stack-Atlas's memory, and `control-room-handoff-pause-gate` (Magic
Workflow). Three indexes that held prose and no memory are empty.

**Evidence and copies.** `~/.local/share/claude-cookbook/evidence/2026-11-15-global-claude-md-diet/`
(`placement.md`, the new file, the four measurement runs and the proof session's answer). A
copy of the old global file, every memory folder as it was and the removed memories:
`~/.local/share/backups/claude-md-diet-20261115/`.

**Done after the merge.** Once 0.30.1 was installed, the last section of the global file
("Job rules the Cookbook does not hold yet", four lines) was deleted, because the pages hold
them. The token counter of the Claude API was not used for the measurement: the
`anthropic-api` key needs a workspace ID on every request (how to read one is in the entry
above).

**Outstanding** is carried in the entry above.

## 15 November 2026: the tools without a job are removed (0.30.0)

**Merged and verified.** Pull request #52, merge commit `8f464e0`. The release check of that
commit is `verified` (execution 1512).

**The owner's decision this follows.** After the map was merged, the owner was asked one
question that listed every installed tool the map gives no job, with a recommendation per
tool. The owner answered "All as recommended" (15 November 2026). That answer is the yes for
the uninstalls below and for nothing else. An uninstall is one of the stops in the ground
rules; it was asked and answered, and no stop is changed here.

**Removed from this PC and from the Cookbook** (catalog, map, pages, the update check's
tables and the tests that named them):
- Jev Router: the plugin `jev-turn-router` and the `jev-claude` terminal proxy with its shims
  and checkouts. The DPAPI key `jev-compaction` stays: Jev compaction uses it.
- savvy-flow and savvy-progress; be-ambitious and gauntlet-loop; skill-creator-plus;
  claude-reflect and its stray rule file; self-compact-claude; cache-tax and prompt-band.
- The Adobe for creativity connector and plugin: switched off on this PC. The connector
  itself is disconnected in claude.ai's settings, which only the owner can do.
- Files left from tools retired earlier, in `~/.local/bin`, and two marketplaces left
  registered from tools retired earlier.

Kept, and not part of the answer: Stagehand (it waited for the visual check), Adobe Firefly
(the photo route), doctor-plus, and everything else.

**How it was done.** Each item was checked first: no hook, MCP entry, scheduled task, other
plugin, vetting script or update script used it. A copy of every removed file and folder is in
`~/.local/share/backups/cleanup-20261115/`. Gitleaks scanned it: 29 matches, every one in a
test file of two public upstream clones (caveman, claude-reflect), none in a file of the
owner's; the two retired `.exe` files were too large to scan.

**One thing did depend on a removed tool.** The daily update check proved that Jev answers by
reading the Jev Router's decision log. It now reads the Jev compaction plugin's log
(`jev-compaction-decisions.jsonl`): a `kind: "compact"` row with the outcome `jev` inside 48
hours is the proof. Without one, Jev is reported "unchecked", never "working", as before.
The check is not looser: the old log had held no answer since 9 November, because the router
skipped every T3 Code session. A trial run (`updates.mjs run --state`, 15 November) reports
Jev as working again and nothing new as missing or unlisted.

**Checked afterwards.** `claude plugin list` shows none of the removed plugins; a new session's
tool, skill and command lists name none of them; that session wrote a Jev compaction `load`
line and `ctx_resume` answered in it; `npm test` passes.

**Pages.** `recipes/add-ons.md` keeps doctor-plus and the rule against blast-radius;
`add-ons-mods.md`, `jev-router.md`, `jev-router-terminal.md` and `photos-adobe-connector.md`
are deleted. The map row "The model for a session or a piece" has no fallback and no page.

**Outstanding** is carried in the newest entry. Still true from this entry: "Adobe for
creativity" is blocked in terminal and T3 Code sessions only (`claude.ai Adobe` is in
`deniedMcpServers` in `~/.claude/settings.json` and the synced plugin is disabled; a new
headless `claude -p` session on 15 November listed it as blocked). The desktop app ignores
`deniedMcpServers` for the connectors it delivers, so a desktop session still loads its
tools. The upload gate in `recipes/photos.md` covers them: no photo goes to Adobe by any
route without the owner's yes.

## 15 November 2026: the map and the recipe split (0.29.0)

**Merged and verified.** Pull request #51, merge commit `74f676c`. The release check of that
commit is `verified` (execution 1509). The owner gave two answers that day: merge #51 without
the release-notes filter, and "All as recommended" on the tools without a job (the entry
above).

**What changed.** The `cookbook` skill's `SKILL.md` went from 94,928 to about 11,000 bytes. It
now holds the map (every job, one owner, one fallback, the recipe page) and the ground rules.
Each recipe is a page in `plugins/cookbook/skills/cookbook/recipes/`, read when its
job comes up; `options/` (5 pages) holds why each owner was chosen and what else was weighed.
`scripts/check.mjs` checks the map, every link, that no page is orphaned, and that a page fits
one `Read`. The update reader (`updates.mjs`) takes a tool's recipe from the pages
(`recipeText`): only the recipe's main page goes into the read request, fenced as data with a
hash of its own; setup and evidence pages (this PC's paths and key names) stay out.

**Why pages are small.** context-mode cuts any tool result over 4,096 bytes (measured: 4,105
was cut). A page is limited to 4,000 bytes as a `Read` result; a recipe's further pages are
named `<recipe>-<part>.md`. The Skill tool is not cut, which is why `SKILL.md` loads whole.

**Checked on this PC, and written into the map.**
- Compaction: Jev compaction (`fast-jev-compaction-atlas`) compacts, in T3 Code too: 40
  compactions from 7 to 14 November, 32 by Jev and 8 by the built-in compactor (6 errors, 2
  below the minimum). Log: `~/.claude/vendor/compaction/state/jev-compaction-decisions.jsonl`.
- Schedulers: Windows Task Scheduler runs plain scripts (`stack-updates-daily`); T3 Code
  scheduled tasks own agent runs (a `once` probe ran in its own thread and answered in 25
  seconds; the task, its worktree and branch are removed); three Claude Desktop tasks still
  run there and move when next touched.
- tstack against the `sa-*` route: the comparison is not in Stack-Atlas's `HANDOFF.md`, so the
  map row says "decided after the comparison"; `sa-release` owns the step until then.

**The owner's decision this follows** (15 November 2026, the owner's global rules, section
"How we work: the owner sets the outcome, Claude ships it", quoted): "Do not ask for approval
of a spec, a plan, a design option, a merge or a deploy. Ask a question only when the outcome
itself is unclear." and "Where a project file still asks for a yes before a spec, plan, design
choice, merge or deploy, this rule wins; correct that file in the next pull request to that
repository." This pull request is that correction for the Cookbook. The live-site stop is
worded wider than before (any host, not only Wix and Shopify).

**Aligned with "How we work" (owner, 15 November 2026).** The ground rules, the workflow
stops, the Cloudflare deploy line and the design-approval lines now say what the global rules
say: no approval for a spec, plan, design, merge or deploy; the stops stay. A security finding
is fixed or goes to the owner; "answered" never clears one.
