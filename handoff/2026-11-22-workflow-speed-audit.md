# 22 November 2026: where the time goes, and the fast-merge rules

**Why.** The owner asked for ways to speed up the workflow of every project, now and future
ones. A read-only audit (8 investigators, each re-checked by a skeptic, one synthesis) measured
the PR loop, CI, hooks, boat, ceremony, onboarding and 3.3 days of session transcripts.

**What changed.** New page `recipes/fast-merges.md`, linked from `ci-releases.md` (its "Merges
queue up" line moved there word for word) and `ai-review.md`: merge scripts in the background,
a review with no high or medium finding ends the rounds (lows to a follow-up, security
excluded), merge `main` only for a real conflict (the rulesets' strict policy is off, read in
three repositories), one ToolSearch for the T3 tools, one owner dialog per job, boat-run in the
background and never piped without `pipefail`. `scripts/check.mjs` prints the room left in
`SKILL.md`, and with `--room` every page within 150 bytes of its limit (17 pages are within
50). `scripts/new-handoff.mjs` writes an entry with the five parts (this one came from it).
`CLAUDE.md` names the boat test command. The other repositories' items run as their own chats:
the merge and release scripts (required checks by name after a merge, 10-second polls, the
collector lock, a verdict file), Stack Atlas (one rollout a day, handoff split, enrolment
generator, `cancel-in-progress` on PR runs only, an onboarding command), the site repository's
visual tests in parallel and its handoff split, the product repository's handoff split and a
Windows test-concurrency trial, and machine-setup (context-mode's cut from 4,096 to 8,192
bytes, name-only skill listings).

**Verification.** `node --test` for the room report and the scaffold, red then green; the full
suite on boat before the push.

**Outstanding.** Two owner questions, asked in the chat: the AI review asked alongside CI rather
than after it (reverses the 16 November "once per PR, for the commit about to merge" design),
and handoff entries written in the job's own pull request instead of separate handoff pull
requests. The Cookbook pages that cite 4,096 bytes change after machine-setup proves 8,192.
Shorter `MEMORY.md` index lines (about 1.1k tokens a call) not done: small, and each line holds
a "do not re-ask".

**Dead ends.** Refuted by the skeptics: skipping Semgrep on pull requests with no dependency
change (a diff-aware Supply Chain scan reads lockfiles too, stop 7), a pip or npm cache in CI
(a cache hit skips Safe Chain), a merge floor from the ruleset (lower than today's count), a
shell pre-filter for the boat-route hook (context-mode's hook already runs in parallel).

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-22-workflow-speed-audit/`
(`synthesis.md`, the ranked findings with numbers; `journal.jsonl`, every agent's result).
