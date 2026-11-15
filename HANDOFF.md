# Handoff

## 15 November 2026: the map and the recipe split (0.29.0)

**What changed.** The `cookbook` skill's `SKILL.md` went from 94,928 to about 11,000 bytes. It
now holds the map (every job, one owner, one fallback, the recipe page) and the ground rules.
Each recipe is a page in `plugins/cookbook/skills/cookbook/recipes/` (51 pages), read when its
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
  below the minimum). `self-compact-claude` only carries a note. Log:
  `~/.claude/vendor/compaction/state/jev-compaction-decisions.jsonl`.
- Jev Router does not route in T3 Code: every T3 prompt from 11 to 15 November is
  `skipped`/`headless`; the last routed turn is from 9 November. Log:
  `~/.claude/vendor/compaction/state/jev-turn-router-decisions.jsonl`.
- Schedulers: Windows Task Scheduler runs plain scripts (`stack-updates-daily`); T3 Code
  scheduled tasks own agent runs (a `once` probe ran in its own thread and answered in 25
  seconds; the task, its worktree and branch are removed); three Claude Desktop tasks still
  run there and move when next touched.
- claude-reflect duplicates auto-memory: its one save (14 November) is in
  `C:\.claude\CLAUDE.md`, a file nothing reads.
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

**Outstanding.**
- The owner's answer on the tools the map leaves without a job (nothing was uninstalled).
- The visual-check row is "being built": its recipe arrives from the chat that builds the
  visual check for live sites.
- The tstack comparison, then one edit of the map row and `options/ship.md`.
- `dispatch-profiles.md` and `connector-register.md` (10.7 KB each) are still read in ranges.
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- `recipes/sign-ins.md` still says Claude never adds an item to the vault; the owner's global
  rules (14 November 2026) say Claude adds logins for users made for Claude. Changing the
  page widens what a rule file allows, so it needs the owner's yes: left unchanged here.
- Next job: the diet of the global `CLAUDE.md` and of the memory index.
