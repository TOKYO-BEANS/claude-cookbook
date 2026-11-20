# 20 November 2026: Depot sandboxes and Managed Agents against boat, measured

**Why.** The owner's yes in the "Replace GitHub Actions with Depot" chat: the same job on Depot
Managed Agents and on boat, with time, cost, setup, security and gaps, then a recommendation.

**What changed here.** A new page, `options/sandboxes-depot-vs-boat.md`, with the figures and
the recommendation; `options/tests-on-boat.md`, the page `recipes/boat.md` links as the why of
its tests line, links it. `recipes/boat.md` itself stays as it was: the page test appends a
link to it and needs its last 50 bytes of room, and `options/reach-outside.md` is at its limit.

**Result.** Stay on boat for tests and long Claude jobs. The Cookbook's suite (745 tests, five
runs each, medians): boat `default` 15.4 s at USD 0.0001 a run; a Depot sandbox 19.8 s at 4
vCPU (USD 0.0039) and 31.3 s at 2 vCPU (USD 0.0031). Depot's compute matches boat's at 4 vCPU;
its upload through the API took 8 s. The Claude job did not run on Depot: Managed Agents'
Claude Code route needs a Claude Team or Enterprise plan (the owner's is Max), and sessions
start from Claude's apps, not `claude -p`; its Claude Managed Agents route bills an API key;
a plain sandbox would hold the plan token as a readable variable, weaker than boat's proxy.
So no plan change, no environment key and no secret was asked for or connected.

**Verification.** Depot: a 110-line script on Depot's Connect API (`CreateSandbox`,
`RunCommand`, `WriteFile`, `StopSandbox`, `GetSandbox`) with the `depot-org` key through
`with-key.mjs`; each sandbox's created and stopped times from `GetSandbox`; every sandbox
stopped (ListSandboxes empty after). boat: `boat-run.mjs --type default --push .`, which
printed each run's cost and deleted each sandbox. `depot usage current` before and after
(sandbox minutes 4,691 to 4,723) moved with other repositories' CI at the same time, so the
cost is from Depot's own sandbox records at the invoiced rate. `node scripts/check.mjs` passes,
and the suite passes on boat (745 tests).

**Outstanding.** None for this job. For the owner to know: the `depot-org` key can start
sandboxes, not only read the bill; a read-only organisation token would do for billing reads
(an access change, so only on the owner's word). Weigh again on the triggers in the page.

**Dead ends.** `depot sandbox exec` (CLI 2.103.28) does not reach a sandbox made by the API
("not found or cannot be reached ... an agent sandbox takes no --session-id"); the API's
`RunCommand` does. A first script run crashed before its clean-up and left one sandbox running;
it was found with `ListSandboxes` and stopped within a minute. The base image puts Node 22
first; on it 14 tests were cancelled, so the measured runs used Node 24 from
`/opt/hostedtoolcache`, as CI and boat have.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-depot-vs-boat/` (`runs/`:
each run's log and `results.jsonl`; `bin/`: the scripts; `dl/`: the Depot docs as read).
