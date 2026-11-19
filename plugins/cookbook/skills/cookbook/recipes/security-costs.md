# What scanning and review cost

Measured on 17 November 2026: one committer, seven private repositories and one public.

- **CodeQL runs on Depot runners in the private repositories** (owner, 17 November 2026):
  `gh api -X PATCH repos/<owner>/<repo>/code-scanning/default-setup -f runner_type=labeled -f runner_label=depot-ubuntu-24.04`.
  The public repository stays on GitHub's runners: its minutes are free, and the Depot runner
  group does not serve a public repository. The Stack Atlas standard writes and checks it
  (Stack-Atlas #217): the onboarding sets it for the repository it brings on, `org --apply`
  for every repository, and `org --check` and the daily audit read it. Measured on one repository first: 46 seconds
  against 86, and the code-scanning rule was satisfied.
- **Why.** GitHub Team includes 3,000 Actions minutes a month for private repositories. CodeQL
  (69%) and AI Scan (24%) had used 2,672 by 17 November, and the Actions budget is USD 0 with a
  hard stop: CodeQL would have stopped and the ruleset blocked every merge. Depot bills its
  runner minutes at USD 0.004 (October 2026: 5,265 minutes, USD 21.06), before 25% VAT.
- **Read the use** with
  `gh api "organizations/<org>/settings/billing/usage?year=<y>&month=<m>"` (per day,
  repository and SKU) and `.../settings/billing/budgets`. Depot's: `node ~/.local/bin/with-key.mjs
  depot-org DEPOT_TOKEN depot org invoices list` (then `line-items <id>`), finalized months only.
- **GitHub's AI scanning is off, proven** (owner turned it off on 17 November 2026; read on 19
  November): "Code Security AI Credits" were USD 12.17 on 17 November, all of it before the
  switch-off and unchanged since the read at 12:25 UTC that day, and none on 18 November; no
  AI scanning session ran in any of the eight repositories after 12:05:45 UTC on 17 November.
  Three switches, each billed as
  "Code Security AI Credits" (USD 0.01): `pr_scan` and `repository_scan` through `gh api -X
  PATCH orgs/<org>/code-scanning/ai-scan`, and "Scan for AI applications", which wrote the
  review threads, only on the organisation's Settings, Advanced Security, Global settings.
  That click detached the standard's configuration: the standard's `org --apply` attaches it
  again. Before: USD 136 in 17 days, a quarter of the minutes. Proof is behaviour, never a
  setting: no run of `dynamic/agents/github-advanced-security` after a push, no AI rows in
  the usage read. A USD 0 hard-stop budget on `code_security_ai_unit` is kept; whether it stops a scan is
  unproven: nothing was billed after the switch-off, so it was never tested.
- **The `ai-review` job is paid in cash once the plan's monthly API credit is used.** It was
  used up on 16 November. From the token counts in the review comments, a floor: USD 17 to 27 for the
  40 reviews of 16 November. With no balance the job answers "credit balance too low" and
  the [fallback review](ai-review-fallback.md) applies. The owner chose one review, run on the Claude plan by a
  reviewer in the session; the API job stays until that is built and measured
  ([ai-review](ai-review.md)).
- **The purchase when the trial ends, about 28 November 2026.** Secret Protection is USD 19
  and Code Security USD 30 for each active committer a month (one, 17 November). Semgrep's
  free code rules found none of CodeQL's 78 alerts (5 not fully analysed), and it has no
  free Secrets ([measured](../options/semgrep-code-vs-codeql.md)). The owner's call: "not now" on
  18 November. Without Code Security the ruleset's CodeQL rule blocks every pull request in
  the private repositories. Weighed: [security-platforms](../options/security-platforms.md).
- A number of pull requests is the multiplier: every push runs the tests, CodeQL and Semgrep,
  and every pull request is reviewed. Fewer, larger pull requests cost less.
- A budget change, a purchase and a plan change are the owner's, each time.
