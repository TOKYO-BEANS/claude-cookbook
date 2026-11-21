# 21 November 2026: the learning loop

**What changed.** The owner asked for a place that keeps everything we do, so mistakes stop
coming back and become our own laws. Asked in a dialog, the owner leaned to the full loop
(keep, review weekly, promote to laws) and asked whether a separate SSD would help.
- Claude Code deleted transcripts after 30 days (no `cleanupPeriodDays`); now 3650 in
  `~/.claude/settings.json` (backup in `~/.local/share/backups/`). The Windows PC's history is
  already gone.
- `scripts/agent-log/archive.mjs`: Claude Code and Codex transcripts to
  `~/.local/share/agent-log/`, credential shapes masked, images and signatures dropped, zstd.
  First run: 322 sessions, 539.6 MB in, 47.0 MB stored, about a minute.
- `scripts/agent-log/digest.mjs`: the weekly input, repeated tool errors and the owner's
  messages. First digest (7 days, 97 sessions): hook denials on the same calls in 19 to 43
  sessions each (parallel-chats, owner-answers, `rm -rf`), `t3_background_wait` on ids that run
  nothing in 21, the read size limit in 12.
- The nightly timer `agent-log` and the T3 task "Weekly lessons" (see `recipes/learning-loop.md`).

**SSD answer.** Not needed for room (383 GB free; about 10 GB a year stored) or for the
review. Its only gain is a backup against a lost laptop; then it must be LUKS-encrypted. The
owner decides whether to buy one.

**Verification.** `npm test` on boat: 754 tests, 750 pass, 0 fail, 4 skipped. The archive and digest ran on
the real transcripts (numbers above); no credential shape is left in the test fixtures' output.

**Dead ends.** The first archive pass masked every random-looking string, tool call ids too,
so an error could not be tied to its tool (731,622 masks). The archive now parses each line
and keeps id fields as they are (161,162 masks).

**Evidence.** `~/.local/share/agent-log/` (the archive, `index.json`) and its
`digests/2026-11-21.md`.

**Outstanding.** Install the launcher and timer, and create the weekly task, after this merge
and `claude plugin update` (the timer runs the installed plugin's copy).
