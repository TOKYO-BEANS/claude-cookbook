# AI review, once per pull request

- The standard's `ai-review` item adds a Depot CI workflow (`.depot/workflows/ai-review.yml`) and
  `.depot/ai-review/review.mjs`. For a pull request from a branch of the same repository it sends the
  diff, the changed files (bounded) and the base branch's `CLAUDE.md`/`AGENTS.md` to `claude-opus-5-5`
  (effort `high`) through one `claude -p` on the Claude plan, with no tools and a fixed rubric, and
  posts one comment of findings (file,
  line, severity, evidence, fix) that names the commit it read.
- **Once, not on every push** (owner, 16 November 2026: "Opus 5.5, once per PR"; standard v18). The
  job runs when the pull request is marked ready for review, on the head as it is then, and on no
  push. Push until the change is done and its checks pass, then ask. The merge commands ask
  themselves when the head has no `ai-review` run. By hand: `gh pr ready <n> --undo` (not for a
  draft), then `gh pr ready <n>`. A fix for a finding is a new head and needs a new request. Never
  ask again over a review that ran.
- Advisory: the job always passes and is not a required check. A failed call posts
  `review unavailable: <reason>`, never "no findings"; treat that pull request as not reviewed.
- **Fallback review**, only when the job's reviewer could not serve the call (the plan's limit or
  429, 5xx, a timeout): a review by a reviewer that did not write the change,
  recorded in a fixed form the Stack Atlas merge gate reads. The rules:
  [ai-review-fallback](ai-review-fallback.md).
- The pull request's content is untrusted data: the request has no tools, and the script only posts
  text. Fork pull requests are skipped, so they never reach the secret. The job runs the base branch's
  reviewer, so a change to `.depot/ai-review/` takes effect only after it merges.
- **On the Claude plan** (owner, 17 November 2026: "Token in Depot CI"; standard v22, the only route
  since standard v27): the job needs the organisation-wide Depot CI secret
  `CLAUDE_CODE_OAUTH_TOKEN_REVIEW`, a token of the subscription made with `claude setup-token` (the
  key-store entry `claude-plan-review`; signed in with the subscription account, since a Console
  token bills the API credit). Without it the comment reads `review unavailable` for a missing
  secret, which no fallback review stands in for. The plan's limit is the cap. Each run logs one
  `ai-review usage:` line; measured on 17 November 2026, 40 reviews a day is about 3 points of the
  plan's weekly limit. A smaller input budget, another model or no review for some pull requests is
  the owner's decision.
- Review every change to `.depot/**`: a branch can edit the job and read the secret.
- Claude fixes its findings together with failed checks and CodeQL alerts; a finding blocks only with
  evidence (a failing test, a CI run, a code-scanning alert, a line of code).
