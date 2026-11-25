# MCP features: what we use

Anthropic's "MCP turns two" release (24 November 2026), checked on Claude Code 2.1.332 on 25
November 2026 ([docs](https://code.claude.com/docs/en/mcp)). Our servers need nothing turned on
for any of them.

- **Skills over MCP** (public beta; needs 2.1.331). A server serves skills, named
  `<server>:<skill>` (`plugin_<plugin>_<server>:<skill>` for a plugin's server). They load in an
  interactive terminal or local desktop session on the plan login, never in `claude -p`, the
  Agent SDK (so not in T3 Code), cloud sessions or behind a custom `ANTHROPIC_BASE_URL` (the
  subscription proxy). Measured: the Cloudflare plugin's server serves 24 skills, 22 of them
  the plugin's own; a terminal session listed both copies, `claude -p` the plugin's 22 only. A
  `deny` rule `Skill(mcp__<server>__*)` left the server's skills in the model's list;
  `skillOverrides` `"off"` (what `/skills` writes) took them out. The user settings turn the 22
  duplicates off (machine-setup #51) and keep `artifacts` and `flagship`, which only the server
  has. The plugin's copy stays: it is the one that loads where we work, and a plugin's skills go
  only with the plugin and its server.
- **Tasks** (generally available). A server answers a long call with a task it runs itself.
  Terminal sessions take one from any server that offers it; an Agent SDK session only with
  `CLAUDE_AUTO_BACKGROUND_TASKS=1`, which T3 Code does not set, so there a call stays a plain
  tool call. No server of ours is known to answer with tasks; Firecrawl's agent and crawl keep
  their own status tools.
- **Elicitation** (generally available). A server asks for input mid-call: a form, or a link to
  open (a sign-in). Claude Code shows the dialog; an `Elicitation` hook could answer one
  unattended, and we have none.
- **File uploads** (coming soon). Nothing until it ships; `stack-updates` follows Claude Code.

## A server's skills replace ours

When a server we use serves a skill for a job that one of our own skills does, retire ours in
the pull request that records it, so one copy is listed. First prove with a run that the
server's skill is listed in a T3 Code session; until server skills load there, ours stays and
this rule waits. Our command-line tools and scripts stay (`gh`, `depot`, `with-key.mjs`): a
skill says how, a CLI is what runs. A plugin that ships the same skills as its server keeps its
copy, and the server's duplicates are turned off with `skillOverrides`.

The daily update check asks Firecrawl's and Parallel's servers `skills/list` with no key and
reports one that starts serving skills (none on 25 November 2026). Graphify answers only after
a sign-in, so check it by hand at its releases with `ListMcpResourcesTool` (docs resources only
on 25 November 2026).

Anthropic's "code execution with MCP" (November 2025): tool search and context-mode give both
its gains.
