# Whole Claude chats on boat (trial)

A trial until 16 December 2026, when boat's plan ends (owner, 27 November 2026, question
dialog in the chat that built #285: "try it out on boat all ready have the active sub and a
wallet with 30usd on it"). Why: the laptop's memory. A local session here takes 208 to 332 MB
for Claude Code alone and 0.3 to 4 GB with its children (six sessions measured that day). A
chat on boat leaves one `ssh` port forward here (6 MB). Keeping boat after 16 December is the
owner's decision, with the numbers below; never renew, top up or move to a larger plan
without it.

- **What it is:** a T3 Code server inside a boat sandbox, reached through `boat forward` and
  linked to this T3 as an environment. A thread launched there is a whole T3 chat: Claude Code
  runs in the sandbox, on the owner's subscription through boat's AI credentials proxy, which
  gives the sandbox placeholder keys only. The plan token never enters it (unlike
  [Depot](sandboxes-claude.md)). Opus 5.5 at high effort.
- **The owner's yes covers** boat's current plan and the proxy on from the wallet (USD 1 a day
  while on, plus USD 1 per 1,000 requests). Turn it on with `boat ai proxy on` when a chat
  starts and `off` when none runs: a day is charged when it is turned on. Anything else that
  costs money stops for the owner.
- **The CLI:** `boat` is the launcher in `~/.local/bin` (key `boat` from the key store, the
  CLI's self-update off), the binary a pinned copy in `~/.local/share/boat` with
  `PROVENANCE.txt` (1.0.106 from GitHub `ariana-dot-dev/agent-server`, tag
  `boat-cli-v<version>`; never boat's installer). The key: vault note "Claude - Boat" (all
  scopes, ends 27 November 2027), key-store name `boat`.
- **Start a chat** (each step proven 27 November 2026):
  1. `boat ai proxy on`; `boat new --type small --environment claude-proxy --name <name>`
     (`claude-proxy` is safe for third parties with proxy credentials on); `boat extend <id>
     --hours <h>` (one hour by default).
  2. `boat push <id> <repository> --to /home/user/<name>` (files git tracks or does not
     ignore). Install `t3` at this laptop's version (`t3 --version`, over 24 hours old) with
     npm in the sandbox; set `"linkedEnvironmentsEnabled": true` in its
     `~/.t3/userdata/settings.json`, or the link is refused.
  3. `boat exec <id> --detach -- bash -lc 'cd <repo> && exec <t3> serve --host 127.0.0.1
     --port 3773 <repo>'`. Bind 127.0.0.1: the sandbox's inbound is open. Never print its log:
     the server prints a pairing QR at start.
  4. `boat forward <id> --remote 3773 --local 13773` in the background.
  5. Pairing: `t3 auth pairing create --json --ttl 5m` in the sandbox, its `credential` piped
     to `t3 environment link --from - --access full-access` as `http://127.0.0.1:13773
     <credential>`, never shown or on a command line.
  6. `t3_project_create` and `t3_thread_launch` with that `environmentId`, model
     `claude-opus-5-5`, effort high. The chat answers through `t3_thread_send` and `_read`.
- **Between sessions:** `boat stop <id>` (5 s) keeps disk and memory 14 days; `boat resume`
  (1 s) brings the processes back. The proxy's placeholder changes at resume, so restart
  `t3 serve` (otherwise 401: "This placeholder credential is not valid any more"); the thread
  keeps its context. A stopped sandbox uses no plan time.
- **End:** `boat ai proxy off`; stop or `boat delete` the sandbox; stop the forward by its
  `ssh` too (`pkill -f '[s]sh.*13773'`: it outlives `boat forward`); `t3 environment unlink`.
  `boat list --all` and `boat ai proxy` confirm.
- **Simpler shape, no T3:** `boat prompt <id> --provider claude --model opus-5-5
  --reasoning-effort high "<prompt>"`, then `--resume <conversation>` for each turn (50 MB
  here while it waits). `boat exec` ends at 30 s unless `--timeout`.
- **Measured 27 November 2026** (sandbox `small`, the Cookbook): six turns of real work (the
  tests of `sandbox-claude.mjs`'s exit codes, written and reviewed there and kept) and the
  full suite (797 passed): 23 proxied requests, USD 0.023; 355 plan seconds (12 minutes at
  half rate), USD 0.0036 of the plan's value; the day's proxy USD 1. In the sandbox the T3
  server took 441 MB, Claude Code 253 MB; 2.4 GB of 4 GB stayed free.
- **Cost of a chat hour:** the machine is inside the plan (552 hours of `default` left on 27
  November, twice that of `small`). The proxy: 23 requests in 188 s of the model working
  (about 440 an hour, USD 0.44), nothing while the chat waits, plus USD 1 a day. A day with
  3 hours of the model working: about USD 2.3.
  [The comparison](../options/sandboxes.md).
