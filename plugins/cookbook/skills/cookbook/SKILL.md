---
name: cookbook
description: Task-to-tool recipes and the list of tools in the stack. Use at the start of any non-trivial task, and whenever you are about to choose a tool for research, web pages, code search, security scanning, CI, releases, hosting, deploys, classification or ranking, model choice, debugging, reverse engineering, visual design, photo sharpening, masks and cut-outs (no tool yet: say so), SEO, Wix sites, a change customers see on a live site (its visual check), Claude Code add-ons, scripted `claude -p` runs or multi-agent work, to pick the tool and skill that fit and use them the way that works. Also use when the user asks "what should we use for…", "how do we usually…", or mentions the cookbook.
---

# Cookbook

The map below is the design of the whole setup: every job has one owner and one fallback.
Find the job, check that its owner is connected in this session (one real call proves it; a
configured tool is not a working one), then `Read` the recipe page the row names and follow
it. Read a page only when its job comes up. When the owner is missing or fails, use the
fallback and say that you did.

- Recipe pages are in `recipes/` beside this file; every page fits one `Read`.
- Why each owner was chosen, and what else was weighed (tools outside the stack included):
  [build](options/plan-and-build.md), [check](options/check.md), [ship](options/ship.md),
  [reach outside](options/reach-outside.md), [keep healthy](options/keep-healthy.md).
- `catalog.json` beside this skill lists every tool in the stack. Add, change or retire a tool
  there, in the map and in its recipe page in the same pull request, and run `npm test` first.
  A retired tool is deleted, not listed: git history is the record.

## The map

