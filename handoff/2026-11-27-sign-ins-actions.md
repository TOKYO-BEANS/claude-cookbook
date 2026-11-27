# 27 November 2026: the sign-ins recipe names the browser's change summary

**Why.** The sign-in tools now record what a browser session changed on a site
(`agent-browser actions`) and move a used sign-in mail to a 15-minute trash with
`agent-browser mail-restore` as its undo (their own pull requests, 27 November 2026, from
`recipes/agent-changes.md`). The recipe agents read before working on a site did not say so.

**What changed.** `recipes/sign-ins.md`: one item, "After a change on a site": run `actions`,
report it with the site's way back, and the mail's restore command.

**Verification.** `node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the
pull request).

**Dead ends.** None. **Outstanding.** None.

**Evidence.** The pull request. Release log: the `sa-release` run of this pull request.
