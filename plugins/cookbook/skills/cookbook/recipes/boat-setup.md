# Cloud sandboxes (boat): the plan, setup and evidence

- **The plan is the owner's:** USD 20 a month since 16 November 2026 (the trial ended that
  day), renewed on the 16th. `boat limits --json` is the source, never memory. It showed that
  day: 2,000,000 seconds a month at the `default` rate (about 555 hours; `small`, 2 vCPU and
  4 GB, counts half; `large`, 8 vCPU and 16 GB, double; no `xlarge`), 100 sandboxes at once,
  12 starts a minute, 60 an hour and 200 a day, and 10 saved snapshots.
- **Nothing bills past the plan** by boat's own terms while the wallet is empty and extra
  starts are off, as both were that day: the wallet pays for use above the plan, and a start
  past a limit is billed only with extra starts on. Not tested by running out. Claude never
  changes the plan, tops up the wallet, turns extra starts on or creates API keys. Without a plan, or with the month's
  time used up, the sandbox step answers "no result" and every pinned npm update waits for
  the owner: if boat is ever cancelled, take the step out of the vetting scripts and these
  recipes in the same change.
- **On this PC:** the `boat` command is a shim that decrypts the DPAPI key `boat` into that one
  process and turns the CLI's self-update off (`BOAT_NO_UPDATE=1`). The binary is a pinned copy
  in `~/.local/share/boat`, checked against the checksum list boat publishes; it is not
  code-signed. Never run boat's installer (`install.ps1`): it writes to AppData, the PowerShell
  profile and the user PATH, which do not survive a reboot from Claude's container. To update:
  download the new binary and checksum list to an empty folder, compare the SHA-256, replace the
  copy and run `boat --version`.
- The API key ends on 10 February 2027 (the catalog carries the date). A 401 means it ran
  out: the owner makes a new one in the dashboard and saves it through the masked key window.
- Proven on 12 November 2026: `boat run --type small` had a sandbox ready in under a second
  (Ubuntu 24.04, Node 24, Python 3.12), ran a command and deleted it.
- Proven on 14 November 2026: the sandbox step ran on two vetted lockfiles (44 and 15
  seconds, USD 0.0002 and 0.0001), and showed each postinstall script, the hosts asked for
  and what was left running. With the outside code running as `vet`, an install made of
  hostile commands was refused each one (`sudo`, the evidence folder, `pkill tcpdump`).
- Proven on 16 November 2026, on the paid plan: this repository's `npm test` ran in a
  `small` sandbox in 13 seconds with the upload (about 150 seconds on this PC) and found a
  test that depended on the machine's sort order; five sandboxes ran at once; a `large` one
  reported 8 CPUs; `boat list --all` was empty afterwards. The lot cost under USD 0.01.
