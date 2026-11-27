# 27 November 2026: Vercel beside Cloudflare

**Why.** The owner: use Vercel and Cloudflare together, not one over the other; set Vercel up by
following `vercel.com/get-started.md`, and see `vercel.com/connect/cloudflare`.

**What changed.**
- `recipes/vercel.md` (new): which piece of a project goes where, the Hobby plan's
  non-commercial rule, why Cloudflare is never proxied in front of Vercel, Vercel Connect (an
  access change, not set up), how Claude works with it (GitHub deploys, the REST API with the
  key-store token, docs as Markdown), and what was weighed and not used.
- `SKILL.md`: the Hosting row names Vercel for Next.js and links the page (Wrangler unbolded and
  one date moved out of the Codex row to make room; the date stays in `recipes/codex.md`).
- `catalog.json`: entry `vercel` (trial; the CLI part follows npm, nothing installed).
- `options/ship.md`, `recipes/cloudflare.md`: point to the split.

**Verification.** `node scripts/check.mjs --room` passes; the suite runs in a Depot sandbox for
this pull request. Vercel's API is not proven yet: no token (below).

**Evidence.** `~/.local/share/vetting/vercel-cli-67.0.0/` (`NOTES.md`, `out/`). Release log: the
`sa-release` run of this pull request.

**Dead ends.**
- The Vercel CLI 67.0.0: one native binary that bundles 62 advisories (1 critical, 23 high);
  overrides cannot reach them. The owner chose "API + GitHub, no CLI" (question dialog,
  27 November 2026). Clears: a release whose vetting is clean.
- The Vercel plugin, the skills pack and the hosted MCP server: weighed in `recipes/vercel.md`.

**Outstanding.**
- **The token `vercel`** (owner). The Vercel account's email is a "Sign in with Apple" relay made
  for GitHub, which drops all mail from Vercel, so every "Verify your identity" code (token,
  new email, passkey) never arrives (proved 27 November 13:14 UTC: a code sent, none reached the
  Proton mailbox; Vercel offers no other method, and its support agent sends such cases to
  Account Recovery). The owner submitted Vercel's Account Recovery form the same day, asking
  for the Proton address as primary. Clears: Vercel changes the email,
  the owner creates the token (`claude-linux`, team scope, 1 year) and saves it as the vault
  note `key/vercel`. Then Claude copies it into the key store, proves it with `GET /v2/user` and
  `GET /v10/projects`, and adds the expiry to the catalog entry's `dates`.
