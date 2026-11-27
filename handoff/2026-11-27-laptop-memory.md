# 27 November 2026: a slimmer TypeScript server, and threads away from the laptop

**Why.** The owner asked whether threads could start on boat or Depot so the laptop stops
throttling, then answered "do 1 and 2" in the question dialog: cut the laptop's load, and
weigh a remote host for threads. Measured: 10 of 13 GiB used, swap full, memory pressure
"full" about 29%.

**What changed.**
- The Cookbook plugin declares the TypeScript language server itself (`lspServers` in
  `plugins/cookbook/.claude-plugin/plugin.json`), with no syntax server and no typings
  installer. `typescript-lsp@claude-plugins-official` is turned off in
  `~/.claude/settings.json` after the merge (two plugins cannot both take `.ts`); copies before
  and after under `~/.local/share/claude-cookbook/agent-changes/2026-11-27/`.
  Undo: turn that plugin back on and revert this pull request.
- `catalog.json`: the Language servers tool no longer lists the official TypeScript plugin.
- `recipes/code-navigation.md`: the new server and its undo. `recipes/sandboxes.md`: the
  weighing of a whole thread away from the laptop.

**Verification.** The probe started the pinned server both ways on a Cookbook script: 688 MB
before, 286 MB after, hover and diagnostics the same. `claude plugin validate` passes;
`node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the pull request).
Sessions started after `claude plugin update` get the new server; running ones keep theirs.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-laptop-memory/` (README with
the measurements, `probe.mjs`). Release log: the `sa-release` run of this pull request.

**Dead ends.** Depot sandboxes and a remote T3 host for whole threads: both leave the plan
token readable on the remote machine (Depot's own Claude Code route needs Team or Enterprise).
The owner's 20 November and 26 November answers stand.

**Outstanding.** Cloud sessions (`claude --cloud`): the one Max route that keeps the token out,
not set up. It needs GitHub access granted to Claude (the owner's), and its sessions do not
show in T3's sidebar. Asked in the chat that made this entry.
