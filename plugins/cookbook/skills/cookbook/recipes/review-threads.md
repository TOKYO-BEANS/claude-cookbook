# Security review threads on a pull request

The rule is in [ci-releases](ci-releases.md): no merge while a thread of GitHub's security
review is open. This page is how to read the threads and what the merge commands do.

- **What they are.** `github-advanced-security` reviews each push and writes each finding as a
  review thread on a line of the diff ("Prompt injection risk", "Excessive agency risk"),
  about one round per push, a minute or two after it. It never closes a thread and gives no
  alert to look up. A thread on an older commit stays as it is when a later commit meets it.
- **Read them** with `gh api --paginate repos/<owner>/<repo>/pulls/<n>/comments`: the first
  comment of a thread has no `in_reply_to_id`, a reply names it there, and
  `original_commit_id` is the commit the thread was written on. `gh pr view --json comments`
  shows pull request comments only, never these.
- **A fix:** push the commit, then reply in the thread with `Fixed in <commit>` at the start
  (7 to 40 characters of a commit of the pull request, later than the thread's). The review of
  that push is the check on the fix: a finding that is still there comes back as a new thread.
  A thread on the head has no later commit, so a fix is a new push and a new round.
- **Not fixing it** (a dispute, an accepted risk, a follow-up) is the owner's decision: ask
  with the question dialog, one question per thread or one for a group with a recommendation,
  and write `Owner's yes (<date>): <the owner's words>` in each thread only after the yes,
  with the date as `16 November 2026` or `2026-11-16`. The gate counts it only from an owner
  of the organisation as GitHub lists them. It cannot tell who typed a reply, so writing
  either reply without its ground is a breach of the rule, not a way through.
- **The gate.** `merge-when-green.sh`, the standard's `merge-when-green` and `sa-release` ask
  Stack Atlas `scripts/workflows.mjs ai-review --gate` with the threads, the pull request's
  commits, the owners and the head; the gate runs only from the clone of Stack Atlas `main`. The threads are the last read before the merge, the merge names the
  head that was read, and a refusal prints the ids of the open threads.
- **A thread that arrives late.** The merge commands read the threads again after the merge
  and print `{"threadsAfterMerge":{"new":[...]}}`; `merge-when-green.sh` then ends with exit
  code 4 and `sa-release` with `unknown`. It is an open finding for the owner, never dismissed
  and never a reason to undo the merge. `unreadable` there means: read the threads by hand.
- **A hand `gh pr merge`** runs the same gate first and `new-threads` afterwards: the commands
  are in Stack Atlas `docs/claude-code.md`.
