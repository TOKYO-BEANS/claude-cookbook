# Malicious packages at install

**Aikido Safe Chain** runs before every `npm ci` and `pip install` in CI, Windows jobs included. The
Stack Atlas standard pins it by release and checksum (`templates/depot-security/safe-chain-step.yml`
and `safe-chain-step-windows.yml`) and checks it in every installing job. The rest of the security
setup: [security.md](security.md).

- **Minimum package age: 24 hours** (owner, 18 November 2026; Safe Chain's own default is 48).
  Never lower, and no `minimumPackageAgeExclusions` of our own. Why a hold at all: Safe Chain checks
  installs against Aikido's malware feed, and a new malicious release is not in the feed until
  someone detects it, which usually takes hours. The hold covers that gap.
- How the standard sets it: the Safe Chain step writes `SAFE_CHAIN_MINIMUM_PACKAGE_AGE_HOURS=24` to
  `$GITHUB_ENV` after the installer. An `env:` on the step would end with the step, and the installs
  run in later steps. The variable outranks a repository's `.aikido` file, so no repository holds
  less (standard v23, Stack-Atlas #226; proved in Depot CI run `jzfz1w4lbz`).
- **CVE fixes pass the hold.** Safe Chain itself (from the pinned 1.5.27 on) lets through a release
  that Aikido has confirmed as a malware-free patch for an urgent CVE: an exact name and version
  from Aikido's safe-patches list, for npm and pip. If that list cannot be loaded, the full hold
  applies.
- A lock that pins a release younger than the hold fails the install: wait for it to age.
- Safe Chain checks an install only when the command resolves to its wrapper on `PATH`.
  Not checked, in a step or a script: one inside `npm run`, `npm test` or `python`, or by a
  virtual environment's `pip` or `python`. A script that must install starts
  `safe-chain npm ci ...` (`pip` likewise) with `PKG_EXECPATH` unset, and fails in CI without Safe Chain.
