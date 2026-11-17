# Cloud sandboxes (boat): saved snapshots

A saved snapshot (`boat snapshot <id> <name>`) lets a sandbox start with a setup already done
(`boat run --from <name>`). The owner asked on 17 November 2026 whether repeated boat work
should use one. It does not, for now: the setups we repeat are faster than a snapshot start.

- **Measured on 17 November 2026,** on `small`: a fresh start was ready in 1.0 s, a start from
  a saved snapshot in 3.0 to 3.2 s. The largest install we repeat, `npm ci --ignore-scripts`
  of a listed repository (325 MB of `node_modules`), took 2.8 s; saving it took 16 s and
  450 MB. Net gain: about half a second a run. This repository's suite needs no install, and
  a Claude run in [boat-claude.md](boat-claude.md) sets nothing up before the agent starts.
- **So:** `boat-run.mjs` and `boat-claude.mjs` have no `--from`, and no snapshot is kept.
  Install in the run, as [boat.md](boat.md) says.
- **When to build it:** a repeated job whose setup takes over a minute on boat (a large
  `npm ci`, a pip install that compiles, browsers or other tools for a Claude run), measured
  with `boat-run.mjs`, not guessed. Then add `--from` to the two scripts and one step that
  builds and replaces a snapshot, through a pull request, under these rules:
  - Built only from a `--no-env` sandbox, from our own committed lockfile, install scripts
    off; never from a vetting sandbox, whose outside code would carry into later runs.
  - Named by the lockfile's hash, so a stale one is never reused; a reused name replaces the
    old snapshot.
  - At most the plan's 10 saved snapshots: `boat snapshots --json`, `savedAllowance.used`
    against `included`, read before each save. Past the plan each costs USD 0.056 a day from
    the wallet (`boat limits --json`, `overagePrices.savedSnapshotDayDollars`): never.
  - Never shared (`boat snapshot share`) without the owner's yes.
  - A start from a snapshot still gets `--no-env`, the run's size and its timeout.
- **The measurement** ran by hand, once: one sandbox and one snapshot, both deleted the same
  day; `boat snapshots --json` showed 0 of 10 used afterwards.
