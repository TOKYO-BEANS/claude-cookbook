# Multi-agent workflows (`sa-*`)

These run on Claude Code's Workflow tool.

Named workflows in `~/.claude/workflows/` keep ultracode's structure with proportionate execution:
one implementer and one reviewer per task, real evidence (tests, CI, Semgrep, Graphify) over extra
opinions, and an agent budget. Exceeding a budget needs a stated reason (`budget` with
`budgetReason`).

| Workflow | For | Budget |
| --- | --- | --- |
| `sa-review` | a commit range or PR: evidence first, then one reviewer | 3 |
| `sa-release` | after a merge or deploy; or merge a PR when the merge condition holds | 1 |
| `sa-research` | a public question with cited sources | 4 |
| `sa-build` | a written plan, task by task, to a green PR | 8 |
| `sa-debug` | a reproducible bug: failing test first, then fix and review | 4 |
| `sa-triage` | open CodeQL alerts and Semgrep Supply Chain findings, one fix PR | 6 |
| `sa-onboard` | bring a repository onto the shared standard | 2 |

- A finding without a failing test, a CI run, a CodeQL alert, a Semgrep finding, a Graphify
  result or a line of code never blocks.
- `merge: true` when the merge condition in [ci-releases.md](ci-releases.md) holds and no stop applies. A workflow
  still stops and asks for: a paid service, a first publication, a message to other people, an
  access change, an uninstall,
  a major-version update, deleting data that cannot be restored, a customer-visible change on a
  live Wix or Shopify site that has not passed the site's visual check, anything that dismisses,
  accepts or suppresses a security finding, and any change that loosens one of these stops or
  weakens a check, a ruleset or a CI job.
- Record each completed run as Stack-Atlas's `workflows/README.md` "After a run" says.
