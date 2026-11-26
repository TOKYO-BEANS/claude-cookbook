# Vetting outside code: the sandbox step

A fixed step of every vetting: outside code is run once in a Depot sandbox before it is installed,
after the three scanners (`connecting.md`). It is a step, not a choice, because a use left to
judgement did not happen. It holds for every install and update recipe here and in the
`stack-updates` skill, also where a recipe's own steps do not repeat it (REA).

The scripts are in the `stack-updates` skill's `scripts/vetting` folder, with tests in the
repository's `scripts/vetting.test.mjs`. The files of the same names in
`~/.local/share/vetting/_tools` only start the installed plugin's copy.

- **An npm package:** `bash <stack-updates skill folder>/scripts/vetting/pinned-vet.sh <install
  folder> <package> <version>` ends with the sandbox run (`pinned-sandbox.sh`, same arguments,
  runs it alone). It sends the new `package.json` and `package-lock.json` and a probe script,
  installs with the install scripts on, and starts the package's command once with `--version`.
  A first copy, with no install folder yet: [pinned-copies.md](pinned-copies.md).
- **Anything else, a pinned binary included:** copy `sandbox-probe.sh` from that folder into the code's
  folder, then `node <cookbook skill folder>/scripts/sandbox-run.mjs --type small --timeout
  900 --vet <folder> -- bash sandbox-probe.sh --cmd "<install command>" "<start command>"`.
  `--vet` sends the folder as it is (outside code, no upload list) and runs only the probe;
  the sandbox gets none of the org's secrets.
- `pinned-vet.sh` exits 0 only with a sandbox result and a report from each scanner: a scanner
  that wrote none prints "no report" and the run exits 3.
- The run has install scripts on; this PC installs with `--ignore-scripts`, so it shows
  what the package does, not what the install here will do. The full output is kept in `<vetting folder>/out/sandbox.log`.
- With no key or the month's allowance used, the step answers "no result" and every pinned
  npm update waits for the owner. Moved from boat to Depot on 26 November 2026, in one change
  with the scripts.

Reading the report, what counts as a surprise and the one exemption:
[vetting-sandbox-report.md](vetting-sandbox-report.md). The sandbox itself: [sandboxes.md](sandboxes.md).
