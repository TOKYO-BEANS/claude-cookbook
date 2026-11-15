# Cloud browser (Browserbase): setup and updates

- **On this PC:** the `browse` command is a shim that decrypts the DPAPI key `browserbase` into
  that one process (`with-key.mjs`) and turns the CLI's usage telemetry off
  (`BROWSERBASE_TELEMETRY_DISABLED=1`; it would send command names and exit codes to PostHog).
  The CLI is a pinned copy, `browse@0.11.4`, in `~/.local/share/browserbase-cli`, installed from
  a lockfile with `npm ci --ignore-scripts`: never `npm install -g browse` or
  `browse skills install` from a session. The lockfile overrides `zod` to 4.6.7, because the
  version `browse` resolves to has a high-severity advisory (GHSA-mrhx-c7xc-m3w5, fixed in 4.6.6).
- **To update:** resolve the new version to a lockfile in an empty folder, run the three local
  scans from [connecting.md](connecting.md) (OSV-Scanner on the lockfile, Gitleaks on a copy
  of the installed packages outside a `node_modules` path, because Gitleaks skips that path, and
  Trivy) and the sandbox run from [boat.md](boat.md); `pinned-vet.sh` there does all four.
  Drop the `zod` override once `browse` resolves to a fixed version, then `npm ci
  --ignore-scripts` in the install folder and run one session. A package whose own install script
  fetches its program (its lockfile entry says `hasInstallScript`; the Parallel CLI is one) is not
  complete after `npm ci --ignore-scripts`: do by hand what that script does, with the checksum it
  uses, and start the tool once before `updates.mjs verify`, which reads the version from the
  lockfile and cannot tell whether the tool starts.
- Vetted on 12 November 2026: OSV-Scanner 2.7.0 read 210 packages and found no critical or high
  advisory and 4 medium ones (`glob`, two `minimatch` versions and `deepmerge`); they are below
  the high-or-critical bar and stay open until `browse` updates. Gitleaks 8.30.1 read
  38.8 MB and flagged 11 strings: documentation examples, test fixtures, public-key pins and the
  CLI's public PostHog project token, none a credential. Trivy 0.76.2 found no configuration
  files to scan, which is no result, not a clean one.
- Updated to 0.11.4 on 14 November 2026: OSV-Scanner read 186 packages and found one medium
  advisory, none high or critical; Gitleaks flagged 11 strings of the same kinds as before; Trivy
  found one medium advisory and no secret. The `zod` override stays.
- Tested on 12 November 2026: one cloud session (open, title, snapshot, stop) billed 1 browser
  minute; one fetch and one search answered.
