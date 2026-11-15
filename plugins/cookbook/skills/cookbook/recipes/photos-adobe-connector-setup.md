# Photos: the Adobe connector's child session

How `scripts/adobe-session.mjs` in the skill's folder brings the connector in (tests in the
repository's `scripts/adobe-session.test.mjs`). Proved on 15 November 2026, Claude Code 2.1.325.

- **What stays off.** `claude.ai Adobe` and `plugin:adobe-for-creativity:Adobe` stay in
  `deniedMcpServers` in `~/.claude/settings.json`, and the plugin `adobe-for-creativity@synced`
  stays disabled. Terminal and T3 Code sessions therefore load no Adobe tool. Do not remove
  those entries, and do not enable the plugin: its server is the direct one that Adobe refuses.
- **What must stay on.** The connector stays connected in claude.ai (Settings, Connectors). The
  child session gets it from there. Disconnecting it there ends this route and the fallback.
- **The child session.** `claude -p` with `--setting-sources ""`, so the user settings and their
  deny list do not apply, in `dontAsk` mode: a call no rule allows is denied. Its rules: read
  `--out` and each `--add-dir`; write in `--out`; the Adobe tools in `--allow`; no shell unless
  `--bash "curl <args>"` is passed (curl is the only command accepted). Its own settings file
  denies every other claude.ai connector and repeats the deny rules for logins and keys that
  the user settings would have given it. `--budget` (3 US dollars of plan usage) and
  `--minutes` (20) end it. The stops of the recipe are in its system prompt.
- **Folders.** `--out` is a folder for this run's results: not a drive root, the home folder, a
  repository or project root, or anything under `.claude`, `.ssh` and the like. The script
  keeps its settings, event log and debug log beside it in `<out>.adobe-session`, which the
  child can neither read nor write.
- **Measured.** Allowed: a read in `--add-dir`, a write in `--out`, the listed Adobe tool.
  Denied: a read, Glob and Grep elsewhere; `~/.claude/settings.json`; the script's own settings
  file; a write into `--add-dir`; an Adobe tool not listed; with `--bash "curl *"`, a `mkdir`
  and a redirect. With a shell on, Claude Code still runs commands it reads as read-only
  (`whoami`, `node --version`), and curl can send any file the user can read to any address:
  pass a shell rule only when the piece needs it. No upload has gone through this script yet.
- **Tripwires, not the gate.** A tool outside the short read-only list needs `--owner-yes`
  (one line; it goes into the system prompt, where a brief cannot imitate it). After the run
  the script reads the session's debug log and exits 3 when any server but the connector
  connected: add that connector to `OTHER_CONNECTORS`. The gate itself is the owner's yes in
  the chat ([photos.md](photos.md)).
- **Timing.** The connector reaches a new session a moment after it starts. The script holds
  the prompt back until the debug log shows it connected, and stops after 90 seconds without.
- **After a run.** The script prints the calls made, the denied calls and the session's report.
  Check the calls and the files, not the status line: exit code 0 with "calls: none" did
  nothing. The logs can hold account detail: keep them out of a repository.
- The desktop app loads the connector in its own sessions whatever these settings say.

Routes that were tried and do not work: [dead ends](photos-adobe-connector-dead-ends.md).
