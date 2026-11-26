# Cloud sandboxes (Depot): setup and evidence

- **The account:** the Depot org that runs CI; sandboxes bill on the same plan, per
  vCPU-second (USD 0.00005, the rate that reproduced October 2026's invoice), from the
  sandbox's creation to its stop. Read the bill with
  `with-key.mjs depot-org DEPOT_TOKEN depot ...`; Claude never changes the plan.
- **The key:** `sandbox-run.mjs` reads the key-store key `depot-org` itself (through
  `with-key.mjs`'s reader) and keeps it in its own process: it goes in the API's header and
  never into the sandbox. That key can start sandboxes and read the bill; a narrower token is
  an access change, so only on the owner's word.
- **The API:** Depot's Connect API (`depot.sandbox.v1.SandboxService`) by `fetch`, no SDK:
  `CreateSandbox` (off the tailnet, without Depot Cache, a lifetime of the timeout plus five
  minutes), `RunCommand`, `WriteFile`, `StopSandbox`, `GetSandbox`, `ListSandboxes`. The
  image is a GitHub-runner Ubuntu 24.04: user `runner` with sudo, strace, tcpdump, git,
  Node 22 first (the script puts Node 24 from `/opt/hostedtoolcache` first). The `depot
  sandbox exec` command cannot reach a sandbox made by the API.
- **The state folder** `~/.local/share/sandbox-run`, outside every repository on purpose:
  `upload-allowed.txt`, one `github.com/owner/name` a line, `#` for a comment; a repository
  with no origin is listed by its folder. After the name, `data:` and the data-shaped files
  that were looked at and hold no customer data, each a path or a folder ending in `/`
  (`... data: fixtures/prices.csv db/migrations/`). `ledger.jsonl` holds one line a run:
  its month, sandbox, vCPU-seconds and USD, from Depot's record of the sandbox (or the run's
  most when that could not be read). `slots/` holds one file per run under way.
- **Proven on 26 November 2026:** this repository's suite through the script; times and
  costs in the handoff entry of that day. A vetting run of a pinned npm copy ran the probe
  with strace and tcpdump as on boat.
- **The hook** `hooks/sandbox-route.mjs` denies local tests and `semgrep` in a listed
  repository, naming the sandbox-run command (`semgrep ci`: the CI job); give sa-review that
  command. Only a run that needs this PC itself (its key store, its display or an app on it):
  end `# local-run: <why, 10+ chars>`.
