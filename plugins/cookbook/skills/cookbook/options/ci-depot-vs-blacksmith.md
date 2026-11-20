# Measured: Depot against Blacksmith for CI

Compared on 19 November 2026 on Depot's own invoices and usage (`depot org invoices`,
`depot usage current` and `breakdown`, key `depot-org`) and Blacksmith's published prices.
No sign-up, no trial. USD, before VAT.

- **Depot, Developer plan, as invoiced.** USD 20 a month, with 2,000 runner minutes and
  2,000 Depot CI minutes (counted at 2 vCPU: 240,000 vCPU-seconds). Runner minutes over that:
  0.004 (the pricing page says 0.006); a Windows minute counts twice at 2 vCPU, four times at
  4. Depot CI over that: 0.00005 a vCPU-second, 0.006 a 2-vCPU minute. October: 20 + 21.06
  (7,266 Windows minutes less 2,000) + 11.63 (472,522 vCPU-seconds less 240,000) = 52.69,
  the invoice to the cent.
- **Blacksmith, published** (<https://www.blacksmith.sh/pricing>,
  <https://docs.blacksmith.sh/blacksmith-runners/overview>, read 19 November 2026): no plan
  fee; 3,000 free 2-vCPU Linux minutes a month (worth 12); Ubuntu x64 0.004 a minute at 2
  vCPU, doubling per size; Windows x64 (public beta) 0.008 at 2 vCPU, 0.016 at 4; macOS M4
  0.08. How a job's time is rounded is not published.
- **Our seconds at both prices** (Blacksmith low: by the second; high: each job rounded up
  to the minute):

| Month | Depot | Blacksmith |
| --- | --- | --- |
| October, invoiced | 52.69 | 33 to 40 |
| November, 19 days × 30/19 | 90 | 65 to 85 |
| November without the Windows jobs | 48 | 19 to 35 |

  A Windows minute costs the same on both. The gap is the plan fee and Depot CI's rate
  (0.006 against 0.004 a 2-vCPU minute).
- **What a move costs.** Blacksmith only runs jobs for GitHub Actions; it has no workflow
  runner of its own. Every repository's `.depot/workflows` would move to
  `.github/workflows`: the standard's CI, Safe Chain and Semgrep jobs, the `ai-review` job,
  the ruleset's required checks, and the Depot CI secrets into GitHub's. Each is a hand
  change to CI, which goes to the owner. Lost too: `depot ci diagnose` and the Depot MCP
  tools the recipes use. Depot container builds are not used (0 build minutes in October
  and November). GitHub's 0.002 a minute charge on runners it does not host, postponed on 17
  December 2025 with no new date, would add about 14 a month to Blacksmith, nothing to Depot
  CI.
- **Probiz's Windows job, measured 20 November 2026** (`depot jobs`, key `depot-org`; GitHub's
  job timings; GitHub's rate card): on GitHub's `windows-latest` (2 vCPU, 7 to 22 September, 34
  passing jobs) a median of 713 seconds, about 0.12 a job at 0.010 a minute. On Depot's
  `depot-windows-2025-4` (4 vCPU, since 23 September, 416 passing jobs) a median of 268
  seconds with no queue, about 0.07 a job (4 runner minutes a minute at 0.004 over the
  allowance, the same as the listed 0.016 a minute). November to the 20th: 133 jobs, 2,571
  runner minutes, about 10.30 over the allowance. Depot CI cannot run it: no Windows sandboxes.
- **Recommendation: stay on Depot.** Without the Windows jobs the saving is 13 to 29 a month
  (about 0 to 15 if GitHub's charge returns), against moving every repository's CI and the
  standard. Cheaper on Depot first: retiring the Windows jobs (about 42 of November's 90)
  and keeping Depot CI jobs at 2 vCPU (November averaged 2.2). Weigh again if the bill before
  VAT passes 100 two months running, or a price changes.
