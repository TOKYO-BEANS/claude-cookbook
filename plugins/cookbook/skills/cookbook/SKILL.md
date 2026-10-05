---
name: cookbook
description: Task-to-tool recipes. Use at the start of any non-trivial task, and whenever you are about to choose a tool for research, web pages, code search, security scanning, CI, hosting, deploys, classification or ranking, project memory, session history, terminal output, debugging or multi-agent work, to pick the tool and skill that fit and use them the way that works. Also use when the user asks "what should we use for…", "how do we usually…", or mentions the cookbook.
---

# Cookbook

Pick the recipe for the task, check that the tool is actually connected in this session
(a configured tool is not a working one: one real call proves it), then follow the recipe.
When a tool is missing or fails, use the fallback named here and say that you did.

## Choosing quickly

| Task | First choice | Then / fallback |
| --- | --- | --- |
| A current fact, docs lookup, comparison | **Parallel Search** (`web_search`, several queries in one call; answer from the excerpts) | `web_fetch` only for pages the excerpts did not cover; native web search only if Parallel is down (say so) |
| Read one known web page, a PDF, a JS-heavy site | **Firecrawl scrape / parse** | Parallel `web_fetch` |
| List a site's URLs, crawl a site | **Firecrawl map / crawl** (always a real `limit`; check credits first) | — |
| Code questions in public repos (issues, PRs, READMEs) | **Firecrawl developer search** (`categories: ["developer"]`) | GitHub search via `gh` |
| Papers and studies | **Firecrawl research index** | Parallel Search |
| A known technical problem ("has anyone solved…") | **Stack Overflow for Agents (SOFA)**: search, read the source post, check it applies | Parallel Search |
| Where is X defined, who calls Y, what breaks if Z changes | **Graphify** (`graphify_find`, `graphify_callers`, `graphify_impact`, `graphify_tests_for`) — check its indexed commit against your branch first | `rg` / reading files |
| A literal string, comment or config value | `rg` (ripgrep) | — |
| Judge, classify, route, rank, match, dedupe, extract from text | **TypeSafe / Jev** (typed judgments with probabilities; explicit no-match and uncertainty) | an LLM call only when no typed primitive fits |
| Remember a decision or result across sessions | **Waggle** (project-scoped; store outcomes, not chatter) | the project's handoff file |
| Save, resume, inspect or publish an agent session's history | **AgentGit** (`agit`; only when asked, or when the session already has an AgentGit identity) | the project's handoff file; code stays in GitHub |
| Plan, build, debug, review a change | **Superpowers** skills (brainstorming → writing-plans → subagent-driven-development or executing-plans; systematic-debugging; test-driven-development; verification-before-completion) | — |
| Several agents on one job | the named **`sa-*` workflows** (below) with their budgets | plain parallel subagents |
| Source control, PRs | **GitHub** via `gh` | GitHub MCP |
| CI | **Depot CI** (`.depot/workflows`) | GitHub Actions only as a documented exception |
| Security scanning | **Semgrep** (CI scan gate) + **OSV-Scanner, Gitleaks, Trivy** (independent review job) + **Aikido** (Safe Chain before installs) | — |
| Hosting, edge, storage, access control | **Cloudflare** (Workers, D1, R2, KV, Access) via Wrangler or the `cf` CLI | — |
| Polish substantial English prose | **Grammarly** through the browser | careful self-edit |
| Shorten a noisy command's output (status, test and build summaries) | **RTK** (`rtk <command>` for supported commands; check the exit status separately) | the plain command when exact output, parsing or failure detail matters |
| Terser replies, when the user asks for them | **Caveman** skill (`/caveman`; off by default) | normal, clear prose |

## Recipes

### Research
1. Parallel Search with 2–3 queries in one call. Most answers are in the excerpts.
2. Fetch only the pages the excerpts did not cover (Parallel `web_fetch` or Firecrawl scrape).
3. For technical "has this been solved" questions, also ask SOFA; read the post before trusting it.
4. Cite every claim with the URL it came from. Report paid usage you saw; "not reported" is not zero.

### Firecrawl without surprises
- Scrape, map and search cost credits; JSON/extract cost extra. Check the balance before batches.
- Every crawl gets an explicit `limit`; every agent run an explicit `maxCredits`.
- A blocked or bot-protected site is not fixed by retrying elsewhere: report it.

### Code navigation
- Graphify answers structure questions from an indexed snapshot. Compare its `commitSha` with your branch;
  a semantic match may name a different symbol, and an empty caller list does not prove code is unused.
- Unindexed changes (your branch, local edits) need `rg` and reading.

### Classification and judgment (Jev)
- Use it whenever code needs a judgment about text that rules cannot make: routing, tagging, ranking,
  matching, extraction choices, "is this the same thing", gating an action.
- Ask for typed outputs, keep an explicit "no match / uncertain" outcome, cache by input fingerprint,
  and evaluate on labelled examples that are never sent as inputs.
