# Building a change (Superpowers)

- New behaviour starts with brainstorming (intent, then a design Claude decides: the owner
  sets the outcome and is not asked to approve a spec, a plan or a design); multi-step work
  with independent parts, or more than one session of it, gets a written plan, then
  subagent-driven-development or executing-plans; the third point sizes the rest.
- A design or plan with a choice that is costly to reverse (a data model, a migration, a
  security-sensitive design, two real options) gets one Codex consult on that choice before
  the build starts: [codex-consult](codex-consult.md). Weigh the answer, decide, and say
  what was taken and declined. Routine changes get none.
- Size the method to the job. A job one agent finishes in a session from an exact
  specification is built directly, test-first: measured on 23 November 2026, the written plan
  with a subagent per task cost 15 times the plain build for the same result on 46 hidden
  cases ([skills compared](../options/skills-compared.md)).
- Anything people use (a page, a screen, a form, a tool's defaults) follows the
  [build principles](build-principles.md): hold the change to each one's Check before it is
  called done.
- Change behaviour test-first; debug by reproducing and finding the root cause before fixing.
- Verify with fresh evidence (tests, CI) before calling anything done.
