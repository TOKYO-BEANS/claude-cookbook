# Agent configuration audit (AgentShield)

- Scan a sanitized copy of the agent configuration, never the live one with secrets in it.
- Findings are advisory: report what is new since the baseline; change nothing automatically.
- MCP servers, connectors and skills: `connector-register.md` in the skill's folder (read it 30
  lines at a time) lists what loads in
  every session, its calls over 30 days and the route from the order in [connecting.md](connecting.md). Redo it once a quarter and after adding a plugin or connector, with
  `scripts/usage-census.mjs` in the skill's folder (each `tool_use` id once: a count without that ran
  42.5% high). Flag a server that loads twice (a plugin copy and a connector copy), a server whose
  own instructions say it is deprecated, a large server only some projects use, and a server whose
  job a CLI already in the stack does (`gh` instead of the GitHub MCP; the `rea`, `firecrawl` and
  `parallel-cli` command lines). Each removal or scope change is standing configuration: the owner
  decides it. Measure the start before and after, as the register's last section says.
- Skills cost their description in every session: propose `"name-only"` in `skillOverrides` for a
  rarely used personal or bundled skill. A plugin's skills follow the plugin's scope
  (`enabledPlugins`, with `"<name>@synced"` for a plugin synced from claude.ai); `skillOverrides`
  does not reach them. The owner decides.
- Flag any `Write(...)` allow rule in a settings file: it never matches ([scripted-runs-rules.md](scripted-runs-rules.md)).
