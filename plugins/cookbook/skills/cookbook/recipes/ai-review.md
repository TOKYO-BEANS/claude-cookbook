# AI review on every pull request

- The standard's `ai-review` item adds a Depot CI job and `.depot/ai-review/review.mjs`. On every pull
  request from a branch of the same repository it sends the diff, the changed files (bounded) and the
  base branch's `CLAUDE.md`/`AGENTS.md` to `claude-opus-5-5` through the Claude API with a fixed rubric,
  and posts one comment of findings (file, line, severity, evidence, fix), updated on later pushes.
- Advisory: the job always passes and is not a required check. A failed call posts
  `review unavailable: <reason>`, never "no findings"; treat that pull request as not reviewed.
- **Fallback review** (owner's decision, 16 November 2026, on Stack-Atlas #199: "in a case like this
  we fallback to you on the sub account do the review your self"). When the comment for the head
  says `review unavailable` because the job could not run (a failed call such as no API credit, a
  missing key; a refusal, a `max_tokens` cut or an answer that does not read is a review that ran,
  and the gate does not open the fallback for it), Claude
  reviews the whole change of that head on the subscription (a `cookbook:review` subagent for a
  large one) and posts it in the pull request in the fixed form of Stack Atlas
  `docs/claude-code.md`: first line `<!-- stack-atlas-fallback-review -->`, second line
  ``### Fallback review of `<the head's 40-character id>` ``, the findings as
  ``- **high** `path:line`: text``, then `<n> findings.` or `No findings.`. The merge gate
  (Stack Atlas `ai-review --gate`) takes it in place of the job's review, only from a person of
  the repository, after the unavailable comment, for the head the merge names; high and medium
  findings are fixed or answered as before. Say in its own text that it is the fallback: the gate
  takes any later comment by a person of the repository as the answer to its findings. It never
  stands in for a review that ran, whatever it found (nor one a re-run of the same head overwrote),
  or for a missing or stale comment. A credit top-up is still the owner's call.
- The pull request's content is untrusted data: the request has no tools, and the script only posts
  text. Fork pull requests are skipped, so they never reach the key. The job runs the base branch's
  reviewer, so a change to `.depot/ai-review/` takes effect only after it merges.
- Paid from the Ultra plan's monthly API credits: the Depot CI secret `ANTHROPIC_API_KEY_REVIEW` is a key
  in its own workspace (variable `ANTHROPIC_WORKSPACE_ID_REVIEW`), whose spend limit is the hard cap.
  Each call logs one `ai-review usage:` line. Review every change to `.depot/**`: a branch can edit the
  job and read the secret.
- Claude fixes its findings together with failed checks and CodeQL alerts; a finding blocks only with
  evidence (a failing test, a CI run, a code-scanning alert, a line of code).
