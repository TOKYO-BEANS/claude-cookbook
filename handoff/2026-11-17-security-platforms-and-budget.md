# 17 November 2026: one security platform (none), and what scanning and review cost

**Why.** The owner asked whether one tool could do all of it better than the split, before
buying Secret Protection and Code Security at the end of the trial (about 28 November 2026),
and whether it could also take over the pull request review. The same day the GitHub Actions
minutes of the private repositories were about to run out.

**What the bills showed** (`gh api organizations/<org>/settings/billing/usage`, 17 November).
- Private repositories: 2,672 of the plan's 3,000 minutes, 672 on 16 November alone. By job
  (every dynamic run since 1 November, each job rounded up to a minute): CodeQL 1,849,
  AI Scan 648, Dependabot 149, the rest 44. The Actions budget was USD 0 with a hard stop.
- "Code Security AI Credits": USD 135.97, undiscounted, with no budget. It is AI Scan, the
  source of the security review threads, on every push of every pull request. Nobody had
  recorded that it is billed.
- The `ai-review` job: the plan's monthly API credit was used up on 16 November (31 reviews
  answered "credit balance too low" that evening). From the token counts in the review
  comments: USD 11 on 17 November by 11:00 UTC and USD 17 on the 16th if every review is
  priced as Opus 5.5, USD 13 and USD 27 if the reviews that ran on Fable 5.2 cost 2.5 times
  as much (a price from a local table, not confirmed). A floor either way: a pull request
  keeps one comment, and a failed call is not counted.

**The owner's answers (question dialog, 17 November 2026).**
- The minutes: "CodeQL on Depot runners".
- The two AI reviews: "One review, on the plan (Recommended)": AI Scan off now; a review on
  the Claude plan is built and measured; the API job stays until that is proven.
- The purchase: "Measure first (Recommended)": Semgrep's code rules against the CodeQL
  alerts we have, by 24 November, then the owner chooses.
- Asked about Macroscope, Depot's larger plan and Aikido with something else: answered in
  the dialog, none chosen. The reasons are in `options/security-platforms.md`.

**What changed.**
- CodeQL default setup on the seven private repositories: `runner_type: labeled`,
  `runner_label: depot-ubuntu-24.04`. Tried first on the least active one with a draft pull
  request of an empty commit (closed, branch deleted): the job ran on a Depot runner in 46
  seconds against 86, `CodeQL` passed and the pull request read `CLEAN`. After the switch a
  second repository's CodeQL run on a normal push used Depot runners. The public repository
  is unchanged.
- AI Scan: `pr_scan` and `repository_scan` read `disabled` on the organisation and on all
  eight repositories. That did not hold: 15 minutes later a "Code scanning AI
  findings" run started on this pull request's first push and ran a whole session. A budget
  was then added for the SKU `code_security_ai_unit`: USD 0, hard stop (`POST
  organizations/<org>/settings/billing/budgets`, `budget_type: SkuPricing`). The next two
  pushes each ran a whole session again, minutes after the budget. Disabling the workflow
  (`PUT .../actions/workflows/<id>/disable`) is refused with 422. The Stack Atlas chat on
  these settings found the third switch (its report reached this chat at 12:36 UTC): "Scan for AI applications", the
  `xpia-reviewer` agent that wrote the prompt-injection threads, has no API and lives only
  on the organisation's Settings, Advanced Security, Global settings, "Code scanning". The
  owner unticked it there, after 12:06 and before 12:17 UTC. The last session started at
  12:05:45 UTC; pushes at 12:17 and
  12:24 UTC started CodeQL and no session. The click detached `TOKYO-BEANS standard` from
  all eight repositories; the standard's `org --apply` attached it again at 12:20 UTC, all
  eight `enforced`, runners unchanged. Evidence:
  `~/.local/share/stack-atlas/evidence/2026-11-17-ai-scan/`.
- The Cookbook: `recipes/security-costs.md` and `options/security-platforms.md` are new;
  `recipes/security.md`, `recipes/ai-review.md`, `recipes/review-threads.md`,
  `options/check.md` and the catalog's GitHub entry say the same. No tool was added or
  retired.

**Outstanding.**
- The proof that AI scanning is off is the 18 November usage read with no new AI rows
  (17 November read USD 12.17 at 12:25 UTC). Whether the USD 0 budget bites is unproven.
  Owner: Claude, the Stack Atlas chat on these settings, which scheduled the read; from
  Stack-Atlas #217 its `org --check` and audit flag any AI scanning run after 12:06 UTC.
- Stack Atlas writes the runner from Stack-Atlas #217 (onboarding step 6c,
  `codeql-runner <repo> --apply`, and `org --apply`); until it merges a new private
  repository gets GitHub's runners. Owner: the Stack Atlas chat, which also changes the
  "by hand" line in `recipes/security-costs.md` afterwards.
- The review on the plan: not built. Owner: Claude, its own chat. It takes AI Scan's risk
  types into the rubric; the thread rule stays for threads still open.
- The measurement of Semgrep's code rules, due 24 November 2026, before the trial ends.
  Owner: Claude, its own chat. The purchase itself is the owner's.
- Depot's bill now reads: the owner saved a Depot organisation token as `depot-org` in the
  key store (17 November 2026, on a question-dialog yes). October 2026: USD 52.69 before VAT
  (the USD 20 plan, 5,265 runner minutes at USD 0.004 = USD 21.06, sandbox compute USD
  11.63). CodeQL's share shows on the November invoice, finalized on 1 December: check it.
- The Actions budget is unchanged at USD 0 with the hard stop. With CodeQL moved, and once
  AI Scan is proven off, the private repositories use about 10 minutes a day there.

**Failures and dead ends.**
- I took the `ai-scan` endpoints for undocumented; they are in GitHub's REST docs (public
  preview since 10 September 2026). They were real switches, only not the one that ran.
- Parallel's connector answered "free-tier rate limit" after two calls in the main session;
  the research runs had finished, and the vendor pages were read with Firecrawl.
- Firecrawl timed out twice on Semgrep's pricing page: its free tier is from a research
  run's sources and the catalog, not from the page.
- A re-run of an old CodeQL run is refused, and a change of runner alone starts no run:
  only a push or a pull request does.
- No independent comparison of finding quality between the scanners was found.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-17-security-platforms/`: the
usage read, the per-job minutes and the script that counted them, the review comments with
their token counts, and the four research results.
