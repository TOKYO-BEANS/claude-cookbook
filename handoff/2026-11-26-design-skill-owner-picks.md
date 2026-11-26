# 26 November 2026: the owner's blind picks; Anthropic's `frontend-design` is used

**Why.** The owner disagreed with the 25 November verdict (no design skill) and pointed at its
gaps: the judge saw stills cut at 7,000 px and no scrolling. The owner chose to decide by
scrolling the 18 trial pages blind.

**What changed.** `recipes/visual-design.md`: Opus builds the chosen look with Anthropic's
`frontend-design` skill loaded, makes the skill's design choices itself, and carries the best
parts of the other options into the one built. `options/design-skills-compared.md` records the
owner's picks and why a judge on stills no longer decides a visual choice. `catalog.json` lists
`frontend-design`. Outside this repository: the plugin installed for the user (version 1.1.1,
SKILL.md sha256 `d91970639e9f5c37`, the copy the trial ran), and the capture script's height cap
raised from 7,000 to 40,000 px.

**Verification.** The owner's picks, made blind in a local gallery with the letters shuffled per
brief: bike workshop C, on-call dashboard E, conference C. The key
(`owner-gallery-key.json`) maps all three to `frontend-design` runs. None of the three scrolls
sideways on the phone. The owner added that every page had parts liked and parts not. The
Cookbook check and the suite on boat.

**Outstanding.** machine-setup's copy of the user settings and its plugin inventory gain the
plugin in their own pull request.

**Dead ends.** Two routes to show the live pages on the owner's phone: a local file (the phone
cannot reach the laptop) and T3's inline HTML render of each brief (did not show on the phone).
Full-length JPEG captures at 390 px did show.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-25-design-skill-trial/owner-gallery/`
(the gallery, `phone-full/`) and `owner-gallery-key.json` beside it. The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-26-cookbook-design-skill-owner-picks/release-check.log`.
