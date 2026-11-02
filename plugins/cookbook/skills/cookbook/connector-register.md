# Connector and skill register

What loads into every Claude Code session, what each item is for, how much it is used, and the
route the connector ranking gives it. The ranking: this Cookbook first, then the maker's official
CLI or connector, a community CLI, our own small script wrapped in a skill, an MCP server in project
scope, and an MCP server in user scope last.

Read on 2 November 2026: the servers a fresh desktop session reports (`session_connectors_status`),
and calls over the 30 days before, each `tool_use` id once (`scripts/usage-census.mjs` beside this
file). The calls describe the setup before 2 November, when the user-scope Aikido, GitHub, REA and
three Cloudflare servers left, OpenSEO moved to project scope, and the Spotify and PubMed connectors
were disconnected. A row with zero calls is a removal candidate; each decision says why.

## Servers and connectors

| Server | Kind | Job | Calls (projects) | Tool names | Route | Decision and reason |
|---|---|---|---|---|---|---|
| graphify | user, HTTP | code graph: symbols, callers, impact, tests | 685 (5) | 28 | user-scope MCP; no CLI | Keep: the most used server |
| firecrawl | user, HTTP | hosted scrape, search, crawl, map, agent | 273 (11) | 31 | MCP plus the `firecrawl` CLI for scripts | Keep: crawl and agent have ask rules |
| Firecrawl | claude.ai connector | search, developer and research indexes | 1 (1) | 10 | duplicate of the user server in Code | Keep: the only Firecrawl route in chat; no Code-only switch (below) |
| parallel-search | plugin, HTTP | web search and fetch | 383 (17) | 2 | plugin MCP; `parallel-cli` for extract and research | Keep |
| cloudflare | plugin, HTTP | Cloudflare API `execute`, `search`, docs | 25 (5) | 4 | plugin MCP; Wrangler or `cf` for D1 and Workers logs (its login lacks those scopes) | Keep |
| cloudflare-docs | user, HTTP | Cloudflare documentation search | 40 (4) | 2 | user-scope MCP | Keep: 2 names |
| aikido-mcp | plugin, **stdio** | local Aikido scans and issues | 27 (2) before the repoint, 25 of them the fixer's daily probe; 2 real scans | 10 | **project scope** | Move: about 188 MB and 5 processes in every open session for 2 scans a month. First repoint the fixer's probe to a project where the plugin stays on (as for OpenSEO), then turn the plugin off at user scope |
| wix-mcp | plugin synced from claude.ai, HTTP | Wix site work, with 12 `wix:*` skills | 37 (2) | 34 | **project scope**: `"wix@synced": false` in user settings, `true` in the Wix project's `.claude/settings.local.json` | Move: one project uses it, and its skills are the longest descriptions in the listing |
| Wix | claude.ai connector | the same Wix server | 11 (2) | 32 | duplicate of `wix-mcp` in Code | Keep connected for chat; denied in terminal sessions |
| Shopify | claude.ai connector | Shopify docs and store tools | 3 (1), all docs search | 48 | Shopify CLI for theme work; a project-scope server if a store project needs one | Keep connected for chat; denied in terminal sessions |
| Wispr Flow | claude.ai connector | meeting notes and scratchpad | 0 | 15 | none needed in Code | Candidate. Not switched off: the only switch also cuts chat, and the owner decides chat |
| Google Drive | claude.ai connector | Drive files | 8 (1) | 11 | official connector | Keep |
| Claude Docs | claude.ai connector | Claude's own documents | 60 (4) | 8 | first-party connector | Keep |
| savvy-progress | plugin mod | progress bar for savvy-flow | 538 (3) | 2 | in-process, no process of its own | Keep |
| self-compact-claude | plugin mod | `note_to_self` before compaction | 178 (3) | 1 | in-process | Keep |
| scheduled-tasks | desktop app | scheduled runs | 177 (7) | 6 | built in | Keep |

The desktop app's own servers (sessions, pull requests, browser, Chrome, computer use, terminal,
widgets, connector registry) come with the app and are not listed.

**Connectors in desktop Code sessions.** The desktop app ignores `deniedMcpServers` for the
connectors it delivers; terminal sessions honour it. The only other switch, + > Connectors in a
Code session (the same as the app's connector tool), carries over to new sessions, but an open bug
report says it also turns the connector off in claude.ai chat and Cowork (anthropics/claude-code
issue 101370, 11 October 2026). A per-project connector choice is an open feature request (issue
106619). Until one exists, a connector the owner wants in chat stays connected, and its tool names
load in every desktop session.

## Skills

A skill costs its description in every session until it is used. `skillOverrides` (`on`,
`name-only`, `user-invocable-only`, `off`) reaches personal, project and bundled skills only. Plugin
skills, including plugins synced from claude.ai, follow their plugin's scope: `enabledPlugins`, with
`"<name>@synced"` for a synced plugin.

| Skills | Calls in 30 days | Decision and reason |
|---|---|---|
| `liquid-theme-a11y`, `liquid-theme-standards`, `shopify-liquid-themes` | 0 | `name-only`: one store project, no theme work in 30 days |
| `code-review`, `simplify`, `keybindings-help`, `fewer-permission-prompts` | 0 | `name-only`: typed by hand when wanted; the model gains nothing from the description |
| `run`, `loop`, `schedule`, `artifact-diagramming` | 0 | On: the description is what makes them trigger from a plain request |
| Skills added on 30 October (`be-ambitious`, `doctor-plus`, `gauntlet-loop`, `skill-creator-plus`) and `reverse-engineer-anything` | 0-1 | On: younger than the 30-day window |
| Skills a rule names (`release-maintenance`, `stack-atlas-onboard`, `stop-slop`, `typesafe-ai`, the `sa-*` workflows) | 0-33 | On: the rule gives the name and the moment |
| `wix:*` | 4 | With the plugin, to project scope |
| `aikido:*` | 0 | With the plugin, to project scope after the probe moves |
| Parallel, Cloudflare, Depot, Superpowers, Firecrawl and Cookbook plugin skills | 0-41 | On: core stack; the plugins carry the routes this Cookbook names |

## Doing it again

Once a quarter, and after adding a plugin or connector:

1. In a fresh session, list the servers (`session_connectors_status` in the desktop app, `claude mcp
   list` in a terminal).
2. Count the last 30 days: `node scripts/usage-census.mjs ~/.claude/projects 30` from this skill's
   folder. It counts each `tool_use` id once, Skill calls by skill and slash commands by message.
3. Update the rows here. Zero calls make a candidate; a skill younger than the window stays on.
4. Measure the start before and after a change: the same `claude -p` run twice (same model, flags
   and folder), reading the first assistant `usage` from its transcript.
5. Each removal or scope change is standing configuration: back up the settings file and get the
   owner's yes.
