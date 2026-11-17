# Cloud sandboxes (boat): the plan, setup and evidence

- **The plan is the owner's:** USD 20 a month since 16 November 2026 (the trial ended that
  day), renewed on the 16th. `boat limits --json` is the source, never memory. It showed that
  day: 2,000,000 seconds a month at the `default` rate (about 555 hours; `small`, 2 vCPU and
  4 GB, counts half; `large`, 8 vCPU and 16 GB, double; no `xlarge`), 100 sandboxes at once,
  12 starts a minute, 60 an hour and 200 a day, and 10 saved snapshots.
- **Nothing bills past the plan:** extra starts are off, and the wallet, which pays above
  the plan, holds the AI proxy's money since 17 November 2026 ([boat-claude.md](boat-claude.md)):
  boat-run starts only while the next start costs nothing, starts are left and the plan's
  time holds the run. Claude never
  changes the plan, tops up the wallet, turns extra starts on or creates API keys. With no
  plan or no time left, the sandbox step answers "no result" and every pinned npm update
  waits for the owner: if boat is cancelled, take the step out of the vetting scripts and
  these recipes in one change.
- **On this PC:** the `boat` command is a shim that decrypts the DPAPI key `boat` into that one
  process and turns the CLI's self-update off (`BOAT_NO_UPDATE=1`). The binary is a pinned copy
  in `~/.local/share/boat`, checked against the checksum list boat publishes; it is not
  code-signed. Never run boat's installer (`install.ps1`): it writes to AppData, the PowerShell
  profile and the user PATH, which do not survive a reboot from Claude's container. To update:
  download the new binary and checksum list to an empty folder, compare the SHA-256, replace the
  copy and run `boat --version`.
- **The upload list** of `boat-run.mjs` is `~/.local/share/boat-run/upload-allowed.txt`, one
  `github.com/owner/name` a line, `#` for a comment; a repository with no origin is listed
  by its folder. After the name, `data:` and the data-shaped files that were looked at and
  hold no customer data, each a path or a folder ending in `/`
  (`... data: fixtures/prices.csv db/migrations/`). It is outside every repository on
  purpose. Its `slots` folder beside it holds one file per run under way.
- The API key ends on 10 February 2027 (the catalog carries the date). A 401 means it ran
  out: the owner makes a new one in the dashboard and saves it through the masked key window.
- Proven on 12 November 2026: `small` ready in under a second (Ubuntu 24.04, Node 24).
- Proven on 14 November 2026: the sandbox step ran on two vetted lockfiles (44 and 15
  seconds, USD 0.0002 and 0.0001), and showed each postinstall script, the hosts asked for
  and what was left running. With the outside code running as `vet`, an install made of
  hostile commands was refused each one (`sudo`, the evidence folder, `pkill tcpdump`).
- Proven on 16 November 2026, paid plan: this repository's `npm test` ran in a
  `small` sandbox in 13 seconds with the upload (about 150 seconds on this PC) and found a
  test that depended on the machine's sort order; five sandboxes ran at once; a `large` one
  reported 8 CPUs; `boat list --all` was empty afterwards. Under USD 0.01 in all.
  `boat-run.mjs` refused its first upload on three Gitleaks findings (made-up test values,
  since rewritten), then sent 176 tracked files and passed the tests in 22 seconds.
- **The hook** `hooks/boat-route.mjs` denies local tests and `semgrep` in a listed repository,
  naming the boat-run command (`semgrep ci`: the CI job); give sa-review that command.
  Windows-only: end `# local-run: <why, 10+ chars>`.
