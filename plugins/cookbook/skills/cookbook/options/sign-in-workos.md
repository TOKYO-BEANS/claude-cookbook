# Options weighed: sign-in for a product (WorkOS)

The owner asked on 22 November 2026 how WorkOS could be used. Read the same day from
Parallel Search and the pricing page (<https://workos.com/pricing>). Result: not added; no
product here needs it yet. The owner chose to record it as weighed.

- **What it is.** Sign-in and identity for software sold to other businesses. AuthKit (hosted
  sign-in: password, passkeys, two-step login, Google and Microsoft sign-in, emailed links) is
  free up to 1 million monthly users. Enterprise SSO and SCIM Directory Sync cost USD 125 a
  connection a month each (lower from 16 connections). Audit Logs USD 125 a month a SIEM
  connection plus USD 99 a million events stored; Radar (bot and login-abuse checks) free for
  1,000 checks, then USD 100 a month for 50,000; a custom domain USD 99 a month. Also roles
  and fine-grained permissions, an Admin Portal for a customer's IT, Vault, sign-in for MCP
  servers and agents, and Pipes (links to users' third-party accounts).
- **Why not now.** The one product here with a login is an internal app for one company, with
  a few roles, its own login and a Cloudflare edge Worker in front. No outside customer
  organisations, so SSO, Directory Sync, Audit Logs and the Admin Portal have nothing to do.
  Passkeys, two-step login and Radar would help, but replacing a working login for them is a
  large change for a small gain. The rest has an owner already: access control, bot checks
  (Turnstile) and OAuth for a Worker-hosted MCP server are Cloudflare's
  ([cloudflare](../recipes/cloudflare.md)); keys and logins are the key store's and the
  vault's ([keys](../recipes/keys.md)).
- **Passport** (asked the same day; early access since 17 November 2026,
  <https://workos.com/passport>). Staff sign-in, not product sign-in: an employee registers a
  Mac once, then work apps connected over SAML or OpenID Connect open already signed in
  (Apple's Platform SSO), with an app list, Mac device management and company rules for AI
  tools and MCP servers. Not now: Mac only at launch while this setup runs on Linux, built for
  a team of employees where here is one owner (logins are the vault's), early access for
  selected teams, no price published. Weigh it again for a team on Macs, or when a group's AI
  tools need one set of MCP rules.
- **What would bring it in.** (1) A product that outside companies sign into, each with its
  own users: start from AuthKit on its free tier. (2) A customer asks for SSO or SCIM: WorkOS
  is the first choice, and its connection price is a spend the owner approves. (3) A public
  remote MCP server with many outside users, where Cloudflare's OAuth route falls short.
  Weigh it again then, through the Cookbook's [connecting](../recipes/connecting.md) route.
