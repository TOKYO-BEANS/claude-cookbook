# 20 November 2026: the owner-questions broker takes over a socket file left by a killed broker

**Why.** On the Ubuntu laptop the Stop hook got one Jev answer after 19 November 17:26 UTC and
then 186 fallbacks to the phrase list (`no broker yet (started)` 72, `(starting)` 114). Found by
the chat that rewrote the Windows pages (#176).

**Root cause.** The broker listens on a Unix socket, `/tmp/cookbook-owner-questions-<id>-<v>.sock`.
A Unix socket file outlives a process that is killed (a Windows named pipe does not, so the PC
never showed it). The first broker, started 18:26:40, was killed, and its file stayed. From then
on every connection got `ECONNREFUSED` ("no broker"), every new broker got `EADDRINUSE` on
`listen` and left at once (`.catch(() => process.exit(0))`, meant for "another broker listens").
Ruled out: the key (`jev-compaction` is in GNOME Keyring), D-Bus in the detached child (the 18:26
broker read the key and answered), the "10 minutes without a key" exit.

Why it was killed: the detached broker stays in the systemd scope of the T3 session that started
it (`app-t3code-agents.slice/.../t3code-claude-<id>.scope`), so it ends when that scope is
stopped. That will keep happening; with this fix the next turn starts a new broker, and the key
read takes about a second on Linux, inside the hook's 12-second budget.

**What changed.**
- `owner-questions-broker.mjs`, `startBroker`: on `EADDRINUSE` (not on Windows) the path is
  removed and `listen` tried once more, only when it is a socket of this account and a
  connection to it is refused. A live broker is never displaced; a file that is not a socket is
  left alone. The `listening` handler is registered once: a failed `listen(path, cb)` keeps its
  callback, and the retry would have set the idle and life timers twice and kept the process up.
- `scripts/owner-questions.test.mjs`: a test that kills a listener with `SIGKILL`, then checks
  the takeover, the live broker and the plain file. It failed with `EADDRINUSE` before the fix.

**Verification.**
- `node --test scripts/owner-questions.test.mjs`: 29 of 29; the full `npm test` on boat (below).
- The worktree's hook, run by hand at 00:02 on 20 November against the real stale file: the new
  broker removed it and listened; the log row has `source: jev`, owner 0.99, 775 ms.
- After the merge and `claude plugin update`: `source: jev` rows from real turns (below).

**Dead ends.** The first test run never ended: the retry's second `listen(path, cb)` fired both
callbacks and left a timer pair behind. Fixed by the single `listening` handler above.

**Outstanding.** None known. A broker that is killed still costs its scope's sessions nothing
more than one cold start on the next turn.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-owner-questions-stale-socket/`:
`diagnosis.txt`, `log-counts-before.json`, `jev-rows.jsonl`, `owner-questions-test.out`.
