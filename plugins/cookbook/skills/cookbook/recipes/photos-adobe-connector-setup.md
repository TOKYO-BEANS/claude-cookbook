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
  deny list do not apply, and a settings file that denies every other claude.ai connector. It
  runs in `dontAsk` mode with only the tools named on the command line: Read, Glob, Grep and
  ToolSearch, writes inside `--out` only, and the Adobe tools in `--allow`. It has no shell
  unless a `--bash "<rule>"` is passed (for example `curl *`, to send a file to a presigned
  link or fetch a result). `--budget` (3 US dollars of plan usage) and `--minutes` (20) end
  it. It follows the stops of the recipe from its system prompt.
- **Measured limits.** Denied: an Adobe tool not in `--allow`, a write outside `--out`, and
  with `--bash "curl *"` a `mkdir` and a redirect to a file. With a shell on, Claude Code also
  runs commands it reads as read-only (`whoami` and `node --version` ran): a shell rule is not
  a list of everything the shell can do. `curl *` can send any file the session can read to
  any address: pass a shell rule only when the piece needs it.
- **Tripwires, not the gate.** A tool outside the script's short read-only list needs
  `--owner-yes`. The run stops when its first event lists any server but the connector: a
  connector added in claude.ai later has to be added to `OTHER_CONNECTORS` in the script. The
  gate itself is the owner's yes in the chat ([photos.md](photos.md)).
- **Timing.** The connector reaches a new session a moment after it starts, so every run
  begins with a ToolSearch call, which waits for it (three of three runs then found it).
- **After a run.** The script prints the calls made, the denied calls and the session's report;
  the full event log is in `--out`. Check the calls and the files, not the status line. The log
  can hold account detail: keep it out of a repository.
- **Proof.** One run with `--allow adobe_mandatory_init,get_account_type,font_search` and no
  yes: the three calls answered (a signed-in account; ten fonts for "Lato"), no file was sent
  and nothing was created.
- The desktop app loads the connector in its own sessions whatever these settings say.

Routes that were tried and do not work: [dead ends](photos-adobe-connector-dead-ends.md).
