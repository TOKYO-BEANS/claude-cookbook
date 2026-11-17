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
  owner's yes with its date and words.
- `recipes/codex-consult.md`: the opening names both modes; "What keeps it from writing" now
  says nothing but the brief stops an unattended run from writing, and keeps the
  before-and-after audit (`git status --short`, `HEAD`, the remote branch) in either mode.
- `recipes/codex-limits.md`: "Nothing fences reading" covers both modes; the standing yes
  says the consult may run unattended since 17 November 2026, the checks first. The three
  checks before the call and what may be sent are unchanged.
- The map row (`SKILL.md`) and `options/ship.md` follow. The yes covers one consult, not
  tstack's `sol-loop`.
- `scripts/codex-start-check.test.mjs`: the page test checks both modes on the page and that
  the hook passes and checks a start in each.

**Not changed.** The start check, its hook, the Gitleaks scan, the ignored-files check, the
narrow brief, "never on text from outside", and what may never be sent.

**Security threads.** Three threads on #63 (discussions 4584893393, 4585127408, 4585059394)
were accepted by the owner as asking for a yes before each consult. A review that raises the
unattended mode again is answered with the two answers above, not re-asked.
