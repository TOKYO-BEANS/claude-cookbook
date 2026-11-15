# Model routing (Jev Router): the `jev-claude` terminal proxy

**In a terminal through a proxy: `jev-claude`.**
- Start `jev-claude` instead of `claude` in a terminal. One Jev call per new user turn picks
  Haiku, Sonnet or Opus from the account's own model list; tool-loop continuations keep that
  model. The status line shows the routed model and Jev's confidence, and `/jev-explain` shows
  why. Choosing a model in `/model` pauses routing; the "Jev Router" row resumes it.
- It can't serve the app: a folder's settings may not set `ANTHROPIC_BASE_URL` (Claude Code
  only lets project settings set an approved list of variables). The terminal CLI must be signed
  in (`claude auth login`, from a Start-menu PowerShell).
- Routing fails open: a Jev error or timeout keeps the current model. A prompt overrides Jev
  only with "use" or "switch to" followed by one model name, not negated and not inside code.
  Leave `JEV_ALLOW_FABLE` unset: Fable bills extra usage.
- To Claude Code the model is the unknown name `jev-router`, so a session gets a 200k context
  window (not `opus[1m]`'s 1M). Behind a custom base URL it also turns tool search off, which puts
  every MCP tool schema (about 220k tokens with the claude.ai connectors) into each request; the
  launcher sets `ENABLE_TOOL_SEARCH=true` to prevent that. A `-p` test with `--tools` must include
  `ToolSearch`.
- On a claude.ai login Claude Code fetches no model list through the proxy, so routing uses the
  fixed ids in `src/config.mjs` (`TIERS`). When Anthropic ships new models, update them there (a
  local patch with a test).
- On this PC: the checkout `~/.local/share/jev-router` is an upstream commit plus the patches in
  `~/.local/share/jev-router-patches` (local branch `local-<sha>`). `jev-claude` runs
  `~/.local/bin/jev-claude-secure.mjs`, which decrypts the DPAPI key into its own process only,
  reads no `.env` file, ignores `TYPESAFE_BASE_URL`, and gives Claude Code `--add-dir` for the
  skill folder `~/.local/share/jev-router-skill` only. Never follow upstream's README setup
  (`npm install -g`, a `~/.jev-router.env` key file).
- To update: review the new upstream range with `sa-review`, check out the exact commit, re-apply
  the patches (drop any that upstream fixed), run `npm ci --ignore-scripts` and `npm test`,
  compare `bin/jev-claude.mjs` with the launcher, then route one real prompt. Upstream does not
  accept Claude-written contributions; report bugs there as issues, and only with the owner's yes.
