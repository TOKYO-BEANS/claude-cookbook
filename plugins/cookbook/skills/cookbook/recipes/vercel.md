# Vercel

Added beside Cloudflare on 27 November 2026 (owner: use the two together, not one over the
other). Cloudflare stays the default host ([cloudflare](cloudflare.md)); Vercel takes the
front ends it is better at.

## Which goes where

| Piece of a project | Where |
| --- | --- |
| Domains, DNS, mail records | Cloudflare. A front end on Vercel gets a DNS-only (grey) record |
| A Next.js front end: server rendering, ISR, image optimisation, AI SDK UI, a v0 start | Vercel |
| A static or simple site, a client site, a landing page | Cloudflare Workers static assets |
| APIs, webhooks, cron, queues, long work | Cloudflare Workers, Queues, Durable Objects |
| Data and files: SQL, key-value, media | Cloudflare D1, KV, R2 (no egress fee) |
| Private pages, staff access | Cloudflare Access; product sign-in: [WorkOS](../options/sign-in-workos.md) |
| Firewall and DDoS | each platform for its own traffic |

- **Never proxy Cloudflare in front of Vercel** (orange cloud): Vercel's bot protection stops
  working, visitors get challenges, and two caches go stale against each other (Vercel's
  guide "Using Cloudflare and other reverse proxies with Vercel"). A Vercel front end calls a
  Cloudflare back end over HTTPS instead.
- **Plan.** The account is on Hobby: free, and for personal, non-commercial use only. Vercel
  counts as commercial any deployment that earns anyone money, a paid builder included: client
  sites, a care plan, ads and affiliate links. Such a project goes on Cloudflare, or on Vercel
  Pro (USD 20 a seat a month), which is a spend: ask the owner first.
- **Vercel Connect** (`vercel.com/connect/cloudflare`) hands a Vercel app short-lived
  Cloudflare credentials at run time (OIDC), instead of a Cloudflare token in its environment
  variables. Creating a connector gives Vercel access to the Cloudflare account: an access
  change, asked first. Not set up.

## How Claude works with it

- **Deploys come from GitHub.** The owner connected GitHub to Vercel: a push to a linked
  repository builds on Vercel, a pull request gets a preview URL, a merge to the default branch
  goes to production. The same rules as any deploy ([ci-releases](ci-releases.md)): it follows
  a merge whose checks passed, then the release check. Linking a repository to Vercel the first
  time, a first public deploy, and a DNS change on a live domain are each asked first; a change
  customers see needs the site's visual check ([visual-check](visual-check.md)).
- **Everything else through the REST API** (`https://api.vercel.com`, docs at
  `vercel.com/docs/rest-api`) with the token `vercel` from the key store ([keys](keys.md)).
  The token goes to curl on standard input, never on a command line:

  ```sh
  node ~/.local/bin/with-key.mjs vercel VERCEL_TOKEN bash -c \
    'printf "Authorization: Bearer %s\n" "$VERCEL_TOKEN" |
     curl -sS -H @- https://api.vercel.com/v2/user' | jq '.user.username'
  ```

  Projects `GET /v10/projects`, deployments `GET /v6/deployments`, a deployment's build log
  `GET /v3/deployments/<id>/events`, environment variables `/v10/projects/<id>/env`. A write
  (env, domains, project settings) follows the same stops as on Cloudflare.
- **Docs**: every page has a Markdown copy (`vercel.com/docs/<page>.md`, the knowledge base
  at `vercel.com/kb/...`), read with Firecrawl or curl.
- **The token**: a classic token `claude-linux`, scoped to the owner's team, made by the owner
  at `vercel.com/account/tokens` (the sign-in is the owner's GitHub) and saved as the vault
  note `key/vercel`. Vercel asks again for a mailed code before it makes a token: the account's
  primary email must be one that receives mail (an Apple "Sign in with Apple" relay made for
  GitHub drops Vercel's mail). Its expiry is in `catalog.json`.

## Not used, and why (27 November 2026)

- **The Vercel CLI** (`vercel` on npm). Since 67.0.0 it is one native binary per platform
  (`@vercel/vc-native-linux-x64`, 186 MB) that bundles its JavaScript libraries, and the vetting
  found 62 advisories in them (1 critical in `tar`, 23 high: `undici` 5, `minimatch`,
  `path-to-regexp`, `js-yaml`, `smol-toml`, `zod`, and `sandbox`, which has no fix). npm
  overrides cannot reach code inside the binary. The owner chose the API and GitHub instead.
  The update check follows the npm package; a new release is vetted
  (`pinned-vet.sh vercel-cli vercel <version>`) and installed as a pinned copy only once its
  scan is clean, run as `with-key.mjs vercel VERCEL_TOKEN vercel ...`. Never `vercel login`:
  it keeps its token in a plain file.
- **The Vercel plugin** (`vercel/vercel-plugin`): hooks on every prompt and tool call in every
  session, its own telemetry, 40 skills, no licence GitHub can read. The standalone skills pack
  (`vercel-labs/agent-skills`) is not needed while no project here is on Next.js.
- **The hosted MCP server** (`https://mcp.vercel.com`, OAuth): tool names in every session for
  what the API does. Weighed again when a project here lives on Vercel; then in that project's
  `.mcp.json`, with the owner's first OAuth consent.
- **`vercel deploy --temporary`** (no account, claimable URL): a first publication with no
  owner; not used.
