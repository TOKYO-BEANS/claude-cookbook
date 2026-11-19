# Options weighed: reach outside

Chosen by fit for the job on 15 November 2026.

- **Facts and lookups: Parallel Search.** Several queries in one call, and excerpts that
  usually answer without a fetch. Weighed: native web search (the fallback: no excerpts
  ranked for the question); Exa, Tavily, Brave and Perplexity (the same job, another
  vendor).
- **Pages, PDFs, crawls, developer and paper indexes, typed records: Firecrawl.** One service
  renders a JS-heavy page, parses a PDF, maps a site and holds the developer and research
  indexes and Alexandria. Weighed: Parallel `web_fetch` (the fallback for one page); Jina
  Reader (single pages only); `gh search` (the fallback for public code); Apify (outside
  scrapers, same jobs).
- **A cited answer from several sources: `sa-research`.** Parallel first, Firecrawl for gaps,
  inside an agent budget. Weighed: Parallel Task and deep research (one vendor's synthesis,
  priced per run: the fallback is its quick `web_research`); the bundled deep-research skill
  (no budget).
- **Operating a public page: Browserbase, by two routes.** The page runs in a cloud browser,
  away from this PC and from any signed-in profile. From a script, or for one step: the
  `browse` CLI, which adds nothing to a session. Several steps: Stagehand, the same cloud
  browser as an MCP server, in a child session since 17 November 2026. On the same four screenshots one Stagehand call
  took 8 seconds and one browser minute; nine `browse` commands took 137 seconds and two.
  Its price: a child session's start-up, and a source build the update check cannot follow. The visual check uses neither. The owner chose on
  15 November 2026 to keep Stagehand for "In-session browser work". Weighed:
  - the built-in browser (holds the owner's signed-in sessions: keep unknown pages out of it);
  - Playwright MCP and Chrome DevTools MCP (a local browser on this PC, and a server in every
    session);
  - the Chrome extension and computer use (they act in the owner's own browser and desktop).
- **A site that needs a sign-in: agent-browser with the Proton Pass vault.** Its own local
  browser profile, a login filled without the secret entering the conversation, and a vault
  that holds only what Claude may use. Weighed: the built-in browser (the fallback, when only
  the owner can sign in); a cloud browser (never: a login does not go into a recorded cloud
  session); 1Password and Bitwarden CLIs (the same job; the owner already uses Proton).
- **Keys and tokens: the OS key store** (GNOME Keyring; DPAPI on Windows before). Unlocked
  at sign-in, then any process of this user can read it, as with DPAPI; a key reaches one
  process at run time. Weighed: `.env` files and environment variables (plain text); a
  hosted secrets manager (production secrets).
- **Google accounts: the `google` command with gws.** One consent per account, then
  short-lived tokens, for any Google API. Weighed: Google's MCP connectors (a server per
  product); gws's own sign-in (keeps a second copy of the grant, one account only).
- **Code away from this PC: boat.** A full Ubuntu machine in under a second, billed per
  second, deleted after the command, from one CLI. Weighed: Cloudflare Sandbox (in the stack,
  but needs a Worker around it); E2B, Daytona and Modal (the same job behind an SDK); GitHub
  Codespaces (made for a person's editor); Docker on this PC (not away from it).
- **SEO: OpenSEO.** Keyword, backlink and audit data with Search Console intake, in skills.
  Weighed: Ahrefs and Semrush (subscriptions for the same data).
