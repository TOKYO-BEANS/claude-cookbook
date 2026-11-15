# Handoff

## 15 November 2026 (later): the global rules file is cut to the hard rules (0.30.1)

**On this PC.** The owner's global `~/.claude/CLAUDE.md` now holds the machine's hard rules,
"How we work", the sign-in rule and one paragraph that points at the Cookbook. It went from
36,078 to 9,201 bytes. Measured in a new headless session with no tools and no MCP servers,
two runs each side, within 5 tokens: the session's input fell from 18,233 to 8,709 tokens, so
9,524 fewer at every session start. In the measure the job was set in (about 4.24 bytes a
token) that is about 8,500 to about 2,200; the model's own count is higher on both sides.

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
  page". The page now says that and no more: Claude still never edits or moves an item.

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
started and 0.30.0 when that session ran; this job did not update it.

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

**Outstanding.**
- Once the plugin with this pull request is installed: the last section of the global file
  ("Job rules the Cookbook does not hold yet", four lines) is deleted, because the pages hold
  them then. Done in the same chat when the install is verified.
- The merge commit and the release check of this pull request go into the next Cookbook pull
  request.
- Dead end: the Claude API's token counter could not be used for the measurement. The
  `anthropic-api` key needs a workspace ID on every request and none is recorded on this PC.
  The owner's to clear: the ID from the Console's Workspaces page, saved as `workspace_id` in
  `~/.local/share/claude-api/caption/config.json`.
- The owner disconnects "Adobe for creativity" in claude.ai (Settings, Connectors).
- The Proton Pass CLI was reported signed out by the daily update check on the morning of
  15 November; not rechecked in this job.
- The visual-check row is "being built": its recipe arrives from the chat that builds the
  visual check for live sites. That chat is the next job; after it, a fixed set of tasks
  measured before and after.
- `dispatch-profiles.md` and `connector-register.md` (about 10 KB each) are still read in
  ranges.
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.

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

Kept, and not part of the answer: Stagehand (it waits for the visual check), Adobe Firefly
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

**Outstanding** is carried in the entry above. Still true from this entry: "Adobe for
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
