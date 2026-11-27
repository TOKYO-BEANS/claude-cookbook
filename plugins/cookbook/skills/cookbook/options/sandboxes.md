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

**The Claude job: moved on 27 November 2026.** boat's AI credentials proxy kept the plan's
sign-in out of the sandbox. Depot's Managed Agents route for Claude Code needs a Claude Team or
Enterprise plan with self-hosted environments (the owner's is Max), and its host-bound secrets
(a gateway fills the value in, the sandbox never holds it) exist only for those connections.
Its Claude Managed Agents route bills an API key: never, by the plan-only rule. So a plain
sandbox runs `claude -p` with the plan token as a readable variable. The owner chose against
that on 20 November and for it on 27 November ("we put the claude subscription token on Depot
then, and use opus 5.5 high"), to spare the laptop's memory. The token is one made for Depot
alone, sent with the job's command only ([sandboxes-claude](../recipes/sandboxes-claude.md)).

**Weigh again** if the owner moves to a Claude Team or Enterprise plan, or if Depot offers
host-bound secrets to plain sandboxes: then the token can stay out.

**Whole chats: boat, a trial from 27 November 2026, kept the same day** (owner's yes, on boat's
plan and wallet; [the page](../recipes/sandboxes-boat-chat.md)). Measured that day,
for a month of 22 workdays with 3 hours of the model working each:

| | Machine | Claude | Token in the sandbox | Idle hours |
| --- | --- | --- | --- | --- |
| boat `small`, T3 linked | inside the USD 20 plan | proxy: USD 1 a day plus USD 1 per 1,000 requests (about USD 51) | no, placeholders | stopped (1 s resume), free |
| Depot `small`, a long-lived sandbox | USD 0.36 an hour (8 hours: about USD 63) | the plan, no fee | yes, readable | billed while it runs; no stop with memory measured |

boat: about USD 71 a month, keeping the plan; Depot: about USD 63, with the token in the
sandbox. Both spare the laptop the same memory. The owner kept boat on 27 November 2026
("option 2"): the plan renews monthly (USD 20, next 16 December), for the chats that suit it
and whenever the laptop nears its limits.

**Snapshots of the chat sandbox: weighed, not built** (owner, question dialog, 27 November
2026). `up` resumes the stopped sandbox in about 10 s and makes a new one in about 30 s; a
snapshot would help only a new one (a failed sandbox, the 14-day hold run out, a second
sandbox): about 20 s, a few times a month. Against it: a snapshot taken after `up` carries
the T3 server's identity and link, so it must be taken before linking, and it is stale after
every T3 update. The 17 November measurement for test runs (0.6 to 0.8 s a run) is in
`handoff/2026-11-17-boat-snapshots.md`. Weigh it again if `up` of a new sandbox passes a minute.

Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-20-depot-vs-boat/` and
`~/.local/share/claude-cookbook/evidence/2026-11-26-depot-sandboxes/`.
