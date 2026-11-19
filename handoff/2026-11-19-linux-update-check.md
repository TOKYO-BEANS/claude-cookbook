# 19 November 2026: the daily update check reads the Linux installs

**Why.** After the move to Ubuntu the check's fixed tables still named Windows files
(`boat.exe`, `pass-cli.exe`, `gws.exe`, `cli-proxy-api.exe`) and started every keyed CLI as
`cmd.exe /d /c {bin}/<name>.cmd`, so those parts read "could not check" and their services
"broken". The pages still called the daily run a Windows task.

**What changed.**
- `lib/tables.mjs`: the four binaries under `~/.local/share` without `.exe`; a keyed CLI's
  check starts its launcher by full path, `{bin}/<name>` (a `#!/bin/sh` file, no shell).
  Depot's check is `with-key.mjs depot-org DEPOT_TOKEN depot org invoices list --page-size 1`:
  the Depot CLI is not signed in on Linux, and `org credits` is limited to one read a minute.
- `lib/inventory.mjs`: a `{bin}/<name>` launcher of a connection check counts as listed.
- Wording: the daily run is the systemd user timer `stack-updates-daily` in the skill, its
  scripts and notice, `update-check.md`, `update-check-routine.md`, `scheduled-runs.md`,
  `options/keep-healthy.md` and the map row.
- Tests: the tables name no `.exe`, `.cmd` or `cmd.exe`; the real runner starts a `#!/bin/sh`
  launcher by path with its arguments intact, and a file without the execute bit is a spawn
  failure; Depot's pattern against what the CLI prints with and without a token.
- Left as it is: the `cmd.exe /d /c` launcher shape in `scripts/check.mjs` and `lib/connect.mjs`.
  No table uses it; it goes with the Windows CI job.

**Verification.** On the laptop: `npm test` 692 tests, 686 pass, 6 skipped (Windows only), 0
fail. The first real run recorded the baseline, then a second run after the Depot change:
Depot, GitHub, Firecrawl, boat, Browserbase, Proton Pass, Cloudflare and Parallel answered. A
probe unit (`systemd-run --user`) with the service's `PATH` saw Node, a signed-in `gh`,
`claude`, no API key in its environment, and read a key through `with-key.mjs`.

**What the baseline shows (19 November).**
- Broken: OpenSEO (`claude mcp list` does not list it outside its two projects) and the
  Google Workspace CLI (no `google` launcher yet; the sign-in tools are another chat's job).
- Could not check: CLIProxyAPI (not installed yet). The project map `projects.json` was
  missing and is written again.
- Behind: the Cookbook plugin, Depot CLI 2.103.28 (2.103.29), Firecrawl CLI 1.29.0 (1.30.0),
  and Git 2.53.0 against Git for Windows 2.56.1, which is the wrong feed on Ubuntu.
- Missing: Superpowers and the Firecrawl plugin (installed here from another marketplace
  than the catalog names), the Jev compaction plugin, the Shopify CLI (an npm global here).
- 57 things not in the Cookbook: the dev toolbox of 18 November and four language-server
  plugins. The catalog's Linux pass is its own pull request.

**Outstanding.**
- After the merge: `claude plugin update cookbook@claude-cookbook`, copy `scripts/daily.mjs`
  to `~/.local/bin/stack-updates-daily.mjs` if it differs, then enable the timer
  (`systemctl --user enable --now stack-updates-daily.timer`) and read it back. Owner: Claude.
- The Depot CLI has no user sign-in on Linux; only the organisation token's reads work.

**Dead ends.** `depot org list` (needs a user sign-in) and `depot org credits` (the second read
within a minute answered "polling limit exceeded") as the Depot check.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-linux-scripts-and-pages/`:
`update-check-first-run.txt`, `update-check-second-run.txt`.
