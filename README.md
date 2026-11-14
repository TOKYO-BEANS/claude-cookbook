# claude-cookbook

Two skills for Claude Code. **cookbook**: which tool, skill or workflow to use for which task, how to use it without the usual mistakes, and `catalog.json`, the list of tools in the stack. **stack-updates**: the daily update check, which compares every tool in the catalog with its newest release and reports what changed, what is broken and which dates are close; it changes nothing. A Windows task runs it each morning with no model session, and the plugin's one SessionStart hook tells a new session when a report is waiting.

## Install in Claude Code

```
/plugin marketplace add TOKYO-BEANS/claude-cookbook
/plugin install cookbook@claude-cookbook
```

Installed at user scope, it is available in every project. Claude loads it at the start of non-trivial
tasks and whenever it picks a tool.

## Keep it current

`plugins/cookbook/catalog.json` is the list of tools in the stack. Change it together with `SKILL.md` in a pull request, run `npm test` (it runs `node scripts/check.mjs`, `node scripts/agents.mjs` for the dispatch profiles in `plugins/cookbook/agents/`, and `node --test`; CI runs it on every pull request), bump `version` in `plugins/cookbook/.claude-plugin/plugin.json`, then run `claude plugin update cookbook@claude-cookbook`. Each tool lists its installed `parts`: how the installed version is read (`installed`) and where its releases appear (`feed`: `npm`, `github`, `marketplace`, `commit`, `changelog`, `gitForWindows`, `jevModels`, `nodeDist`, or `none` with a reason; see `scripts/check.mjs` for the fields). Commands and the changelog host allow list live in `plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs`, never in the catalog.

Nothing here is private: no keys, account ids, paths or project data. Personal and project rules stay in
your own `CLAUDE.md` or `AGENTS.md`.
