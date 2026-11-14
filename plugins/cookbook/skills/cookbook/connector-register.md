# Connector and skill register

What loads into every Claude Code session, what each item is for, how much it is used, and the
route it gets from the order in "Connecting a new app or service" (SKILL.md): this Cookbook first,
then the maker's official connector or CLI, a community CLI, the API from a small script, and an MCP
server last. An MCP server that only some projects need goes in project scope, not user scope.

Read on 2 November 2026: the servers a fresh desktop session reports (`session_connectors_status`),
and calls over the 30 days before, each `tool_use` id once (`scripts/usage-census.mjs` beside this
file). "Folders" counts the transcript folders that called a server, not projects. The calls
describe the setup before 2 November, when the user-scope Aikido, GitHub, REA and three Cloudflare
servers left, OpenSEO moved to project scope and two unused connectors were disconnected. A row with
zero calls is a removal candidate.

## Servers and connectors

| Server | Kind | Job | Calls (folders) | Tool names | Route | Decision and reason |
|---|---|---|---|---|---|---|
| graphify | user, HTTP | code graph: symbols, callers, impact, tests | 685 (5) | 28 | user-scope MCP; no CLI | Keep: the most called server, used across code projects |
| firecrawl | user, HTTP | hosted scrape, search, crawl, map, agent | 273 (11) | 31 | MCP, plus the `firecrawl` CLI for scripts | Keep: the page-extraction route; crawl and agent have ask rules |
| Firecrawl | claude.ai connector | search, developer and research indexes | 1 (1) | 10 | duplicate of the user server in Code | **Disconnected 3 November**: the user `firecrawl` server has the same search, developer and research tools, and connectors are used only through Claude Code |
| parallel-search | plugin, HTTP | web search and fetch; since plugin 0.12.0 (14 November 2026) also research (needs a sign-in, not set up), typed decisions, verticals and image search | 383 (17) | 8 (2 before 0.12.0) | plugin MCP; `parallel-cli` for extract and research | Keep: the default research route. The names grew from 2 to 8 with the plugin's move to `mcp.parallel.ai/mcp/claude`; `web_search` and `web_fetch` kept their names |
| cloudflare | plugin, HTTP | Cloudflare API `execute`, `search`, docs | 25 (5) | 4 | plugin MCP; Wrangler or `cf` for D1 and Workers logs (its login lacks those scopes) | Keep: 4 names for the whole API |
| cloudflare-docs | user, HTTP | Cloudflare documentation search | 40 (4) | 2 | user-scope MCP | Keep: used weekly, 2 names |
| stagehand | user, **stdio** | cloud browser automation in a session: `run`, `snapshot`, `screenshot` | 0 (added 14 November 2026) | 3 | user-scope MCP; the `browse` CLI for a single or scripted step | **Trial, added 14 November** on the owner's "install and use". User scope is an exception to the rule above, made because browser work comes up in any project; it costs 3 names and two Node processes in every session, and no browser time until a tool is called. Review on 28 November: with calls from only one or two projects, move it to project scope |
| aikido-mcp | plugin, **stdio** | local Aikido scans and issues | 1 (1). The user-scope copy removed on 2 November had 27, of them 25 the fixer's daily probe and 2 dependency scans | 10 | **project scope**: `"aikido@claude-plugins-official": false` in user settings, `true` in the `.claude/settings.local.json` of the two projects where local scans ran | **Done 2 November**: it cost about 188 MB and 5 processes in every open session for about 2 scans a month. The fixer that probed it daily was removed with the Stack Atlas dashboard on 12 November. A fresh session starts 5 Aikido processes there and none elsewhere |
| wix-mcp | plugin synced from claude.ai, HTTP | Wix site work, with 11 `wix:*` skills | 37 (2) | 34 | **project scope**: `"wix@synced": false` in user settings, `true` in the site folder's `.claude/settings.local.json` | **Done 2 November**: one site uses it, and its skills carry the longest descriptions in the listing |
| Wix | claude.ai connector | the same Wix server, delivered a second time | 11 (2) | 32 | duplicate of `wix-mcp` in Code | **Disconnected 3 November**: the owner uses connectors only through Claude Code, not claude.ai chat. Wix work runs in the site folder through `wix-mcp` (`ListWixSites` checked after the disconnect) |
| Shopify | claude.ai connector | Shopify docs and store tools | 3 (1), all docs search | 48 | Shopify CLI for theme work; the store project's own Admin API scripts for store data; a project-scope server if a store project needs more | **Disconnected 3 November**, same reason |
| Wispr Flow | claude.ai connector | meeting notes and scratchpad | 0 | 15 | none needed in Code | **Disconnected** by 3 November, same reason |
| Google Drive | claude.ai connector | Drive files | 8 (1) | 11 | official connector | **Disconnected 3 November** by the owner. A Drive file a task needs is downloaded into the project folder, or Drive is reconnected for that task |
| Claude Docs | claude.ai connector | Claude's own documents | 60 (4) | 8 | first-party connector | Keep: the document route |
| context-mode | plugin, **stdio** | keeps big tool output out of the context: `ctx_execute`, `ctx_batch`, `ctx_search`, `ctx_doctor` | new on 5 November | 9 | user-scope plugin MCP; the same bundle's `cli.mjs` for `doctor` | **Added 5 November** by the owner for every project and every new session. One Node process per session; recount at the next census |
| savvy-progress | plugin mod | progress bar for savvy-flow | 538 (3) | 2 | in-process, no process of its own | Keep: costs 2 names |
| self-compact-claude | plugin mod | `note_to_self` before compaction | 178 (3) | 1 | in-process | Keep: costs 1 name |
| scheduled-tasks | desktop app | scheduled runs | 177 (7) | 6 | built in | Keep: runs the scheduled jobs |
| atlas (Stack Atlas CLI) | own CLI, one process per command | Stack Atlas status, Sync and `Claude Code:` records | 6 to 12 November | 0 | none: removed | **Removed 12 November**: the owner slimmed Stack Atlas to its standard and the `sa-*` workflows, and the dashboard this CLI talked to was deleted |
| Adobe for creativity | claude.ai connector, and the `adobe-for-creativity` plugin server (HTTP) | Adobe image, PDF, font, video and Stock actions (Photoshop, Lightroom, Illustrator, Firefly, Express, Acrobat, InDesign, Premiere) | new on 10 November | 116 | official hosted connector with OAuth; no CLI | **Added 10 November** by the owner (trial until a task uses it). Loads twice in a desktop session: the connector's tools, and a plugin server that waits for sign-in. No tool upscales or sharpens, so photo sharpening uses the Firefly web app instead (recipe "Photos (Adobe Firefly and Adobe for creativity)"). Whether it stays user-wide is the owner's call; recount at the next census |