- Keep exact calculations, permissions and fixed business rules in code; confidence alone never
  authorizes a write or clears a security finding.

### Security in a repository
- Two CI jobs on every commit: `semgrep` (scan gate on high/critical and reachable vulnerable
  dependencies) and `security` (OSV-Scanner, Gitleaks with the repo's `.gitleaks.toml`, Semgrep
  community rules, Trivy). Pin scanners by version and checksum; install Trivy only from immutable
  releases.
- A Gitleaks exception is one rule and one exact value pattern — never a `paths` allowlist, never a
  model's judgment alone. A false-positive verdict is not a clean scan.
- Aikido Safe Chain runs before every `npm ci` / `pip install`.

### CI and releases
- Depot CI with `.depot/workflows`; read failures with `depot ci logs` / `depot ci diagnose`.
- Merge only when every required check is green on the exact head commit; after a merge or deploy,
  verify the release (commit, checks, deployed version, health) before calling it done.
- Do not merge two PRs into the same `main` back to back: a new push can cancel the earlier merge's CI.

### Cloudflare
- Projects with a `wrangler.jsonc` use the project-pinned Wrangler; otherwise the `cf` CLI.
- Before a deploy: build, test, dry run, list pending D1 migrations, note the rollback version.
  Deploys and Access changes need the owner's explicit yes.

### Debugging
- Reproduce first, trace the data flow (Graphify), form one hypothesis, write the failing test, then
  fix. After three failed fixes, question the design instead of trying a fourth.

### Session history (AgentGit)
- Run `agit` only when the user asks to save, resume, inspect or publish a session, or when the
  session already has an explicit AgentGit identity. Unrelated tasks need no AgentGit checks.
- It versions conversations in its own Agent repo; GitHub stays the source control for code.
- Name the target explicitly (`<owner/repo>@<branch>`). Never pick a repo or session from the
  directory name, the newest transcript or the one used last time.
- `agit commit` saves locally; `agit push` publishes. No bulk upload of past conversations, share
  links or remote control (`rc`) unless the user asks for that exact action.

### Compact terminal output (RTK)
- Prefix supported commands whose readable output is long (`rtk git status`, test and build
  summaries). Leave shell built-ins, pipelines, login or provisioning commands and anything a parser
  reads as JSON unwrapped. RTK keeps full output locally, so keep secrets out of it.
- A summary is not the full record: check the exit status separately, and get the raw output
  (`rtk recall <hash>`, `rtk proxy <command>` or the plain command) before diagnosing a failure or
  calling it fixed. Do not rerun a command with side effects just to see its output.
- Never let compressed output hide a failing test or a security finding; run scans and required
  validation without it.
- `rtk gain` reports estimates. Label them as estimates; claim no token savings you have not measured.

### Terse replies (Caveman)
- Keep it off unless the user asks: the plugin starts in `full` mode on its own unless
  `CAVEMAN_DEFAULT_MODE=off`. `/caveman lite|full|ultra` turns it on; "normal mode" turns it off.
- It shortens prose only. Code, commands, exact error text, approvals, security warnings and evidence
  stay verbatim; commits, PR text and docs stay normal prose.
- The skill (how the agent writes), the CLI proxy (shrinks what the agent reads) and the app
  middleware are separate. Use the proxy only for a supported workload you have verified.
- Claim savings only from a measured A/B run on your own work.

## Multi-agent workflows (`sa-*`)

**Claude Code only:** these run on Claude Code's Workflow tool. In Codex, follow the same steps by
hand: one implementer, one reviewer, evidence first, and the same owner stops.

Named workflows in `~/.claude/workflows/` keep ultracode's structure with proportionate execution:
one implementer and one reviewer per task, real evidence (tests, CI, Semgrep, Graphify) over extra
opinions, an agent budget, and owner stops for merges, deploys, first publications and paid services.

| Workflow | For | Budget |
| --- | --- | --- |
| `sa-review` | a commit range or PR: evidence first, then one reviewer | 3 |
| `sa-release` | after a merge or deploy; or merge an approved PR when green | 1 |
| `sa-research` | a public question with cited sources | 4 |
| `sa-build` | a written plan, task by task, to a green PR | 8 |
| `sa-debug` | a reproducible bug: failing test first, then fix and review | 4 |
| `sa-triage` | a repository's Semgrep findings, one fix PR | 6 |
| `sa-deploy` | a Worker deploy at a merged commit, stopping for the owner | 2 |
| `sa-onboard` | bring a repository onto the shared standard | 2 |

## Ground rules that apply to every recipe

- Credentials never go into chat, files or commands as literals; programs get keys at run time from
  an encrypted store.
- Ask before anything hard to undo or outward-facing: merges, deploys, publishing, access grants,
  payments, deleting data.
- Report outcomes as they are: a failed check is reported with its output, a skipped step is named,
  "unknown" is never shown as healthy.
