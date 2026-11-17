# 17 November 2026: a consult may run unattended

**Why.** The owner said yes to an unattended Codex consult twice on 17 November 2026, both in
the question dialog: in the Stack Atlas chat "Codex works under Claude's rules" (about 14:03
UTC, "Yes (Recommended)": Claude may start Codex without the owner watching, for read-only
second opinions on our own work) and in the chat that wrote #63 (about 14:05 UTC, "Allow
unattended": "Claude may start a consult that runs without your clicks, with full access, on
your own repositories only, after the scan, ignored-files and start checks. Recorded with
today's date in recipes/codex.md through a pull request.").

**What changed.**
- `recipes/codex.md`: "Start it" names two modes. Unattended (`runtimeMode: "full-access"`)
  only for a consult on the owner's own repositories after the limits page's checks and the
  start check; supervised (`runtimeMode: "approval-required"`) for anything else. The bullet
  "An unattended run is not a job of this page ... None is recorded" is replaced by the
  date and a link; the owner's words are on `recipes/codex-limits.md`.
- `recipes/codex-consult.md`: the opening names both modes; "What keeps it from writing" now
  says nothing but the brief stops an unattended run from writing, and keeps the
  before-and-after audit (`git status --short`, `HEAD`, the remote branch) in either mode.
- `recipes/codex-limits.md`: "Nothing fences reading" covers both modes; a new bullet
  records the two answers of 17 November (the first did not name full access, the second
  did). The 16 November standing yes keeps its words. The three checks before the call and
  what may be sent are unchanged.
- The map row (`SKILL.md`) and `options/ship.md` follow. The yes covers one consult, not
  tstack's `sol-loop`.
- `scripts/codex-start-check.test.mjs`: the page test checks both modes on the page and that
  the hook passes and checks a start in each; a new test denies a full-access start that the
  check refuses, that has no `Repository:` line, or that asks for a worktree.

**Not changed.** The start check, its hook, the Gitleaks scan, the ignored-files check, the
narrow brief, "never on text from outside", and what may never be sent.

**Security threads.** Three threads on #63 (4584893393, 4585127408, 4585059394) asked for a
confirmation before each consult; the owner answered them on 16 November with the standing
yes. A thread that asks for that again is answered with it. The 17 November yes allows the
unattended mode; it does not accept a security finding nobody has raised yet: a new finding
about the mode is fixed or goes to the owner, like any other.

**Fallback review.** The in-CI AI review of e0a4f70 was unavailable (API credit balance). A
`cookbook:review` subagent reviewed the diff: one medium (this section had cleared future
findings in advance) and five low findings (the two answers merged into one, "code in" dropped
from the 16 November yes, its record shortened, this handoff's wording, no test of a denied
full-access start). All six were fixed on the next head.

**Graphify's four findings (medium, advisory).** On e0a4f70 Graphify raised four: only the
brief keeps an unattended run from writing; the audit is repository-scoped, so a write outside
the repository goes unseen; repository text could steer a full-access run; the hook has no
`runtimeMode`-specific gate. `recipes/codex-consult.md` now states the audit's limit. The owner
was asked in the question dialog (this chat, 17 November 2026) and answered "Accept as known
limits": the four are known limits of the unattended mode, answered with that yes. A new
finding that is not one of these four is handled as any other.
