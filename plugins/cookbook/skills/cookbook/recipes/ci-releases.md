# CI and releases

- Depot CI with `.depot/workflows`; read failures with `depot ci logs` / `depot ci diagnose`.
- GitHub goes through `gh` and Git only: pull requests, checks, the API (`gh api`), search.
- **The merge condition.** A pull request merges, without asking the owner, when every check on
  its head commit has passed, an `ai-review` comment for that commit exists and is not
  `review unavailable`, and each high or medium finding in it is fixed or answered in the pull
  request. A high finding still disputed after two replies goes to the owner. Never skip, weaken
  or reword a check to get through.
- **From a finished change to a merged pull request:** `sa-release` with `merge: true`, and T3's
  `watch_pull_request` to wait for checks. The watch also wakes for older commits: check the head
  commit on each wake-up. Whether tstack's `full-send` takes over this step is decided after the
  comparison run; its result goes in Stack-Atlas's `HANDOFF.md`.
- **After a merge or deploy**, in the same task: Release Maintenance (commit, checks, deployed
  version, health), recorded with the release verifier, before calling it done. A failed release
  check: roll back to the last good version first, then fix through a new pull request.
- Do not merge two PRs into the same `main` back to back: a new push can cancel the earlier
  merge's CI.
