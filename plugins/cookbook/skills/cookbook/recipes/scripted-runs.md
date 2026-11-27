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
- Claude runs only on the subscription, never on API usage (owner, 20 November 2026: "we should not
  run over API usage, only Claude Subscription Token"). There is no Claude API key and no Messages
  API call. A script that needs Claude starts a locked-down `claude -p` with the plan token (key
  store `claude-plan-review`, made with `claude setup-token` while signed in with the subscription
  account) as `CLAUDE_CODE_OAUTH_TOKEN` in that run only, in an environment built from nothing so
  no `ANTHROPIC_API_KEY` reaches it, and refuses a run whose `apiKeySource` is a key. The patterns
  are the `ai-review` job ([ai-review](ai-review.md)) and the judge of the first site's visual
  check ([how it is built](visual-check-build.md)): the model named in every run, a spend cap
  counted at API list rates (`--max-budget-usd`), and each run's usage logged beside its output.

A run that changes something people use (files, mail, data, a page) leaves a summary, the
changes and an undo: [agent-changes](agent-changes.md).

More: [permission rules and limits](scripted-runs-rules.md).
