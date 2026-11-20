# 20 November 2026: the 24-hour rule picks the version, never the day

**Why.** The owner, 20 November 2026: "you don't have to wait 24 hours to install something we
don't even have". Two briefs that day had read the minimum-age rule as a wait (snooze the chat
and schedule a task until a release ages). The rule exists because a malicious release is
usually caught within hours; taking the release before a young one keeps that protection
without holding anything up.

**What changed.**
- `recipes/connecting.md`: "A release is installed once it is 24 hours old" and "npm, uv, mise
  and GitHub releases wait" now say: install at once the newest release over 24 hours old (the
  one before a release from today); the standing exception has no age rule.
- `recipes/safe-chain.md`: the hold holds back a version, never a tool or a job; a lock that pins
  a release younger than the hold pins the release before it, and waits only when no older
  release does the job. Open #203 changes line 3 of the same page; no overlap.
- Outside this repository: the global `CLAUDE.md` age-rule bullet says the same, and the memory
  note `safe-chain-24h-hold` with its index line.
- The hold itself is unchanged: still 24 hours, no exclusions, CVE fixes as before.

**Verification.** `npm test` on boat (see the pull request). `rg` over the pages finds no other
sentence that tells a chat to wait for a release to age.

**Outstanding.** None.
