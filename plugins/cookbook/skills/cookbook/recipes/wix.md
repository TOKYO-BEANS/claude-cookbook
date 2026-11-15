# Wix sites

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

More: [ask first, and customer data](wix-ask-first.md).
