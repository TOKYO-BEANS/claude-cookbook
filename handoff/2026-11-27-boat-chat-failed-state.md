# 27 November 2026: boat-chat, a failed sandbox before any spend and one way out

**What changed.** The two lows the AI review of #289 left:
- `up` checks for a failed sandbox (`error`, `failed`, `archived`) right after reading it and
  before the proxy, so a command that must fail turns nothing on.
- `up`, `pull` and `down --delete` (without `--discard`) give a failed sandbox one message:
  "sandbox <id> is <state>: boat recover <id> first, or down --delete --discard". Before,
  `pull` said "run up first" and `down --delete` said "the sandbox is stopped", which sent the
  user back to `up`, which refuses it. The state test's name now matches the mapping.
- The recipe page is not changed: it has 20 bytes of room, and the message names the way out.

**Verification.** The test "a failed sandbox is never replaced: up stops with its id" now
asserts `ai proxy on --json` is never called, and the exact messages of `up`, `pull` and
`down --delete`, and that `down --delete --discard` still deletes a failed one; the full suite
in a Depot sandbox (see the pull request).

**Dead ends.** None.

**Outstanding.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-boat-chat-route/`. Release
log: this pull request's `sa-release` run, in the same folder.
