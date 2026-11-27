# 27 November 2026: boat-chat, the last two lows of #288's review

**What changed.** The AI review of #288's last head (7ee85b5) left two lows, taken here as
promised in that pull request:
- `stateKind`: `error`, `failed` and `archived` are "failed", no longer "gone". Such a sandbox
  still exists and may hold unpulled work, so `up` stops with its id instead of making a new
  one and dropping the old one from the record (`boat recover <id>`, or `down --delete` once
  its work is safe). Only `deleted`, `deleting` and "not in boat's full list" count as gone.
- `down`: a failed or unreadable `boat list` leaves the proxy as it is, says so and exits 1,
  instead of reading "none run" and turning off a proxy other chats may use.

**Verification.** Tests "a failed sandbox is never replaced: up stops with its id" and "down
leaves the proxy as it is when boat's list cannot be read"; the full suite in a Depot sandbox
(see the pull request).

**Dead ends.** None.

**Outstanding.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-boat-chat-route/`. Release
log: this pull request's `sa-release` run, in the same folder.
