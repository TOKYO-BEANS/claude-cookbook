# 22 November 2026: the proxy's Antigravity sign-in serves no Claude models

**Why.** The owner asked whether the subscription proxy matches Theo Browne's published hub
guide and keeps the ban risk as low as his. A review against the guide (gist
`t3dotgg/59a521d2ee8d70aaf90e280c175072af`) found routing, the home connection, localhost-only
and the two hard rules in place. One gap: the Antigravity sign-in (owner's yes earlier today)
also offered `claude-sonnet-4-6` and `claude-opus-4-6-thinking`, so a Claude model could have
been served by the Google account. That breaks Theo's rule 2 (Claude only through a Claude
subscription).

**What changed.** On the laptop, `~/.local/share/cliproxyapi/config.template.yaml` gained
`oauth-excluded-models: antigravity: ["claude-*"]` (old copy in `~/.local/share/backups/`); the
service was restarted. The recipe `subscription-proxy.md` records the Antigravity sign-in, its
risk and the exclusion; two bullets were shortened to keep the page under its read limit.

**Verification.** After the restart `/v1/models` lists 7 Antigravity models, none `claude-*`;
a request for `claude-sonnet-4-6` bound to the Claude sign-in, `gemini-3-flash` to the
Antigravity one (journal). The Cookbook check and the pull request's checks.

**Outstanding.** Review findings left to the owner, none blocking: only one Claude account is
signed in, so "Claude (pool)" has no account to fail over to; Theo's soonest-reset-first routing
is a fork of his own (not built); session affinity cannot be proven from the journal (info lines
only on new bindings); a laptop away from home changes the address the traffic comes from.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-22-proxy-antigravity-claude-models/result.txt`.
