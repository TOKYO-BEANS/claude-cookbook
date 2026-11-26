# Options weighed: cloud sandboxes, boat or Depot

**Decision, 26 November 2026: Depot sandboxes, and boat is cancelled.** The owner's yes in
the "Reduce Costs and Improve Workflows" chat. boat cost USD 20 a month (plus USD 30 a month
for its AI credentials proxy, switched off that day), and the stack used 1.6% of its plan
(10,725 of 2,000,000 seconds in ten days). Depot is already paid per use for CI.

**Measured on 20 November 2026**, this repository's suite at `main` (745 tests, the install
included), Node 24 on both, five runs each, medians:

| | Wall time | Boot | Upload | Tests alone | Cost a run |
| --- | --- | --- | --- | --- | --- |
| boat `default`, through `boat-run.mjs` | 15.4 s | 2.0 s | in the wall time | 7.8 s | USD 0.0001 |
| Depot sandbox, 4 vCPU | 19.8 s | 2.4 s | 8.1 s | 6.6 s | USD 0.0039 |
| Depot sandbox, 2 vCPU | 31.3 s | 2.9 s | 8.0 s | 18.8 s | USD 0.0031 |

At the use measured (about 30 runs a day), Depot comes to well under a dollar a month
against boat's USD 20. A gzip upload cut Depot's upload; the runs through `sandbox-run.mjs`
on 26 November are in that day's handoff entry. Depot's cost is its own record of each
sandbox (created to stopped) times vCPUs at USD 0.00005 a vCPU-second, the rate that
reproduced October's invoice ([CI page](ci-depot-vs-blacksmith.md)).

**What boat had that the move had to keep**, now in `sandbox-run.mjs`: the scan of the
upload, the upload list and the data-shaped file stop, a spend guard (a ledger of Depot's
records, USD 10 a month), a timeout, ten at once, and a stop of every sandbox. A sandbox is
created off the org's tailnet and without Depot Cache's credentials, and gets no CI secret.

**The Claude job: not moved, and why.** boat's AI credentials proxy kept the plan's sign-in
out of the sandbox. Depot's Managed Agents route for Claude Code needs a Claude Team or
Enterprise plan with self-hosted environments (the owner's is Max), starts from Claude's
apps rather than `claude -p`, and its Claude Managed Agents route bills an API key: never, by
the plan-only rule. A plain sandbox running `claude -p` would hold the plan token as a
readable variable. So `boat-claude.mjs` is retired, and a long Claude job runs as a
plan-token `claude -p` on the laptop ([scripted-runs](../recipes/scripted-runs.md)).

**Weigh again** if the owner moves to a Claude Team or Enterprise plan, or if Depot runs
Claude Code on an individual plan or behind a credentials proxy.

Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-20-depot-vs-boat/` and
`~/.local/share/claude-cookbook/evidence/2026-11-26-depot-sandboxes/`.
