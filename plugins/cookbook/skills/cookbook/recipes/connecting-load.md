# What a server costs a session start, and how it loads

Measured on 16 November 2026 (Claude Code 2.1.325, Opus 5.5, tool search on): the input tokens
of a new session's first request, every server on, against one left out. Repeats agreed to
within 10 tokens. With all nine servers 67,356; with none 48,100.

| Server | Tokens | Sessions that called it (of 557, 30 days) | Loads |
| --- | --- | --- | --- |
| firecrawl | 11,407 | 35 | deferred since 16 November: 1,376 now |
| OpenSEO (plugin) | 2,303 | 32 | in its projects only since 16 November |
| parallel-search (plugin) | 1,783 | 75 | every session |
| Claude Docs (claude.ai) | 1,656 | 5 | every session (owner: leave) |
| graphify | 965 | 78 | every session |
| context-mode (plugin) | 885 | 79 | every session |
| cloudflare (plugin) | 91 | 10 | every session (owner: leave) |
| cloudflare-docs | 52 | 10 | every session (owner: leave) |
| stagehand | 39 | 1 | every session (owner: leave) |

After the two moves a session start is 55,308 tokens: 12,048 fewer. T3 Code's own server is
not in a headless run and was not measured.

- **What costs.** Tool search already keeps a tool's definition out until it is needed: a
  server costs its tool names and its instructions. The rest is tools its author marked to
  load in full (five of Firecrawl's: 10,031 tokens).
- **Measure before moving**: `scripts/measure/servers.mjs` in the Cookbook repository
  (`run --arm all`, `without:<server>`, `plugin-off:<plugin>`, `defer:<server>`, then
  `report`). Under about 100 tokens, leave the server alone. Which servers move is the
  owner's choice: ask once, with the saving, the use and what the move costs.
- **Three ways out of a session start, lightest first.**
  1. `"alwaysLoad": false` in the server's own entry (user scope, `claude mcp add-json`;
     Claude Code 2.1.287 or later). It stays connected and every tool waits behind tool
     search: call `ToolSearch` with `select:<tool name>` first. A plugin's server and a
     claude.ai connector have no entry of the user's, so this is not for them.
  2. A plugin off in the user settings and on in a project's `.claude/settings.local.json`
     (`"enabledPlugins": {"<plugin>@<source>": true}`): OpenSEO, Wix, Aikido. The file is
     not in git, so a T3 worktree thread does not have it: open the chat in the project
     folder. A deny in `deniedMcpServers` cannot be lifted by a project.
  3. A child session that loads the one server
     ([Adobe](photos-adobe-connector-setup.md)). For a plugin switched off:
     `claude -p --setting-sources "" --plugin-dir <the plugin's folder under
     ~/.claude/plugins/cache>`; OpenSEO connected that way with its stored sign-in (no call
     was made). Write the limits as the Adobe script does before a real run.
