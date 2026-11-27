# 27 November 2026: whole Claude chats on boat, a trial until 16 December

**The owner's answer.** In the chat that built #285 (question dialog, 27 November 2026), to
"a whole T3 chat in a sandbox": "try it out on boat all ready have the active sub and a wallet
with 30usd on it". A yes to a trial on boat's current plan (paid until 16 December 2026) and to
boat's AI credentials proxy on from the wallet (USD 1 a day while on). Not covered: keeping the
plan past 16 December, a top-up, a larger size. This settles the "outstanding" line of the
#285 entry.

**What changed.**
- New page `recipes/sandboxes-boat-chat.md`: a T3 Code server in a boat sandbox, linked to this
  T3 as an environment through `boat forward`; each step, the stop and resume, the end, the
  numbers. `recipes/sandboxes.md` and `recipes/sandboxes-claude.md` point to it;
  `options/sandboxes.md` compares a month of chats on boat and on Depot.
- boat back in `catalog.json` as `trial` (dates: plan ends 16 December 2026, key ends 27
  November 2027) and in the stack-updates version table.
- `scripts/sandbox-claude.test.mjs`: three tests of `main()`'s exit codes (the low left open by
  #285), written by the trial chat itself in the sandbox over two turns and reviewed there in a
  third (macOS temp path, tar `._` files, a temp-folder leak check, a 60 s timeout).
- On this laptop: the boat CLI 1.0.106 (GitHub release `boat-cli-v1.0.106`, SHA-256 checked;
  1.0.107 was under 24 hours old) pinned in `~/.local/share/boat`, the launcher
  `~/.local/bin/boat` back. The owner made the API key on boat's dashboard ("Claude - Boat",
  all scopes, ends 27 November 2027) and saved it in the vault under that title and in T3's
  secret card; both copies matched by hash, stored as key `boat`, the card's file deleted.

**Verification (27 November 2026).** Sandbox `bx_22h8jbu4` (`small`, environment
`claude-proxy`): two `boat prompt` turns (20 s and 81 s), then a T3 thread in the linked
environment, four turns, Opus 5.5 high: real work, then `boat stop` (5 s) and `boat resume`
(1 s); the thread kept its context after the T3 server was restarted. The full suite in the
sandbox: 801 tests, 797 passed, 4 skipped, 0 failed; the new test file 9 of 9, three runs.
Cost: 23 proxied requests (USD 0.023), 355 plan seconds (USD 0.0036 of the plan), the proxy's
day USD 1: the wallet went from USD 29.96 to 28.96 (the requests not yet deducted). Laptop:
the forward 6 MB; local sessions measured 208 to 332 MB each, 0.3 to 4 GB with children.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-boat-chat-trial/` (billing
before and after, the proxy on and off, usage per sandbox, the turns, both patches). Release
log: this pull request's `sa-release` run.

**Dead ends and traps.** `--auto-bootstrap-project-from-cwd` is not a `t3 serve` flag. A T3 server
refuses a link until `linkedEnvironmentsEnabled` is set. `t3 serve` prints a pairing QR at
start: one reached this session's output; it had expired (no pairing token active, checked).
At resume the proxy's placeholder changes, and the old T3 server got 401s. Killing `boat
forward` leaves its `ssh` child holding the port. `boat exec` stops a command at 30 s unless
`--timeout`.

**Outstanding.**
- The owner's decision by 16 December 2026: renew boat's plan for chats (about USD 71 a month
  as measured) or let it end; without a yes it ends, the boat entry and page go, and chats stay
  on the laptop. Asked in the chat that made this entry.
- The refund: a refund of the wallet was asked of boat support on 26 November (`boat
  feedback`); the trial spends from that wallet (USD 1.02 so far), so the refund, if it comes,
  is smaller. The wallet showed USD 28.96, no refund yet.
- Left running on purpose: sandbox `bx_22h8jbu4`, stopped (disk and memory kept 14 days,
  until 11 December), and the linked environment `box-node-10d021c75f81ea70` in T3 (ends 27
  December): the trial chat resumes from them. The proxy is off.
- The sign-in gap: the key was the owner's step on boat's dashboard. With an all-scopes key,
  `boat api-key create` and `rotate` now need no owner unless the key is revoked.
