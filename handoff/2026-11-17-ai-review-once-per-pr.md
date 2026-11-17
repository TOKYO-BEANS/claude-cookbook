# 17 November 2026: the AI review runs once per pull request (Stack Atlas standard v18)

**Why.** A review of every push used the plan's USD 200 of monthly Claude API credit in 12 days
(394 calls on 138 pull requests). Asked with the question dialog "Do you want the review made
cheaper, so the credit lasts the month?", the owner chose "Opus 5.5, once per PR (Recommended)"
on 16 November 2026. TOKYO-BEANS/Stack-Atlas#205 (`1f6e010`) built it as standard v18 and
TOKYO-BEANS/release-maintenance#18 (`31ced85`) taught `merge-when-green.sh` to ask for the
review. This repository went to v18 with #94 (`38ab6e0`).

**What changed here.** `recipes/ai-review.md` says how it works now: the job is its own workflow
(`.depot/workflows/ai-review.yml`), it runs when a pull request is marked ready for review and on
no push, the merge commands ask for it when the head has no `ai-review` run, never for a draft,
and by hand it is `gh pr ready <n> --undo`, then `gh pr ready <n>`. It gives the measured cost
(about USD 0.39 a call on Opus 5.5) and says that a smaller input budget, another model or no
review for some pull requests is the owner's decision. The map row, `options/check.md`,
`recipes/ci-releases.md` and `recipes/ai-review-fallback.md` follow in a clause each.
`recipes/security.md` is unchanged: its row still holds, and the page has no room.

**Verification.** `npm test`. A text change: each page was read back, and every changed page is
under the 4000-byte limit.

**Known limit (Stack Atlas `HANDOFF.md`, 17 November 2026).** Asking for a review of a pull
request that is ready already makes it a draft first, and a private repository has draft pull
requests only on GitHub Team or above. If the organisation leaves that plan, the merge commands
answer that the review could not be asked for, and nothing merges in the private repositories
until a second way to ask is built. Owner: the plan is the owner's decision.

**Outstanding.** None for these pages.
