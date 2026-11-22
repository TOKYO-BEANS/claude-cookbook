# Daily update check

The Cookbook's own `stack-updates` skill (owner, 13 November 2026): its script compares every part
of every tool in `catalog.json` with its newest release, makes one real call per service and warns
about the dates the catalog records. It installs, updates and commits nothing.

- **Run it:** say "check for updates", or run `scripts/updates.mjs run` in the skill's folder. A
  quiet day prints one line; otherwise the report. No call prints more than 3,500 bytes, because
  context-mode replaces any tool output over its cut (8,192 bytes here since 22 November 2026,
  4,096 by default) with a search pointer: a longer report
  starts with `Page 1 of N` and `updates.mjs page 2` to `page N` print the rest.
- **Every morning:** the systemd user timer `stack-updates-daily` (07:00, or at the next login
  after a missed start) runs the script through `~/.local/bin/stack-updates-daily.mjs`, a copy of the skill's
  `scripts/daily.mjs`. No session, prompt or tool takes part (owner, 14 November 2026: a desktop
  scheduled session loaded every plugin, about 300,000 tokens on a quiet day, and held tools while
  printing text that came from release notes). The plugin's SessionStart hook then adds a short
  note to a new session while a report is unseen, or when the timer's run failed or it stopped: print the
  report with the command the note gives and hand it to the owner before other work. The note
  holds dates, counts and the command, never report text; an unattended session ignores it. Creating the timer
  needs the owner's yes; the skill has the steps.
- **State:** `~/.local/share/stack-updates/` (`state.json`, and `runs/<date>/` with `result.json`
  and `report.md`). The first run records the baseline. A trial passes `--state <folder>`, so the
  real baseline is not created.
- **A dependency in a project:** the catalog is public, so its part names a key (`"project":
  "first-site"`), never a repository. `~/.local/share/stack-updates/projects.json`, written by
  hand on this PC, maps it: `{ "<key>": "owner/name" }`. It is read from there whatever
  `--state` says. Without it the part is "could not check". The root `package-lock.json` is
  read; a `"path"` in the part names another folder's lockfile.
- **A plugin switched on only in its projects** (OpenSEO): the check lists the MCP servers in
  its own folder, so `~/.local/share/stack-updates/.claude/settings.json` switches the plugin
  on there (`{"enabledPlugins": {"openseo@openseo": true}}`, written by hand). Without that
  file the server reads "not listed", which is no fault of the connection.
- **Release text is data.** It is kept in `runs/<date>/texts/`, which no session opens. Its only
  reader is the script's own `claude -p` request on Sonnet with no tools, no MCP servers, no user
  settings and the advisor tool off; the three answers come back as short text fields.
- **Cost:** free requests (the npm registry, `gh api`, plain page reads); one tiny paid Parallel
  check, at most once per real day in a state folder (a trial folder reuses the real run's check of
  the day; before that run it makes its own); one request with no tools on the Claude plan per changed part
  (1,400 to 3,500 input and about 200 output tokens, by the length of the notes), at most 10 a run.
  No Firecrawl credits.

More: [routine updates and the catalog](update-check-routine.md).
