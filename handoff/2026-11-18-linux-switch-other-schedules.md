# 18 November 2026: before the Linux switch, the schedules outside T3 Code

**Why.** `2026-11-18-linux-switch-scheduled-tasks.md` lists the T3 Code scheduled tasks. Four
more schedules on the Windows PC were not T3 tasks; they too are gone after the wipe.

**What changed.** This entry: the four, to recreate on Linux.

| Schedule | Where it ran | What it does | On Linux |
| --- | --- | --- | --- |
| `stack-atlas-standard-daily`, daily 07:30 local | Claude Desktop scheduled task | the standard's unattended daily run (`stack-atlas-onboard` daily prompt): upgrade pull requests that merge when green, rulesets | a T3 scheduled task with the same prompt; it also does the standard's open rollout |
| `agentshield-weekly`, weekly | Claude Desktop scheduled task | read-only AgentShield scan of a sanitized copy of the Claude Code config against the saved baseline | a T3 scheduled task |
| `daily-sidebar-cleanup`, daily | Claude Desktop scheduled task | archives all but the 5 newest Claude Code chats per sidebar group; never deletes | a T3 scheduled task, if still wanted beside the T3 sidebar sweep |
| `stack-updates-daily`, daily 07:00 local | Windows Task Scheduler | `node ~/.local/bin/stack-updates-daily.mjs` (`recipes/update-check.md`) | a systemd user timer |

The Claude Desktop task folders (`~/.claude/scheduled-tasks/<name>/SKILL.md`, the prompt) were
copied whole to the private wrap-up folder on the migration kit. A WSL keepalive task was
Windows-only and is dropped.

**Verification.** Read from Windows Task Scheduler and `~/.claude/scheduled-tasks/` on
18 November 2026 at 21:25 UTC; `node scripts/check.mjs` passed.

**Outstanding.** Recreate the four on the first Linux session.

**Dead ends.** None.

**Evidence.** `~/.local/share/linux-migration/claude-desktop-scheduled-tasks/` and
`thread-wrapup.md` on the migration kit.
