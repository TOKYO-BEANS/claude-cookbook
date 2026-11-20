# Measured: Depot sandboxes and Managed Agents against boat

The owner's yes of 20 November 2026: the same job on both, timed and costed. Result: **stay on
boat** for tests and for long Claude jobs; Depot stays the CI.

**The test run, measured 20 November 2026**, the Cookbook's suite at `main` (745 tests, the
install included), Node 24 on both, five runs each, medians:

| | Wall time | Boot | Upload | Tests alone | Cost a run |
| --- | --- | --- | --- | --- | --- |
| boat `default`, through `boat-run.mjs` | 15.4 s | 2.0 s | in the wall time | 7.8 s | USD 0.0001 |
| Depot sandbox, 4 vCPU | 19.8 s | 2.4 s | 8.1 s | 6.6 s | USD 0.0039 |
| Depot sandbox, 2 vCPU | 31.3 s | 2.9 s | 8.0 s | 18.8 s | USD 0.0031 |

"Tests alone" is the test runner's own duration. boat's wall time includes Gitleaks and its
own checks; one boat run printed USD 0.0002. Depot's cost is its own record of each
sandbox (created to stopped, 19.3 and 30.9 s) times vCPUs at 0.00005 a vCPU-second, the rate
that reproduced October's invoice ([CI page](ci-depot-vs-blacksmith.md)); the org is past its
included minutes this month, so it is paid. `depot usage current` moved with CI jobs that ran
at the same time, so it cannot isolate ten runs. boat's cost is what `boat-run` printed. Both
are near zero; boat is 20 to 40 times cheaper a run and faster. Depot's compute is as quick at
4 vCPU; its upload through the API took 8 s.

**The Claude job: not run on Depot, and why.**

- **Managed Agents, Claude Code** (launched 31 October 2026; the `depot claude` sandboxes
  ended 19 November) runs Claude Code self-hosted environment sessions. It needs a Claude
  Team or Enterprise plan with self-hosted environments; the owner's plan is Max, so it would
  take a plan change. Sessions start from Claude's web, desktop or mobile app with a
  repository picked there, not from `claude -p`, and each user connects GitHub to Claude.
  The environment key stays at Depot; the sandbox gets a one-use runner credential.
- **Managed Agents, Claude Managed Agents** bills an Anthropic API key: never, by the plan-only
  rule.
- **A plain Depot sandbox running `claude -p`** would need the plan token as a Depot CI
  secret, which reaches the sandbox as a plain variable the agent can read (Depot's
  send-only-to-listed-hosts gateway is for Managed Agents runs). boat's AI credentials proxy
  keeps the sign-in outside the sandbox and `boat-claude.mjs` caps the requests. No yes was
  asked: the result would be weaker than what we have.

**Setup and security, as found.** The SDK sandbox ran without installing `@depot/sandbox`
(Depot's Connect API by `fetch`, a 110-line script in the evidence). The `depot-org` key
starts sandboxes, not only reads the bill. A sandbox joins the org's tailnet and gets Depot
Cache credentials unless the create call turns both off (the script did). The image is a
GitHub-runner Ubuntu 24.04 with Node 22 first on the path (Node 24 and 26 in
`/opt/hostedtoolcache`; on Node 22, 14 tests were cancelled) and no Claude CLI. Missing
beside boat: a scan of the upload, a spend guard, and a Claude proxy; a Managed Agents run
also bills its five-minute idle wait.

**Weigh again** if the owner moves to a Claude Team or Enterprise plan, if Depot runs Claude
Code on an individual plan or behind a credentials proxy, or if boat's price or plan changes.

Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-20-depot-vs-boat/`.
