# Claude jobs in Depot sandboxes

Since 27 November 2026 (owner, question dialog in the laptop-memory chat: "we put the claude
subscription token on Depot then, and use opus 5.5 high"; it replaces the 20 November answer
"Claude jobs: not on Depot"). Why: the laptop's memory. A local session takes about 320 MB
plus its servers; a job sent to a sandbox leaves two small Node processes here (the larger
83 MB) while it runs.

- **What goes:** a long or self-contained Claude job that a chat would otherwise give a local
  subagent or a local `claude -p`: a change in one of our own repositories, a review, a batch.
  **What stays here:** a job that needs this PC (its key store, display or apps), an MCP
  server, customer data, and any outside code: the token is readable in the sandbox.
- **How:** `node <this skill's folder>/scripts/sandbox-claude.mjs --push <repository>
  [--type small] [--timeout 3600] [--budget 10] [--tools Read,Edit,Write,Glob,Grep,Bash]
  (--prompt-file <file> | -- <prompt>)`. From a chat, start it in the background and wait on
  it (`t3_background_wait`). The prompt carries the whole job: the run sees the repository
  and nothing of this chat.
- **What it runs:** through `sandbox-run.mjs --claude`, so every limit, the upload list and
  scan, and the stop are that script's ([sandboxes](sandboxes.md)). In the sandbox: Claude Code
  at this laptop's version, then one `claude -p` by the [scripted-runs](scripted-runs.md)
  rules: Opus 5.5 at high effort, only the listed tools (`dontAsk`), no settings, no MCP
  server, no saved session, `--max-budget-usd`, and an environment built from nothing but the
  token. A first event whose `apiKeySource` is not `none` (the plan login) ends the run.
- **The token:** key `claude-depot` (vault note `key/claude-depot`), made by the owner with
  `claude setup-token` on the subscription account on 27 November 2026, for Depot alone so it
  can be revoked alone: revoke it at claude.ai, then delete both copies. `sandbox-run.mjs`
  reads it and sends it with the job's command only (`RunCommand`'s `env`), never with the
  sandbox, the unpack step or `--vet`; in the job only `claude -p` gets it, not the install. It is masked in the output that comes back, and a run
  whose files hold a plain copy of it sends nothing back; an encoded copy would pass, which is
  why only our own jobs run with it.
- **Host-bound secrets** (the value outside the sandbox, filled in by a gateway) are Depot's
  only for Managed Runs connections, whose Claude Code route needs a Team or Enterprise plan
  (checked 27 November 2026). Weigh again when plain sandboxes get them.
- **What comes back** is data, three regular files and never a link: `~/.local/share/sandbox-run/claude/<run>/` holds
  `stream.jsonl` (every event), `claude.err`, `changes.patch` (for `--push`: every change
  against the uploaded copy, new files included) and `summary.json` (model, login, turns,
  usage, the list-rate figure). Gitleaks reads the folder; a finding ends with exit 4, goes
  to the owner, and the patch is not applied. Read the patch, then `git apply` it on the state that was
  uploaded; the run committed nothing.
- **Cost, measured 27 November 2026** (a read, a command and a new file): 20 s here, the
  sandbox 14.3 s at 2 vCPU, USD 0.0014 by Depot's record; the Claude side is on the plan
  (USD 0.05 at list rates, counted against the plan's limits). `small` costs USD 0.36 an hour,
  inside `sandbox-run.mjs`'s cap of two hours a run and USD 10 a month.
- **A whole T3 chat** is not run on Depot: a sandbox that lives as long as the chat costs
  USD 0.36 an hour (`small`) and holds the token for hours. The owner chose boat
  instead (27 November 2026), where the token stays out:
  [whole chats on boat](sandboxes-boat-chat.md).
