# Handoff

## 15 November 2026: the tools without a job are removed (0.30.0)

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

**Outstanding.**
- The owner disconnects "Adobe for creativity" in claude.ai (Settings, Connectors). Until
  then it is blocked in terminal and T3 Code sessions only: `claude.ai Adobe` is in
  `deniedMcpServers` in `~/.claude/settings.json` and the synced plugin is disabled (a new
  T3-style session on 15 November listed it as blocked). The desktop app ignores
  `deniedMcpServers` for the connectors it delivers, so a desktop session still loads its
  tools. The upload gate in `recipes/photos.md` covers them: no photo goes to Adobe by any
  route without the owner's yes.
- The Proton Pass CLI is signed out (the daily update check has reported it broken since the
  morning of 15 November, before this job).
- The merge commit and the release check of this pull request go into the next Cookbook pull
  request, as below for #51.
- The visual-check row is "being built": its recipe arrives from the chat that builds the
  visual check for live sites.
- The tstack comparison, then one edit of the map row and `options/ship.md`.
- `dispatch-profiles.md` and `connector-register.md` (about 10 KB each) are still read in
  ranges.
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- `recipes/sign-ins.md` still says Claude never adds an item to the vault; the owner's global
  rules (14 November 2026) say Claude adds logins for users made for Claude. Changing the
  page widens what a rule file allows, so it needs the owner's yes: left unchanged here.
- Next job: the diet of the global `CLAUDE.md` and of the memory index.

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
