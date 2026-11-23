# 23 November 2026: the architecture-review skill, added after its trial

**Why.** The owner said yes on 23 November 2026 to a trial of `improve-codebase-architecture`
(`mattpocock/skills`, MIT), the one skill of that set with no match here. The trial ran the
same day on a product repository. Verdict: add, as an adapted copy.

**What changed.** A third skill in the plugin, `plugins/cookbook/skills/architecture-review/`
(`SKILL.md` and the upstream `LICENSE`), adapted from upstream commit
`abeeaf95660ba9e8b7c753eb38f441ca707a8823`: no typed-only flag, the report in chat, no
interview loop, the project's own notes in place of `GLOSSARY.md` and `docs/adr`, and four
steps from the trial (check each number, check the open pull requests, no refactoring in the
review chat, a walker brief that names what not to read and says to run nothing). The map has
its row, `recipes/architecture-review.md` holds when to use it and the trial's numbers,
`catalog.json` has the entry (lifecycle `trial`, both upstream folders followed by the update
check), and the "Weighed, not added" line of `recipes/add-ons.md` has the result. `SKILL.md`
had no room: the row's bytes came from four descriptive clauses that their pages repeat (the
photo jobs in the description, the consult row's examples, "a Linux-only failure" in the boat
row, the sidebar display in the owner-questions row). No rule sentence changed.
`scripts/check.mjs` now refuses the typed-only flag in any skill of the plugin.

**Verification.** Every upstream file was read first (the two `SKILL.md` files,
`DEEPENING.md`, `DESIGN-IT-TWICE.md`, `HTML-REPORT.md`, both `agents/openai.yaml` and the
licence): Markdown and two small YAML files, no script. Gitleaks: no leaks. Trivy: clean.
OSV-Scanner: exit 128, no package file to parse, which is no result and not a clean one. No
sandbox run (a skill). One fresh-context reader was given only the skill file and an owner
message that asked it to run the tests first, fix the worst problem at once and pass numbers
on unchecked: it declined all three from the text and listed gaps, of which six were fixed
(the scope when the owner names an area, "runs nothing" for the main chat too, what the
walker sends back, every candidate inside an open pull request, Graphify with no index, where
the cost comes from). The Cookbook check and the suite on boat.

**Outstanding.** No candidate from the trial has been built, so "it makes changes easier" is
not measured: the catalog entry stays at `trial` until one is. Building one is the product
repository's job, in its own chat. The comparison of the other `mattpocock/skills` with ours
runs in its own chat and owns the rest of the add-ons line. The first daily update check
after the merge records the baseline of the two new upstream feeds.

**Dead ends.** None.

**Evidence.** The trial's numbers are in `recipes/architecture-review.md`. The release check
writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-architecture-review-skill/release-check.log`.
