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
| `sa-build` | a written plan, task by task, to a green PR | 11 |
| `sa-debug` | a reproducible bug: failing test first, then fix and review | 4 |
| `sa-triage` | open CodeQL alerts and Semgrep Supply Chain findings, one fix PR | 6 |
| `sa-onboard` | bring a repository onto the shared standard | 2 |

- A finding without a failing test, a CI run, a CodeQL alert, a Semgrep finding, a Graphify
  result or a line of code never blocks.
- `merge: true` when the merge condition in [ci-releases.md](ci-releases.md) holds and no stop applies. A workflow
  still stops and asks for: a paid service, a first publication, a message to other people, an
  access change, an uninstall,
  a major-version update, deleting data that cannot be restored, a change customers see on a
  live site (Wix, Shopify or any other host) that has not passed that site's visual check, or
  whose check is not yet recorded in the project's `CLAUDE.md` with the owner's yes
  ([visual-check.md](visual-check.md)), anything that dismisses,
  accepts or suppresses a security finding, a change by hand to `.depot/**` or
  `.github/workflows/**`, and any change that loosens one of these stops or
  weakens a check, a ruleset or a CI job.
- The reviewer steps of `sa-review`, `sa-build` and `sa-triage` read text other people wrote, so
  they run without a shell, on `cookbook:reader` (the `sa-triage` triager on
  `cookbook:reader-graph`): `sa-review` and `sa-triage` since Stack-Atlas #188, `sa-build` since
  Stack-Atlas #190 ([dispatch](dispatch.md)). What a reviewer needed a shell for runs in a step
  before it; in `sa-build` that step makes a task three agents, hence its budget of 11.
- Record each completed run as Stack-Atlas's `workflows/README.md` "After a run" says.
