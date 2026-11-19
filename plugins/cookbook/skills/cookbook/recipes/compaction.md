# Compaction

One compactor, checked on 19 November 2026 in
`~/.claude/vendor/compaction/state/jev-compaction-decisions.jsonl`.

- **Jev compaction compacts.** The plugin `fast-jev-compaction-atlas` (version 0.5.0, local
  `claude-local` marketplace) loads in every session, T3 Code and `claude -p` included, and
  compacts at 60 % of the context. Jev keeps the conversation word for word and drops the old
  tool calls and results it judges no longer needed, instead of writing a summary. Its first
  compaction on Linux removed 59 % (19 messages to 9) with one TypeSafe request.
- **The fallback is automatic.** When Jev's call fails (`error`, the key unreadable included),
  would remove less than 25 % (`below-minimum`), or the session is in a `privateRoots` folder
  (`private-root`), the built-in compactor runs instead. Nothing has to be done by hand.
- **It sends transcript content to TypeSafe:** user and assistant text, tool names and inputs
  (up to 1,000 characters each); tool results go as a one-line note. The key `jev-compaction`
  is read from the OS key store at call time, only by `with-key.mjs`, in a child process that
  posts the request: the session never holds it, and no file or setting does. It runs in every
  project (owner decision, 2 October 2026); a project is left out through the plugin's
  `privateRoots` option (folders separated by `;`; a session counts when its working folder,
  or the main checkout of its git repository, is inside one). Never go back to version 0.3.0:
  it checked only the current folder.
- **Updates:** the plugin is a pinned copy in the local `claude-local` marketplace
  (`~/.claude/vendor/compaction/local-marketplace/fast-jev-compaction-atlas`), with a
  `PROVENANCE.json` that names the upstream commit, what was left out (upstream's dev
  toolchain) and the local changes. Refresh it only after reading the upstream diff: update the
  copy, re-apply the listed changes, run `claude plugin test` on the folder, update
  `PROVENANCE.json`, run `claude plugin marketplace update claude-local` and `claude plugin
  update fast-jev-compaction-atlas@claude-local`, then record the commit with the
  `stack-updates` skill's `updates.mjs record jev/compaction <commit>`. A copy of the folder
  is kept in the `machine-setup` repository; the Windows build was lost when it was not.
- **After a compaction or a resumed session:** `ctx_resume` (context-mode) gives the last
  task, changed files and open errors. Read it before repeating earlier work.
- **When compaction looks wrong:** read the log first. `kind: "compact"` rows carry the
  trigger (`precompute`, `auto`, `manual`), the outcome (`jev` or `builtin`, with a reason)
  and the reduction; no row holds transcript text.
