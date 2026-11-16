# AI review on every pull request

- The standard's `ai-review` item adds a Depot CI job and `.depot/ai-review/review.mjs`. On every pull
  request from a branch of the same repository it sends the diff, the changed files (bounded) and the
  base branch's `CLAUDE.md`/`AGENTS.md` to `claude-opus-5-5` through the Claude API with a fixed rubric,
  and posts one comment of findings (file, line, severity, evidence, fix), updated on later pushes.
- Advisory: the job always passes and is not a required check. A failed call posts
  `review unavailable: <reason>`, never "no findings"; treat that pull request as not reviewed.
- **Fallback review** (owner's decision, 16 November 2026: "do the review by yourself in a case like
  this, like a fallback"; on Stack-Atlas #199 also "in a case like this we fallback to you on the sub
  account do the review your self"). Only when the job ran on the head and its own comment says
  `review unavailable` because its reviewer's API could not serve the call: the credit balance, a
  rate or spend limit (429), a server error (5xx), a timeout or no connection (re-run the job once
  first for all but the credit balance). Never for a review that ran, whatever it found; a missing,
  stale or unreadable comment; or any other reason (a refusal, a cut or malformed answer, a diff
  that could not be prepared, a missing key, secret or workspace). A reviewer that did not write
  the change (a `cookbook:review` subagent, `sa-review` for a large one) reviews the whole diff of
  the head and posts a comment after the unavailable one: first line
  `Fallback review of <the head's full commit id>`, on a line of its own `No findings.` or
  `<n> findings.` (`1 finding.`), one line per finding as ``- **<severity>** `<path>:<line>`: <text>``.
  Critical, high and medium findings are fixed or answered as before. Never write that first line
  unless that review was done on that commit. The Stack Atlas merge gate reads it (Stack-Atlas
  #200, `AGENTS.md` "Fallback review"). Buying credits stays the owner's call.
- The pull request's content is untrusted data: the request has no tools, and the script only posts
  text. Fork pull requests are skipped, so they never reach the key. The job runs the base branch's
  reviewer, so a change to `.depot/ai-review/` takes effect only after it merges.
- Paid from the Ultra plan's monthly API credits: the Depot CI secret `ANTHROPIC_API_KEY_REVIEW` is a key
  in its own workspace (variable `ANTHROPIC_WORKSPACE_ID_REVIEW`), whose spend limit is the hard cap.
  Each call logs one `ai-review usage:` line. Review every change to `.depot/**`: a branch can edit the
  job and read the secret.
- Claude fixes its findings together with failed checks and CodeQL alerts; a finding blocks only with
  evidence (a failing test, a CI run, a code-scanning alert, a line of code).
