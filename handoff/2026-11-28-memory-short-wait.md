# 28 November 2026: local runs wait while memory is short, and zram

**Why.** RAM was 87 % used and the 4 GB swap 100 % full, with memory pressure at 42 to 75 %
(the laptop thrashing). The 27 November route (`2026-11-27`, #288) reads the laptop's load
only when a chat starts another chat. It never looks at a run inside a chat, or at chats the
owner opens. The biggest single user was a local `semgrep ci --supply-chain --dry-run`: 2.3 GB
for 33 minutes, started by a Stack Atlas onboarding run in a `/tmp` clone of a shop repository.
The rest was ten open chats (about 300 MB each), four TypeScript servers, a site preview and
the desktop apps.

**What changed.** The owner chose "Both" with the question dialog.
- `hooks/sandbox-route.mjs`: before any local test run or Semgrep scan, in any folder, it reads
  `laptop-load-lib.mjs`. While a memory or swap limit is reached, the run is denied with the
  reading and "run it in a sandbox or wait", past `# local-run:` too. CPU and load limits stay
  with the chat launch. `COOKBOOK_LAPTOP_PROC` stands in for `/proc` in the tests.
- `laptop-load-lib.mjs`: `memoryReasons()` picks the memory and swap reasons of a reading.
- `recipes/sandboxes-setup.md`: the hook paragraph says so.
- The laptop (owner's yes and sudo password, 28 November 2026): Ubuntu's
  `systemd-zram-generator` 1.2.1-2, `/etc/systemd/zram-generator.conf` (`zram-size = ram / 2`,
  zstd, priority 100; the device running since the install is the package's own default,
  min(ram / 2, 4096) with lzo-rle, started 4 s before this file was written; with this file it
  is ram / 2, about 7 GB, with zstd, from the next start). `/dev/zram0` is used before
  `/swap.img`, which stays as overflow.

**Verification.** `swapon --show` lists `/dev/zram0` 4G at priority 100 beside `/swap.img`.
Stopping the scan took available memory from 1.8 to 3.5 GB. The suite ran in a Depot sandbox
(see the pull request). `node scripts/check.mjs` passes.

**Evidence.** This pull request's tests (`scripts/sandbox-route.test.mjs`,
`scripts/boat-chat.test.mjs`). Release log: the `sa-release` run of this pull request.

**Dead ends.** None.

**Outstanding.**
- The zram file is not in machine-setup yet, so the second Lenovo move would not copy it
  (`/etc` is outside the home copy). Owner: Claude, in a machine-setup pull request. Cleared
  when the move program writes `/etc/systemd/zram-generator.conf`.
- The stopped onboarding scan (shop repository) has to run again in that chat. It now waits
  while memory is short.
