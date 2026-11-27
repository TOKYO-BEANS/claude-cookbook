# 27 November 2026: pull request text states the meaningful lines

**What changed.** The owner's yes of 27 November 2026 (dialog in the chat "Review Video Insights and
Vercel Setup", lessons 23 and 24 of the design interview in `recipes/video.md`'s evidence): the AI
review's report and every pull request's text state the meaningful lines apart from the total. The
`pr-text` skill's Summary now gives the size on a line of its own, printed by the new
`plugins/cookbook/skills/pr-text/meaningful-lines.mjs [base]` (git only; base `origin/HEAD` when left
out), which leaves out tests, lock files, fixtures and generated files. Its rules and its line are
the same as the Stack Atlas AI review's comment (Stack Atlas standard v35, `leftOutKind` and
`sizeLine` in `templates/ai-review/review.mjs`, its pull request named in this one's text); change
both together. The skill's last paragraph says the size line was added after the tested text.

**Verification.** `scripts/meaningful-lines.test.mjs` (three tests: the left-out kinds, the size line
with renames and binaries, `main`'s base and refusals). `node scripts/check.mjs` passes (SKILL.md of
the map unchanged); the suite runs in a Depot sandbox (see the pull request).

**Outstanding.** None. The AI review's half reaches the other repositories with Stack Atlas v35's
daily rollout.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-pr-text-meaningful-lines/`: the
sandbox log of the head; release log: the `sa-release` run of this pull request.
