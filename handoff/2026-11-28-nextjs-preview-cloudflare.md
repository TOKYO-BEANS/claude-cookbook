# 28 November 2026: a Next.js preview of a commercial site on Cloudflare

**Why.** The owner asked for Next.js trials of WeCare and Probiz, preview only, with a Vercel Pro
plan allowed if needed. WeCare's trial showed that a Cloudflare preview through OpenNext is enough
for a commercial site: no Pro plan and no Vercel GitHub App on the organisation.

**What changed.**
- `recipes/vercel.md`: a bullet on a Next.js preview through `@opennextjs/cloudflare` on
  `workers.dev` (size, noindex, stubbed forms) and the three traps met on the way, plus where to read
  the advisories for Next's vendored React.

**Verification.** The WeCare trial Worker answered 200 on its four pages with
`X-Robots-Tag: noindex, nofollow`, 307 on the unported pages, 303 from its checkout Route Handler;
Wrangler's dry run printed `Total Upload: 5061.72 KiB / gzip: 1078.10 KiB`. Numbers and the
comparison with the Astro build: `jobs/34-nextjs-proeve/RESULT.md` in `TOKYO-BEANS/WeCare-Wix`
(pull request #54). `npm test` here: not run on the laptop (memory under 25 %); CI runs it.

**Evidence.** `~/.local/share/wecare-wix/evidence/nextjs-trial-2026-11-28/`. Release log: the
`sa-release` run of this pull request.

**Failures and dead ends.** The three traps named in the recipe, each met once in the WeCare trial
and fixed there.

**Outstanding.** None here. The owner's decision on Next.js for WeCare is asked in that job's chat.