| Job | Owner | Fallback | Recipe |
| --- | --- | --- | --- |
| **Plan and build** | | | |
| Plan, build or debug a change | **Superpowers** skills | the same steps inline | [building](recipes/building.md), [debugging](recipes/debugging.md) |
| A long job a program can check: run until the check passes | **Claude Code** `/goal` | a Stop hook with a script check | [goal-runs](recipes/goal-runs.md) |
| Several agents on one job | the named **`sa-*`** workflows, within their budgets | plain parallel subagents | [workflows](recipes/workflows.md) |
| One bounded side piece: an edit, a cited answer, a read-only review, a step that only reads | a Cookbook dispatch profile (`cookbook:mechanical`, `cookbook:research`, `cookbook:review`, `cookbook:reader`, `cookbook:reader-graph`) | T3 `delegate_task`, only for a piece that needs its own checkout | [dispatch](recipes/dispatch.md) |
| A second opinion (a consult) on our own work from a model that is not Claude: a design, a risky change, a cross-check | **Codex**, as a T3 `delegate_task` run, unattended on our own repositories after the checks (owner, 17 November 2026) or supervised; never on text from outside | a `cookbook:review` subagent | [codex](recipes/codex.md), [codex-consult](recipes/codex-consult.md) |
| Where X is defined, who calls Y, what breaks if Z changes | **Graphify** | `rg` and reading files | [code-navigation](recipes/code-navigation.md) |
| A literal string, comment or config value | `rg` (the Grep tool) | — | — |
| A judgement inside product code: classify, route, rank, match, extract | **TypeSafe / Jev** | a Claude API call with a typed answer | [judgement](recipes/judgement.md) |
| The look of anything visual | **Claude Design** | a plain HTML mockup | [visual-design](recipes/visual-design.md) |
| Sharpen a soft real photo | none: say so | — | [photos](recipes/photos.md) |
| Edit a real photo: masks, cut-out, straighten, colour by region | none: say so | — | [photos](recipes/photos.md) |
| Long English prose | the **stop-slop** skill | — | — |
| How shipped software works without its source | **REA** | the `rea` command line | [rea](recipes/rea.md) |
| Write or change a skill | **Superpowers** `writing-skills` | the bundled `skill-creator` | — |
| The model for a session or a piece: Fable or Opus, and when a banked limit reset is used | the model budget script and its hook, which set the thread's model in **T3 Code**; a dispatch profile per piece | the thread's model as it is, said aloud | [model-budget](recipes/model-budget.md) |
| Several Claude or Codex subscriptions behind one local address, only when the owner starts it | **CLIProxyAPI**, through `cliproxyapi` and `claude-pool` | one subscription as it is | [subscription-proxy](recipes/subscription-proxy.md) |
| **Check** | | | |
| Tests, builds and container images | **Depot** CI | GitHub Actions, only as a documented exception | [ci-releases](recipes/ci-releases.md) |
| Review of every pull request | the `ai-review` Depot job, once, when the pull request is marked ready for review | a **fallback review** of the head by a reviewer that did not write it, when its reviewer's API could not serve the call | [ai-review](recipes/ai-review.md) |
| Review of a commit range with no pull request | **sa-review** | a `cookbook:review` subagent | [workflows](recipes/workflows.md) |
| Scan our code | **GitHub** CodeQL default setup | — | [security](recipes/security.md) |
| Vulnerable dependencies | **Semgrep** Supply Chain | — | [security](recipes/security.md) |
| Leaked keys at push | **GitHub** Secret Protection | — | [security](recipes/security.md) |
| Malicious packages at install | **Aikido** Safe Chain | — | [security](recipes/security.md) |
| Dependency updates | Dependabot version updates | — | [security](recipes/security.md) |
| Open CodeQL alerts and Semgrep findings | **sa-triage** | — | [workflows](recipes/workflows.md) |
| Vet outside code before an install | the vetting scripts: **Gitleaks**, **OSV-Scanner**, **Trivy**, then one **boat** sandbox run | none: "no result" stops the install | [connecting](recipes/connecting.md), [vetting-sandbox](recipes/vetting-sandbox.md) |
| Visual check of a live site before a customer-visible change | the site's own check script, in its repository: capture, pixels, layout rules, a judge on another model | none: no check recorded and approved for the site, or no pass, means ask the owner | [visual-check](recipes/visual-check.md) |
| Agent configuration: permissions, hooks, MCP servers | **AgentShield** on a sanitized copy | — | [agent-audit](recipes/agent-audit.md) |
| Health of the Claude setup and its instruction files | **doctor-plus** | Claude Code's own `/doctor` | [add-ons](recipes/add-ons.md) |
| **Ship** | | | |
| Source control, pull requests, GitHub's API | **GitHub** through `gh`, and **Git** | — | [ci-releases](recipes/ci-releases.md) |
| From a finished change to a merged pull request | **sa-release** with `merge: true` | `gh pr merge`, once the merge condition holds | [ci-releases](recipes/ci-releases.md) |
| After a merge or deploy | **Release Maintenance** through **sa-release** | the `release-maintenance` skill inline | [ci-releases](recipes/ci-releases.md) |
| Hosting, edge, storage, access control | **Cloudflare**, with **Wrangler** or the `cf` CLI | — | [cloudflare](recipes/cloudflare.md) |
| A site that lives on Wix | the **Wix** MCP | the built-in browser on the Wix dashboard | [wix](recipes/wix.md) |
| A Shopify store or theme | the **Shopify CLI** and the **Shopify theme skills** | the built-in browser on the Shopify admin | — |
| Bring a repository onto the standard | **sa-onboard** | — | [workflows](recipes/workflows.md) |
| **Reach outside** | | | |
| A current fact, docs lookup, comparison | **Parallel** Search | native web search, said aloud | [research](recipes/research.md) |
| Read one known page, a PDF, a JS-heavy site | **Firecrawl** scrape or parse | Parallel `web_fetch` | [firecrawl](recipes/firecrawl.md) |
| A site's URLs, or a crawl | **Firecrawl** map or crawl, with a real `limit` | — | [firecrawl](recipes/firecrawl.md) |
| A solved technical problem; code in public repositories | **Firecrawl** developer search | `gh search` | [research](recipes/research.md) |
| Papers and studies | **Firecrawl** research index | Parallel Search | [research](recipes/research.md) |
| Typed records: companies, people, jobs, filings, places | **Firecrawl** Alexandria | Parallel FindAll | [firecrawl](recipes/firecrawl.md) |
| One question across 10 to 50 pages | the web batch script (**Parallel**, **Firecrawl**, **TypeSafe / Jev**) | Parallel Search excerpts | [web-batch](recipes/web-batch.md) |
| A cited answer that needs several sources | **sa-research** | Parallel `web_research` | [workflows](recipes/workflows.md) |
| Several steps on a public page: click, fill, screenshot | **Stagehand**, in a child session | the `browse` CLI, a command per step | [stagehand](recipes/stagehand.md) |
| A public page from a script, or one step | **Browserbase**, the `browse` CLI | Firecrawl, when reading is enough | [cloud-browser](recipes/cloud-browser.md) |
| A site that needs a sign-in | **agent-browser**, with a login from the vault | the built-in browser, where the owner signs in | [sign-ins](recipes/sign-ins.md) |
| Web logins | the **Proton Pass CLI**, vault "Claude" | the owner signs in | [sign-ins](recipes/sign-ins.md) |
| Keys and tokens | the DPAPI store (`agent-key.ps1`, `with-key.mjs`, `key-header.mjs`) | — | [keys](recipes/keys.md) |
| Google Drive, Sheets, Docs, Calendar, Search Console, Analytics | the **Google Workspace CLI**, through `google` | OpenSEO, for Search Console on a connected project | [google](recipes/google.md) |
| Run code away from this PC: tests on Linux before a push, a Linux-only failure, a long or parallel job, a long Claude job that stands alone | **boat** | Depot CI, for a repository's own checks | [boat](recipes/boat.md), [boat-claude](recipes/boat-claude.md) |
| SEO research for a website | **OpenSEO** | Firecrawl scrape, for one page | [seo](recipes/seo.md) |
| Connect a new app or service | the **Cookbook** first, then the lightest route | — | [connecting](recipes/connecting.md) |
| Office files and PDFs | the bundled `docx`, `pdf`, `pptx` and `xlsx` skills | — | — |
| **Keep healthy** | | | |
| Big output kept out of the conversation | **context-mode** | ranged `Read` and `rg` | [context-mode](recipes/context-mode.md) |
| Compaction | Jev compaction (plugin `fast-jev-compaction-atlas`) | the built-in compactor, by itself | [compaction](recipes/compaction.md) |
| Open questions for the owner, and settling finished chats | the **Cookbook**'s `owner-questions` Stop hook, judged by **TypeSafe / Jev**; the display is T3 Code's sidebar (`❓ ` marker, pins) | the hook's phrase list, said aloud | [owner-questions](recipes/owner-questions.md) |
| Several chats at once: a question another chat already put to the owner, a job or a file another chat has | the **Cookbook**'s `owner-answers` hooks, which point at the chat that asked and stop a chat's first change until it has looked; **T3 Code**'s thread list and thread read | the same two looks by hand, before asking or changing a file | [parallel-chats](recipes/parallel-chats.md) |
| Memory across sessions | the project's handoff for its state (`HANDOFF.md`, or a file per entry in `handoff/`); auto-memory for the owner's preferences | — | [parallel-chats](recipes/parallel-chats.md) |
| A plain script on a schedule | a systemd user timer | — | [scheduled-runs](recipes/scheduled-runs.md) |
| An agent run on a schedule | a **T3 Code** scheduled task | a Claude Desktop scheduled task | [scheduled-runs](recipes/scheduled-runs.md) |
| Claude Code from a script (`claude -p`) | the scripted-runs rules | — | [scripted-runs](recipes/scripted-runs.md) |
| Updates, broken connections, close dates | the **Cookbook**'s `stack-updates` skill | — | [update-check](recipes/update-check.md) |
| Where a session runs | **T3 Code** | Claude Code in a terminal | — |

