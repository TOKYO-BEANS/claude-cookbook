# Dispatch profiles

A dispatch splits one task into pieces and runs each piece with a fixed profile: a model, an effort
and, where that can be enforced, a tool list. The main chat splits the work, reads the reports and
checks the evidence; it does not do the pieces itself.

Which profiles run as what was decided on 3 November 2026 (dispatcher phase B0) from the platform's
limits:

- **Subagent** when the piece is bounded, ends in a report and gains from a tool limit. Only
  subagents can be limited to a tool list, and one started at about 14,000 tokens in the B0 probe,
  against about 119,000 for a desktop side chat (the register's measurement).
- **Side chat** (`start_session`) when the owner must be able to open the piece, steer it or
  approve inside it, or when it ends in a branch or pull request of its own.

The main chat runs Opus 5.5 at medium effort: `start_session` caps a side chat at the caller's
model family and effort, and a later raise misses the first turn, where most of the work happens.

## Subagent profiles

The agent files ship in this plugin's `agents/` folder. Call one with the Agent tool,
`subagent_type: "cookbook:<profile>"`, and the brief below as the prompt. Leave the call's `model`
and `effort` out: either one overrides the profile's file, and the `CLAUDE_CODE_EFFORT_LEVEL`
environment variable, when set, overrides every effort (docs/en/sub-agents, "Choose a model" and
"Choose an effort level"). The profile's effort does beat a per-model `effortLevel` in user
settings: the review proof sent `high` under a user `xhigh` for Opus.

| Profile | Agent | Model | Effort | May use | Refused |
| --- | --- | --- | --- | --- | --- |
| mechanical | `cookbook:mechanical` | haiku | low | Read, Edit, Write, Bash, Glob, Grep | every MCP server and connector, web tools, Skill, Agent |
| research | `cookbook:research` | sonnet | medium | Read, Grep, Glob, the Parallel Search MCP, the hosted Firecrawl MCP | shell, file writes, Firecrawl crawl, agent, interact, parse (a local-file upload) and monitor changes, every other MCP server |
| review | `cookbook:review` | opus | high | Read, Grep, Glob, Bash, the Graphify MCP | Edit, Write, NotebookEdit, Graphify `remember` and `set_workspace`, web tools, every other MCP server |

- Two mechanical pieces that may touch the same files each get `isolation: "worktree"` on the Agent
  call; each then comes back with its own branch for the main chat to merge. A single piece edits
  the main chat's worktree directly, so the agent file does not force isolation.
- Background is the default run mode. A background subagent keeps every MCP tool but only a fixed
  set of built-in tools; each profile lists only built-ins from that set, so it gets the same tools
  either way (`npm test` checks it). A background subagent's permission prompts appear in the main
  chat, and a lasting answer there applies to the whole session.
- None of the profiles has the Agent tool, so none can start subagents of its own.
- What the tool list does not limit: Bash can do whatever the shell can, so mechanical's and
  review's shell rules live in their prompts, beside the permission rules that still apply.
  `CLAUDE.md` still loads. No profile has the Skill tool, so none loads skills.
- Proved on 3 November 2026 with `claude -p` (CLI 2.1.316): a Haiku parent in `dontAsk` mode made
  one Agent call per profile, with this plugin loaded by `--plugin-dir` and the installed copy
  switched off. The subagent's saved transcript (`prefix.json` and its `api-request` entries) shows
  the tools it was given and the model and effort sent. The parent had 11 MCP servers, the Claude
  Docs connector among them; each subagent got only the servers in its own list.

  | Profile | Tools given | Sent | Real task | Forbidden calls |
  | --- | --- | --- | --- | --- |
  | mechanical, foreground and background | its 6 built-ins, no MCP | `claude-haiku-5-5`, low | renamed a function; its test printed `ok` | Graphify, WebFetch: "No such tool available" |
  | research | Read, Grep, Glob, 2 Parallel, 20 Firecrawl (none of the 8 withheld) | `claude-sonnet-5-5`, medium | a cited answer from the subagent docs, 1 Parallel call | Write (first run), `firecrawl_parse`, `firecrawl_crawl`: "No such tool available" |
  | review | Read, Grep, Glob, Bash, 26 Graphify (not `remember` or `set_workspace`) | `claude-opus-5-5`, high | found both seeded bugs, each shown by a `node` check | Edit, Parallel `web_search`: not available |

  The review subagent ran above its parent (Haiku at medium), so a profile's model and effort hold
  either way. In a desktop session (Opus at `xhigh`, with the app's session, browser, computer-use
  and connector servers loaded), a user-level copy of the research profile's frontmatter got the
  same research tools and nothing else, on Sonnet at medium, in the background.

- A plugin agent ignores `hooks`, `mcpServers` and `permissionMode` in its file. These profiles use
  none of them: they name MCP servers by wildcard in `tools`. Every server named there must be in
  `connector-register.md`; `npm test` checks it.

## Side-chat profiles

| Profile | `model` | `effort` | `permission_mode` | `use_worktree` | Ends in |
| --- | --- | --- | --- | --- | --- |
| code | `claude-sonnet-5-5` | medium | `inherit` | true | a branch and pull request, through Superpowers test-first work and review |
| design | `claude-opus-5-5` | medium | `inherit` | false | two or three Claude Design options for the owner to pick; building the pick is a code piece |
| ops-deploy | `claude-opus-5-5` | medium | `default` | true | a deploy prepared at a merged commit, stopped for the owner's yes in that chat |

- `inherit` means leaving `permission_mode` out, so the side chat gets the main chat's mode.
  ops-deploy starts in `default`: every command outside the allow rules then asks the owner in that
  chat, so a production step cannot pass without a click.
- ops-deploy runs at medium, not high: the deploy itself is a script the owner approves. The owner
  can raise the effort inside that chat.
- design has no worktree because it changes no repository files; its brief says so.
- Starts use `context: "fresh"` with the brief below and a `background` of at least 80 characters.

### What a side chat cannot be limited to

- **Tools, MCP servers and skills.** `start_session` has no such field, and the desktop app has no
  per-session launch flags (the desktop docs: `--allowedTools` and `--disallowedTools` have "No
  per-session equivalent").
- **Folder settings do not fill the gap.** A desktop worktree session reads the main checkout's
  settings, and in desktop sessions the claude.ai connectors and synced plugins ignore folder
  settings altogether.
- **Model, effort and permission mode above the main chat's.** A higher model or effort is ignored
  at start; a higher permission mode is refused. `set_session_model` and `set_session_effort` apply
  from the next turn and, outside auto and bypass modes, need the owner's approval.
- **Starting further side chats.** The desktop app refuses `start_session` in a session that another
  session started, and in a turn that another session's message began (the app's own session
  instructions; B0 hit both). A retry is a `SendMessage` to the same side chat, and a side chat in
  another permission mode than the main chat's, such as ops-deploy, holds that message for the
  owner's approval and may let it expire, with nothing reported back (`SendMessage`'s contract).
