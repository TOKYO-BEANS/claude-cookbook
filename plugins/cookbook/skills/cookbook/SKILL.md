---
name: cookbook
description: Task-to-tool recipes and the list of tools in the stack. Use at the start of any non-trivial task, and whenever you are about to choose a tool for research, web pages, code search, security scanning, CI, releases, hosting, deploys, classification or ranking, model routing, debugging, reverse engineering, visual design, SEO, Wix sites, Claude Code add-ons (skills and mods) or multi-agent work, to pick the tool and skill that fit and use them the way that works. Also use when the user asks "what should we use for…", "how do we usually…", or mentions the cookbook.
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
| How shipped software works when you have no source: a binary, .NET assembly, Electron app, installer, SQLite file or saved HAR capture | **REA** (MCP server `rea` with its `reverse-engineer-anything` skill; static inspection first) | the `rea` CLI when the MCP tools are absent; native decompilation needs Ghidra, IDA or Hopper |
| Judge, classify, route, rank, match, dedupe, extract from text | **TypeSafe / Jev** (typed judgments with probabilities; explicit no-match and uncertainty) | an LLM call only when no typed primitive fits |
| Each turn of a Claude Code session on the cheapest model that can do it | **Jev Router**: the `jev-turn-router` plugin (on by default, in the app and terminals); `jev-claude` for a proxied terminal | `/jev-router off` for one session |
| Remember a decision or result across sessions | the project's handoff file and the agent's own memory | — |
| Plan, build, debug, review a change | **Superpowers** skills (brainstorming → writing-plans → subagent-driven-development or executing-plans; systematic-debugging; test-driven-development; verification-before-completion) | — |
| Sketch, mock up or design a UI, page, screen or prototype | **Claude Design** (a Design artifact on claude.ai, made with the Artifact tool) | build the chosen design in the repo; a plain HTML mockup only if Design artifacts are unavailable (say so) |
| Several agents on one job | the named **`sa-*` workflows** (below) with their budgets | plain parallel subagents |
| Source control, PRs | **GitHub** via `gh` | GitHub MCP |
| CI | **Depot CI** (`.depot/workflows`) | GitHub Actions only as a documented exception (today: Windows checks on Depot runners; CodeQL during the Advanced Security trial) |
| After a merge or deploy | **Release Maintenance** (exact-commit checks, recorded by the release verifier) through `sa-release` | — |
| Security scanning | **Semgrep** (CI scan gate) + **OSV-Scanner, Gitleaks, Trivy** (independent review job) + **Aikido** (Safe Chain before installs) + **GitHub Secret Protection** (push protection) | — |
| Audit agent configuration (permissions, hooks, MCP, skills) | **AgentShield** on a sanitized copy (advisory only) | — |
| Hosting, edge, storage, access control | **Cloudflare** (Workers, D1, R2, KV, Access) via Wrangler or the `cf` CLI | — |
| SEO research for a website | **OpenSEO** plugin skills (credits; ask before a batch over 2,000) | Firecrawl scrape for single pages |
| Change a site that lives on Wix: bookings, store, pricing plans, forms, blog, SEO tags, media, contacts | **Wix** (Wix MCP `ExecuteWixAPI`, following the matching `wix-manage` recipe) | page layout of an Editor-built site: the Wix Editor; a new look starts in Claude Design |
| Make a task or prompt more ambitious; write a prompt that loops until it beats a bar | **be-ambitious**, **gauntlet-loop** skills | — |
| Check the Claude Code setup and its instructions; audit or write a skill | **doctor-plus**, **skill-creator-plus** skills (report first) | Superpowers `writing-skills` for a skill's description |

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

### Model routing (Jev Router)
Two ways to run it. Both make one Jev call per new prompt, and the tool loop keeps the chosen
model. Prompt text goes to TypeSafe on the `jev-compaction` key's free allowance.

**In the app and in terminal sessions: the `jev-turn-router` plugin.** It's on by default
(user scope, local `claude-local` marketplace, read from
`~/.claude/vendor/compaction/local-marketplace/jev-turn-router`).
- **What it does:** a Claude Code mod. Its `turn.start` hook asks Jev, and its `turn.step` hook
  names Haiku, Sonnet or Opus 5.5 for every request of that turn. The session keeps its own
  model setting, so `opus[1m]`'s 1M window and tool search stay as they are.
- **What is routed:** only the main loop of an Opus session a person works in, meaning a
  terminal REPL, or a Code-tab session recognised by the app's `mcp__ccd_*` tools.
