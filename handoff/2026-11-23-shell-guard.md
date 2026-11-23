# Weekly lessons: the shell guard and a digest in parts

**What changed.** The first weekly review (recipes/learning-loop.md) of 120 sessions made two
laws and fixed its own input.
- `hooks/shell-guard-lib.mjs`, run first by the Bash hook (`boat-route.mjs`, one Node start):
  a `pkill -f` (or a `pgrep -f` that feeds `kill`) whose pattern has no bracket class is denied
  with the bracketed pattern, because Claude Code runs the whole command as one bash's argument
  and the pattern matches that shell, which kills itself (exit 143/144: 15 times in 11 sessions;
  14 of 18 such runs failed). An `rm -rf` is denied with the next step (a fresh `mktemp -d`
  folder, or a move to `~/.local/share/backups/`); the permission rule denied it 31 times in
  19 sessions and the memory line about it did not reach the agent in time.
- `digest.mjs` cut the digest at 80 KB, which dropped the owner's messages of the last three
  days (70 of 120 sessions). It now writes `<date>.md`, `<date>-2.md` and on, split between
  sessions, each part naming the next, and prints every path.

**Verification.** New `scripts/shell-guard.test.mjs` (5 tests) and a `digestParts` test pass
locally; the full suite runs on boat. A replay of the guard over the week's 17,736 archived Bash
calls stopped all 15 self-kills and all 31 `rm -rf` denials, missed none, and stopped 3 other
`pkill -f` calls whose patterns matched their own shell and survived by chance.

**Outstanding.** None for this pull request. Left as repeats, not laws: `t3_background_wait`
on ids no background start returned (65 calls in 28 sessions, most in the same block as the
start, so the id was guessed): a transcript check would also have stopped 31 good calls, and
T3 Code's own error names the next step. The parallel-chats and owner-answers stops (one per
session, as designed), the boat route and the read-size stops: hooks that work.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-23-shell-guard/` (the scan and
replay scripts, `replay.txt` with counts only); the private review
`~/.local/share/agent-log/reviews/2026-11-23.md`. The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-shell-guard/release-check.log`.
