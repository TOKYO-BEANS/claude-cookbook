# claude-cookbook

A Claude Code plugin with one skill, **cookbook**: which tool, skill or workflow to use for which task,
and how to use it without the usual mistakes (research, web pages, code search, security scanning, CI,
Cloudflare, classification with Jev, project memory, debugging and the `sa-*` multi-agent workflows).

## Install

In Claude Code:

```
/plugin marketplace add TOKYO-BEANS/claude-cookbook
/plugin install cookbook@claude-cookbook
```

Installed at user scope, it is available in every project. Claude loads it at the start of non-trivial
tasks and whenever it picks a tool.

## Keep it current

The recipes follow the tool catalogue in Stack Atlas. Change `plugins/cookbook/skills/cookbook/SKILL.md`
in a pull request, bump `version` in `plugins/cookbook/.claude-plugin/plugin.json`, and run
`claude plugin update cookbook@claude-cookbook`.

Nothing here is private: no keys, account ids, paths or project data. Personal and project rules stay in
your own `CLAUDE.md`.
