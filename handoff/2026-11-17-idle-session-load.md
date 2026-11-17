# 17 November 2026: what every session loads, and idle T3 threads

**The job.** The owner's outcome, continued from the boat route job
([2026-11-17-boat-route.md](2026-11-17-boat-route.md)): the PC stops throttling. This entry is
the load that is not boat's to take: what each Claude session starts, and the idle T3 threads.

**Measured before** (process list with command lines, grouped by server and by session): RAM
about 13 of 14.8 GB. 14 Claude sessions under T3 Code, 12 of them active in the last 15 minutes:
the session count is real parallel work, not idle chats. Per session: context-mode about 35 MB,
Stagehand's two Node processes (the `with-key.mjs` wrapper and the server) about 32 MB resident
and about 71 MB committed, so about 450 MB resident and 1 GB committed across 14. The
"`with-key.mjs` wrappers" in the opening measurement were all Stagehand's. Other load at that
moment: 3 local `npm test` trees and 2 Semgrep Pro scans from sessions started before #108's
hook, and the browser. T3 had 559 unsettled threads, 547 of them finished subagent threads.
Subagent threads hold no process: they ran inside their parent's session.

**What changed.**
- Stagehand left the session start. Its MCP entry moved from user scope in `~/.claude.json` to
  `~/.local/share/stagehand-mcp.json`; a step that needs it runs in a child session
  (`claude -p --mcp-config ... --strict-mcp-config`), recipe `stagehand.md`. Called in 1 of 557
  sessions. Pages: `stagehand*.md`, `connecting-load.md`, `connector-register.md`, the map row
  in `SKILL.md`; in `catalog.json` its hosted part names no server, so the daily check shows it
  as unchecked instead of "not listed". Backup of the config:
  `~/.local/share/backups/stagehand-on-demand-20261117/`.
- 511 finished subagent threads whose parent was no longer running were settled (reversible:
  `unsettle`). Children of running chats and every top-level chat were left alone.
- context-mode stays in every session: it is the owner of keeping output small, called in 79
  sessions.

**Verification.** The child-session route returned example.com's title in 55 seconds.
`claude mcp list` no longer lists Stagehand. After: unsettled threads 559 to 68 (13 top-level,
55 children of running chats). RAM 12.7 GB and CPU 84% right after: the 13 sessions already
running keep their Stagehand pair until they end, so the saving (about 32 MB resident per
session) arrives as sessions are replaced.

**Outstanding.**
- The rest of the RAM is the number of sessions at once: each is about 270 MB for Claude itself
  plus its servers. A limit on chats at once is the owner's choice (asked in the chat).
- Measure again once the sessions running on 17 November have ended: Stagehand processes should
  be 0. Owner: Claude, next chat in this repository.
- #108's open low findings: a separate small pull request (boat route handoff).

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-17-idle-session-load/`: the
before and after summaries, the scripts that made them, the Stagehand proof, the settled ids.
