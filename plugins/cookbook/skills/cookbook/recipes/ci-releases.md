# CI and releases

- Depot CI with `.depot/workflows`; read failures with `depot ci logs` / `depot ci diagnose`.
- GitHub goes through `gh` and Git only: pull requests, checks, the API (`gh api`), search.
- **The merge condition.** A pull request merges, without asking the owner, when every check on
  its head commit has passed, an `ai-review` comment for that commit exists and is not
  `review unavailable` (or, when the job could not run and it says so, Claude's fallback review of
  that commit stands in for it: the [ai-review](ai-review.md) recipe), each high or medium finding in it is fixed or answered in the pull
  request, and no security review thread on it is open (two points down). A high finding still
  disputed after two replies goes to the owner. Never skip, weaken or reword a check to get
  through.
- **A security finding is fixed, never answered away.** "Answered" is for a finding that is not
  about security. A security finding, from the review or a scanner, is fixed in the pull
  request; one Claude would dispute, dismiss or accept goes to the owner before any merge. A
  model's judgement never clears one.
- **A security review thread stops the merge.** GitHub's security review
  (`github-advanced-security`) writes each finding as a review thread on the pull request. No
  merge while one is open, on the head or on an older commit. Only a reply in that thread
  closes it: `Fixed in <commit>`, a later commit of the pull request that fixes the finding,
  or `Owner's yes (<date>): <the owner's words>`, written only after the owner has said yes to
  that thread. "With the owner" means that yes: telling or asking the owner, a planned
  follow-up or an answer leaves the thread open. Never resolve, dismiss or hide one, and never
  write either reply, to get through. How to read them, the gate and a thread that arrives
  late: [review-threads](review-threads.md).
- **A hand change to CI goes to the owner.** A pull request that changes `.depot/**` or
  `.github/workflows/**` can read the CI secrets, and the `ai-review` job runs the base branch's
  reviewer, so the review does not stop it. It does not merge on the merge condition: the
  owner sees it first. The exception is the standard's own upgrade pull request (the
  `stack-atlas-onboard` skill), which merges when green.
- **From a finished change to a merged pull request:** `sa-release` with `merge: true`, and T3's
  `watch_pull_request` to wait for checks. The watch also wakes for older commits: check the head
  commit on each wake-up. Set the number of review rounds before the first push (three). The
  budget never overrides the merge condition: after the last round only low findings go into a
  follow-up pull request, and an open high or medium finding, or any security finding, still
  blocks the merge and goes to the owner. Keep a pull request small
  enough for the AI review to read whole, and give a large change one reviewer that did not
  build it (`sa-review` or a `cookbook:review` subagent).
- **After a merge or deploy**, in the same task: Release Maintenance (commit, checks, deployed
  version, health), recorded with the release verifier, before calling it done. A failed release
  check: roll back to the last good version first, then fix through a new pull request.
- Do not merge two PRs into the same `main` back to back: a new push can cancel the earlier
  merge's CI.
