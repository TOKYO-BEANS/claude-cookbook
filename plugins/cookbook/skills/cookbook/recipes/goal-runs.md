# Long runs toward a check (`/goal`)

A job that a program can decide runs on its own until the check passes: Claude Code's `/goal`
keeps starting turns, and after each one a small model judges the condition from the
transcript (met, not yet, impossible). The idea is "hill climbing": the closer a job looks
like a pass/fail test, the longer an agent can work on it without a person.

- **When:** tests pass, output matches a reference, a benchmark beats a number, a list or
  queue reaches zero. Not for a job only taste decides, and never past a stop: a change
  customers see still needs its visual check, a merge still needs every check on the pull
  request.
- **How, headless:** `claude -p "/goal <condition>"` under the
  [scripted-runs](scripted-runs.md) rules (model, permission mode with `--allowedTools`,
  `--max-budget-usd`, `--no-session-persistence`), plus `--output-format stream-json
  --verbose`, or a long goal looks stuck. Tried 18 November 2026 on Claude Code 2.1.327:
  `claude-haiku-5-5`, plan login (`apiKeySource` `none`), met in 2 turns. Not tried yet:
  `/goal` typed in a T3 Code thread, and inside a [boat-claude](boat-claude.md) task.
- **Hooks off, no goal:** `/goal` is a Stop hook, so it is unavailable where hooks are off
  (`disableAllHooks`, `allowManagedHooksOnly` in managed settings) or the folder is not
  trusted. There, start a fresh `claude -p` under the same rules each round, with the check's
  last output in the prompt, until the check passes (`--no-session-persistence` leaves
  nothing for `--continue` to resume).
- **The condition** (up to 4,000 characters):
  - one end state and the command that proves it, which must print its result: the
    evaluator runs nothing and reads only what the transcript shows;
  - what must not change on the way: "no test, check, fixture or reference file edited";
  - a bound: "or stop after 30 turns".
- **A second stage** once it is correct: "N times faster than <baseline>, with the same
  check green".
- **A judge instead of a program** (screenshots, prose) is weaker: pin the reference, judge
  on another model ([visual-check](visual-check.md)). A public run of this kind drifted
  brighter until its author swapped the reference image.
- **"Met" is not done.** The evaluator only reads Claude's own account. The work is done when
  the checks on the result pass: tests, CI, the review.
- **Usage:** the plan only, never bought usage ([model-budget](model-budget.md)): read the
  budget line before a long goal. A goal pauses at a usage limit; it is cleared by an error
  that needs a fix, and the loop stops after several turns with no tool use.
- **What slows the run:** ask the agent at the end what blocked or slowed it and what would
  remove that; the answer goes in the handoff, and a blocker that comes back becomes its
  own job (the same as a sign-in gap).
- **Do not set** `ANTHROPIC_DEFAULT_HAIKU_MODEL` to change the evaluator: it changes every
  use of the small model.

Weighed, 18 November 2026: `/loop` (a time interval, not a condition); a Stop hook of our own
(the fallback, for a check a script must decide); many Claude subscriptions run flat out, as
in a public video of 28 October 2026 (plan limits "assume ordinary, individual usage":
[Claude Code legal page](https://code.claude.com/docs/en/legal-and-compliance); and the owner
buys no usage).
