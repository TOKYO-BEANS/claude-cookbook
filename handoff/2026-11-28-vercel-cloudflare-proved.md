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

**Verification.** Worker, as first deployed: write 201 with the production origin, 403 from
another origin; two WebSocket clients got a posted note. After the review fixes it allows the
production origin only: a real preview of ours gets 403 too (see Failures and dead ends). Vercel: first production deploy READY,
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
  `<project>-abcdefghi-<team>.vercel.app`, which matches; a branch alias collides the same way.
  After two failed patterns, no third: the page and the test Worker allow the exact production
  origin only. The redeployed Worker answers 403 to both crafted hosts and to a real preview,
  204 to production, and two WebSocket clients still get a posted note.
- GitHub sudo by email code: mailed to the Apple relay, never reached Proton; the owner
  approved by GitHub Mobile instead.

**Outstanding.**
- The test repository: the owner chose to keep it as a template (28 November 2026). It is
  marked a template and archived on GitHub; its Vercel project, Worker and D1 database stay up
  on the free tiers (the production page still answers 200). Deleting them later is asked.
- GitHub sudo without the owner's phone: the owner said yes (28 November 2026) to adding their
  GitHub authenticator (TOTP) code to the vault "Claude" themselves; the owner adds that item.
  Once it is there, Claude proves it on the next sudo prompt and records the route.
- The Protection Bypass for Automation secret was not captured: no capture script needs it yet.
