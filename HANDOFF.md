# Handoff

## 15 November 2026 (night): a fixed set of tasks, measured before and after (0.30.3)

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
every run). Outside it, the void trial and the probes: USD 0.69.

**To measure a later change:** build the two sides (`git archive <commit> plugins/cookbook`
into `<side>/plugin`, the rules file as `<side>/work/CLAUDE.md`), then `probe`, `run` and
`report`. Results compare within one task set only: a changed task or check takes a new
`set` name.

**Verification.** `npm test` passes (315 tests, 8 new in `scripts/measure.test.mjs`). The 48
stored answers were scored again from the raw streams after the last change to the parser:
152 of 152, none moved.

**Evidence:** `~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`
(`RESULT.md`, `runs/report.md`, `runs/summary.jsonl`, one stream per run, both sides in
`arms/`, the void runs in `void/`).

**From #54** (the entry below). It merged as `b75dbaf`; the release check of that commit is
`verified` and acknowledged (execution 1530; `sa-release` itself ended `unknown` for the
skipped `ai-review` job, as on every merge commit). Plugin 0.30.2 was installed the same
evening and proved with a new headless session. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-15-visual-check-recipe/`.

**Outstanding.**
- The merge commit, the release check and the install of this pull request (0.30.3) go into
  the next Cookbook pull request.
- Not measured: the removal step by itself, and a session with every MCP server on (two such
  runs differ by thousands of tokens). A per-server measurement belongs to the on-demand job
  (memory `whole-design-one-owner`).
- Waiting on the owner, not to be redone: disconnecting "Adobe for creativity" in claude.ai
  (Settings, Connectors).
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- Stagehand's review date is 28 November (`connector-register.md`); the owner chose to keep
  it, do not ask again.
- Still open from #54: the Proton Pass CLI was reported signed out on the morning of
  15 November and not rechecked; `dispatch-profiles.md` and `connector-register.md` are
  still read in ranges; the Claude API's token counter was not retried.

## 15 November 2026 (evening): the visual check has its row and its pages (0.30.2)

**The map.** The row "Visual check of a live site before a customer-visible change" no longer
says "being built". Its owner is the site's own check script, in the site's repository; its
fallback is to ask the owner; its page is `recipes/visual-check.md` (when a pass lifts the
stop, how to use a check, what a pass never covers), with `recipes/visual-check-build.md`
(how a site gets one: the four layers, the capture traps, the proofs, the record). Both are
general. What is specific to wecarestudio.dk stays in that project (`CLAUDE.md`, section
"Visual check", and `jobs/25-visuelt-tjek/FINDINGS.md`), where the check was built and
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
times, all in the WeCare project on 14 and 15 November (the screenshot trial of job 25).

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
`anthropic-api` key can be read with `depot ci vars list --repo TOKYO-BEANS/WeCare-Wix`
(variable `ANTHROPIC_WORKSPACE_ID_REVIEW`), as the WeCare check does.

**Outstanding.**
- The merge commit and the release check of this pull request go into the next Cookbook
  pull request.
- Next job, in its own chat: a fixed set of tasks measured before and after.
- Stagehand's review date is 28 November (`connector-register.md`): with calls from only one
  or two projects it moves to project scope.
- Waiting on the owner, not to be redone: disconnecting "Adobe for creativity" in claude.ai
  (Settings, Connectors).
- The Proton Pass CLI was reported signed out by the daily update check on the morning of
  15 November; not rechecked.
- `dispatch-profiles.md` and `connector-register.md` (about 10 KB each) are still read in
  ranges.
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- Not retried: the Claude API's token counter for measuring what a file costs a session. It
  needs a workspace ID in the request (see the correction above).

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
