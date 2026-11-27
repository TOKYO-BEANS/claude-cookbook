# 27 November 2026: snapshots for the boat chat sandbox, weighed and not built

**The job.** The owner asked whether snapshots on boat had been thought about alongside the
day's whole-chat route (#286 to #290). They had for test runs (17 November, measured, not
built; that page was retired with the move to Depot on 26 November), never for the chat
sandbox.

**What changed.** `options/sandboxes.md` records the decision: `up` resumes in about 10 s and
makes a new sandbox in about 30 s, so a snapshot would save about 20 s, only for a new sandbox,
a few times a month; it would have to be taken before linking (the T3 server's identity) and
rebuilt after every T3 update. Owner's answer in the question dialog of this chat: record no.
No script change.

**Verification.** `node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the
pull request).

**Evidence.** The pull request; the 17 November numbers in
`handoff/2026-11-17-boat-snapshots.md`.

**Dead ends.** None.

**Outstanding.** None. Weigh it again if `up` of a new sandbox passes a minute.
