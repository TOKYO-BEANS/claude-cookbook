# 17 November 2026: security costs, the follow-up of #104

**Why.** Stack-Atlas #217 (merged `e87ec83`, 17 November 2026) makes the Stack Atlas
standard write and check CodeQL's runner per repository and GitHub's AI Scan, so the line
in `recipes/security-costs.md` that said a new private repository needs the runner call by
hand no longer holds. #104's fallback review left three low findings for a follow-up
(its record: #104, comment 6948918625).

**What changed.**
- `recipes/security-costs.md`: the CodeQL entry says the standard sets the runner (the
  onboarding for its repository, `org --apply` for all) and `org --check` and the daily
  audit read it. The AI scanning entry now holds the proof that it is off (below).
- `recipes/ai-review.md`: this pull request's wording fix of the cost line ("a day like
  16 November (40 reviews) costs at least USD 17 to 27 in cash") was dropped in the merge of
  `main` on 19 November: `main` had replaced that whole line with the review on the Claude
  plan (#139), so there was nothing left to fix.
- A correction to `handoff/2026-11-17-security-platforms-and-budget.md` (a record file,
  left as it is): its "What changed" list leaves out `recipes/ci-releases.md`, which #104
  also changed.

**Result (read 19 November 2026, about 08:01 UTC): GitHub's AI scanning is off, proven.**
- Usage, product `ghas`, SKU "Code Security AI Credits": 17 November, 8 rows, 1,216.63
  credits, USD 12.17 gross and net (release-maintenance 1.68, Stack-Atlas 3.61, Probiz 0.64,
  sign-in-tools 0.78, claude-cookbook 3.88, release-verifier 0.67, Molebo-Shopify 0.39,
  WeCare-Wix 0.51), the same rows as the read at 12:25 UTC that day. 18 November: no AI
  rows. 19 November so far: none.
- The newest run of `dynamic/agents/github-advanced-security` in each of the eight
  repositories was created on 17 November, the last at 12:05:45 UTC (claude-cookbook); none
  after.
- `node standard/cli.mjs org --check` (Stack-Atlas, from the clone at `b98be26`): no AI Scan
  item and no AI session item. Its state is `drift` for another reason: `machine-setup` and
  `random` run CodeQL default setup on GitHub's `standard` runner, not
  `depot-ubuntu-24.04`. Notes: configurations 291071 and 291072 are attached to no
  repository (deleting them is the owner's call).
- Not told by this: whether the USD 0 budget on `code_security_ai_unit`
  (e61575d8-d771-4726-86ba-44759db8ba89) stops a charge. Nothing was billed after the
  switch-off, so it was never tested.

**Outstanding.** The CodeQL runner drift of `machine-setup` and `random` is not this pull
request's job: the standard's `org --apply` writes it (owner: Claude, a Stack-Atlas session).

**Evidence.** `~/.local/share/stack-atlas/evidence/2026-11-17-ai-scan/` (`2026-11-19-*`:
usage JSON per day, session runs, org check, findings); Stack-Atlas `HANDOFF.md`,
"17 November 2026: the standard writes CodeQL's runner and AI Scan off (#217)".
