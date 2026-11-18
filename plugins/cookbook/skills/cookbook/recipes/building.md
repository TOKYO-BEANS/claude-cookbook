# Building a change (Superpowers)

- New behaviour starts with brainstorming (intent, then a design Claude decides: the owner
  sets the outcome and is not asked to approve a spec, a plan or a design); multi-step work
  gets a written plan, then subagent-driven-development or executing-plans.
- A design or plan with a choice that is costly to reverse (a data model, a migration, a
  security-sensitive design, two real options) gets one Codex consult on that choice before
  the build starts: [codex-consult](codex-consult.md). Weigh the answer, decide, and say
  what was taken and declined. Routine changes get none.
- Change behaviour test-first; debug by reproducing and finding the root cause before fixing.
- Verify with fresh evidence (tests, CI) before calling anything done.
