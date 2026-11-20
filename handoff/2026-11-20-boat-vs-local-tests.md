# 20 November 2026: tests before a push stay on boat on the Linux laptop

**Why.** machine-setup's GUIDE.md step 8, part 2: the rule "a repository's tests before a push
run on boat" was set on the Windows PC (150 seconds a run there, a PC short of memory). On the
Linux laptop it had to be measured again.

**Measured.** claude-cookbook `fa6d1d8`, Stack-Atlas `4d8874b`, release-maintenance `94626d7`,
the install included, five runs each (local runs with `hyperfine`). Medians: laptop 9.0, 17.4
and 1.6 s; boat `small` 30.1, 23.3 and 7.1 s; boat `default` 14.2 and 21.6 s. boat's own part is
about 4.7 s a run; the 32 boat runs of this job cost USD 0.0036 together, as boat-run reported. A local run takes 45 to 50
CPU-seconds and 0.4 to 0.6 GB; three at once took 15.9 s each. The full table and the weighing
are in `options/tests-on-boat.md`.

**The owner's answer.** 20 November 2026, question dialog, "Keep boat for all": the laptop is
faster, but a local run puts test code and its npm packages beside the unlocked key store, with
no Safe Chain on the laptop. The closed list of 19 November (key store, display, an app on the
laptop) stands.

**What changed.** The hook names a `default` sandbox (`--type default --timeout 1200`) instead
of `small` for tests: half the cookbook's time for about the same plan time (nearly double
for Stack-Atlas, which gains 1.7 s; one size keeps the hook simple). New page
`options/tests-on-boat.md`, linked from `recipes/boat.md`; `boat.md` says an upload holds no
`.git`; `boat-setup.md`'s 150 seconds is the Windows PC's.

**Verification.** The suite of this branch did not run on boat before the push: the measurement
had used up the plan's hourly starts (`BOAT-RUN: not started`, exit 75). The run before that
failed only the page-size check, fixed before the push. `node scripts/check.mjs` passed, and
Depot CI on #180 passed (`test`, `semgrep`, CodeQL, `test (windows-2025)`). #180 merged as
`553e4dc` through `merge-when-green.sh` (AI review: 0 high, 0 medium, 2 low; Graphify Formal
Verification neutral, set aside); release check `verified` (execution 1898). The two lows (this
paragraph and the plan-time claim) are fixed in the follow-up pull request.

**A correction.** The 17 November entry put Stack-Atlas's one failure on boat ("own tree holds
no scanner ignore file") down to the Desktop clone. It is boat's upload: no `.git`, so the
test's `git ls-files` fails. It fails on every boat run and passes on the laptop and in CI.

**Outstanding.**
- That false failure. Fix it in Stack-Atlas (the test skips outside a git checkout) or in
  boat-run (a `git init` and `git add` of the uploaded copy before the command). Owner: a later
  Cookbook or Stack-Atlas pull request; no owner step needed.
- One local run in this job was outside the closed list: the hook's own test file, once, after
  the edit (12 of 12 passed). The measurement runs were the job itself. Every later run went to
  boat.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-boat-vs-local/`:
`local-hyperfine.json`, `local-load.txt`, `boat-runs.jsonl` (with phase times),
`boat-runs-cookbook-small-round1.jsonl`, `boat-stack-atlas-git-failure.log`, the three local
test logs and `boat-bench.mjs`, the script that timed the boat runs; `release-cookbook-180-merge.log`.