- **Another folder or a preset** only when the owner's own words name it.

So the brief carries the profile's rules, and the side chat's start-up self-check is required: it
reports what the profile promised but did not load, instead of improvising.

### Start-up self-check

Before working, a side chat runs its profile's checks and puts any gap first in its first reply.

- **code:** `get_session` on `self` shows the profile's model and effort; the branch is its own
  worktree branch from `origin/main`; the project's install has run (`npm ci` where there is a
  lockfile); Graphify answers and its indexed commit is noted against the branch; the Superpowers
  skills are listed.
- **design:** `get_session` model and effort; the Artifact tool is present (`quickstart` with
  `intent: "design"`); the built-in browser tools are present; the project's design system link, if
  it has one.
- **ops-deploy:** `get_session` model, effort and permission mode `default`; `gh auth status`;
  Wrangler through `with-key.mjs` answers `whoami`; the `release-maintenance` skill is listed; the
  merged commit to deploy and its CI state. Nothing is deployed before the owner's yes in this chat.

## The brief and the report

Both kinds get the same brief and end in the same report, so the main chat can check every piece
the same way.

```text
Profile: <profile>. Dispatch: <dispatch id>, piece <n> of <total>.
Task: <one piece, in one or two sentences>.
Files or area: <paths, a commit range or a question>.
Done means: <the check that proves it, e.g. "npm test passes" or "three sources agree">.
Rules: stay inside the files or area above; stop and report a question instead of choosing when
the brief does not settle something; never deploy, merge, publish or spend beyond <cap>.
Self-check first (side chats): <the profile's list above>; report gaps before working.
Report: <subagents: your final message> | <side chats: write <notes folder>/<dispatch id>-<n>-<profile>.md>
and end your turn with its status line.
```

The report, in this order:

```text
Status: passed | failed | blocked - one line
Changes: one line per file or object changed, or "none"
Evidence: commands, run IDs, links and their results
Tests: what ran and the counts, or why none ran
Open items: questions for the main chat, or "none"
Known failures and dead ends: item - reason - what clears it, or "none"
```

The main chat checks the evidence, not the status line: a claimed test run needs its output, a PR
its checks. A failed check gets one retry (`SendMessage` to the same side chat, or a new subagent
call with the failure in the brief), then goes to the owner. An ops-deploy retry goes to the owner
from the start: its messages wait for the owner's approval anyway.

## Archiving side chats

Always ask, as one batched question at the end of the dispatch that lists the side chats that
passed by name ("Archive these 3?"). Archiving stops the chat and cleans up its worktree, so a side
chat with uncommitted or unpushed work, an open pull request or a failed check is never offered.
Subagents need no archiving. The app's `auto_archive_on_pr_close` setting is the native route for
chats that end in a pull request; turning it on is the owner's choice.
