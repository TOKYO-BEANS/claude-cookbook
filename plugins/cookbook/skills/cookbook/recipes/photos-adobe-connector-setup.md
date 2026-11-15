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
  deny list do not apply, in `dontAsk` mode: a call no rule allows is denied. It may read
  `<out>/to-adobe`, read and write `<out>/run-<time>` (made new for the run), call the Adobe
  tools in `--allow`, and nothing else. It has no shell. Its own
  settings file denies every other claude.ai connector and repeats the deny rules for logins
  and keys that the user settings would have given it. `--budget` (3 US dollars of plan usage)
  and `--minutes` (20) end it. The stops of the recipe are in its system prompt.
- **Files.** The only files of the owner's the child can see are the ones the script copies
  into `<out>/to-adobe`: each `--send <file>`. Each must be named in `--owner-yes` by its whole
  file name, as the gate asks of a yes, and be a plain file, not a link. That folder may hold
  nothing else, so a file from an earlier run means a new `--out`. Whatever else `--out`
  holds, the child cannot read it. `--out` is not a drive root, the home folder, a repository
  or project root, or anything under `.claude`, `.ssh`, `.git` and the like.
- **No shell.** A step that needs one (a PUT to a presigned link, a download)
  is done by the chat that started the run: the child writes the link into a file in its
  run folder and reports the step as waiting. No upload has gone through this script yet, so the exact
  steps are not known.
- **Measured.** Allowed: a read of a staged file, a write and a read in the run's folder, the
  listed Adobe tool. Denied: an older file in `--out`, a Glob of `--out`, the file's original,
  a write into `--out` or `to-adobe`, the script's own files, an Adobe tool not listed. A
  shell command: no such tool.
- **The script cannot know what the owner said.** It checks that a tool outside the short
  read-only list has a yes, and that the yes names every file. Whether the owner gave that yes
  in this chat is the gate ([photos.md](photos.md)), and it is the caller's to keep.
- **Other servers.** The script exits 3 when the session's debug log shows any server but
  the connector connected: add that connector to `OTHER_CONNECTORS`.
- **After a run.** The script prints the calls made, the denied calls and the session's report.
  Check the calls and the files, not the status line: exit code 0 with "calls: none" did
  nothing. Its log beside `--out` (`<out>.adobe-session`, out of the child's reach) keeps tool
  names, denials and cost: no prompt, argument or result text. The debug log is deleted.
- The desktop app loads the connector in its own sessions regardless.

Routes that were tried and do not work: [dead ends](photos-adobe-connector-dead-ends.md).
