# Learning loop

Every session is kept, read back each week, and a mistake that comes back becomes a law.
Asked on 21 November 2026, the owner leaned to the full loop; no model of our own is trained for now.

- **Keep.** Claude Code keeps transcripts for 10 years (`cleanupPeriodDays: 3650` in
  `~/.claude/settings.json`; the default deletes them after 30 days). The `agent-log` user
  timer (03:30) runs `scripts/agent-log/archive.mjs` through `~/.local/bin/agent-log-nightly.mjs`:
  each new or grown Claude Code and Codex transcript is copied to `~/.local/share/agent-log/`
  (folder 0700, files 0600, zstd, about a tenth of the size), every credential shape masked
  (`agentshield/sanitize.mjs`), images and thinking signatures dropped, ids kept.
  `last-run.json` says how the last night ended. The archive stays on this laptop's encrypted
  disk: never in a repository, never uploaded. A backup copy goes only to an encrypted drive.
- **Read.** The T3 task "Weekly lessons" (Mondays 09:00, Cookbook project) runs
  `scripts/agent-log/digest.mjs --days 7`. The digest (in `digests/`, 80 KB a part; a long
  week goes on in `<date>-2.md` and on, and the review reads every part) lists the tool
  errors that came back in more than one session and what the owner typed, by session.
  It reads the archive only, never `~/.claude`.
- **A lesson** is a mistake in three or more sessions, an owner correction, or the same
  failure twice in one job. A hook that denies the same call again and again is a lesson too:
  the agent learned the rule too late.
- **Also look at what the sessions ran in** (23 November 2026, from a measured
  [comparison](../options/skills-compared.md)): an instruction in a steering file that no
  session needed or followed; a check that exists but nothing runs, or a mistake a mechanical
  check would have caught; information the agent searched for at length or could not see; a
  tool call that read far more than it used. Each one the sessions show gets a proposal.
- **Promote** each lesson to the strongest form that fits, through a normal pull request:
  1. a check, test or hook that stops it, or a hook message that names the exact next step;
  2. a line where the agent reads before acting: the tool's recipe page, the skill, the
     project's `CLAUDE.md`;
  3. a memory line, only for an owner preference.
  Never loosen a check to make a repeat go away. A law that changes how the owner works is
  asked first. A Bash mistake that a command's text shows goes into the shell guard
  (`hooks/shell-guard-lib.mjs`, run by the Bash hook): it denies with the exact next step.
  Since 23 November 2026 it stops `pkill -f` patterns that match their own shell and `rm -rf`.
- **The laws ledger** is `~/.local/share/agent-log/laws.md`: per law its date, the rule, where
  it lives and is enforced, and the sessions behind it (ids, no text). The review reads it
  first and counts a lesson already there as "law not working" instead of a new law.
- The review writes `reviews/<date>.md`, opens at most one pull request per repository, and
  ends with one line to the owner: the laws added and the repeats that remain.
- The Cookbook is public: a pull request names the rule and the count, never a project,
  client or transcript text.
