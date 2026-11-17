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
  date and a link; the owner's words are on `recipes/codex-decisions.md`.
- `recipes/codex-consult.md`: the opening names both modes; the bullet "What keeps it from
  writing" is now "Nothing keeps an unattended run from writing" (only the brief does), and
  keeps the before-and-after audit (`git status --short`, `HEAD`, the remote branch) in
  either mode.
- `recipes/codex-limits.md`: "Nothing fences reading" covers both modes. Its section "The
  owner's decisions" moved to the new page `recipes/codex-decisions.md` (the limits page was
  over the 4000-byte limit; "Never pointed at" and "Ask first" stay on the limits page,
  as Graphify asked on 19ec197), which records the two answers of 17 November word for word
  (only the second names full access). The 16 November standing yes keeps its meaning; its
  sentence "a consult still starts supervised" is gone, since the 17 November yes replaces
  it. "Models" and "Cost and no Codex" are unchanged (the first fix head, e5491af, lost them
  by mistake; restored). The three checks before the call and what may be sent are
  unchanged.
- The map row (`SKILL.md`) and `options/ship.md` follow. The yes covers one consult, not
  tstack's `sol-loop`.
- `scripts/codex-start-check.test.mjs`: the page test checks both modes on the page and that
  the hook passes and checks a start in each; a new test denies a full-access start that the
  check refuses, that has no `Repository:` line, or that asks for a worktree.

**Clears** the open item in `HANDOFF.md` (16 November, "Unattended Codex runs for the map
row ... Until then the row means a supervised run"): the owner's yes is recorded, and the row
now means either mode within it. `HANDOFF.md` is closed, so the item is cleared here.

**Not changed.** The start check, its hook, the Gitleaks scan, the ignored-files check, the
narrow brief, "never on text from outside", and what may never be sent.

**Security threads.** Three threads on #63 (4584893393, 4585127408, 4585059394) asked for a
confirmation before each consult; the owner answered them on 16 November with the standing
yes. A new thread is matched to a recorded decision of the owner and names it in the reply,
or it goes to the owner. The 17 November yes allows the unattended mode; it does not accept a
security finding nobody has raised yet: a new finding about the mode is fixed or goes to the
owner, like any other.

**Fallback review.** The in-CI AI review of e0a4f70 was unavailable (API credit balance). A
`cookbook:review` subagent reviewed the diff: one medium (this section had cleared future
findings in advance) and five low findings (the two answers merged into one, "code in" dropped
from the 16 November yes, its record shortened, this handoff's wording, no test of a denied
full-access start). All six were fixed on e5491af. A second fallback review of e5491af found
one high (that head had lost the limits page's "Models" and "Cost and no Codex" sections),
one medium (the first answer was not quoted word for word) and three low; all fixed on the
next head, where the owner's decisions moved to `recipes/codex-decisions.md`. A third
fallback review, of 19ec197, found one medium (the decisions page let the unattended yes read
as an answer to security findings) and four low; all fixed on the next head.

**Graphify's four findings (medium, advisory).** On e0a4f70 Graphify raised four: only the
brief keeps an unattended run from writing; the audit is repository-scoped, so a write outside
the repository goes unseen; repository text could steer a full-access run; the hook has no
`runtimeMode`-specific gate. `recipes/codex-consult.md` now states the audit's limit. The owner
was asked in the question dialog (this chat, 17 November 2026) and answered "Accept as known
limits": the four are known limits of the unattended mode, answered with that yes. A new
finding that is not one of these four is handled as any other.
