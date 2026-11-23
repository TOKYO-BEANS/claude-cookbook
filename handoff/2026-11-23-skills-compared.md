# 23 November 2026: mattpocock/skills measured against ours; pr-text added

**Why.** The owner asked on 23 November 2026 for a test of each of the 27 `mattpocock/skills`
against the tool with the same job here, Superpowers first, with tests of our own. A skill
replaces an owner only on a measured result.

**What changed.** Two pages hold the results: `options/skills-compared.md` (the ten jobs with
a match here) and `options/skills-compared-single.md` (the eleven skills with none, how it
was run, the limits). No owner in the map changed. Four things follow from the numbers:

- A fourth skill in the plugin, `plugins/cookbook/skills/pr-text/` (`SKILL.md` and the
  upstream `LICENSE`): our adapted copy of his `pr`, a third of its size, with the rule that
  evidence is output pasted from commands that ran. Map row "Pull request text", catalog
  entry at `trial` with a commit feed on the upstream folder, the README, and the check's
  list of skill files with its test.
- `recipes/learning-loop.md`: four things to look for besides repeats, from his `retro`.
- `recipes/building.md`: size the method to the job (the plan with a subagent per task cost
  15 times the plain build for the same hidden-test result).
- `recipes/add-ons.md`: the "weighed, not added so far" line is now the measured result and
  the `pr-text` line. `SKILL.md` had no room for the row: its bytes came from four
  descriptive clauses that their pages repeat ("the Grep tool", the T3 pool name, "GNOME
  Keyring", "by itself"). No rule sentence changed.

**Verification.** 233 runs on the plan (172 Sonnet 5.5, 43 Haiku 5.5, 18 Opus 5.5) and 133
blind judge calls on Opus 5.5 (one more, a Haiku build with Superpowers' subagents, was still
running after 40 minutes and is not counted); every program-scored task's scorer was checked first against
an untouched copy (fails) and a reference solution (full score). The pull request text result
was repeated on a second, independent task and on Opus 5.5 high, and the judge's "invented"
count was replaced by a program check against each run's own tool results. The upstream `pr`
folder was read whole (`SKILL.md`, `CREDITS.md`, `agents/openai.yaml`: Markdown and one small
YAML file, no script). Gitleaks: no leaks. Trivy: exit 0, nothing in the folder it scans.
OSV-Scanner: exit 128, no package file to parse, which is no result and not a clean one. No
sandbox run (a skill). The Cookbook check and the suite on boat.

The review of #244 had two lows, both fixed in the follow-up pull request: `pr-text` now says
to mask a credential, an account id, a home path or a private project name in pasted output,
and the first point of `recipes/building.md` no longer contradicts the sizing point. Its release
check writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-skills-compared-lows/release-check.log`.

**Outstanding.** `pr-text` stays at `trial` until it has written real pull requests: look at
the first five and move it to `active` or take it out (owner: Claude, in the weekly lessons).
The first daily update check after the merge records the baseline of the new upstream feed.
The owner's own `~/.claude/skills/handoff` copy needs no change: its one miss was the
scorer's wording.

**Dead ends.** `claude plugin eval` as the harness: it compares a plugin with no plugin
only, has no grader that runs a command, no per-run tokens and no scripted user; cleared by a
version that has them. Claude Code's own sandbox for the test runs: on Ubuntu 26.04 AppArmor
refuses its nested user namespace, and `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` fails the same way;
bubblewrap through `CLAUDE_CODE_SHELL_PREFIX` did the job, and an AppArmor change is the
owner's. The coding tasks as a way to rank the skills: every arm passed on Sonnet and on
Haiku, so only larger, messier tasks could separate them; nobody is on that. A judge that is
given stored reference output: it calls real pasted output invented.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-23-skills-compare/`: `harness/`
(`run.mjs`, `judge.mjs`, `report.mjs`, `evidence-check.mjs`, the fixture contract), `tasks/`
(23 made-up repositories with scorers), `runs/` (per run the stream, the diff, the score and
the verdict; `summary.json`), `vetting/`. The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-skills-compared/release-check.log`.
