# The MEGA Drops work is complete: the handoff check's last leftover

**Why.** On 20 November 2026 the owner asked to finish implementing the mega.dev Drops, work
started before the move to Linux. The Drops page (read 20 November 2026) lists the same 14 Drops,
dated 19 August to 19 October 2026, that were read and applied on 18 November in #145, #149 and
#151 (`handoff/2026-11-18-mega-dev-learnings.md`). Nothing new has been published since. The one
leftover was #151's third-round low finding: the handoff check's `NOT_DURABLE` still let four
`.claude` path forms pass as evidence.

**What changed.** `scripts/check.mjs`: `NOT_DURABLE` now also matches `/root/.claude/`,
`$USERPROFILE/.claude/` (and `${USERPROFILE}`), `~<name>/.claude/` and `$env:HOME\.claude\`. The
`/root` form needs a start of path before it, so a repository folder that is named `root` still
passes. `scripts/check.test.mjs`: the four forms were added to the list of home folders that must fail.

**Verification.** The new test failed first on boat (`AssertionError: /root/.claude/z`), then
passed after the fix. On boat, the whole `npm test` run had 729 tests: 725 passed and 0 failed.

**Outstanding.** None for the Drops. The weekly fixer (first run 23 November 2026) no longer has
this leftover to pick up.

**Dead ends.** Two earlier chats with the same request ended after about five minutes with no
output and no change. Their branches have no commits.

**Evidence.** The 14 article texts from 18 November are in
`~/.local/share/claude-cookbook/evidence/2026-11-18-mega-dev-learnings/`. The test is in
`scripts/check.test.mjs`.
