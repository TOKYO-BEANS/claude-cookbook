# Cloudflare

The default host. A Next.js front end may go on Vercel instead, DNS staying here:
[vercel](vercel.md).

- Projects with a `wrangler.jsonc` use the project-pinned Wrangler; a project with a
  `cloudflare.config.ts` uses the `cf` CLI the same way, pinned in its own `package.json`.
  Neither is installed machine-wide, whatever the plugin's skills say (`npm install --global
  cf`): weighed on 20 November 2026 (a 1.0.0 release candidate; no project here needs it).
  Everything else (a Worker with neither file, account work): the plugin's `execute`, or a
  small script on the API with the key-store token.
- Before a deploy: build, test, dry run, list pending D1 migrations, note the rollback version.
  A deploy follows a merge whose checks passed, and the release check follows the deploy at once.
  An Access change needs the owner's yes. So does a change customers see on a live site that
  has not passed that site's visual check, or whose check is not yet recorded in the
  project's `CLAUDE.md` with the owner's yes ([visual-check.md](visual-check.md)):
  Cloudflare hosting is no way around that stop.
- Run Wrangler with `WRANGLER_SEND_METRICS=false`, `WRANGLER_SEND_ERROR_REPORTS=false` and
  `WRANGLER_NO_SKILLS_UPDATE_PROMPTS=true`. Wrangler 4.151's skills install and update prompt can
  write into `~/.claude/skills` from an interactive terminal.
- Queries without an MCP server: D1 through `wrangler d1 execute <database> --remote --command "<SQL>"`; Worker
  logs through `POST /accounts/<account>/workers/observability/telemetry/query` with the same
  key-store token (`with-key.mjs cloudflare-wrangler CLOUDFLARE_API_TOKEN`), or the Cloudflare plugin's
  `execute` once its login grants the observability and D1 scopes (the owner re-authorizes it in
  `/mcp`). `cloudflare-docs` stays for documentation search.
- The plugin's `cloudflare-one` skill (1.0.4) reads an Access service token "from the project's
  configured secret store or environment variables". Here that store is the OS key store, and
  the token (two keys) reaches a site only through `agent-browser access`
  ([sign-ins](sign-ins-mail-and-access.md)), never an environment variable, a `.env` file or a
  command line ([keys](keys.md)). Only for a site listed in `site-login/access.json`; a new site
  is an access change and needs the owner's yes.
- `wrangler dev` reads a Worker's required secrets from the environment, so start it without
  secret-looking variables set. For local dev, keep `compatibility_date` at or below the date of the
  bundled workerd.
- An endpoint that starts paid work, or relies on a protecting setting, fails closed: it answers 503
  while that setting is unset, and a test covers the unset case. Template: release-verifier
  `src/auth.mjs`.
- The owner's domain `nofix.dev`: the apex and `/privacy` (Worker `nofix-site`) keep Google's
  sign-in screen in production, so nothing else goes there; `in.nofix.dev` is the mail inbox
  ([sign-ins](sign-ins-mail-and-access.md)). Since 20 November 2026 the apex's mail is Proton's
  ([proton-mail](proton-mail-setup.md)); its DMARC record says `p=reject` (owner's yes, 18 November
  2026), which Proton's DKIM passes: any other sender for it is refused.
  Private pages on its subdomains behind Access were
  weighed on 17 November 2026 and not built: an Artifact is already private, opens wherever the
  owner uses claude.ai and can keep state, and T3's `html_render` shows a page in the chat. Each
  Access page adds a Worker, an Access policy (an access change) and a sign-in for nothing more.
  Built only for a page that must serve live data from this PC.
