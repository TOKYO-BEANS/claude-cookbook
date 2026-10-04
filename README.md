# claude-cookbook

One skill, **cookbook**, for Claude Code and Codex: which tool, skill or workflow to use for which task,
and how to use it without the usual mistakes (research, web pages, code search, security scanning, CI,
Cloudflare, classification with Jev, project memory, debugging and the `sa-*` multi-agent workflows).

## Install in Claude Code

```
/plugin marketplace add TOKYO-BEANS/claude-cookbook
/plugin install cookbook@claude-cookbook
```

Installed at user scope, it is available in every project. Claude loads it at the start of non-trivial
tasks and whenever it picks a tool.

## Install in Codex

Codex reads the same `SKILL.md` format from `~/.codex/skills/`. Copy the skill folder there:

```
git clone https://github.com/TOKYO-BEANS/claude-cookbook.git
mkdir -p ~/.codex/skills
cp -r claude-cookbook/plugins/cookbook/skills/cookbook ~/.codex/skills/
```

On Windows PowerShell, use
`Copy-Item -Recurse claude-cookbook\plugins\cookbook\skills\cookbook $HOME\.codex\skills\` for the last
step. Restart Codex. To update, pull the clone and copy the folder again.

Everything except the `sa-*` workflows works in Codex; those need Claude Code's Workflow tool. The recipes
name tools and plugins, so install the ones you want (Firecrawl, Parallel, Graphify, Depot and so on) in
Codex as well.

## Keep it current

The recipes follow the tool catalogue in Stack Atlas. Change `plugins/cookbook/skills/cookbook/SKILL.md`
in a pull request, bump `version` in `plugins/cookbook/.claude-plugin/plugin.json`, then run
`claude plugin update cookbook@claude-cookbook` (Claude Code) or copy the folder again (Codex).

Nothing here is private: no keys, account ids, paths or project data. Personal and project rules stay in
your own `CLAUDE.md` or `AGENTS.md`.
