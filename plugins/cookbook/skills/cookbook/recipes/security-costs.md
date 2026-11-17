# What scanning and review cost

Measured on 17 November 2026: one committer, seven private repositories and one public.

- **CodeQL runs on Depot runners in the private repositories** (owner, 17 November 2026):
  `gh api -X PATCH repos/<owner>/<repo>/code-scanning/default-setup -f runner_type=labeled -f runner_label=depot-ubuntu-24.04`.
  The public repository stays on GitHub's runners: its minutes are free, and the Depot runner
  group does not serve a public repository. Until the standard writes the setting, a new
  private repository needs the call by hand. Measured on one repository first: 46 seconds
  against 86, and the code-scanning rule was satisfied.
- **Why.** GitHub Team includes 3,000 Actions minutes a month for private repositories. CodeQL
  (69%) and AI Scan (24%) had used 2,672 by 17 November, and the Actions budget is USD 0 with a
  hard stop: CodeQL would have stopped and the ruleset blocked every merge. A Depot minute
  past its plan's 2,000 costs the same USD 0.006 as GitHub's.
- **Read the use** with
  `gh api "organizations/<org>/settings/billing/usage?year=<y>&month=<m>"` (per day,
  repository and SKU) and `.../settings/billing/budgets`. Depot's use needs an organisation
  token, which the key store does not hold: the Depot share is unread, never zero.
- **GitHub's AI Scan is off** (owner, 17 November 2026):
  `gh api -X PATCH orgs/<org>/code-scanning/ai-scan -f pr_scan=disabled -f repository_scan=disabled`.
  It reviewed every push and wrote the security review threads. It is billed by use as
  "Code Security AI Credits" (USD 0.01 each): USD 136 in 17 days, about USD 0.53 a pull
  request, plus a quarter of the minutes. A scan still ran 15 minutes after the switch read
  `disabled`, so the lock is a budget for the SKU `code_security_ai_unit`: USD 0 with a hard
  stop. Its risk types (agent permissions, prompt injection, data disclosure) go into our
  own review's rubric.
- **The `ai-review` job is paid in cash once the plan's monthly API credit is used.** It was
  used up on 16 November. From the token counts in the review comments: USD 11 to 27 a day at
  38 to 40 pull requests a day. The owner chose one review, run on the Claude plan by a
  reviewer in the session; the API job stays until that is built and measured
  ([ai-review](ai-review.md)).
- **The purchase when the trial ends, about 28 November 2026.** Secret Protection is USD 19
  and Code Security USD 30 for each active committer a month. The owner decides after
  Semgrep's code rules are measured against the CodeQL alerts we have (due 24 November).
  What was weighed: [security-platforms](../options/security-platforms.md).
- A number of pull requests is the multiplier: every push runs the tests, CodeQL and Semgrep,
  and every pull request is reviewed. Fewer, larger pull requests cost less.
- A budget change, a purchase and a plan change are the owner's, each time.
