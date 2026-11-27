# 27 November 2026: every agent change comes with a summary, the changes and an undo

**Why.** The owner's yes (27 November 2026, in another chat's question dialog) to a design
interview's lesson: an agent's "made some changes" comes with a short summary, a "show
changes" toggle and an undo. Outcome: wherever our products or tools let an agent or a
model-driven script change something, people get those three.

**What changed.**
- `recipes/agent-changes.md` (new): the three, how each is checked (the undo by a test that
  changes, undoes and compares), a row per kind of change, what is out of scope, what cannot
  be undone (a send, a payment: summary, preview and the stops), new work.
- Linked from `recipes/judgement.md`, `recipes/scripted-runs.md` and `recipes/ai-review.md`
  (SKILL.md has 1 byte of room: no new map row).
- `recipes/learning-loop.md`: the weekly run copies `laws.md` and a memory note before it
  edits one, and names each file it changed.
- Two T3 tasks in the Cookbook project, updated and read back (not in git): "Weekly fixer"
  (`scheduled-task:09b58e27-…`) and "Weekly lessons" (`scheduled-task:b8af2b86-…`) keep a copy of each
  memory note or `laws.md` before and after an edit, under
  `~/.local/share/claude-cookbook/agent-changes/<date>/<task>-<time>/` at its full path, never
  overwritten, and name each file, its copy and the undo in their closing message. The undo
  copies back only while the file still equals the after copy (AI review, first round).

**The inventory.** 11 repositories and the live task prompts, read from each default branch:
22 places a model or agent changes something. 12 met the rule or were out of scope (a
report-only review comment, a model's own context, changes made by fixed rules alone, a sent
mail that is asked first). The gaps, each given to the repository that owns it:
- The AI fix comment shows counts but not the model's own summary, and names no undo; the
  onboarding pull request does not say that a model picked the test command, nor name a
  ruleset it replaced (whose old value is not kept): the Stack Atlas repository's chat.
- A product's model rewrites a planning field and clears a hand-set number the log does not
  keep, with no undo; a model's guess is overwritten with no history: that product's chat.
- The subscriptions dashboard refresh deletes the earlier uploads: the machine-setup chat.
- Browser actions in a signed-in profile log only the command name; a used sign-in mail is
  deleted for good: the sign-in tools chat.
- The mail sorter records no per-mail move, so a move cannot be shown or put back: a
  pull request of its own in this repository.
- The two weekly tasks above edit memory and `laws.md` with no copy: fixed here.

**Verification.** `node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the
pull request).

**Dead ends.** None.

**Outstanding.** The four repository chats' pull requests, and the mail sorter's undo here.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-agent-changes/inventory.md`
(the full inventory, with file and line for each place). Release log: the `sa-release` run of
this pull request.
