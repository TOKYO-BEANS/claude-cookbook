# 22 November 2026: the pages name the Firecrawl CLI 1.30.0

**Why.** The daily update check installed the pinned Firecrawl CLI 1.30.0 as a routine update
(from 1.29.0; `verify` exit 0, scans clean, sandbox quiet, old copy in
`~/.local/share/firecrawl-cli/.previous`). Step 7 of the update check: the pages that name the
old version follow in one pull request.

**What changed.** `recipes/keys.md` and the comments of `scripts/firecrawl-secure.mjs` name
1.30.0. Read against the launcher's lists as `keys.md` asks: one new subcommand,
`research lookup-protein`, which goes with `research` and already gets the key; no new top-level
command or global option; `browser.js` unchanged. The lists need no change. The `zod` override
(4.6.7) is still needed: the CLI still pulls zod 3.x.

**Verification.** The Cookbook check and the pull request's checks.

**Outstanding.** None.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-22-firecrawl-1.30.0-pages/help-compare.txt`.
