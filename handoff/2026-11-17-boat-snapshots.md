# 17 November 2026: boat snapshots for repeated setup, measured and not built

**The job.** The owner's question in the boat Claude chat: "can we use the snapshot feature
for repeated work?" The outcome: repeated boat work with a slow setup starts from a saved
snapshot, through the scripts; simple first, and less if the measured gain is small.

**What changed.** No script change. `recipes/boat-snapshots.md` records the measurement, the
decision and the rules for building it later (a `--no-env` sandbox, our own committed lockfile,
install scripts off, never from a vetting sandbox, named by the lockfile's hash, at most the
plan's 10, never shared without the owner's yes). `recipes/boat.md` links it.

**Verification.** Measured on `small`, 17 November: through `boat-run.mjs`, `npm ci
--ignore-scripts` of the one listed repository with a lockfile took 2.8 s (325 MB, an 11 s
run with the upload). By hand, once: a fresh start was ready in 1.0 s, a start `--from` a
saved snapshot in 3.0 to 3.2 s; saving took 16 s (450 MB). Net gain about 0.6 s a run, so
nothing was built. A `--no-env` start from the snapshot held no stored secret. `boat
snapshots --json` showed 0 of 10 used and `boat list --all` was empty afterwards.

**Dead ends.** `boat snapshot` with no arguments does not list saved snapshots; `boat
snapshots --json` does (`named`, `savedAllowance`). `boat delete --json` needs `--yes`.

**Outstanding.** None. Build it when a repeated job's setup passes a minute on boat, by the
page's rules.
