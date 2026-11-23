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
- **Typed-only skills:** a skill with `disable-model-invocation: true` in its frontmatter runs
  only when a person types its name. The owner types none (23 November 2026): when adding a
  skill, remove the flag in our copy and say in its description when to use it, or give the
  job to a tool Claude can start. `handoff` had the flag until that day. context-mode's
  `ctx-doctor`, `ctx-stats` and `ctx-upgrade` keep it: the same jobs are its MCP tools.
- **`mattpocock/skills` (27 skills, MIT), measured on 23 November 2026:** none replaces an
  owner here. 16 run only when typed, in a fixed order (grill, spec, tickets, implement,
  review, retro), and each step has an owner: Superpowers, the `sa-*` workflows, the AI
  review, the weekly lessons. Each was run against ours and against no skill
  ([skills compared](../options/skills-compared.md), [the rest](../options/skills-compared-single.md)).
  Taken from it: `handoff` (our earlier copy), [architecture-review](architecture-review.md)
  after its own trial, four lines of `retro` in [learning-loop](learning-loop.md), and
  **pr-text**. A skill replaces an owner only on a measured result.
- **Pull request text:** the **pr-text** skill (`cookbook:pr-text`, in this plugin; Claude
  starts it when it writes a pull request's title and body). Three parts: what changed, with
  the smallest picture; before-and-after output pasted from commands that ran, never
  retyped; how to roll back and what a rollback leaves behind. Our adapted copy of his `pr`
  (the licence and the upstream commit are in the skill's folder), at `trial` in the catalog
  until it has written real pull requests. A project's own rules for the text (no project
  names in a public repository, the closing lines) still hold. An upstream change shows in
  the update check: read the diff and take what fits by hand.
- Do not install blast-radius (anthropics/claude-code-playground): on the Windows PC it refused
  every risky Bash command at once (no `sleep` or `du` on the PATH, `bash` was the WSL launcher).
  Not tried on the laptop; a new look starts at [connecting](connecting.md). Use permission deny
  rules for hard blocks.
