# 19 November 2026: Depot against Blacksmith for CI, measured

**Why.** Step 8 of the Linux setup guide (machine-setup) asked whether Blacksmith would cost
less than Depot for our CI, read against Depot's real bill.

**What changed here.** A new page, `options/ci-depot-vs-blacksmith.md`, with the figures, the
sources and the recommendation; the CI bullet of `options/check.md` names Blacksmith as weighed
and links it. To keep `check.md` under the read limit, the visual-check bullet is shorter:
"its own dependency, like a test runner" is now "its own dependency", and "Built for the first
site on 15 November 2026" is gone (the visual-check recipe keeps that date).

**Result.** Stay on Depot. Before VAT: October invoiced 52.69 on Depot, 33 to 40 on Blacksmith
for the same seconds; November projected 90 against 65 to 85; without the Windows jobs 48
against 19 to 35, or about 33 to 49 if GitHub's postponed 0.002 a minute charge on runners it
does not host returns. Blacksmith only provides runners for GitHub Actions, so a move would
take every repository's `.depot/workflows`, the standard and the `ai-review` job back to
GitHub Actions, each a hand change to CI. No sign-up, trial or plan change was made, and no
owner question was needed: the comparison does not say to switch.

**Verification.** `with-key.mjs depot-org DEPOT_TOKEN depot org invoices list` and
`line-items` (September and October), `depot usage current`, `depot usage breakdown
--product depot-ci|github-actions --group-by repository|runner` for November to date and for
October. The model of Depot's bill reproduces the October invoice to the cent: the plan's
2,000 runner minutes and 240,000 Depot CI vCPU-seconds come off before the overage, and a
Windows minute counts 2x (2 vCPU) or 4x (4 vCPU). Blacksmith's prices: its pricing page and
runner docs, read through Parallel Search the same day; its rounding of a job's time is not
published, hence the ranges. `node scripts/check.mjs` passes.

**Outstanding.** None for this job. Weigh again if Depot's bill before VAT passes USD 100 two
months running or either price list changes.

**Dead ends.** `depot usage breakdown --product depot-ci --group-by runner` answers
"unsupported --product and --group-by combination"; `--group-by job` needs a workflow key.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-ci-depot-vs-blacksmith/`
(the invoice line items and usage JSON, links removed).