The desktop app's other built-in servers (sessions, pull requests, browser, Chrome, computer use,
terminal, widgets, connector registry) come with the app and are not listed.

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
| `liquid-theme-a11y`, `liquid-theme-standards`, `shopify-liquid-themes` | 0 | `name-only` (done 2 November): used in one store project only, no theme work in 30 days; their names say what they are for |
| `code-review`, `simplify`, `keybindings-help`, `fewer-permission-prompts` | 0 | `name-only` (done 2 November): no calls and no typed uses in 30 days; the name still lets the model or the owner call them |
| `run`, `loop`, `schedule`, `artifact-diagramming` | 0 | On: the names are too general to pick without the description, which is what makes them trigger from a plain request |
| Skills added on 30 October (`be-ambitious`, `doctor-plus`, `gauntlet-loop`, `skill-creator-plus`) and `reverse-engineer-anything` | 0-1 | On: younger than the 30-day window |
| Skills a rule names (`release-maintenance`, `stack-atlas-onboard`, `stop-slop`, `typesafe-ai`, the `sa-*` workflows) | 0-33 | On: the rule gives the name and the moment |
| `wix:*` | 4 | With the plugin, to project scope (done 2 November) |
| `aikido:*` | 0 | With the plugin, to project scope (done 2 November) |
| `anthropic-skills:*` (from claude.ai, delivered by the app as a plugin) | 0-100 | On: `skillOverrides` does not reach them; the browser skill is the most called skill |
| Parallel, Cloudflare, Depot, Superpowers, Firecrawl and Cookbook plugin skills | 0-41 | On: core stack; the plugins carry the routes this Cookbook names |

**Measured, 2 November:** the same `claude -p` run (Haiku, built-in tools Read, Skill and
ToolSearch, an empty folder) started with 50,246 input tokens twice before the two changes above and
49,059 and 49,063 after: about 1,200 fewer per session start. A desktop session starts at about
119,000.

## Doing it again

Once a quarter, and after adding a plugin or connector:

1. In a fresh session, list the servers (`session_connectors_status` in the desktop app, `claude mcp
   list` in a terminal).
2. Count the last 30 days: `node scripts/usage-census.mjs` from this skill's folder (defaults: the
   `~/.claude/projects` folder and 30 days). It counts each `tool_use` id once, Skill calls by skill
   and slash commands by message.
3. Update the rows here. The census prints claude.ai connectors by id: write the connector's name
   from step 1, never the id, and no project names or paths (this repository is shared). Zero calls
   make a candidate; a skill younger than the window stays on.
4. Measure the start before and after a change: the same `claude -p` run twice (same model, flags
   and folder), reading the first assistant `usage` from its transcript.
5. Each removal or scope change is standing configuration: back up the settings file and get the
   owner's yes.
