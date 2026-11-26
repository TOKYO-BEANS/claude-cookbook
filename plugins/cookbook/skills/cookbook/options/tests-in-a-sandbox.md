# Options weighed: tests before a push, a sandbox or the laptop

The owner's choice on 20 November 2026, after the numbers below: tests run in a cloud sandbox
for every repository on the upload list (boat then, a Depot sandbox since 26 November
2026). A run stays on the laptop only when it needs the laptop itself (its key store, its
display or an app on it), as [the hook](../recipes/sandboxes-setup.md) says, or when the
repository tracks customer data, which no sandbox gets.

**Measured** 19 and 20 November 2026, on the Ubuntu 26.04 laptop (Ryzen 5 5500U, 12 threads,
on mains power), each repository at its `main`, the install included, five runs each:

| Suite | Laptop | boat `small` | boat `default` |
| --- | --- | --- | --- |
| claude-cookbook, 734 tests | 9.0 s | 30.1 s | 14.2 s |
| Stack-Atlas, check, lint and 782 tests | 17.4 s | 23.3 s | 21.6 s |
| release-maintenance, CI's 68 tests | 1.6 s | 7.1 s | not run |

Medians. boat's own part is about 4.7 seconds before a test starts (Gitleaks about 1, the
start about 2, the upload about 1.5). A run costs about USD 0.0001, so price does not decide.
The hook therefore names a `default` sandbox for every suite. It halves the cookbook's time
for about the same plan time (14.2 against 15.1 plan-seconds, since `small` counts half); for
Stack-Atlas it saves 1.7 s for nearly double (21.6 against 11.7). One sandbox size keeps the
hook simple, and a run is a few seconds out of 2,000,000 a month.

**Weighed:**

- **Speed:** the laptop is 1.3 to 4 times faster. A local run takes 45 to 50 CPU-seconds and
  0.4 to 0.6 GB at its peak; three cookbook runs at once took 15.9 s each. The hook began on
  17 November for a Windows PC that took 150 seconds and was short of memory; the laptop is
  not.
- **Isolation, which decided it:** on the laptop the test code and its npm packages run
  beside the unlocked key store, which any process of the owner can read, and the laptop has
  no Safe Chain. A sandbox holds no secret.
- **Parity with CI:** the sandbox has CI's Ubuntu 24.04 and Node 24; the laptop has Node 26.
  The upload holds no `.git`; since 20 November 2026 the script makes the copy a git checkout
  in the sandbox before the command, so a test that calls git (Stack-Atlas's "own tree holds
  no scanner ignore file") runs there as in CI. CI decides either way.
- **Cost:** near zero either way; a Depot run of this suite is about USD 0.003.
- **A Depot sandbox instead of boat:** chosen on 26 November 2026, with the upload scan and a
  spend guard moved into the script ([measured](sandboxes.md)).

Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-20-boat-vs-local/`.
