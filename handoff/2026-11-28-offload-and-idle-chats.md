# 28 November 2026: chats move off the laptop at the owner's message, idle chat processes end

**Why.** The same morning, after #294, systemd-oomd stopped T3 Code (10:24 local) and the
kernel stopped a chat's scope. Only chats started by a chat were steered to boat (#288). T3
also keeps each chat's `claude` process (about 300 MB) until T3 stops: 10 to 11 were alive while
2 chats ran, some 11 to 19 hours old. The owner chose "All three" with the question dialog,
then, asked about Claude cloud sessions: "Boat, cloud for no-input jobs".

**What changed.**
- `hooks/laptop-load-note.mjs` (UserPromptSubmit): at an owner's message in a T3 chat on the
  laptop (boat-chat's state file present) while `laptop-load-lib.mjs` reads near, once an hour
  per chat, the chat hears the reasons and the route: a chat that fits boat, new or running,
  moves with a brief and settles; a job that needs no input may go to a cloud session once set
  up; anything else stays. `offloadNote` and `noteDue` in `laptop-load-lib.mjs`.
- `scripts/idle-chats/` (`idle-chats.mjs`, `.service`, `.timer`): every 10 minutes, ends
  (SIGTERM) the `claude` process of a T3 chat with no unfinished run (T3's state, read-only via
  `node:sqlite`), its last run ended 30 minutes ago, and no Bash shell under it. Log:
  `~/.local/share/claude-cookbook/idle-chats/log.jsonl`. Installed on the laptop after the merge.
- `hooks.json`, `recipes/sandboxes-boat-chat.md`, `recipes/sandboxes-setup.md`.
- Live, outside the repository: the Stack Atlas onboarding batch's user service
  (`sa-v39-first-calls.service`, its Semgrep scan back at 2.3 to 3.1 GB) got `MemoryHigh=3G`
  `MemoryMax=4G` for this boot (`set-property --runtime`), so going over the limit stops that
  service, not T3.

**Verification.** The resume probe: a throwaway chat's process ended by
`idle-chats.mjs --idle 1 --thread …`; at the next message T3 started a new process with
`--resume` and the chat answered with the word it was given before. Tests:
`scripts/idle-chats.test.mjs`. The suite ran in a Depot sandbox (see the pull request).

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-28-memory-short-wait/`
(`idle-chats-resume-probe.md`). Release log: the `sa-release` run of this pull request.

**Dead ends.** T3 Code has no setting that ends idle provider processes (its "Idle minutes"
setting belongs to another feature). Claude cloud sessions as the only route: cheaper, but not
in T3's sidebar, so a question to the owner would wait in the Claude app.

**Outstanding.**
- Cloud sessions are not set up: the first no-input job asks the owner for the GitHub grant.
- The onboarding batch's local Semgrep scans (Stack Atlas `scripts/semgrep-supply-chain.mjs`)
  run from a script, so no Bash hook sees them; a memory cap in that script belongs to Stack
  Atlas. Owner: Claude, a Stack Atlas pull request. Cleared when the script runs the scan
  under a memory limit or waits while memory is short.
- From #294: the zram file into machine-setup.
