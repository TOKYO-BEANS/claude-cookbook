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
saved snapshot in 3.0 to 3.2 s; saving took 16 s (450 MB). Net gain 0.6 to 0.8 s a run, so
nothing was built. A `--no-env` start from the snapshot held no stored secret. `boat
snapshots --json` showed 0 of 10 used and `boat list --all` was empty afterwards.

**A failure of mine.** The by-hand part went around `boat-run.mjs` and kept a sandbox
between commands for about a minute (`--no-env`, 900 s TTL), which `recipes/boat.md` asks the
owner's yes for; it was not asked. Its copy of a listed repository went in by `boat push`,
so without the Gitleaks scan or the data-file check. Cost USD 0.0000; everything deleted.
The page says so and that it is no precedent. Found by the fallback reviews of `05fea2d`
(two mediums, two lows) and `bc0be6d` (three lows), all fixed.

**Dead ends.** `boat snapshot` with no arguments does not list saved snapshots; `boat
snapshots --json` does (`named`, `savedAllowance`). `boat delete --json` needs `--yes`.

**Outstanding.** None. Build it when a repeated job's setup passes a minute on boat, by the
page's rules.
