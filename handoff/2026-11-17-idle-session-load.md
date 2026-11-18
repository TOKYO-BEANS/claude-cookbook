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
  as unchecked instead of "not listed"; `scripts/measure/servers.json` no longer expects it.
  This reverses the owner's 16 November answer "Leave all three" for Stagehand, which was
  asked on its token cost (39 tokens); the new reason is memory, the means is Claude's under the
  global rules, and the owner set this job's outcome with Stagehand on demand as its example.
  Backup of the config:
  `~/.local/share/backups/stagehand-on-demand-20261117/`.
- 511 finished subagent threads whose parent was no longer running were settled (reversible:
  `unsettle`). Children of running chats and every top-level chat were left alone.
- context-mode stays in every session: it is the owner of keeping output small, called in 79
  sessions.

**Verification.** The child-session route returned example.com's title in 55 seconds; the
command with every limit of `scripted-runs.md` did in 17 seconds on 18 November, and its debug
log shows the server connected before the first request (Claude Code 2.1.327).
`claude mcp list` no longer lists Stagehand. After: unsettled threads 559 to 68 (13 top-level,
55 children of running chats). RAM 12.7 GB and CPU 84% right after: the 13 sessions already
running keep their Stagehand pair until they end, so the saving (about 32 MB resident per
session) arrives as sessions are replaced.

**Outstanding.**
- The rest of the RAM is the number of sessions at once: each is about 270 MB for Claude itself
  plus its servers. Asked whether to limit chats at once, the owner answered "No limit"
  (18 November 2026): not to be asked again unless something changes.
- Measured again on 18 November: 6 sessions, Stagehand processes 0, CPU 31%, a bare `node -e 0`
  in about 0.3 s. Free RAM was still 1.2 GB, mostly held by the browser (2.3 GB) and WebView2
  apps (2.1 GB), not by Claude.
- Hooks under load (another chat's measurement, checked here): at 17:15 on 17 November a bare
  Node start took 5 s, so context-mode's 5-second hooks (a plugin of its own, not changed here)
  missed and the owner saw "hook did not answer in time". A tool call starts up to five Node
  processes: context-mode before and after (shell, read, search, edit and MCP tools), and of the
  Cookbook's: `model-budget-note.mjs` after every tool (`PostToolUse` with no matcher),
  `boat-route.mjs` before shell calls, `owner-answers.mjs` before `AskUserQuestion`, edits and
  new threads and after `AskUserQuestion`, `codex-start-gate.mjs` before delegations and new
  threads. Next small job: narrow `model-budget-note`'s `PostToolUse` matcher without losing
  "a long turn hears the advice". Owner: Claude, next chat in this repository.
- A local Semgrep comparison (`~/.local/share/claude-cookbook/work/semgrep-vs-codeql/scan.sh`,
  another chat's job) ran repositories one after another on 17 November; it was not running on
  18 November, so nothing was stopped.
- #108's open low findings: a separate small pull request (boat route handoff). Owner: Claude;
  cleared by that pull request's merge.
- Tests: on 17 November boat-run refused this branch's suite (a funded wallet). On 18 November
  the branch's own `boat-run.mjs` (after #121) ran it: 666 tests, 659 pass, 0 fail, 7 skipped;
  the installed plugin's older copy refused until `claude plugin update` (done after the merge).

**The merge.** #119 merged as `08ff727` on 18 November: every check passed (Graphify Formal
Verification skipped, set aside as outside the gate); the `ai-review` job
was unavailable (credit balance), so a fallback review of the head `8daf754` was recorded (first
pass seven findings, all fixed; second pass one low, answered: the child-session command sends
its prompt at once, proven by one run with the debug log, guarded by "reply NO TOOL"). Release
check `verified` (execution 1740). Plugin updated to `08ff727`.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-17-idle-session-load/`: the
before and after summaries, the scripts that made them, the Stagehand proof, the settled ids,
the child-session command and debug excerpt, and `2026-11-18-measured-again.txt` (the second
measurement, and the other chat's 17 November figures, marked as not re-measured).
