# Options weighed: ship

Chosen by fit for the job on 15 November 2026.

- **Source control and pull requests: `gh` and Git.** One short command, one short answer, and
  it adds nothing to a session. Weighed: the GitHub MCP server (dozens of tool names in every
  session for what `gh api` already does); the GitHub web pages in a browser (only for what
  has no API).
- **From a finished change to a merged pull request: `sa-release` with `merge: true`**, with
  T3's `watch_pull_request` for the waiting. Its merge commands read the merge condition and the
  AI review themselves and refuse without them, it knows the stops, and it records the release
  check. Weighed: tstack's `full-send` (`t3dotgg/tstack`, nine Markdown skills, read and scanned
  at `11e37a7`, not installed), followed by hand on Stack-Atlas #181 and compared with the
  `sa-*` route on #182 (the comparison is in Stack-Atlas's `HANDOFF.md`, 15 November 2026). Its
  review step `sol-loop` did not run then: only the Claude provider was on. Codex has been on
  since 16 November 2026, and `sol-loop` and `council` are still not in use: tstack is not
  installed. `sol-loop` picks the latest GPT Sol, and the ChatGPT sign-in refuses
  `gpt-6.1-sol` (an older one, `gpt-5.6-sol`, answers); it starts its reviewer in the session's
  own mode, round after round, and the owner's yes to an unattended Codex run covers a
  consult, not a loop ([codex](../recipes/codex.md)). `council` needs three providers and two
  are on. Neither checks the merge condition in code, and the review of a pull request has its
  owner. Their job, a review by another provider's model, is done by a consult, as advice
  ([codex-consult](../recipes/codex-consult.md)). What the comparison showed is kept as practice
  in `recipes/ci-releases.md`: the reviews inside the `sa-*` route found almost nothing, the AI
  review in CI and one reviewer that had not built the change found the defects, and a budget of
  three review rounds held where an unbudgeted change took six.
- **After a merge or deploy: Release Maintenance.** It checks the exact commit, the CI
  identities, the deployed version and health, and the release verifier keeps the ledger.
  Weighed: a look at the CI page (no record, no deployed version); a periodic monitor (late,
  and not tied to the commit).
- **Hosting: Cloudflare.** Workers, D1, R2, KV and Access under one account and one CLI.
  Weighed: Vercel and Netlify (strong for front ends, a second platform for data and access
  control); a virtual server (upkeep). Sites that already live on Wix or Shopify stay there
  as owner-approved exceptions.
- **Wix: the Wix MCP.** Business data through `ExecuteWixAPI` with no token on this PC.
  Weighed: the Wix CLI (needs a token; for code-built sites); the dashboard in the built-in
  browser (the fallback: page layout in the Editor has no API).
- **Shopify: the Shopify CLI and the theme skills.** Theme work as files under Git. Weighed:
  the admin in the built-in browser (the fallback: settings with no CLI route).
- **Onboarding a repository: `sa-onboard`.** It applies the standard through one pull request
  that merges only when green.
