# The plugin's version is its commit

Until 16 November 2026 every Cookbook pull request set the next number on one line of
`plugin.json`. Two open pull requests conflicted there, and two that chose the same number
merged with no conflict and no update at all: Claude Code keeps the installed copy while the
number is the same.

- **No number.** `plugins/cookbook/.claude-plugin/plugin.json` and the entry in
  `.claude-plugin/marketplace.json` carry no `version`. `npm test` fails when one comes back
  (`versionErrors` in `scripts/check.mjs`); a pull request opened before this takes its line out
  when it merges `main`.
- **What Claude Code does then** (documented in "Versions and updates" of its plugin pages;
  measured with 2.1.325): it installs by commit. `~/.claude/plugins/installed_plugins.json`
  holds 12 characters of the commit as `version` and the whole commit as `gitCommitSha`, and
  the cache folder has that 12-character name. The commit is the head of the repository, not
  the newest commit under `plugins/cookbook`: every merge is an update, one that changes
  nothing in the plugin too. A copy that still has a number moves to the commit at its next
  update.
- **After a merge**, on this PC: `claude plugin update cookbook@claude-cookbook`. On
  16 November 2026 it refreshed the marketplace's clone by itself ("updated from 0.40.0 to
  9853430351c2"). When it answers "already at the latest version" while `main` has moved, as
  it did for a marketplace registered by hand in the measurement, run `claude plugin
  marketplace update claude-cookbook` first. A running session keeps the copy it loaded
  until `/reload-plugins` or its next start.
- **Names.** A pull request title and a handoff heading carry no number. The pull request's
  own number names the change; a copy on a PC is named by its 12 characters, which
  `git log` finds.
- **The daily update check** reads the head of `main` for the Cookbook's plugin and compares
  it with the registry's commit: equal is current, unequal is behind. The same holds for any
  marketplace plugin with no version (`lib/feeds.mjs`, `lib/compare.mjs` in `stack-updates`).
- **The Codex start check** compares the commit of the marketplace clone Codex reads with
  `main`'s head, read from the clone's files (`scripts/codex-start-check.mjs`).

Not chosen: a number set by one step at merge time. It needs a workflow that pushes to
`main` past the required checks, and Claude Code's own rule already gives every merge a
version.
