# 28 November 2026: the Vercel + Cloudflare split, proved

**Why.** `recipes/vercel.md` said deploys come from GitHub, but nothing had been deployed on the
new Vercel account, and a GitHub login tied to the first account might block it. The owner said
yes (27 November 2026, about 21:15 UTC) to a throwaway test app, a first link of its repository
to Vercel, its first public deploy on `vercel.app` and `workers.dev`, and the Vercel connection
on GitHub, for this app only.

**What changed.**
- New private repository on the owner's personal GitHub account: a Next.js page (Vercel,
  Hobby) and a Worker with D1 and a SQLite-backed Durable Object (Cloudflare, free plan).
  The Vercel GitHub App is installed on the personal account for that one repository.
- `recipes/vercel.md`: deploys from GitHub proved; Hobby needs a personal-account repository;
  what Vercel's sign-in protects (previews and deployment URLs, not the production address);
  the GitHub login is on the new account.
- New `recipes/vercel-with-workers.md`: the shape, the one-time API steps, the checks and what
  went wrong.

**Verification.** Worker: write 201 with the production origin, 403 from another origin, preview
preflight 204; two WebSocket clients got a posted note. Vercel: first production deploy READY,
`<project>.vercel.app` 200; two T3 browser tabs saw each other's note live and D1 read it back;
the test pull request got a READY preview (302 to Vercel's sign-in) and a passing `Vercel`
check; its merge deployed to production, READY, the change visible. `node scripts/check.mjs`
passes; the suite runs in a Depot sandbox (see the pull request).

**Evidence.** `~/.local/share/claude-cookbook/evidence/vercel-cloudflare-split/` (screenshot of
the second window with the live note). Release log: the `sa-release` run of this pull request.

**Failures and dead ends.**
- The 24-hour rule was broken once: `npx wrangler --version` fetched Wrangler 4.169.0 (7 hours
  old) into the npx cache and ran it. Moved to
  `~/.local/share/backups/npx-wrangler-4.169.0-too-young-20261127`; the project uses 4.168.0.
  Cause and rule in the new page.
- Linking by the API before the GitHub App was installed: `repo_not_found`.
- The AI review (medium) found the first preview-origin pattern too loose: a hyphen in its
  middle class let a host in another Vercel scope ending in `-<team>` match. The next pattern,
  the 9-character deployment hash only, was still open (second AI review, medium): a scope
  `abcdefghi-<team>` with a project `<project>` gets the alias
  `<project>-abcdefghi-<team>.vercel.app`, which matches. The page now allows exact origins only
  (production and each branch alias), or a preview host the Vercel API shows belongs to the
  project.
- GitHub sudo by email code: mailed to the Apple relay, never reached Proton; the owner
  approved by GitHub Mobile instead.

**Outstanding.**
- The test repository: keep it archived as a template, or delete it with its Vercel project,
  Worker and D1 database (asked of the owner, 28 November 2026).
- The Protection Bypass for Automation secret was not captured: no capture script needs it yet.
- The test Worker still uses the 9-character-hash pattern: change it to exact origins,
  redeploy, and check that `https://<project>-abcdefghi-<team>.vercel.app` gets 403.
