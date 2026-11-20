# 20 November 2026: the pooled proxy has its first accounts

**Why.** Follow-up to the always-on build (#190): the owner signed the accounts in.

**What changed.** The owner ran the logins in a terminal: one Claude account and one Codex
account (`private/auths`, both files 0600). Nothing else changed.

**Verification.** `cliproxyapi status`: 200 with 38 models. `claude-pool -p` with Claude Haiku
5.5 answered "ok" through the proxy (two `POST /v1/messages` in its journal).

**Owner's answer, 20 November 2026 (question dialog):** T3's hub view of the pooled limits:
"No, use the console". The key rule stays as it is; the limits are read with `cliproxyapi panel`.
Do not ask again.

**Outstanding.**
- A pooled turn in a T3 thread on "Claude (pool)", and a look at cache reads and writes in the
  console after a longer session (Theo's check that session affinity holds).
- With one Claude account a limit hit has nowhere else to go; more accounts are the owner's
  step.
- Codex through the proxy is still not built: the Codex account is signed in but nothing uses
  it (an `env_key` launcher, not a literal key in `config.toml`).

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-cliproxyapi-always-on/`.
