# 18 November 2026: Apify weighed, not chosen

**Why.** The owner asked whether Apify (console.apify.com, github.com/apify) would fit the stack.

## What was found

- Apify is a store of 118K+ "Actors" (scrapers and automations), most written by outside
  developers, run on Apify's cloud and billed per event or per result. Plans: free with $5 of
  usage a month, then $19, $199 and $999 a month (apify.com/pricing, read through Parallel
  Search on 18 November 2026).
- Its jobs repeat ones the stack already has: pages, crawls and typed records (Firecrawl),
  search and entity lists (Parallel), operating a page (Browserbase and Stagehand).
- Its CLI stores the token in the OS keychain (Windows Credential Manager here), which
  `options/reach-outside.md` already turned down; the hosted MCP server at `mcp.apify.com`
  would add tools to sessions.
- Where it would add something: ready-made scrapers for sites that block generic scraping.
  Even then, many of those sites' terms forbid it.

## Decision

Owner, question dialog, 18 November 2026: "No, just exploring". Apify is not adopted;
`options/reach-outside.md` lists it as weighed. Nothing was installed and no account was made.

## Verification and evidence

- `npm test` on boat: 667 tests, 660 pass, 0 fail, 7 skipped (Windows-only). `node
  scripts/check.mjs` passes; the page needed three small trims to stay under the 4,000-byte
  Read limit.
- The `ai-review` job was unavailable (API credit balance too low), so a `cookbook:review`
  subagent did the fallback review; its record is on the pull request.
- The prices and the Actor count come from Parallel Search excerpts of apify.com/pricing and
  mcp.apify.com on 18 November 2026. No copy was kept: re-read those pages before relying on
  them.

## Still outstanding

None. If a job comes up that Firecrawl's Alexandria records cannot serve, the route is one
free-tier trial through the API with a key from the DPAPI store, before any change here.
