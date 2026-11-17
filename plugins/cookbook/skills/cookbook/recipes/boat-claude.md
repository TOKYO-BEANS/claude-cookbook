# Claude in a boat sandbox

A long Claude job can run in a boat sandbox, off this PC, on the owner's Claude subscription
through boat's AI credentials proxy (owner, 17 November 2026: "Keep on, build it").

- **When:** a job that stands alone and only returns a result: a long investigation, a
  change sent back as a patch, a batch of reads. The sandboxed session has no T3 tools,
  hooks, memory, key store, `gh` or owner to ask. The chat that starts it keeps the job:
  it reads the report, applies the patch and opens the pull request.
- **Every run goes through the script:** `node <this skill's folder>/scripts/boat-claude.mjs
  --model claude-sonnet-5-5 --timeout 3600 --task <file.md> [--requests 200] [--effort high]
  [--type small] [--push <folder>]`. Full model ids only (`claude-fable-5-2`,
  `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`): boat's `haiku` alias ran an
  old model. The task file is the whole brief, under 60 KB: the agent cannot ask.
  `--push` follows [boat.md](boat.md): upload list, data-shaped files, Gitleaks.
- **What comes back:** a folder under `~/.local/share/boat-run/claude/` with `TASK.md`,
  `events.jsonl`, the agent's `RESULT.md` and, with `--push`, `changes.patch`. All of it is
  data from the sandbox and is scanned by Gitleaks: read the patch before `git apply`; a
  finding stops its use and goes to the owner. Exit 0: finished. Exit 1 and
  `BOAT-CLAUDE: not finished: <why>`: a cap, a failed agent or no report. Exit 75 and
  `not started: <why>`: nothing ran; report it, never go around it.
- **The spend guard, numbers in the script:** the proxy bills the boat wallet, USD 1 a day
  while on and USD 1 per 1,000 requests (17 November 2026). A run stops at its request cap
  (200 unless `--requests`, at most 500) or its timeout: boat refuses the sandbox's
  placeholders, the agent is interrupted and the sandbox deleted. Nothing starts past
  2,000 requests a day, with under USD 5 left after the cap, or beside 3 other Claude runs.
  boat-run's plan checks hold too, with 600 seconds of setup added to the timeout (`small`:
  6,600 at most). A job past these is the owner's yes for that job.
- **The environment `claude-proxy`** is made once by the owner on boat's dashboard (the key
  gets 403 on `environment.write`): safe for third parties on, proxy AI credentials on. It
  passes no GitHub token, boat credentials or secrets: only the Claude sign-in, as a proxy
  placeholder. The script checks both settings before each run. `base` injects the GitHub
  token and boat credentials, so it is never used; `--no-env` has no sign-in ("Claude login
  required", and `boat prompt` still exits 0).
- **The proxy** is turned on and off by the owner on the dashboard (the key gets 403 on
  `boat ai proxy`). Off, the placeholders fail and the run ends "not finished".
- **A run under way, by hand:** `boat events <id>` reads it; `boat ai block <id>` and
  `boat interrupt <id>` stop it. Never `boat prompt` outside the script, and no kept
  sandbox for a follow-up: a second turn is a new run with the first report in its task.