## Ground rules that apply to every recipe

- The owner sets the outcome; Claude plans, builds, merges, deploys and verifies without asking
  for approval. Checks decide: the merge condition is in `recipes/ci-releases.md`.
- Stop and ask for: spending money (a new paid service, a plan change, a paid batch over its
  stated limit); deleting data that cannot be restored; a change customers see on a live
  site (Wix, Shopify or any other host) that has not passed that site's visual check, and
  until the check is recorded in the project's `CLAUDE.md` and the owner has said yes to it
  once, always ask; access only the owner can
  give, and any access change; a first publication; a message to other people; an uninstall;
  a major-version update; a change by hand to CI or secret-bearing files (`.depot/**`,
  `.github/workflows/**`); and any change that loosens one of these stops or weakens a check,
  a ruleset or a CI job.
- A security finding is fixed. Dismissing, accepting or suppressing one goes to the owner; a
  model's judgement never clears one.
- A recipe page may add stricter stops for its own job (a write on a live system, a publish,
  an upload). Those hold as well: this list is the least, not the most.
- Credentials never go into chat, files or commands as literals; programs get keys at run time
  from an encrypted store.
- Paid calls: before a batch of about 10 or more items, run one with the exact settings and
  check it (not needed for a capped unattended job). The batch keeps its own caps and asks. Around a call
  that reports no cost, read the balance before and after; count the difference only if nothing
  else spent. An unchanged balance is unsettled, not zero, until the dashboard settles it.
- Keep bulk out of the conversation: a script writes large output to a file and prints a short
  summary; pass images and other media by path unless looking at them is the check.
- Report outcomes as they are: a failed check is reported with its output, a skipped step is
  named, "unknown" is never shown as healthy.
