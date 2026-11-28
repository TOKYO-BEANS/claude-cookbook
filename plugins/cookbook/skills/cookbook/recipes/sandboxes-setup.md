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
  `CreateSandbox` (off the tailnet, without Depot Cache, a lifetime of the timeout in
  whole minutes plus six), `RunCommand`, `WriteFile`, `StopSandbox`, `GetSandbox`, `ListSandboxes`. The
  image is a GitHub-runner Ubuntu 24.04: user `runner` with sudo, strace, tcpdump, git,
  Node 22 first (the script puts Node 24 from `/opt/hostedtoolcache` first). The `depot
  sandbox exec` command cannot reach a sandbox made by the API.
- **The state folder** `~/.local/share/sandbox-run`, outside every repository on purpose:
  `upload-allowed.txt`, one `github.com/owner/name` a line, `#` for a comment; a repository
  with no origin is listed by its folder. After the name, `data:` and the data-shaped files
  that were looked at and hold no customer data, each a path or a folder ending in `/`
  (`... data: fixtures/prices.csv db/migrations/`). `ledger.jsonl` holds a line when a sandbox exists (the most
  its run can take) and one at its stop (Depot's record, or the most when that could not be
  read); the last line for a sandbox counts, so a killed run stays counted. `slots/` holds one file per run under way.
- **Proven on 26 November 2026:** this repository's suite through the script; times and
  costs in the handoff entry of that day. A vetting run of a pinned npm copy ran the probe
  with strace and tcpdump as on boat.
- **The hook** `hooks/sandbox-route.mjs` denies local tests and `semgrep` in a listed
  repository, naming the sandbox-run command (`semgrep ci`: the CI job); give sa-review that
  command. Only a run that needs this PC itself (its key store, its display or an app on it):
  end `# local-run: <why, 10+ chars>`. While memory is short (laptop-load-lib's memory and
  swap limits), every local test run or scan waits, in any folder and past `# local-run`
  (owner, 28 November 2026): a 2.3 GB local `semgrep ci` and ten open chats filled RAM and
  swap. Run it in a sandbox or wait. The laptop has 4 GB of zram (compressed swap in RAM)
  before `/swap.img` since that day.
- **At the owner's message** (hook `laptop-load-note.mjs`, UserPromptSubmit), in a T3 chat on
  the laptop while it is near ([the limits](sandboxes-boat-chat.md)), once an hour per chat, the
  chat hears the reasons and the route: a chat that fits boat (a first message or one already
  running) commits and pushes its work, writes a brief (the request word for word, what is done,
  the branch, what is next, open questions), runs `boat-chat.mjs up`, starts the boat chat with
  `t3_thread_launch` and settles here; it asks the owner there, in T3. A job that needs no input
  at all (a long change ending in a pull request) may go to a cloud session (`claude --cloud`)
  once set up: the first needs the owner's GitHub grant. Cloud chats are not in T3's sidebar
  (owner, 28 November 2026: boat, cloud only for no-input jobs).
- **Idle chats** (`scripts/idle-chats/`, owner, 28 November 2026): T3 keeps each chat's `claude`
  process (about 300 MB) until T3 stops. A user timer runs `idle-chats.mjs` every 10 minutes
  and ends (SIGTERM) a chat's process when T3's state shows no unfinished run and the last run
  ended 30 minutes ago, and no Bash shell (a tool, a background command or monitor) runs under
  it. T3 starts it again with `--resume` at the next message. `--dry-run` shows the choice;
  each end is a line in `~/.local/share/claude-cookbook/idle-chats/log.jsonl`. Install: copy
  `idle-chats.mjs` to `~/.local/bin`, the two units to `~/.config/systemd/user`, then
  `systemctl --user enable --now idle-chats.timer`.
