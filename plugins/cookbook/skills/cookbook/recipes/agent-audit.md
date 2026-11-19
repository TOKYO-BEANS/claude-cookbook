# Agent configuration audit (AgentShield)

- Scan a sanitized copy of the agent configuration, never the live one with secrets in it.
- Findings are advisory: report what is new since the baseline; change nothing automatically.
- **The scan** is `scripts/agentshield/` in the skill's folder (tests:
  `scripts/agentshield.test.mjs` in the repository). `install.sh` copies it to
  `~/.local/share/stack-atlas/agentshield`; the T3 task "AgentShield weekly scan" (Mondays
  08:00) runs `scan.sh` there and triages by the rules in its prompt. A run checks the
  installed copy against its pin (version, lockfile, every file); copies a fixed list of files
  (own settings and instructions, MCP servers, installed plugins, each Desktop project's
  instruction and settings files) with credential values taken out; puts the copy through
  the sanitizer again, and anything it would still change stops the run; starts AgentShield
  under Node's permission model (Node 25 or newer: no network, no child process, one output
  folder), with `net-guard.mjs` counting the attempts it stops; deletes the copy; and writes
  `new-findings.md`, which starts with `NEW_FINDINGS`, `RESOLVED_FINDINGS` and `MODE`
  (`failed` from a run's start until it ends).
- **No list of credential shapes is complete.** The copy is best effort; what the scanner
  quotes is masked again, more strictly, before anything is written (`maskOutput`).
- **AgentShield is a pinned copy** in `~/.local/share/agentshield`: `ecc-agentshield@1.6.0`
  with zod, glob and minimatch overridden to their fixed versions (owner, 19 November 2026).
  An update: `pinned-vet.sh`, `pinned-install.sh`, the version line in `scan.mjs` through a
  pull request, then `scan.sh --pin`.
- **The baseline is the owner's:** `scan.sh --rebaseline` only on the owner's yes, never in
  a scheduled run (`--pin` neither). Without one a run reports the totals, the change since
  the run before and the critical and high findings (`MODE: no-baseline`): the state since
  19 November 2026, while the laptop is still being set up.
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
