# Scripted Claude Code runs (`claude -p`)

From a local test of 94 headless runs (Claude Code 2.1.314, October 2026). Each rule here was broken
at least once in that test.

- Pass every limit on the command line: `--model`, `--permission-mode` (`dontAsk` or `default`, each
  with `--allowedTools`, or `acceptEdits`; never `bypassPermissions` or
  `--dangerously-skip-permissions`), `--max-budget-usd` and `--no-session-persistence`. Without the
  last, the transcript is saved under `~/.claude/projects`.
- Load only what the job needs: `--tools` lists its built-in tools, `--strict-mcp-config` with
  `--mcp-config` its MCP servers. A `--setting-sources` list without `user` also drops the user deny
  rules, so drop `user` only with both limited to the job.
- `--tools ""` is not the whole story (Claude Code 2.1.323, 13 November 2026): the run is still
  offered a server-side advisor tool that the stream's tool list does not show, only a
  `--debug-file` log; `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` (not in `--help`) removes it.
  `--setting-sources ""` is what keeps user plugins from loading and their prompt hooks from
  receiving the prompt. `apiKeySource` in the stream's init event shows whether the run is on the
  plan login (`none`) or on a key.
- A run that loads MCP servers holds its prompt back until they have connected
  (`--input-format stream-json`, the prompt written to stdin once a `--debug-file` log shows
  `MCP server "<name>": Successfully connected` for each). A prompt sent at once is answered
  without the servers still connecting: runs then differ by thousands of tokens, and a tool may
  be missing. Held back, repeats agreed to within 10 tokens (`scripts/measure/servers.mjs`).
- A Bash result can end with a line the harness adds ("Shell cwd was reset to …"). A run told to
  end with a command's output copied it and dropped the output's first line until the prompt named
  both: keep every line from the first, leave out the harness line.
- The Claude API key (`anthropic-api` in the DPAPI store, the Ultra plan's monthly API credits) is for
  own scripts that call the Messages API only. Never Claude Code, `apiKeyHelper`, a global
  `ANTHROPIC_API_KEY` or a script that starts `claude`: Claude Code would bill the key, not the plan.
  It is a personal key not scoped to a workspace, so every request sends `anthropic-workspace-id`
  (a `wrkspc_` ID from the Console's Workspaces page; not a secret). The first such script,
  `~/.local/share/claude-api/caption/` (one-line image captions on `claude-haiku-5-5`), shows the
  pattern: run through `with-key.mjs anthropic-api ANTHROPIC_API_KEY`, the model named in every
  call, a per-run spend cap checked before each call, and each call's `usage` logged beside its output.

More: [permission rules and limits](scripted-runs-rules.md).
