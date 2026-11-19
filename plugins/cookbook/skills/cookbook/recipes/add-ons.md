# Claude Code add-ons

One skill the owner added on 30 October 2026; every file was read before install. A mod runs
in every session, headless ones included, so a misbehaving one affects scheduled jobs too.

- **Health check of the Claude setup and its instructions**: `/doctor-plus`, report first. Make
  accepted fixes through a worktree pull request. Leave alone the standard-managed CLAUDE.md
  section, AGENTS.md's shared owner decisions and the junctioned shared skills
  (`release-maintenance`, `typesafe-ai`).
- Updates: the skill is a plain copy in `~/.claude/skills`. Read the upstream diff from the
  recorded commit to the new one, copy the folder over the old one, then record the commit
  with the `stack-updates` skill's `updates.mjs record doctor-plus/skill <commit>`.
- In a skill or command body, a dollar sign right before a digit becomes an argument when the
  skill gets arguments: write `"${1}"` in shell code and `USD 30` for prices
  (`scripts/check.mjs` enforces it here). Fix a skill in its source repository, never in a
  plugin cache or a junctioned folder.
- Do not install blast-radius (anthropics/claude-code-playground): on the Windows PC it refused
  every risky Bash command at once (no `sleep` or `du` on the PATH, `bash` was the WSL launcher).
  Not tried on the laptop; a new look starts at [connecting](connecting.md). Use permission deny
  rules for hard blocks.
