# Context window (context-mode)

The owner added it on 5 November 2026 for every project and every new session: the
`context-mode@context-mode` plugin (marketplace `mksglu/context-mode`, version 2.1.0, licence
Elastic-2.0) at user scope. No project turns it off; a new project gets it without a step.

- **What it does:** a stdio MCP server (`node server.mjs`, 9 tool names) and hooks on SessionStart,
  UserPromptSubmit, PreToolUse and PostToolUse. A tool result over 8,192 bytes (Bash, PowerShell,
  Read, Grep, WebFetch and every MCP server, Firecrawl and Parallel included) is indexed and
  replaced by its best-matching lines and a search pointer. The Skill, Glob and Agent tools are
  not covered. The cut is `CTX_REPLACE_TRIGGER_BYTES`, set to 8192 in `env` of
  `~/.claude/settings.json` since 22 November 2026 (machine-setup #45: a 6,000-byte Bash result
  came back whole, and was cut with 4,096). The default, and a session started before then, cuts
  at 4,096. In 2.2.1 the value is the hook's cut only: in `server.mjs` it sizes the ranged-read
  probe (`READ_PROBE_LINES`) and does not limit `ctx_execute` output. Every page in `recipes/`
  and `options/` still fits one read under 4,000 bytes. The index is a local SQLite FTS5 store in `~/.context-mode`, outside
  `~/.claude`. Its only network calls are a version check against the npm registry
  and `ctx_index` fetching a URL it is given; no telemetry.
- **Use it:** when a step counts, sums, filters or finds something in more than about 20 lines of
  data, run it through `ctx_execute` (or `ctx_batch` for several commands) and print only the
  answer. `ctx_search` finds the rest of a result that was cut. Small output and edits use the
  normal tools. To read long texts whole (articles to understand, not search), a script saves
  them to the scratchpad in files under 3,700 bytes, read many to a message: 15 web pages,
  167 KB, took 48 reads in six messages (18 November 2026).
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
