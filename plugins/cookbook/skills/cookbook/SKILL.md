---
name: cookbook
description: Task-to-tool recipes and the list of tools in the stack. Use at the start of any non-trivial task, and whenever you are about to choose a tool for research, web pages, code search, security scanning, CI, releases, hosting, deploys, classification or ranking, debugging, visual design, SEO or multi-agent work, to pick the tool and skill that fit and use them the way that works. Also use when the user asks "what should we use for…", "how do we usually…", or mentions the cookbook.
---

# Cookbook

Pick the recipe for the task, check that the tool is actually connected in this session
(a configured tool is not a working one: one real call proves it), then follow the recipe.
When a tool is missing or fails, use the fallback named here and say that you did.

`catalog.json` beside this skill lists every tool in the stack; Stack Atlas follows it. Add or
remove a tool there and here in the same pull request, and run `node scripts/check.mjs` first.

## Choosing quickly

| Task | First choice | Then / fallback |
| --- | --- | --- |
| A current fact, docs lookup, comparison | **Parallel Search** (`web_search`, several queries in one call; answer from the excerpts) | `web_fetch` only for pages the excerpts did not cover; native web search only if Parallel is down (say so) |
| Read one known web page, a PDF, a JS-heavy site | **Firecrawl scrape / parse** | Parallel `web_fetch` |
| List a site's URLs, crawl a site | **Firecrawl map / crawl** (always a real `limit`; check credits first) | — |
| Code questions in public repos (issues, PRs, READMEs) | **Firecrawl developer search** (`categories: ["developer"]`) | GitHub search via `gh` |
| A known technical problem ("has anyone solved…") | **Firecrawl developer search**: read the source issue or pull request and check it applies | Parallel Search |
| Papers and studies | **Firecrawl research index** | Parallel Search |
| Where is X defined, who calls Y, what breaks if Z changes | **Graphify** (`graphify_find`, `graphify_callers`, `graphify_impact`, `graphify_tests_for`) — check its indexed commit against your branch first | `rg` / reading files |
| A literal string, comment or config value | `rg` (ripgrep) | — |
| Judge, classify, route, rank, match, dedupe, extract from text | **TypeSafe / Jev** (typed judgments with probabilities; explicit no-match and uncertainty) | an LLM call only when no typed primitive fits |
| Remember a decision or result across sessions | the project's handoff file and the agent's own memory | — |
| Plan, build, debug, review a change | **Superpowers** skills (brainstorming → writing-plans → subagent-driven-development or executing-plans; systematic-debugging; test-driven-development; verification-before-completion) | — |
| Sketch, mock up or design a UI, page, screen or prototype | **Claude Design** (a Design artifact on claude.ai, made with the Artifact tool) | build the chosen design in the repo; a plain HTML mockup only if Design artifacts are unavailable (say so) |
| Several agents on one job | the named **`sa-*` workflows** (below) with their budgets | plain parallel subagents |
| Source control, PRs | **GitHub** via `gh` | GitHub MCP |
| CI | **Depot CI** (`.depot/workflows`) | GitHub Actions only as a documented exception |
| After a merge or deploy | **Release Maintenance** (exact-commit checks, recorded by the release verifier) through `sa-release` | — |
| Security scanning | **Semgrep** (CI scan gate) + **OSV-Scanner, Gitleaks, Trivy** (independent review job) + **Aikido** (Safe Chain before installs) | — |
| Audit agent configuration (permissions, hooks, MCP, skills) | **AgentShield** on a sanitized copy (advisory only) | — |
| Hosting, edge, storage, access control | **Cloudflare** (Workers, D1, R2, KV, Access) via Wrangler or the `cf` CLI | — |
| SEO research for a website | **OpenSEO** plugin skills (credits; ask before a batch over 2,000) | Firecrawl scrape for single pages |

## Recipes

### Research
1. Parallel Search with 2–3 queries in one call. Most answers are in the excerpts.
2. Fetch only the pages the excerpts did not cover (Parallel `web_fetch` or Firecrawl scrape).
3. For technical "has this been solved" questions, use Firecrawl developer search and read the source
   issue or pull request before trusting it.
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

### Building a change (Superpowers)
- New behaviour starts with brainstorming (intent, then a design the user approves); multi-step work
  gets a written plan, then subagent-driven-development or executing-plans.
- Change behaviour test-first; debug by reproducing and finding the root cause before fixing.
- Verify with fresh evidence (tests, CI) before calling anything done.

### Security in a repository
- Two CI jobs on every commit: `semgrep` (scan gate on high/critical and reachable vulnerable
  dependencies) and `security` (OSV-Scanner, Gitleaks with the repo's `.gitleaks.toml`, Semgrep
  community rules, Trivy). Pin scanners by version and checksum; install Trivy only from immutable
  releases.
- A Gitleaks exception is one rule and one exact value pattern — never a `paths` allowlist, never a
  model's judgment alone. A false-positive verdict is not a clean scan.
- Aikido Safe Chain runs before every `npm ci` / `pip install`.

### Agent configuration audit (AgentShield)
- Scan a sanitized copy of the agent configuration, never the live one with secrets in it.
- Findings are advisory: report what is new since the baseline; change nothing automatically.

### CI and releases
- Depot CI with `.depot/workflows`; read failures with `depot ci logs` / `depot ci diagnose`.
- Merge only when every required check is green on the exact head commit; after a merge or deploy,
  run Release Maintenance (commit, checks, deployed version, health) and record it with the release
  verifier before calling it done.
- Do not merge two PRs into the same `main` back to back: a new push can cancel the earlier merge's CI.

### Cloudflare
- Projects with a `wrangler.jsonc` use the project-pinned Wrangler; otherwise the `cf` CLI.
- Before a deploy: build, test, dry run, list pending D1 migrations, note the rollback version.
  Deploys and Access changes need the owner's explicit yes.

### Debugging
- Reproduce first, trace the data flow (Graphify), form one hypothesis, write the failing test, then
  fix. After three failed fixes, question the design instead of trying a fourth.

### Visual design (Claude Design)
- The default for anything visual: new pages, screens, dashboards, layouts, component looks and
  redesigns. Start on a Design canvas before writing UI code whenever the look needs a decision.
- Call the Artifact tool with `action: "quickstart"` and `intent: "design"`, then publish from the
  Design type it returns. Use the project's design system when one exists, otherwise the default.
- Put 2–3 options side by side, let the user pick or comment, then build the chosen one in code. The
  canvas is the decision record; the repository holds the real implementation (themes, components,
  tests).
- Not for backend or non-visual work, or a small fix inside an existing, clear design.
- Canvases stay private until the user shares them. Send only what the mockup needs: no secrets,
  customer data or private repository content.
- Syncing a local component library to a claude.ai design system is a separate flow (`/design-sync`)
  that the user starts.

### SEO (OpenSEO)
- Use the OpenSEO plugin's skills (audit, keyword research, competitors, backlinks, local SEO,
  reports). Research uses credits: ask before a planned batch over 2,000 credits.
- It never buys credits or changes a subscription.

## Multi-agent workflows (`sa-*`)

These run on Claude Code's Workflow tool.

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
