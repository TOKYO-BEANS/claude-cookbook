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
  tools in `--allow`, and nothing else. It has no shell. Its own settings file denies every
  other claude.ai connector and repeats the deny rules for logins and keys that the user
  settings would have given it. `--budget` (3 US dollars of plan usage) and `--minutes` (20)
  end it.
- **Files.** The only files of the owner's the child can see are the ones the script copies
  into `<out>/to-adobe`: each `--send <file>`. Each must be named in `--owner-yes` by its whole
  file name, as the gate asks of a yes, and be a plain file, not a link. That folder may hold
  nothing else, so a file from an earlier run means a new `--out`. Whatever else `--out`
  holds, the child cannot read it. `--out` is not a drive root, the home folder, a repository
  or project root, a link, or anything under `.claude`, `.ssh`, `.git` and the like. The
  brief is a small `.md` or `.txt` file written for the run: all of it goes into the prompt.
- **No shell.** A step that needs one (a PUT to a presigned link, a download) is done by the
  chat that started the run: the child writes the link into its run folder and reports the
  step as waiting.
- **Measured.** Allowed: a read of a staged file, a write and a read in the run's folder, the
  listed Adobe tool. Denied: an older file in `--out`, a Glob of it, the file's original, a
  write elsewhere, the script's own files, an unlisted Adobe tool. A shell command: no tool.
- **The script cannot know what the owner said.** It checks that the yes names every file,
  the Adobe account, the credits and the operation of each tool that is not read-only.
  Whether the owner gave it in this chat is the gate ([photos.md](photos.md)).
- **Exit codes.** 0: the session ended well and called an Adobe tool (or wrote the list).
  1: it failed or did nothing. 2: the arguments were refused. 3: stopped or not to be
  trusted: the time limit, no connector in 90 seconds, a debug log left behind, or another
  server connected (add that connector to `OTHER_CONNECTORS`).
- **After a run.** The script prints the calls made, the denied calls and the session's
  report. Check the calls and the files, not the status line. Its log beside `--out`
  (`<out>.adobe-session`) keeps the allow list, the model, tool
  names, denials, counts and cost: no prompt, file name, argument or result text. The yes
  reaches the child in a file that is deleted after the run, not on a command line.

Routes that were tried and do not work: [dead ends](photos-adobe-connector-dead-ends.md).
