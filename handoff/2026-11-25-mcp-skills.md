# MCP skills: the Cloudflare duplicates, the four features and the standing rule

**Why.** Anthropic's 24 November 2026 release brought Skills over MCP (beta), MCP tasks and
elicitation (generally available) and file uploads (coming). The entry of the same day,
`2026-11-25-design-skills-and-mcp-code.md`, said there was nothing new to adopt; that is out of
date. The Cloudflare plugin ships 22 skills, and its server serves those 22 again plus two.

**What changed.** New page `options/mcp-features.md`: the four features, how we use each, the
Cloudflare measurement and the standing rule (a server's skills replace ours for a job once they
load in T3 Code; CLIs and scripts stay). `options/keep-healthy.md` points to it in place of the
"code execution with MCP" sentence; `recipes/connecting.md` carries the rule;
`connector-register.md` records that `skillOverrides` reaches MCP skills. The daily update check
asks Firecrawl's and Parallel's servers `skills/list` with no key (`lib/mcp-skills.mjs`,
`MCP_SKILL_SERVERS`, `checkSkillServers`) and reports one that serves skills; a failed ask is a
"could not read" line. The user settings turn the server's 22 duplicates off (machine-setup #51);
the plugin's copy stays, because server skills never load in `claude -p` or the Agent SDK, so
not in T3 Code.

**Verification.** Four runs on the plan login (`apiKeySource: none` in the `-p` run): `claude -p`
listed the plugin's 22 only; a terminal session listed 46 before and 24 after the overrides (22
plugin, `artifacts`, `flagship`). `node lib/mcp-skills.mjs` printed `skills: 0` for Firecrawl and
Parallel and `initialize: HTTP 401` for Graphify. New tests in
`scripts/stack-updates-connect.test.mjs` and `scripts/stack-updates-run.test.mjs`. The Cookbook
check and the suite on boat.

**Outstanding.** Graphify cannot be asked without its sign-in: check it by hand at its releases.
A skill Cloudflare adds to both plugin and server shows twice in terminal sessions until it is
added to the overrides.

**Dead ends.** A `deny` rule `Skill(mcp__<server>__*)` leaves the server's skills in the listing.
Keeping the server's copy instead of the plugin's: it would leave T3 Code with no Cloudflare
skills, and a plugin's skills go only with the plugin and its server.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-25-mcp-skills/`. The release
check writes
`~/.local/share/release-maintenance/evidence/2026-11-25-cookbook-mcp-skills/release-check.log`.
