# 20 November 2026: the plugin's hook commands start `node` and `bash` by name, and stay so

**Why.** The migration audit of 20 November 2026 set `plugins/cookbook/hooks/hooks.json` beside
the owner's machine rule: "Use absolute paths in MCP header helpers and hooks [...]: the
desktop app starts them with a minimal `PATH`." The nine commands start `node` (eight) and
`bash` (one) by name.

**What changed.**
- The owner's answer, 20 November 2026 (question dialog in the chat that closed the audit's
  Cookbook findings): "No: plugin hooks by name". The rule holds for starters written on one
  machine (a header helper in `~/.claude.json`, `.mcp.json` or Codex's `config.toml`, a
  launcher in `~/.local/bin`, a systemd unit: `recipes/keys.md`, `recipes/pinned-copies.md`,
  `recipes/scheduled-runs.md`), not for the hooks file the plugin ships to every machine that
  installs it. One shipped file names `/usr/bin/node`: the cookbook skill's
  `scripts/agentshield/scan.sh`, copied to one machine for a scheduled run; it falls back to
  `PATH`.
- `scripts/check.test.mjs`: one test. Every command in `hooks.json` is `node` or `bash` by name
  with a script under `${CLAUDE_PLUGIN_ROOT}/hooks/`; a machine path fails. A hook in exec form
  (`args`) will fail it too: widen the pattern then.
- This replaces two notes in the closed `HANDOFF.md`, written on Windows (lines 578-583: the
  Codex start gate's command was `C:/Program Files/nodejs/node.exe`, to clear with "a launcher
  that finds Node"; line 1287: "aligning [the SessionStart hook] with the absolute path is its
  own small change"). On Linux Node is the system package in `/usr/bin`, which every `PATH`
  measured holds: no launcher is needed and nothing is left to align.

Why by name:
- The rule's reason is met without a path. Measured: T3 Code's own `PATH` is the system
  folders; the Claude Code processes under it have `~/.local/bin` in front, and a hook inherits
  that (`sh -c` with Claude Code's environment). `node` 26.13.1 (NodeSource) and `bash` are in
  `/usr/bin`, with no other `node` or `bash` ahead of them.
- A machine path in this file failed once: until #154 five commands named
  `C:/Program Files/nodejs/node.exe`, and on Linux none of them ran.
- On the CI runner Node is not `/usr/bin/node` (`setup-node` puts it in the tool cache).
- Claude Code's own plugin example is `node "${CLAUDE_PLUGIN_ROOT}"/scripts/format.js`.

**Verification.** `node --test scripts/check.test.mjs`: the new test passes with all nine
commands; `/usr/bin/node ...`, the old Windows path and a script outside the plugin root fail
the pattern. The full `npm test` is the pull request's CI.

**Outstanding.**
- Not measured: the `PATH` the Claude desktop app gives a hook (installed, never opened). T3
  Code, started from the desktop, has the desktop session's `PATH`, which holds `/usr/bin`.
  Clears with one look at a session started there.
- A `node` ahead of `/usr/bin` on a session's `PATH` would be the one the hooks start;
  `~/.local/bin` is first there and is npm's global folder. None today; nothing checks it.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-audit-findings/item6-hook-paths.md`
(the measurements with their commands, and the second check).
