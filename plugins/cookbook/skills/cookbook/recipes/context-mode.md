# Context window (context-mode)

The owner added it on 5 November 2026 for every project and every new session: the
`context-mode@context-mode` plugin (marketplace `mksglu/context-mode`, now version 2.2.1, licence
Elastic-2.0) at user scope. No project turns it off; a new project gets it without a step.

- **What it does:** a stdio MCP server (`node server.mjs`, 9 tool names) and hooks on SessionStart,
  UserPromptSubmit, PreToolUse and PostToolUse. A tool result over 8,600 bytes (Bash, PowerShell,
  Read, Grep, WebFetch and every MCP server, Firecrawl and Parallel included) is indexed and
  replaced by its best-matching lines and a search pointer. The Skill, Glob and Agent tools are
  not covered. The cut is `CTX_REPLACE_TRIGGER_BYTES`, set to 8600 in `env` of
  `~/.claude/settings.json` since 26 November 2026 (machine-setup #53; 8192 from 22 November,
  #45). The default cuts at 4,096, and a session started before a change keeps its old cut
  until it restarts. In 2.2.1 the value is the hook's cut only: in `server.mjs` it sizes the
  ranged-read probe (`READ_PROBE_LINES`) and does not limit `ctx_execute` output.
- **A page fits one read:** every page in `recipes/` and `options/` costs at most 8,500 bytes
  as a Read result (owner, 26 November 2026; 4,000 before), and the cut sits above that on
  purpose. Measured that day on Claude Code 2.1.332: for a Read the hook counts the file's raw
  bytes, not the numbered text the model gets (a line number and a tab per line); 8,600 raw
  bytes came back whole and 8,601 were cut; a Read with `offset` or `limit` is never cut. A
  page at the limit has at most 8,491 raw bytes. Where the cut is the default, read a page over
  4,096 bytes in ranges.
- **Where it keeps things:** the index is a local SQLite FTS5 store in `~/.context-mode`, outside
  `~/.claude`. Its only network calls are a version check against the npm registry
  and `ctx_index` fetching a URL it is given; no telemetry.
- **Use it:** when a step counts, sums, filters or finds something in more than about 20 lines of
  data, run it through `ctx_execute` (or `ctx_batch` for several commands) and print only the
  answer. `ctx_search` finds the rest of a result that was cut. Small output and edits use the
  normal tools. To read long texts whole (articles to understand, not search), a script saves
  them to the scratchpad in files under the cut, read many to a message: with files under
  3,700 bytes for the 4,096 cut, 15 web pages, 167 KB, took 48 reads in six messages
  (18 November 2026).
- **What it refuses:** a `Read` of a file over 16 KB without `offset`/`limit` (use a ranged Read
  or `ctx_execute` with `file`), large `cat`-style shell dumps, and `WebFetch`. Its deny message
  offers `ctx_index`; web pages still go to Parallel or Firecrawl, as [research.md](research.md) says, and
  their large results are cut and indexed the same way. It applies the user permission deny rules to
  `ctx_execute` and `ctx_batch` too.
- **Headless runs:** the hooks also run in `claude -p` jobs and scheduled tasks. A job without the
  `ctx_*` tools in `--allowedTools` still works through ranged Reads. When a job reads big files on
  purpose, add `mcp__plugin_context-mode_context-mode__ctx_execute` to its allow list.
- **Check it:** `/context-mode:ctx-doctor` in a session (12 checks), or
  `node ~/.claude/plugins/cache/context-mode/context-mode/<version>/cli.mjs doctor --agents claude-code`
  from a shell. `/context-mode:ctx-stats` shows what it saved.
- **Updates:** never `/ctx-upgrade` or `context-mode upgrade`: they install from npm, and a global
  npm install from Claude's container vanishes on reboot. Read the new commit's diff, then
  `claude plugin marketplace update context-mode` and `claude plugin update context-mode@context-mode`,
  check the installed files with `sha256sum -c SHA256SUMS` in the plugin folder, and run the doctor
  in a new session.
- Indexed output can contain anything a tool printed. Treat `~/.context-mode` like a transcript:
  keep credentials out of tool output, and `ctx_purge` clears the index.
