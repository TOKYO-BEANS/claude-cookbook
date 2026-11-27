# 27 November 2026: build principles every build and design follows

**Why.** The owner said yes (27 November 2026) to turning the design interview lessons that
are ways of building, not checks, into one page every build and design follows. The checks
from the same interview are the UI checklist (`recipes/ui-checklist.md`).

**What changed.**
- `recipes/build-principles.md` (new): eight principles, each with a Check a builder or
  reviewer can apply: the right way on the default path and the rarely right option one step
  deeper; forms ask only what the system cannot derive (small boxes, one health signal); the
  product's mood decided first and written as a `Mood:` line in its `CLAUDE.md`; delight
  small, fast and never blocking; lists become tasks in one action; use what we build and
  file every annoyance as an issue (the weekly quality fix reads them); a date never beats the
  quality bar; two or three working versions of an important screen used before choosing.
- Where an owner rule meets a principle, the page says the owner's rule stands: a deadline
  the owner sets is kept by cutting scope, never a check, and the owner is asked before the
  date when even that fails; a new look is still picked by the owner from full-page pictures.
- Linked from `recipes/building.md` and `recipes/visual-design.md`; pointed at by
  `recipes/ui-checklist.md`. SKILL.md is unchanged (1 byte of room); the page is reached
  through those three.
- Outside the repository: `STANDARD-PLAN.md` in the UI checklist evidence folder now says this
  page joins the checklist when it becomes part of the Stack Atlas standard.

**Verification.** `node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the
pull request).

**Dead ends.** None.

**Outstanding.** None for this page. Existing products get their `Mood:` line when a build
next touches them, not in a sweep.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-video-lessons/` (transcript
and frames); `~/.local/share/claude-cookbook/evidence/2026-11-27-ui-checklist/STANDARD-PLAN.md`.
Release log: the `sa-release` run of this pull request.
