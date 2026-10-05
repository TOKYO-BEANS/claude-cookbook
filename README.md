# claude-cookbook

One skill, **cookbook**, for Claude Code: which tool, skill or workflow to use for which task, how to use it without the usual mistakes, and `catalog.json`, the list of tools in the stack that Stack Atlas follows.

## Install in Claude Code

```
/plugin marketplace add TOKYO-BEANS/claude-cookbook
/plugin install cookbook@claude-cookbook
```

Installed at user scope, it is available in every project. Claude loads it at the start of non-trivial
tasks and whenever it picks a tool.

## Keep it current

`plugins/cookbook/catalog.json` is the list of tools in the stack, and Stack Atlas follows it. Change it together with `SKILL.md` in a pull request, run `node scripts/check.mjs` and `node --test`, bump `version` in `plugins/cookbook/.claude-plugin/plugin.json`, then run `claude plugin update cookbook@claude-cookbook`.

Nothing here is private: no keys, account ids, paths or project data. Personal and project rules stay in
your own `CLAUDE.md` or `AGENTS.md`.