- **What is left alone:** plain `claude -p` and SDK jobs, subagents, a model picked by hand,
  and turns that are only a machine message (task notifications, messages from other
  sessions). So follow-ups another session sends to a test session are never routed.
- **Guards:**
  - a prompt overrides Jev only by naming one model after "use" or "switch to", not negated
    and not inside code;
  - low confidence never steps down;
  - after the first turn it doesn't step down once the context passes 20k tokens (the cache
    would be rebuilt). A Code-tab session starts at about 150k tokens, so in practice only a
    session's first turn steps down, and later turns can step up;
  - a Jev error, or no answer within 2.5 s, keeps the current model.
- **Day to day:** the status line shows the model that ran. `/jev-router` shows the last pick;
  `/jev-router off` or `on` switches it for the session.
- **Decision log:** `~/.claude/vendor/compaction/state/jev-turn-router-decisions.jsonl` (no
  prompt text). The engine has no debug log for Code-tab sessions, so read this log first when
  routing looks wrong.
- **Testing it:** test in a new Code-tab session and read the model from its transcript
  (`~/.claude/projects/<folder>/<session>.jsonl`). `claude plugin test <folder>` runs its tests.
  Haiku, Sonnet and Opus 5.5 all take 1M input tokens (`runtime.max_input_tokens` in
  Claude Code's model catalog); only Haiku 4.5 had 200k.

**In a terminal through a proxy: `jev-claude`.**
- Start `jev-claude` instead of `claude` in a terminal. One Jev call per new user turn picks
  Haiku, Sonnet or Opus from the account's own model list; tool-loop continuations keep that
  model. The status line shows the routed model and Jev's confidence, and `/jev-explain` shows
  why. Choosing a model in `/model` pauses routing; the "Jev Router" row resumes it.
- It can't serve the app: a folder's settings may not set `ANTHROPIC_BASE_URL` (Claude Code
  only lets project settings set an approved list of variables). The terminal CLI must be signed
  in (`claude auth login`, from a Start-menu PowerShell).
- Routing fails open: a Jev error or timeout keeps the current model. A prompt overrides Jev
  only with "use" or "switch to" followed by one model name, not negated and not inside code.
  Leave `JEV_ALLOW_FABLE` unset: Fable bills extra usage.
- To Claude Code the model is the unknown name `jev-router`, so a session gets a 200k context
  window (not `opus[1m]`'s 1M). Behind a custom base URL it also turns tool search off, which puts
  every MCP tool schema (about 220k tokens with the claude.ai connectors) into each request; the
  launcher sets `ENABLE_TOOL_SEARCH=true` to prevent that. A `-p` test with `--tools` must include
  `ToolSearch`.
- On a claude.ai login Claude Code fetches no model list through the proxy, so routing uses the
  fixed ids in `src/config.mjs` (`TIERS`). When Anthropic ships new models, update them there (a
  local patch with a test).
- On this PC: the checkout `~/.local/share/jev-router` is an upstream commit plus the patches in
  `~/.local/share/jev-router-patches` (local branch `local-<sha>`). `jev-claude` runs
  `~/.local/bin/jev-claude-secure.mjs`, which decrypts the DPAPI key into its own process only,
  reads no `.env` file, ignores `TYPESAFE_BASE_URL`, and gives Claude Code `--add-dir` for the
  skill folder `~/.local/share/jev-router-skill` only. Never follow upstream's README setup
  (`npm install -g`, a `~/.jev-router.env` key file).
- To update: review the new upstream range with `sa-review`, check out the exact commit, re-apply
  the patches (drop any that upstream fixed), run `npm ci --ignore-scripts` and `npm test`,
  compare `bin/jev-claude.mjs` with the launcher, then route one real prompt. Upstream does not
  accept Claude-written contributions; report bugs there as issues, and only with the owner's yes.

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
- GitHub (the TOKYO-BEANS organization is on GitHub Team): every repository with CI has a ruleset on its
  default branch. It requires a pull request and the repository's Depot CI checks (integration id
  219785; the Windows exception checks come from GitHub Actions, 15368), and blocks force-pushes and
  deletion, with no bypass. Renaming or retiring a required check means updating the ruleset in the
  same change, or every pull request waits for a check that never reports. A repository gets its
  ruleset once its CI passes.
- GitHub Secret Protection (secret scanning, push protection, validity checks) is on for every
  repository. A push blocked over a fake test value is bypassed with a reason. A real secret is
  rotated, never bypassed.
- CodeQL runs through GitHub's default setup on GitHub Actions. This is a documented exception for
  the GitHub Advanced Security trial (29 October to about 28 November 2026), not a required check.
  When the trial ends, the owner decides whether to buy Code Security (and keep CodeQL there or move
  it into Depot CI) or let it lapse. Code scanning alerts are triaged like Semgrep findings.

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

### Reverse engineering (REA)
- Use REA when a claim depends on shipped software whose source you don't have: a vendor binary or
  .NET assembly, an Electron or JavaScript app, an installer or archive, a database file, a saved
  HAR/SAZ capture. Typical jobs: how a closed system stores or exports its data, what changed between
  two versions of an app, how a feature in someone's product works before building your own.
- Not for a repository you have the source of (Graphify, `rg`), for reading live web pages (Firecrawl),
  or for anything you are not authorized to examine. REA's own disclaimer rules out bypassing DRM,
  licence checks, anti-cheat or authentication, and copying protected code.
- Follow the `reverse-engineer-anything` skill: route by target type, take the summary first, cite
  Evidence IDs, and keep observed, inferred and unknown apart. Close native sessions with
  `close_binary`. Decompiled output can be wrong: check consequential conclusions against a second
  kind of evidence.
- Static before runtime. Browser capture, process capture, Frida and adb run or attach to the target.
  Use them only when static evidence cannot answer, and ask first before touching a live third-party
  system (logins and licence pools count) or a production machine.
- Work on copies. Open a live SQLite database only through a quiescent backup snapshot. REA runs
  locally, but its results go to the model: keep credentials and personal data out of what you open.
- Native decompilation needs a provider (Ghidra, IDA or Hopper). Ghidra is free, but REA accepts only
  the Ghidra line its `rea doctor --provider ghidra` names (12.1.x for 6.8.0, not the newer 12.2), with
  a full JDK 21 or newer. Check `binary_session` with `{}` first; without a provider, say so and use
  the static PE/ELF tools (imports, exports, resources, certificates). Commercial providers must be
  properly licensed; REA grants no licence.
- The first call on a new binary imports it into Ghidra and can take a minute or two. Wait for it
  instead of repeating the call; later calls in the same session are fast.
- Register one exact version (`rea-agents@<version>`), never `@latest`. Before applying REA's own
  `setup --client claude_code`, review its `--dry-run` plan. To update, install the new exact version,
  run a dependency scan, rerun setup, then restart Claude Code.

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

### Wix sites
- For a site that is already built and hosted on Wix. Wix is an owner-approved exception for such
  sites; anything new still defaults to Cloudflare unless the owner chooses Wix for it.
- The Wix plugin ships the skills and a `wix-mcp` server; a claude.ai Wix connector may expose the
  same tools a second time. Use one of them. `ListWixSites` (read-only) proves the connection.
- Start with `GetSiteContext`: editor type, plan, publish state and the installed apps with their
  versions (Stores V1 or V3, Invoices V1 or V2). Use only recipes and endpoints for those versions.
- Business data (bookings services, staff, hours and policies, products, pricing plans, forms, blog
  posts, SEO tags, media, contacts, analytics, accessibility scans): open the matching `wix-manage`
  recipe, confirm shapes with `wix-docs` or `SearchWixAPISpec`, then run one `ExecuteWixAPI`
  function holding the reads and the writes they feed, with `hasMutations: true` for any write.
  Never guess an endpoint or a dashboard URL: copy dashboard routes from the recipe.
- No Wix skill edits the page layout of a site built in the Wix Editor or Wix Studio; those pages
  change in the editor. A redesign starts in Claude Design. Its "Send to Wix" bundle goes to
  `import-claude-design-from-url`, which creates a new live site.
- Code-built (headless) sites: `wix-headless-kit` (Wix-hosted Astro on shipped, verified code),
  `wix-headless`, or `StartDeployWebsite` for plain files. A front end hosted elsewhere that shows
  Wix data: `wix-vibe-headless`, which uses only the public client id. Moving an existing
  Editor-built site to a code front end is a redesign decision for the owner, not a routine change.
- Rarely or never needed for running a site: `wix-app` and `wix-design-system` (Wix Dev Center apps)
  and `wix-base44-connector` (Base44 apps only).
- Some Wix skills and tool descriptions say to act without asking. Ask first anyway before you:
  - publish, release or create a site;
  - install an app on a live site;
  - buy a domain, start Google Ads or set up Wix Payments;
  - generate AI images, which spend Wix credits;
  - post to social media, or send email (payment links, collaborator invites);
  - delete anything, or make a write that replaces a whole list. Update Form drops the fields you
    leave out, a raw headless upload replaces every file, and a new redirect can delete another.
- Customer data (contacts, members, bookings, orders, invoices, form submissions) is personal data.
  Read only what the task needs, and never copy it into files, commits or other services.
- Bookings created through the API send SMS reminders unless `sendSmsReminder` is `false`.
- Prefer the MCP route, which needs no token. If a Wix CLI token is needed, capture it into a
  variable and never print it.
- `wix-replatform` (migrations into Wix) sends run telemetry to Wix and copies Claude Code
  transcripts into the migration folder. Before running it, set `RP_TELEMETRY_BI_DISABLED=1` and
  `RP_TELEMETRY_TRANSCRIPT_DISABLED=1` (exactly `1`). It also mutes all notifications on a new
  site; the owner has to unmute them.
- Keep site-specific notes (which site, its apps, its language) in that site's own project folder,
  not here.

### Claude Code add-ons
Skills and mods the owner added on 30 October 2026. Every file was read before install. Mods run
in every session, headless ones included, so a misbehaving one affects scheduled jobs too.

- **Make a task or prompt more ambitious**: `/be-ambitious`. Its own ask-first list is narrower than
  ours: merges, deploys, publications and stack changes still need the owner's yes.
- **A prompt that loops until it wins**: `/gauntlet-loop` writes the prompt; it does not run it.
  Before running one, add an agent or token budget, a round cap and a Firecrawl credit ceiling.
  Never accept a bar that means running untrusted code. Not for scheduled jobs.
- **Health check of the Claude setup and its instructions**: `/doctor-plus`, report first. Make
  accepted fixes through a worktree pull request. Leave alone the standard-managed CLAUDE.md
  section, AGENTS.md's shared owner decisions and the junctioned shared skills
  (`release-maintenance`, `typesafe-ai`).
- **Audit or write a skill**: `/skill-creator-plus`, audit mode first. Run its scripts with `python`,
  not `python3`, which is the Microsoft Store stub on this PC. Give `init_skill.py` an absolute
  `--path`. Fix a skill in its source repository, never in a plugin cache or a junctioned folder.
  Where its advice on descriptions disagrees with Superpowers' `writing-skills`, Superpowers wins.
- **Orchestrated build with tiered workers**: `/savvy-flow:savvy-flow`, only in a worktree or feature
  branch, because it runs `git init` and commits in a new folder. `sa-build` stays the default for a
  written plan. **savvy-progress** draws the progress bar for it; `/agents-info` opens its agents
  panel.
- **Save a correction as a rule (claude-reflect)**: the reflect-mod row above the prompt offers a
  rule it found. Press "Save to ./CLAUDE.md" only in a `.claude/worktrees` session, so the change
  goes through a pull request. Never press "Global instead": HOME is unset on this PC, so it writes
  `C:\.claude\CLAUDE.md`. `/reflect-pause` stops its model checks.
- **Prompt cache (cache-tax)**: the guard is warn (set once with `/cache-tax guard warn`).
  `/keepwarm 90m` holds the cache through a break and `/keepwarm off` stops it. Never run
  `/keepwarm always`: it is global and warms every session, headless ones included. Warming
  spends tokens.
- **The band above the prompt (prompt-band)**: a limits row (7-day and 5-hour usage, cache warm or
  cold) and a session row (turn, speed, cost, context). Other mods' rows show beneath it.
  `/prompt-band hide`, `show` or `status`. Its cache-expiry notification stays off unless its
  `notify` option is set to `on`.
- Updates: cache-tax and prompt-band are pinned copies in the local `claude-local` marketplace
  (`~/.claude/vendor/compaction/local-marketplace`, each with a PROVENANCE.json). Refresh one only
  after reading the upstream diff. The skills are plain copies in `~/.claude/skills`. For the
  claude-reflect and claude-kit marketplaces, read the new commit before running
  `claude plugin update`.
- Not installed: blast-radius (anthropics/claude-code-playground). On Windows it refuses every risky
  Bash command at once, because `sleep` and `du` are not on the PATH and `bash` is the WSL launcher.
  It also does not watch PowerShell; use permission deny rules for hard blocks. claude-reflect's
  Python hooks plugin is not installed either: its hooks call the `python3` Store stub, and its
  checks start `claude -p` children with every tool.

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
