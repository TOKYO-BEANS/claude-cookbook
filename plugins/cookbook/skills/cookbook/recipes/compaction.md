# Compaction

One compactor, checked on 15 November 2026 in
`~/.claude/vendor/compaction/state/jev-compaction-decisions.jsonl`.

- **Jev compaction compacts.** The plugin `fast-jev-compaction-atlas` (version 0.4.1, local
  `claude-local` marketplace) loads in every session, T3 Code sessions included (the log calls
  them `headless-or-sdk`), and compacts at 60 % of the context. From 7 to 14 November it ran 40
  compactions: 32 by Jev and 8 handed to Claude Code's built-in compactor.
- **The fallback is automatic.** When Jev's call fails (`error`, 6 of the 8) or would remove
  less than 25 % (`below-minimum`, 2 of the 8), the built-in compactor runs instead. Nothing
  has to be done by hand.
- **It sends transcript content to TypeSafe**, on the `jev-compaction` DPAPI key. It runs in
  every project (owner decision, 2 October 2026); a project is left out through the plugin's
  `privateRoots` option. Never go back to version 0.3.0: it checked only the current folder.
- **After a compaction or a resumed session:** `ctx_resume` (context-mode) gives the last
  task, changed files and open errors. Read it before repeating earlier work.
- **When compaction looks wrong:** read the log first. `kind: "compact"` rows carry the
  trigger (`precompute`, `auto`, `manual`), the outcome (`jev` or `builtin`, with a reason)
  and the reduction; no row holds transcript text.
