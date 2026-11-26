# 26 November 2026: `frontend-design` is removed; the owner's picks were not an adoption

**Corrects** [2026-11-26-design-skill-owner-picks.md](2026-11-26-design-skill-owner-picks.md)
(#256). That entry says the owner's blind picks chose Anthropic's `frontend-design` and that it
"is used". The picks were real; the reading was wrong.

**Why.** The owner, the same evening, after seeing the first real job built with the skill
("a complete disaster in my opinion"): "Then we need to rewind kinda remove the design skill,
the 3 I picked out yesterday was just a do you like this better over the Gemini skill, not
adopt it?" And in this job's chat: "It not even a preference only a preference over the
Gemini skill!" So the three picks answered one question, is this page better than the Gemini
skill's. They were not a liking for the skill in general, not a ranking over no skill, and
not a yes to add it. The first sentence is the owner's yes to the uninstall.

**What changed.**
- `catalog.json`: the `frontend-design` entry is deleted.
- `recipes/visual-design.md`: the build has no design skill on top. Taken from what the failed
  job showed: options start from a look a person already likes; a new look is picked by the
  owner from full-page pictures at 1440 and 390 px, and nothing more is built before the pick;
  Claude picks alone only inside a look that already exists; after the build a reader that did
  not build the page compares the captures with the picked option. The line "pick the
  strongest yourself and build it in code" is gone: it let a look only Claude had seen be
  picked alone and built, with captures nobody looked at.
- `options/design-skills-compared.md`: "Neither is used" again; the trial's numbers unchanged;
  what the owner's picks were and were not, and the removal with its date.
- `recipes/connecting.md`: the lesson, where a tool is added: the owner's yes to a tool
  answers "shall we add this"; an answer to "which do you like better" is never that yes.
- Outside this repository: `claude plugin uninstall frontend-design@claude-plugins-official`
  (user scope, version 1.1.1, installed 26 November 07:49 UTC); the law in the private laws
  ledger; the memory note corrected.

**Verification.** `claude plugin list` no longer shows the plugin; `~/.claude/settings.json`
lost exactly one line (`jq -S` diff); a fresh `claude -p` (2.1.332, user settings loaded)
lists 120 skills and 155 commands, none naming `frontend-design`. Nothing else on the machine
loads it: no hook, no other recipe, no project `CLAUDE.md`. The Cookbook check and the suite
in a Depot sandbox.

**Outstanding.**
- machine-setup's copy of the user settings and its plugin inventory still list the plugin:
  their own pull request, opened with this one.
- The job that was built with the skill gets a new look without it, in its own chat, by the
  recipe as it now reads.

**Dead ends.** None.

**Left as it is.** Superpowers' own skill text names "frontend-design" as an example of an
implementation skill: a vendor's wording, nothing loads from it. Claude Code's plugin cache
keeps the uninstalled copy until the app clears it.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-26-design-skill-removed/`
(`uninstall.txt`, `new-session-init.json`). The trial's own evidence is unchanged. The release
check writes
`~/.local/share/release-maintenance/evidence/2026-11-26-cookbook-design-skill-removed/release-check.log`.
