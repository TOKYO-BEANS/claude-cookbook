# Cloud sandboxes (boat): saved snapshots

A saved snapshot (`boat snapshot <id> <name>`) lets a sandbox start with a setup already done
(`boat run --from <name>`). The owner asked on 17 November 2026 whether repeated boat work
should use one. It does not, for now: a snapshot start saves under a second on the setups we
repeat, too little to build and keep up.

- **Measured on 17 November 2026,** on `small`: a fresh start was ready in 1.0 s, a start from
  a saved snapshot in 3.0 to 3.2 s. The largest install we repeat, `npm ci --ignore-scripts`
  of a listed repository (325 MB of `node_modules`), took 2.8 s; saving it took 16 s and
  450 MB. Net gain: 0.6 to 0.8 s a run (1.0 + 2.8 s against 3.0 to 3.2 s). This
  repository's suite needs no install, and a Claude run in [boat-claude.md](boat-claude.md) sets nothing up before the agent starts.
- **So:** `boat-run.mjs` and `boat-claude.mjs` have no `--from`, and no snapshot is kept.
  Install in the run, as [boat.md](boat.md) says.
- **When to build it:** a repeated job whose setup takes over a minute on boat (a large
  `npm ci`, a pip install that compiles, browsers or other tools for a Claude run), measured
  with `boat-run.mjs`, not guessed. Then add `--from` to the two scripts and one step that
  builds and replaces a snapshot, through a pull request, under these rules:
  - Built only from a `--no-env` sandbox, from our own committed lockfile, install scripts
    off; never from a vetting sandbox, whose outside code would carry into later runs.
  - Named by the lockfile's hash, so a stale one is never reused. A new hash is a new name,
    so the step removes the previous hash's snapshot (`boat snapshot rm`) once the new one
    is saved.
  - At most the plan's 10 saved snapshots: `boat snapshots --json`, `savedAllowance.used`
    against `included`, read before each save. Past the plan each costs USD 0.056 a day from
    the wallet (`boat limits --json`, `overagePrices.savedSnapshotDayDollars`): never.
  - Never shared (`boat snapshot share`) without the owner's yes.
  - The sandbox it is built in keeps `boat-run.mjs`'s checks: the plan's limits, the upload
    list and the Gitleaks scan of the copy, a `--ttl`, a timeout on each `boat exec`, never
    `--no-auto-stop`, and `boat delete` at the end, a failure included.
  - A `boat-run.mjs` start from a snapshot still gets `--no-env`, its size and its timeout.
    A `boat-claude.mjs` start keeps its checked environment and `--ttl` (`--no-env` has no
    sign-in); first prove with one run that `--from` keeps the proxy placeholder.
- **The measurement** went around the script once: `boat-run.mjs` cannot keep a sandbox to
  save it, so one was started by hand (`--no-env`, `small`, a 900 s TTL), saved, timed with
  `boat run --no-env --from` and deleted, with the snapshot, the same day (0 of 10 used
  afterwards). The copy of the listed repository went in by `boat push`, so without the
  Gitleaks scan or the data-file check, and [boat.md](boat.md) asks the owner's yes for a
  kept sandbox, which was not asked: it is no precedent. The build step above is
  the route; until it exists, a new measurement asks the owner first.
