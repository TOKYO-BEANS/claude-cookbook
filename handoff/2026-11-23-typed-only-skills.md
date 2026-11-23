# 23 November 2026: the owner types no skills; mattpocock/skills weighed

**Why.** The owner asked whether any of Matt Pocock's skills (<https://www.aihero.dev/skills>)
are in use and worth adding, and said that skills which only run when typed should become
Claude's job: "I'm not going to specifically type them".

**What changed.** `recipes/add-ons.md` has two new lines: the typed-only rule, and
`mattpocock/skills` as weighed, not added. Outside this repository, on the laptop:
`~/.claude/skills/handoff/SKILL.md` lost `disable-model-invocation: true` and its description
now says when to use it; the global `~/.claude/CLAUDE.md` has the rule under "The Cookbook is
the tool stack"; auto-memory has `owner-types-no-skills`.

**Verification.** The `handoff` skill appeared in the session's skill list right after the
edit. A frontmatter scan of the user skills and of every enabled plugin's skills found the
flag only on `handoff` and on context-mode's `ctx-doctor`, `ctx-stats` and `ctx-upgrade`,
whose jobs are MCP tools Claude already starts. The Cookbook check and the suite on boat.

**Outstanding.** Two jobs, each in its own chat, and the add-ons line is updated with their
results: one trial of `improve-codebase-architecture` on a product repository (owner: yes in
the question dialog, 23 November 2026), and a test of each of the other skills against ours,
Superpowers first (owner, in chat, the same day). The `machine-setup` kit copy of the global
rules is refreshed by its own pull request. `/code-review ultra` stays the owner's to start
(billed).

**Dead ends.** None.

**Evidence.** The 27 frontmatters read from `mattpocock/skills` at its head of 19 November
2026 through `gh api`; the skills page read with Firecrawl. The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-typed-only-skills/release-check.log`.
