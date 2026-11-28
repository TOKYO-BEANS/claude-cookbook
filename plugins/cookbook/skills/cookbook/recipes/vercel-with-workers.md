# Vercel front end, Cloudflare back end: the proven setup

Proved end to end on 27 and 28 November 2026 with a throwaway app in a private repository on
the owner's personal GitHub account: a Next.js page on Vercel (Hobby) saves and reads notes
through a Cloudflare Worker (D1), and a Durable Object pushes each new note to every open page
over a WebSocket. Two browser windows saw a note from the other at once; a pull request got a
preview and a passing `Vercel` check; its merge went to production. Which piece goes where:
[vercel](vercel.md).

## The shape

- **One repository, two parts**: the Next.js app at the root (Vercel builds it), the Worker in
  `worker/` with its own `package.json` pinning Wrangler, `wrangler.jsonc` and D1 migrations.
  The page calls the Worker's `workers.dev` address over HTTPS (a public value, kept in the
  code or as `NEXT_PUBLIC_WORKER_URL`). Never Cloudflare's proxy in front of Vercel.
- **CORS from configuration**: the Worker's `vars` hold exact origins only, and on
  `vercel.app` that is the production origin (`https://<project>.vercel.app`) alone. No other
  `vercel.app` host name proves it is this project's: scope slugs may hold hyphens, so another
  scope (`abcdefghi-<team>`, `git-<branch>-<team>`) with a project `<project>` gets an automatic
  alias `<project>-<that scope>.vercel.app` that equals any preview, branch alias or pattern of
  ours (two patterns failed review on 28 November 2026). A preview that must call the back end
  gets its own test Worker and data, or an exact origin on a domain of the owner's. Any other
  origin gets no CORS headers, a write from it answers 403, and the WebSocket upgrade checks the
  same list. An Origin check stops browsers only, not curl or a script: it is not
  authentication.
- **Writes are bounded**: text 1 to 200 characters, the table trimmed to its last 100 rows, so
  a public endpoint cannot grow without limit.
- **Live updates**: one Durable Object room (`env.ROOM.getByName("main")`), SQLite-backed (the
  Workers free plan needs `new_sqlite_classes` in `migrations`), hibernating WebSockets
  (`ctx.acceptWebSocket`); the Worker calls the room's `broadcast()` over RPC after each D1
  insert. The page reconnects after a close and merges notes by id.

## The one-time steps (each asked first: [vercel](vercel.md))

1. Repository on the owner's personal GitHub account (Hobby cannot connect an organization).
2. Vercel project by the API: `POST /v11/projects` `{"name", "framework": "nextjs"}`; it gets
   `<name>.vercel.app` when the name is free.
3. The GitHub login on the Vercel account (Account Settings, Authentication), then the Vercel
   GitHub App on the personal account for selected repositories only
   (`github.com/apps/vercel/installations/new`). GitHub asks for sudo mode: GitHub Mobile
   digits from the owner. Until the app is installed, `GET
   /v1/integrations/git-namespaces?provider=github` is empty and linking answers
   `repo_not_found`.
4. Link: `POST /v9/projects/<name>/link` `{"type": "github", "repo": "<owner>/<repo>",
   "productionBranch": "main"}`. Linking starts no build: the first production deploy is
   `POST /v13/deployments` `{"name", "project", "target": "production", "gitSource": {"type":
   "github", "repoId": <id>, "ref": "main"}}`. Every later deploy comes from GitHub.
5. Worker: `wrangler d1 create`, `wrangler d1 migrations apply <db> --remote`, `wrangler
   deploy --dry-run`, then `wrangler deploy`, each through `with-key.mjs cloudflare-wrangler
   CLOUDFLARE_API_TOKEN` with `CLOUDFLARE_ACCOUNT_ID` set and Wrangler's metrics off
   ([cloudflare](cloudflare.md)).

## Checks that proved it

- curl: a write with the production `Origin` answers 201 with that origin in
  `Access-Control-Allow-Origin`; another origin 403, `https://<project>-abcdefghi-<team>.vercel.app`
  (another scope's alias) and a real preview of ours included.
- Two WebSocket clients in Node (`new WebSocket(url, { headers: { Origin } })`) both receive a
  note posted by a third request; another origin's upgrade fails.
- Two T3 preview tabs (default and incognito profiles) on the production page: a note saved in
  one shows in the other at once, and `wrangler d1 execute <db> --remote` reads it back.
- Deployment state from `GET /v6/deployments?projectId=<id>&target=preview|production`, matched
  on `meta.githubCommitRef` or `meta.githubCommitSha`.

## What went wrong on the way

- `npx wrangler --version` in a folder whose `npm install --before` had failed fetched the
  newest Wrangler (7 hours old) into the npx cache: npx ignores the 24-hour rule. Run the
  project's `./node_modules/.bin/wrangler`, never `npx` for a tool not yet installed. And
  `npm view <pkg> version --before=<date>` prints the newest version, not the one before the
  date: read `npm view <pkg> time --json`.
- GitHub's sudo "Send a code via email" mails the account's Apple relay address; nothing reached
  the Proton inbox in 10 minutes. GitHub Mobile is the route.
- T3's default browser profile was signed in to the first Vercel account; the new one signs in
  with a mailed code to its Proton address (read through Bridge: [proton-mail](proton-mail.md)).
