# Codex: a consult

Part of [codex](codex.md). Everything on that page holds for a consult: the check of where
Codex may start, the supervised start (`runtimeMode: "approval-required"`), never on text
from outside, and no unattended run without the owner's recorded yes, which does not exist.

A consult is the name for the second opinion in the map's row: one question about our own work
to Codex, a model that is not Claude. The answer is advice: the session that asked checks each
point against the code and decides. What may be sent, the refused models and the cost:
[codex-limits](codex-limits.md). Read it before the first consult of a session.

- **When.** Before building on a choice that is costly to reverse (a data model, a migration,
  a security-sensitive design, two real options); when a diagnosis has failed twice; before a
  reply to a review finding you dispute; when the owner says "consult" or "ask Codex".
- **Not for.** What a test or a check can decide; a public fact (research); routine edits; a
  second look by Claude (`cookbook:review`). Never one on every pull request.
- **The call.** As on the Codex page, with `role: "review"`. First check what would be sent
  against the limits page and run its checks: no check, no consult; outside its standing yes,
  ask the owner before the call. Add
  `mode: "wait"` only when this turn needs the answer. Leave `serviceTier` alone.
- **The brief.** The child gets no history. Give it the repository path, the base commit or
  the files, the question, what is already ruled out, and this line: "Change no file: do not
  edit, commit, push, comment on a pull request or start subagents." Ask for a verdict,
  findings with file, line and evidence, and what it could not check. No secrets and no
  customer data in a brief.
- **What keeps it from writing** is the supervised mode's read-only sandbox, not the brief. It
  does not fence reading: see the limits page. Note `git status --short` and
  `git rev-parse HEAD` before all the same; afterwards compare both, and the branch on the
  remote. Report a change the child made; never keep one unseen.
- **While it runs.** Do not edit the files it reads. A timeout, an error or no reply is not
  agreement. One consult per question; a re-check is a new `delegate_task`, three rounds at most.
- **Afterwards.** Report what was said, taken and declined, and why.
- **A session that itself runs on Codex** has no second opinion in this row, and says so.
  Asking Claude from Codex is not proven and not a job of this page.

## What a consult does not replace

- The `ai-review` job owns the review of every pull request, and its comment is part of the
  merge condition ([ai-review](ai-review.md), [ci-releases](ci-releases.md)). A consult's
  approval counts for nothing there, and a high finding still disputed after two replies goes
  to the owner as before.
- It never clears a security finding, a failed check or one of the stops.
- tstack's `sol-loop` and `council` are not in use: see [ship](../options/ship.md).
