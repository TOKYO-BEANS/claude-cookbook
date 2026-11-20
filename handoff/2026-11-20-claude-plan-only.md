# 20 November 2026: Claude runs on the plan token only

**What changed.** The owner's outcome (20 November 2026): "we should not run over API usage, only
Claude Subscription Token." The AI review (standard v27) and the first site's visual-check judge
(its repository's #39) both run a locked-down `claude -p` on the plan token (key store
`claude-plan-review`). So `recipes/scripted-runs.md` no longer has a Claude API key rule: a script
that needs Claude starts `claude -p` on the plan token, and refuses a run on a key.
`recipes/visual-check-build.md` and `options/check.md` describe the judge that way, the map's
judgement fallback and `options/plan-and-build.md` name `claude -p` on the plan token instead of a
Claude API call, and `recipes/security-costs.md` says the `ai-review` job costs no cash.
`scripts/key-header.test.mjs` uses another name for its refused key. The rule bullet for
`anthropic-api` left the global `CLAUDE.md`, and machine-setup's `GUIDE.md` drops both keys in its
own pull request.

**Verification.** `npm test` passes; #201 merged as `916dcaa`, release check verified.

**Removed after the owner's confirmation.** The owner confirmed in the question dialog (20 November
2026, "Yes, all deleted") that the Console keys "CI-Review" (and its workspace), "dmply-api-key" and
"Claude Code" are deleted. The key store entries `anthropic-api` and `anthropic-api-workspace` and
their items in the Proton Pass vault "Claude" were then removed: `secret-tool lookup` finds
neither, and the vault lists neither, active or trashed. machine-setup #42 (`8b9c3ab`) records
it.

**Outstanding.** None.

**Dead ends.** None.

**Evidence.** The first site's repository, `handoff/2026-11-20-judge-plan-token.md`.
