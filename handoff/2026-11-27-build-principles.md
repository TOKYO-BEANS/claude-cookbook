# 27 November 2026: build principles every build and design follows

**Why.** The owner said yes (27 November 2026) to turning the design interview lessons that
are ways of building, not checks, into one page every build and design follows. The checks
from the same interview are the UI checklist (`recipes/ui-checklist.md`).

**What changed.**
- `recipes/build-principles.md` (new): nine principles, each with a Check a builder or
  reviewer can apply: the right way on the default path and the rarely right option one step
  deeper; forms ask only what the system cannot derive (small boxes, one health signal); the
  product's mood decided first and written as a `Mood:` line in its `CLAUDE.md`; delight
  small, fast and never blocking; lists become tasks in one action; use what we build and
  file every annoyance as an issue (the weekly quality fix reads them); a date never beats the
  quality bar; two or three working versions of an important screen used before choosing;
  speed as core architecture (a daily-use app answers from local data first and syncs in the
  background, decided at the start of a build; the owner added it the same day).
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

**Follow-up.** The last review of #276 left one low: principle 7's Check exempted a flaw
shipped under an owner's deadline. A follow-up pull request closed it: under a deadline the
flawed part is cut from scope or the owner was asked before the date.

**Dead ends.** None.

**Outstanding.** The shared sync layer is being weighed in its own chat; when the owner has
chosen it, link its outcome from principle 9 (owner: Claude, cleared by that choice). Existing products get their `Mood:` line when a build
next touches them, not in a sweep.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-video-lessons/` (transcript
and frames); `~/.local/share/claude-cookbook/evidence/2026-11-27-ui-checklist/STANDARD-PLAN.md`.
Release log: the `sa-release` run of this pull request.
