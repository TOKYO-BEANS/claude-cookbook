# 20 November 2026: Probiz's Windows job stays on a Depot Windows runner

**What was asked.** The owner's yes (Cookbook chat "Replace GitHub Actions with Depot"): move
Probiz's Windows CI job off GitHub Actions as far as Depot allows, keep the Safe Chain step and
the same checks, and measure time and cost before and after.

**What was found.** Depot CI still has no Windows sandboxes: Depot's docs (Depot CI runner
labels: "Depot CI doesn't provide sandboxes for macOS or Windows"; read 20 November 2026) and
the Depot skill say the same. Probiz's job (`.github/workflows/ci.yml`, check `Node 24 /
windows-latest`) has run on Depot's Windows runner `depot-windows-2025-4` since commit
`720f59c` (22 September 2026), and GitHub bills it 0 Windows milliseconds. So the job is already
as far onto Depot as Depot allows. Probiz needs no change: no workflow edit, no Safe Chain edit,
no ruleset change (the check is still reported by the GitHub Actions app, 15368).

**What changed.** `options/check.md`, `recipes/security.md`, `recipes/safe-chain.md` and the
Depot entry of `catalog.json` name the Depot Windows runner. `options/ci-depot-vs-blacksmith.md`
has the measurement.

**Measured** (`depot jobs`, `depot usage current`, key `depot-org`; GitHub's job timings):

| | GitHub `windows-latest`, 7 to 22 Sep | Depot `depot-windows-2025-4`, since 23 Sep |
| --- | --- | --- |
| vCPU | 2 | 4 |
| Passing jobs | 34 | 416 |
| Median job time | 713 s | 268 s (p90 293 s, queue 0 s) |
| Price | 0.010 a minute | 4 runner minutes a minute, 0.004 each over the allowance |
| Per job, at the median | about 0.12 | about 0.07 |

November to the 20th: 133 Depot Windows jobs, 2,571 runner minutes (about 10.30 over the
allowance; the organisation's runner minutes this period: 9,101).

**Outstanding.** None for this job. A cheaper option, not tried: `depot-windows-2025` (2 vCPU,
2 runner minutes a minute) is cheaper per job only if the job takes less than twice as long.

**Dead ends.** `depot org invoices` printed nothing for this run; the per-minute rate comes from
the October invoice in `options/ci-depot-vs-blacksmith.md`.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-probiz-windows-ci/`
(`depot-windows-2025-4-jobs.jsonl`, `github-hosted-jobs-2026-09.tsv`,
`depot-usage-current.json`).
