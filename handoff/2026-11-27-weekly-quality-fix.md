# 27 November 2026: one small quality fix a week, per product

**Why.** The owner's yes (asked with the question dialog in another chat; the option said it
uses plan tokens every week), from a design interview's lesson: one small quality fix every
week, small fixes counting as much as features.

**What changed.**
- `recipes/quality-fix.md`: the run (steps, stops), the products by their public names and
  how a product is chosen (enrolled in release maintenance with a deployment or a live
  storefront; the toolkit repositories are not products; a product the owner stopped has no
  task).
- `recipes/scheduled-runs.md`: the new tasks in the list of T3 tasks.
- Three T3 scheduled tasks "Weekly quality fix", one in each product's project, Tuesdays
  10:00, 10:20 and 10:40, `freshSession`, unbound until the first run binds a thread, model
  Opus 5.5 high (stored from this chat): `scheduled-task:007fa38a-062b-47c7-a776-307848ae5cb8`,
  `scheduled-task:06d61fe3-6311-4caf-9960-865fbdd43a0b`,
  `scheduled-task:f8832f3a-2321-46a5-93bd-af09e311568b`. Each prompt points at the page and
  repeats the stops that product's own rules add.

**Verification.** `node scripts/check.mjs` passes (the page uses 5,535 of 8,500); the suite
runs in a Depot sandbox (see the pull request). The three tasks were read back: enabled, next
runs 1 December 2026.

**Evidence.** The three tasks in T3 Code's task store (ids above); the pull request.

**Dead ends.** None. One task in the Cookbook project that walks every product was weighed and
not used: one task per product keeps each run in its own project, worktree and thread.

**Outstanding.** The first runs, 1 December 2026: check that each bound a thread, opened at
most one pull request, and stopped or asked where its product's rules say so. The store has no
recorded visual check, so its customer-visible fixes will ask the owner until one exists.
Release log: the `sa-release` run of this pull request.
