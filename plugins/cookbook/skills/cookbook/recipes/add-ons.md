# Claude Code add-ons

Skills and mods the owner added on 30 October 2026. Every file was read before install. Mods run
in every session, headless ones included, so a misbehaving one affects scheduled jobs too.

The map gives a job to doctor-plus only. The others on this page and in [add-ons-mods.md](add-ons-mods.md) are installed
and have no job in the map (15 November 2026); whether each stays is the owner's decision.

- **Make a task or prompt more ambitious**: `/be-ambitious`. Its own ask-first list is narrower than
  ours: the stops in the Cookbook's ground rules still hold.
- **A prompt that loops until it wins**: `/gauntlet-loop` writes the prompt; it does not run it.
  Before running one, add an agent or token budget, a round cap and a Firecrawl credit ceiling.
  Never accept a bar that means running untrusted code. Not for scheduled jobs.
- **Health check of the Claude setup and its instructions**: `/doctor-plus`, report first. Make
  accepted fixes through a worktree pull request. Leave alone the standard-managed CLAUDE.md
  section, AGENTS.md's shared owner decisions and the junctioned shared skills
  (`release-maintenance`, `typesafe-ai`).
- **Audit or write a skill**: `/skill-creator-plus`, audit mode first. Run its scripts with `python`,
  not `python3`, which is the Microsoft Store stub on this PC. Give `init_skill.py` an absolute
  `--path`. Fix a skill in its source repository, never in a plugin cache or a junctioned folder.
  Where its advice on descriptions disagrees with Superpowers' `writing-skills`, Superpowers wins.
  In a skill or command body, a dollar sign right before a digit becomes an argument when the skill
  gets arguments: write `"${1}"` in shell code and `USD 30` for prices (`scripts/check.mjs`
  enforces it here).
- **Orchestrated build with tiered workers**: `/savvy-flow:savvy-flow`, only in a worktree or feature
  branch, because it runs `git init` and commits in a new folder. `sa-build` stays the default for a
  written plan. **savvy-progress** draws the progress bar for it; `/agents-info` opens its agents
  panel.

More: [mods](add-ons-mods.md).
