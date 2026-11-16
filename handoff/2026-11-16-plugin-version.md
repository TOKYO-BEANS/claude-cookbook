# 16 November 2026 (late): the plugin has no version number

**Why.** The second half of "a handoff and version that stop colliding" (the owner's answer of
16 November 2026, "Build all three (Recommended)"; the first half is
`2026-11-16-parallel-chats.md`). Every Cookbook pull request set the next number on one line
of `plugin.json`. Two open pull requests conflicted there, and two that chose the same number
merged with no conflict: #86 took 0.39.0 under #87, and the installed copy would then not
have updated at all.

**What was not known, and is now measured** (Claude Code 2.1.325, a config folder of its own,
a throwaway marketplace; the table is in the evidence folder):
- With no `version` in the manifest or the marketplace entry, `installed_plugins.json` holds
  12 characters of the commit as `version` and the whole commit as `gitCommitSha`.
- That commit is the head of the repository, not the newest commit under the plugin's
  folder. A commit that changes nothing in the plugin is an update too.
- `claude plugin update` alone answered "already at the latest version" until `claude plugin
  marketplace update` had run, for that marketplace (registered by hand as a `git` source).
  On the real install, a GitHub marketplace, the one command refreshed the clone itself.
- A copy with a number moves to the commit at its next update ("updated from 1.0.0 to
  08f026ea2d9d"), and back when a number returns.
- A `url` source and a `git-subdir` source with no version record their own repository's head
  the same way (`git-subdir` adds a hash of the path to the version).

**What changed.**
- `plugins/cookbook/.claude-plugin/plugin.json` has no `version`. `versionErrors` in
  `scripts/check.mjs` fails `npm test` when one comes back, there or in the marketplace entry.
- The update check, in `skills/stack-updates/scripts/lib/`:
  - `feeds.mjs`: a marketplace plugin with no version is read as the head of its source, with
    no path (`pluginVersion`, `marketplaceLatest`). A version that is there and is not x.y.z
    is still "could not check", never read as "no version". Such a plugin has no release
    text: the subjects of a whole repository are not its notes, and GitHub's security review
    of the second head was right that they would put text anyone with a commit there wrote
    in front of the read stage's model. The report links the commit.
  - `compare.mjs`: for such a plugin the registry's commit is the position: equal is current,
    unequal is behind, and a commit a session recorded is not used. A marketplace plugin that
    drops its version, or takes one again, starts from a new baseline, so no "0.40.0 to a
    commit" is reported. A `commit` feed is unchanged: it reads a path, so an unequal registry
    commit there still says nothing.
  - `inventory.mjs` and the `verify` step in `updates.mjs` needed no change: the registry has
    a version (12 characters) and a whole commit, and `verify` already compares commits.
- `skills/cookbook/scripts/codex-start-check.mjs` compared the plugin's number in the
  marketplace clone with `main`'s. It now reads the clone's commit from its files (`HEAD`,
  the branch's file, `packed-refs`; no Git is run) and compares it with `main`'s head. The
  phrases and exit codes are the same.
- `recipes/plugin-version.md` (new), a pointer in `recipes/parallel-chats.md`, and two
  paragraphs in the `stack-updates` skill.

**Titles and headings.** No number. A pull request's own number names the change; a copy on
a PC is named by its 12 characters.

**Decisions that were mine.**
- Leaving the number out, not a number set by one step at merge time: that step would push to
  `main` past the required checks, and Claude Code's own rule already gives every merge a
  version.
- The update check follows what Claude Code does, so the Cookbook's plugin reads "behind"
  after any merge until the two update commands have run, also after a merge that changed
  nothing in the plugin.
- Nothing became looser in "install without asking": a plugin installed by commit has no
  release notes, so it is never a routine update. Before this, the Cookbook's 0.x steps asked
  as well: a step of the second number counted as major, and a step of the third had only
  commit subjects, which are not release notes. The review of the first head found the one way
  round that: when the feed's text could not be read, `notesFor` in `updates.mjs` fell back
  to the repository's GitHub releases, which two commits do not bound, so every release on
  the page counted as clean notes. Fixed in the same pull request: a commit-shaped change
  never reads releases, and `verdictOf` never calls text between two commits "clean" unless
  it is commit subjects (which count as "none").
- **Two existing tests were changed, not loosened**, both in
  `scripts/codex-start-check.test.mjs`: the scene's marketplace clone is now a `.git` folder
  on a commit where it was a `plugin.json` with a number, and the last GitHub call asserted
  is `commits/main` where it was the manifest's contents. "A Cookbook version that cannot be
  read" became "a Cookbook commit that cannot be read", with more refused shapes than before.

**Verification.** See the pull request for the checks of its head and the reviews.
- The changed Codex start check was run for real in this checkout: exit 0, "main's version",
  with the clone and `main` both on `20b4777`.
- New tests: feeds (7), compare (5), inventory (1), the run and `verify` path end to end (1),
  the check (1), the Codex start check (1 new, 3 rewritten). The three new compare tests that
  can fail against the old `compare.mjs` were run against it, and failed.
- Merged as `9853430` (#90) through `sa-release`: review gate allowed on a fallback review
  of the head (three rounds; the CI review was out of credit), release event verified and
  acknowledged.
- After the merge, on the real install: `claude plugin update cookbook@claude-cookbook`
  answered "updated from 0.40.0 to 9853430351c2"; the registry holds that version and
  `main`'s head as `gitCommitSha`. The daily check, run from the updated plugin against a
  copy of the real state, read `cookbook/plugin` as current: installed and latest the same
  commit, not behind, no feed error, in none of the report's lists. The state held a number
  before that run, so it was also the move from a number to a commit: a new baseline,
  nothing reported.
- `npm test` on this PC, first pushed head: 636 tests, 631 passed, 4 skipped, 1 failed, the
  Windows key test in `scripts/with-key.test.mjs`, which timed out on a loaded PC and which
  this change does not touch. The two later heads ran the affected test files only; CI ran
  the suite on each.

**Outstanding.**
- **A pull request opened before this, with a `version` line,** fails `npm test` after merging
  `main` until the line is taken out: intended, one round each. None was open when this was
  pushed (#88 merged first, as 0.40.1, the last number). Owner: the chat that has the pull
  request.
- **Old cache folders.** Every update now makes a folder under
  `~/.claude/plugins/cache/claude-cookbook/cookbook/`; Claude Code removes one 14 days after it
  was replaced. Not measured: how much disk that is on a day of 20 merges.
- **Stack Atlas and the other repositories were not searched** for a reader of the Cookbook's
  version number. Owner: Claude; clears: a search there, or the first failure.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-16-plugin-version/`
(`measurement.md`, the two commit lists, the registry at the end).
