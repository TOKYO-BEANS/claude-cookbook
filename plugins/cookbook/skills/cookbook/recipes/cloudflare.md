# Cloudflare

- Projects with a `wrangler.jsonc` use the project-pinned Wrangler; otherwise the `cf` CLI.
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
  DPAPI token (`with-key.mjs cloudflare-wrangler CLOUDFLARE_API_TOKEN`), or the Cloudflare plugin's
  `execute` once its login grants the observability and D1 scopes (the owner re-authorizes it in
  `/mcp`). `cloudflare-docs` stays for documentation search.
- `wrangler dev` reads a Worker's required secrets from the environment, so start it without
  secret-looking variables set. For local dev, keep `compatibility_date` at or below the date of the
  bundled workerd.
- An endpoint that starts paid work, or relies on a protecting setting, fails closed: it answers 503
  while that setting is unset, and a test covers the unset case. Template: release-verifier
  `src/auth.mjs`.
