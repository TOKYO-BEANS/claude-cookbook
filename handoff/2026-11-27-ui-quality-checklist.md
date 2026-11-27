# 27 November 2026: a UI quality checklist in every site's visual check

**Why.** The owner said yes (27 November 2026) to a UI checklist our sites and apps are held
to, from a public design interview's lessons, used by each site's visual check, each item
checkable by a script where possible and by the judge on another model otherwise.

**What changed.**
- `recipes/ui-checklist.md` (new): 14 items (tooltips and their timing, menus from their
  trigger, the submenu safe triangle, focused pickers that filter by typing and never move an
  item under the cursor, state and gesture hints, animation with a purpose, palettes from a
  few tokens, a millisecond budget per key interaction, no spinner where local data answers,
  text fields sized for the answer), each marked script or judge; how the check uses them as
  a fifth layer "UI rules", new violations against old ones, the site's own settings, proof.
- `recipes/visual-check-build.md`: five layers, the fifth links the checklist.
- `recipes/visual-check.md`: what a site is held to, and that a check built before the list
  gets it through a pull request in the site's repository. SKILL.md is unchanged (2 bytes of
  room); the visual-check row reaches the page through these two.
- Nothing that asks the owner is shortened: the list of what a pass does not cover stays.

**Verification.** `node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the
pull request).

**Dead ends.** None.

**Outstanding.** The rollout: one pull request per site check script. Today one site has a
check (the first site); its rollout is a job of its own in that repository, opened after this
merge. Until that layer is merged and proved there, its check runs four layers.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-video-lessons/` (transcript
and frames behind the lessons). Release log: the `sa-release` run of this pull request.
