# 19 November 2026: Jev compaction is back on the Linux laptop

**Why.** Since the move from Windows the built-in compactor ran alone: the pinned copy of the
plugin under `~/.claude/vendor`, its `PROVENANCE.json` and the decision log were not
exported, so `machine-setup` dropped the `claude-local` marketplace and the update check read
`fast-jev-compaction-atlas@claude-local` as missing.

**The old local changes could not be recovered.** No copy of the Windows build (0.4.1), its
`PROVENANCE.json` or the log survives: not on disk, in the `machine-setup` export, in the
evidence folders, in memory or in any session transcript. What survives is the upstream commit
it ran, `e3f262a`, in Stack Atlas's daily-update-check spec. So the copy was built again from
upstream with only what Linux needs, and nothing else from the old list was guessed back in.

**What changed.**
- The pinned copy, `~/.claude/vendor/compaction/local-marketplace/fast-jev-compaction-atlas`
  (version 0.5.0), with a new `PROVENANCE.json`. It holds upstream's runtime files unchanged,
  `plugin.json` and `hooks/fast-jev.ts` changed, and engine tests in `hooks/fast-jev.test.ts`.
  Upstream's dev toolchain, tests, examples and demo are left out. The changes:
  - **The key:** each Jev request is posted by a child process started as `/usr/bin/node
    $HOME/.local/bin/with-key.mjs jev-compaction TYPESAFE_API_KEY /usr/bin/node -e <post>`,
    which refuses any origin other than `api.typesafe.ai`. Upstream's three plaintext routes
    are gone: the `apiKey` option, the session's environment variable, and `settings.json`
    `env`.
  - **The decision log:** one row per compaction in `.../state/jev-compaction-decisions.jsonl`,
    with counts and reasons and no transcript text.
  - **`privateRoots`:** folders separated by `;`. A session counts when its working folder, or
    the main checkout of its git repository, is inside one. The option is empty.
- The `claude-local` marketplace was added and the plugin installed for the user
  (`claude plugin marketplace add`, `claude plugin install --scope user`). `updates.mjs record
  jev/compaction e3f262a7f4d4...` was run, and the inventory now reads `jev/compaction` 0.5.0.
- `recipes/compaction.md`: the Linux facts. The key comes from the OS key store through
  `with-key.mjs` (it said DPAPI), with version 0.5.0, the `private-root` fallback, what goes to
  TypeSafe, `claude plugin test` in the update steps, and the `machine-setup` copy.

**Vetting.** Upstream main is still `e3f262a` (17 September), the commit Windows ran, so there
is no diff to read and the commit is past the 24-hour minimum. A reader agent read the whole
tree: one destination (`api.typesafe.ai`), no file writes, no process starts, no dynamic code,
and nothing high or critical in the runtime code.
- **Gitleaks:** 0 in the tree. 1 in history: AWS's published example key in an old test file,
  which is not in the copy.
- **OSV-Scanner:** 122 packages parsed, 16 advisories (4 critical, 2 high), all in upstream's
  vitest/vite dev toolchain. **Trivy:** 0 without dev dependencies, the same toolchain with
  them. Nothing from npm is installed: the copy has no `package.json`, lockfile or
  `node_modules`.
- **The pinned copy:** Gitleaks 0 and Trivy 0. OSV-Scanner reports "no package sources": the
  copy has no dependencies, so this is no result rather than a clean one.
- **Sandbox:** none. The plugin is the "plugin or skill" exemption.

**Verification.**
- `claude plugin validate`: hooks `session.compact` and `turn.complete`; calls
  `$.process.run`, `$.session.*`, `$.ui.*`; env read `HOME` only.
- `claude plugin test`: 5 of 5 pass (Jev path, unreadable key, private folder, worktree of a
  private repository, a folder outside `privateRoots`).
- **A real compaction**, in a `claude -p` session on the plan login with
  `--setting-sources ""` and only this plugin enabled. It ran in an empty scratch folder,
  reading public licence texts; a check run answered `NONE` for `CLAUDE.md` or memory text in
  context. The row: `outcome: "jev"`, trigger `manual`, 19 messages to 9, reduction 0.593, 1
  request. The key was found in none of the 33 files searched (the run, the vendor folder,
  settings and the plugin registry), counted by a script that never prints it.
- `node scripts/check.mjs` passes.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-linux-jev-compaction/`:
the scans, the proof rows and debug lines, the key search, `local-changes.diff`, and a copy
of the marketplace folder.

**Dead ends.**
- The first proof run wrote `builtin`/`below-minimum` with 0 requests. Its 5 messages all fell
  inside the 6 newest, which are never compacted (`preserveRecentMessages`). Seven tool turns
  fixed it.
- In the second run the model answered "Yes" when asked whether `CLAUDE.md` or memory text was
  in context. A direct check (quote any such text, or say `NONE`) answered `NONE`, so the
  "Yes" was a loose answer.
- `--bare` would keep `CLAUDE.md` out, but it only takes an API key. That is never used for
  Claude Code, so the run used `--setting-sources ""` with a `--settings` file instead.

**Outstanding.**
- Codex's `~/.codex/JEV.md` is lost with the rest: no copy or source exists, and
  `~/.codex/AGENTS.md` still points at it. Stack Atlas #236 pointed its own `AGENTS.md` at
  `recipes/judgement.md` instead; the same one-line change to Codex's global `AGENTS.md` (and
  its export in `machine-setup`) clears it. This is Claude's job in a `machine-setup` chat,
  not the owner's.
- The first compaction of an ordinary T3 Code session on this laptop has not been seen yet:
  the next T3 row in the log will show it. The `claude -p` proof ran the same plugin and
  launcher.
- Function hooks are an early-access surface. Upstream's types are from 2.1.274; this copy
  was validated and tested on 2.1.328. After a Claude Code update, run `claude plugin test`
  on the folder.
