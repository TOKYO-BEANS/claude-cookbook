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
  writing" is now "Nothing keeps an unattended run from writing" (only the brief does). The
  before-and-after audit (`git status --short`, `HEAD`, the remote branch) runs in either
  mode and now sits on `recipes/codex-limits.md`, "The audit, before and after", with its
  blind spots named.
- `recipes/codex-limits.md`: "Nothing fences reading" covers both modes. Its section "The
  owner's decisions" moved to the new page `recipes/codex-decisions.md` (the limits page was
  over the 4000-byte limit; "Never pointed at" and "Ask first" stay on the limits page,
  as Graphify asked on 19ec197), which records the two answers of 17 November word for word
  (only the second names full access). The 16 November standing yes keeps its meaning; its
  sentence "a consult still starts supervised" is gone, since the 17 November yes replaces
  it. "Models" and "Cost and no Codex" are unchanged (the first fix head, e5491af, lost them
  by mistake; restored). The three checks before the call and what may be sent are
  unchanged.
- The map row (`SKILL.md`) and `options/ship.md` follow. The yes covers a consult, not
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

**Graphify on 24c9eed.** Four medium findings: three are the limits the owner accepted (only
prose controls, no gate of its own for the mode, steering by repository text); the start check
does run for a full-access start (the hook covers every Codex start, and a test denies one).
The fourth was new: the before-and-after audit can be fooled by another writer in the
checkout. `recipes/codex-consult.md` now says nothing else writes in that checkout while the
child runs (it was "do not edit the files it reads").

**Fourth fallback review**, of 3eb0a5a: one medium (`recipes/codex.md` had lost the date of
the owner's yes, which the owner's answer asked for) and two low (`options/ship.md` line width
and "one consult"); all fixed on the next head.

**Graphify on 3eb0a5a.** Three medium: prose-only gating is an accepted limit. New: the audit
missed `.git` and ignored files, and a hook written to `.git/hooks` would run with the next Git
command; the audit, now on `recipes/codex-limits.md` ("The audit, before and after"), adds
`--ignored` and a hash of `.git/config` and `.git/hooks`, and no Git command runs in the
checkout until they match. The decisions page now says the hook runs the same start check for
both modes and none of its own for the unattended one, which Graphify read as a contradiction.

**Fifth fallback review**, of f374909: three medium, all in that new audit (the `.git` paths
do not exist in a T3 worktree, whose `.git` is a file pointing at a shared folder; `git status`
can run a planted `core.fsmonitor` before the hashes are taken; `--ignored` does not show a
changed file inside an ignored folder) and five low. That was the second failed attempt to make
the audit complete, so it was not tried a third time: the audit went back to the base's three
items, and the page names what it cannot see (Git's own folder, files inside ignored folders,
other branches, tags or pull requests, anything outside the repository). The owner was asked in
the question dialog (this chat, 18 November 2026) and answered "Accept as known limits". The
low ones are fixed: "Write nothing in that checkout" is a rule again, the decisions page gives
years, `options/ship.md` is rewrapped, and this handoff is brought up to date.
