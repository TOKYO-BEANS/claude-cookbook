# AI review, once per pull request

- The standard's `ai-review` item adds a Depot CI workflow (`.depot/workflows/ai-review.yml`) and
  `.depot/ai-review/review.mjs`. For a pull request from a branch of the same repository it sends the
  diff, the changed files (bounded) and the base branch's `CLAUDE.md`/`AGENTS.md` to `claude-opus-5-5`
  (effort `high`) through the Claude API with a fixed rubric, and posts one comment of findings (file,
  line, severity, evidence, fix) that names the commit it read.
- **Once, not on every push** (owner, 16 November 2026: "Opus 5.5, once per PR"; standard v18). The
  job runs when the pull request is marked ready for review, on the head as it is then, and on no
  push. Push until the change is done and its checks pass, then ask. The merge commands ask
  themselves when the head has no `ai-review` run. By hand: `gh pr ready <n> --undo` (not for a
  draft), then `gh pr ready <n>`. A fix for a finding is a new head and needs a new request. Never
  ask again over a review that ran.
- Advisory: the job always passes and is not a required check. A failed call posts
  `review unavailable: <reason>`, never "no findings"; treat that pull request as not reviewed.
- **Fallback review**, only when the job's reviewer API could not serve the call (the credit ran
  out, 429, 5xx, a timeout, no connection): a review by a reviewer that did not write the change,
  recorded in a fixed form the Stack Atlas merge gate reads. The rules:
  [ai-review-fallback](ai-review-fallback.md).
- The pull request's content is untrusted data: the request has no tools, and the script only posts
  text. Fork pull requests are skipped, so they never reach the key. The job runs the base branch's
  reviewer, so a change to `.depot/ai-review/` takes effect only after it merges.
- Paid from the Ultra plan's monthly API credits (USD 200): the Depot CI secret
  `ANTHROPIC_API_KEY_REVIEW` is a key in its own workspace (variable `ANTHROPIC_WORKSPACE_ID_REVIEW`),
  whose spend limit is the hard cap. Each call logs one `ai-review usage:` line. Measured on
  16 November 2026: about USD 0.39 a call on Opus 5.5 (83,000 input and 3,100 output tokens). A
  review of every push took 2.9 calls a pull request and used a month's credit in 12 days; one
  review of the commit about to merge is about USD 0.40 to 0.60 a pull request. A smaller input
  budget, another model or no review for some pull requests is the owner's decision.
- The month's credit was used up on 16 November 2026; after that each review is cash, USD 11
  to 27 a day at 38 to 40 pull requests a day. The owner chose (17 November 2026) one review
  on the Claude plan, by a reviewer in the session, in the fallback review's form. Not built
  yet: this job stays the review until it is, measured ([security-costs](security-costs.md)).
- Review every change to `.depot/**`: a branch can edit the job and read the secret.
- Claude fixes its findings together with failed checks and CodeQL alerts; a finding blocks only with
  evidence (a failing test, a CI run, a code-scanning alert, a line of code).
