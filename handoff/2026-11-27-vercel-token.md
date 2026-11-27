# 27 November 2026: the Vercel token

**Why.** The token `vercel` was outstanding (`2026-11-27-vercel-beside-cloudflare.md`): the first
Vercel account's email was a "Sign in with Apple" relay made for GitHub, which drops Vercel's
mailed codes, and a token needs one.

**What changed.**
- The owner made a new Vercel account on their Proton address (the first one could not be
  changed or deleted without a mailed code), created the classic token `claude-linux-laptop`
  (1 year) and saved it as the vault note `key/vercel`. Claude copied it into the key store
  (`service claude-keys`, `name vercel`) without showing it.
- `catalog.json`: the `vercel` entry's `dates` has the token's expiry, 28 November 2027.
- `recipes/vercel.md`: the token paragraph says which account and token are in use, why the
  first account was left, and that `vercel login` meets the same mailed code.

**Verification.** Through `with-key.mjs`, token on curl's standard input: `GET /v2/user` 200
(the new account), `GET /v10/projects` 200, `GET /v5/user/tokens` shows `claude-linux-laptop`
expiring 2027-11-28. `node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the
pull request).

**Evidence.** `~/.local/share/vetting/vercel-cli-68.0.0-preview/` (lockfile, OSV report, the CLI's
`oauth.ts`). Release log: the `sa-release` run of this pull request.

**Dead ends.**
- The Vercel CLI's sign-in (`vercel login`), tried without installing the CLI through its OAuth
  device flow: "Authorize Device" asks for the same mailed code.
- Vercel CLI 68.0.0 (19:15 UTC, 27 November): a lockfile OSV scan shows the same 62 advisories
  as 67.0.0 (1 critical `tar`). Evidence: `~/.local/share/vetting/vercel-cli-68.0.0-preview/`.

**Outstanding.**
- The first account's Account Recovery request (owner, 27 November 2026) is no longer needed;
  the first account stays unused. Deleting it needs its mailed code.
- Connecting GitHub to the new account (for push deploys) may be refused while the owner's
  GitHub login is still tied to the first account. Checked when the first project is set up.
