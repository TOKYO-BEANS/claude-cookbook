# AI review on every pull request

- The standard's `ai-review` item adds a Depot CI job and `.depot/ai-review/review.mjs`. On every pull
  request from a branch of the same repository it sends the diff, the changed files (bounded) and the
  base branch's `CLAUDE.md`/`AGENTS.md` to `claude-opus-5-5` through the Claude API with a fixed rubric,
  and posts one comment of findings (file, line, severity, evidence, fix), updated on later pushes.
- Advisory: the job always passes and is not a required check. A failed call posts
  `review unavailable: <reason>`, never "no findings"; treat that pull request as not reviewed.
- The pull request's content is untrusted data: the request has no tools, and the script only posts
  text. Fork pull requests are skipped, so they never reach the key. The job runs the base branch's
  reviewer, so a change to `.depot/ai-review/` takes effect only after it merges.
- Paid from the Ultra plan's monthly API credits: the Depot CI secret `ANTHROPIC_API_KEY_REVIEW` is a key
  in its own workspace (variable `ANTHROPIC_WORKSPACE_ID_REVIEW`), whose spend limit is the hard cap.
  Each call logs one `ai-review usage:` line. Review every change to `.depot/**`: a branch can edit the
  job and read the secret.
- Claude fixes its findings together with failed checks and CodeQL alerts; a finding blocks only with
  evidence (a failing test, a CI run, a code-scanning alert, a line of code).
