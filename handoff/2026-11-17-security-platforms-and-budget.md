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
  eight repositories. That alone did not hold: 15 minutes later a "Code scanning AI
  findings" run started on this pull request's first push and ran a whole session. So a
  budget was added for the SKU `code_security_ai_unit`: USD 0, hard stop (`POST
  organizations/<org>/settings/billing/budgets`, `budget_type: SkuPricing`). What the next
  push showed is in the pull request.
- The Cookbook: `recipes/security-costs.md` and `options/security-platforms.md` are new;
  `recipes/security.md`, `recipes/ai-review.md`, `recipes/review-threads.md`,
  `options/check.md` and the catalog's GitHub entry say the same. No tool was added or
  retired.

**Outstanding.**
- Stack Atlas does not write the runner setting or the AI Scan setting yet, and its
  `docs/depot-ci.md` still calls CodeQL on GitHub-hosted runners a permanent exception. Until
  it does, a new private repository gets GitHub's runners, and a re-applied configuration
  may put them back. Owner: Claude, in a Stack Atlas chat opened today.
- The review on the plan: not built. Owner: Claude, its own chat. It takes AI Scan's risk
  types into the rubric; the thread rule stays for threads still open.
- The measurement of Semgrep's code rules, due 24 November 2026, before the trial ends.
  Owner: Claude, its own chat. The purchase itself is the owner's.
- Depot's use is unread: `depot org credits` needs an organisation token, which the key
  store does not hold. A Depot minute past the plan's 2,000 costs USD 0.006. What clears it:
  the owner saves a Depot organisation token in the key store (one masked window).
- The Actions budget is unchanged at USD 0 with the hard stop. With CodeQL and AI Scan gone
  from GitHub's runners, the private repositories use about 10 minutes a day there.

**Failures and dead ends.**
- The `ai-scan` endpoints are not in GitHub's REST docs that were found; the switch was
  accepted and read back, and a scan ran all the same. Whether it takes effect later, or is
  not the control, is not known. What clears it: the Stack Atlas chat on these settings.
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
