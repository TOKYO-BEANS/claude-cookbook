# Options weighed: ship

Chosen by fit for the job on 15 November 2026.

- **Source control and pull requests: `gh` and Git.** One short command, one short answer, and
  it adds nothing to a session. Weighed: the GitHub MCP server (dozens of tool names in every
  session for what `gh api` already does); the GitHub web pages in a browser (only for what
  has no API).
- **From a finished change to a merged pull request: decided after the comparison.** Two
  candidates do this step unattended:
  - `sa-release` with `merge: true`, with T3's `watch_pull_request` for the waiting. It reads
    the merge condition, knows the stops and records the release check.
  - tstack's `full-send` (`t3dotgg/tstack`, nine Markdown skills, read and scanned at
    `11e37a7`, not installed). Followed by hand once, on Stack-Atlas #181. What worked: the
    watch wake-ups, the short problem-first pull request text, and the rule that a disputed
    finding goes to the owner. What did not: its review step `sol-loop` needs a second
    provider's model in T3 Code, and only the Claude provider is on.
  The same change has not yet gone through both routes. Until that run is recorded in
  Stack-Atlas's `HANDOFF.md`, `sa-release` owns the step. Budget review rounds up front either
  way: one policy change took six rounds of about 35,000 input tokens each.
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
