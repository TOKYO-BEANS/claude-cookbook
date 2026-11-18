# 18 November 2026: the Cookbook's AI review on the Claude plan

**Why.** The owner still saw "credit balance too low, fallback review" on pull requests and
asked why the Claude-plan token had not fixed it. Two reasons: the token saved on 17 November
was made with the Console account (it bills the API credit), and only Stack Atlas was on
standard v22; the Cookbook ran v21, which reads only the API key.

**What changed.**
- The owner ran `claude setup-token` again, signed in with the subscription account, and saved
  the token over the DPAPI entry `claude-plan-review` (masked window; question dialog, 18
  November 2026: "Yes, open it now"). A locked-down `claude -p` with that token alone and a home
  of its own answered with `apiKeySource: none` and a result, no credit error.
- The Depot CI secret `CLAUDE_CODE_OAUTH_TOKEN_REVIEW` was set again from it, for
  `TOKYO-BEANS/claude-cookbook` only.
- #139 (`stack-atlas-onboard --upgrade`) moved the Cookbook to standard v22 and merged as
  `3611ef4`; the release check verified it (execution 1760). Its own review still ran the base
  branch's v21 reviewer and was unavailable (credit balance); a fallback review by a
  `cookbook:review` subagent found two lows in files the standard manages, sent to the Stack
  Atlas chat for its template (Stack-Atlas #224 is that chat's v23).
- `recipes/ai-review.md`: the plan path is described as live on the Cookbook; the "not built
  yet" bullet is gone.

**Verification.** This pull request is the proof: its `ai-review` comment must read on the
Claude plan, not `review unavailable`.

**Outstanding.** The other seven repositories still review through the API key (empty credit,
so fallback reviews): their secret and onboarding, then retiring the API key, its secret and
workspace, belong to the Stack Atlas chat (its handoff of 17 November names Claude as owner).
Open #120 (draft) edits the bullet this pull request replaces and will need a merge of `main`.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-18-ai-review-plan/`
(`merge.json`, `merge2.json`, `fallback.md`, `check.json`, `release-139.log`).
