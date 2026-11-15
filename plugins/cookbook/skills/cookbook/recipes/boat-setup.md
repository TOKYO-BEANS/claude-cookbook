# Cloud sandboxes (boat): the plan, setup and evidence

- **The plan is the owner's:** boat has no free tier. The first plan is a 7-day trial (25 compute
  hours, 2 sandboxes at once, auto-stop of 2 hours or less, no `large`), and then the card is
  charged, USD 20 a month for the smallest plan. Keeping or cancelling it is the owner's decision
  (14 November 2026: the owner plans to keep it);
  Claude never changes the plan, tops up the wallet or creates API keys. Without a plan the
  sandbox step answers "no result" and every pinned npm update waits for the owner: if boat
  is ever cancelled, take the step out of the vetting scripts and these recipes in the same
  change.
- **On this PC:** the `boat` command is a shim that decrypts the DPAPI key `boat` into that one
  process and turns the CLI's self-update off (`BOAT_NO_UPDATE=1`). The binary is a pinned copy
  in `~/.local/share/boat`, checked against the checksum list boat publishes; it is not
  code-signed. Never run boat's installer (`install.ps1`): it writes to AppData, the PowerShell
  profile and the user PATH, which do not survive a reboot from Claude's container. To update:
  download the new binary and checksum list to an empty folder, compare the SHA-256, replace the
  copy and run `boat --version`.
- The API key expires (90 days by default, 365 at most). A 401 means it ran out: the owner makes
  a new one in the dashboard and saves it through the masked key window.
- Proven on 12 November 2026: `boat run --type small` had a sandbox ready in under a second
  (Ubuntu 24.04, Node 24, Python 3.12), ran a command, reported USD 0.00 and deleted it;
  `boat list --all` was empty afterwards. The 7-day trial started that day and ends on
  19 November 2026; after it the card is charged USD 20 a month unless the owner cancels.
- Proven on 14 November 2026: the sandbox step ran on two vetted lockfiles, and the probe's
  `--cmd` form ran once on the second of them with the same result. The Parallel CLI
  0.9.4 (44 seconds, USD 0.0002): its postinstall script ran, asked for `github.com` and
  `release-assets.githubusercontent.com` beside the npm registry, and started `unzip`; nothing
  was left running. `browse` 0.11.4 (15 seconds, USD 0.0001): esbuild's postinstall ran, only
  the npm registry was asked for, and the start wrote its own update-check file. Both sandboxes
  were deleted and `boat list --all` was empty afterwards. The repository copy of the scripts
  ran the `browse` lockfile again the same day with the same result (26 seconds). With the
  outside code running as `vet` (0.28.4), the `browse` run gave the same report (17 seconds),
  and an install made of hostile commands was refused each one: `sudo` asked for a password,
  the evidence folder and the probe file gave "Permission denied", and `pkill tcpdump` gave
  "Operation not permitted"; the report listed `sudo` and `pkill` among its programs.
