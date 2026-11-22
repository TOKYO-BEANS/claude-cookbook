# 22 November 2026: the owner's two answers on fast merges

**What changed.** Two owner answers from the speed-audit chat, given in its question dialog on
22 November 2026, written into the recipes: `ai-review.md` lets the review be asked at the final push
when the same suite already passed on boat for that exact commit ("nice to have if you were
confident in the CI passing"); `fast-merges.md` puts the handoff entry in the job's own pull
request, with a separate handoff pull request only after a failed release check or a late owner
answer, at most one per repository a day ("Entry in the job's PR"). The two lows of #230's review
are fixed: the room report counts `SKILL.md` without carriage returns, as the check does, and a
scaffolded entry holds a placeholder in each part, which the check rejects until it is written.

**Verification.** `node --test` for the room report (a CRLF case) and the scaffold (fails unfilled,
passes filled); the full suite on boat before the push. #230 merged as e7d5d5b with the release
check "merge verified".

**Outstanding.** The global `CLAUDE.md` handoff bullet changes in machine-setup (that chat has the
text). The Cookbook pages that cite 4,096 bytes change after machine-setup proves context-mode's
8,192-byte cut. The other repositories' items run in their own chats (see the
2026-11-22-workflow-speed-audit entry).

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-22-workflow-speed-audit/`; this
merge's release check is written by `after-merge.sh` under `~/.codex/release-maintenance/runtime/`.
