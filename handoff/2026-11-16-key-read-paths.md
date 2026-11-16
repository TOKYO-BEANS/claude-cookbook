# 16 November 2026 (late night): the other key reads leave PowerShell; the record of #78 (0.40.1)

**The record of #78, after its merge.**
- Merged by hand as `47d7400` at head `beaaa91`. The gate refused for the unavailable AI
  review only; the owner's answer was "Merge #78 once on sa-review". The security threads
  read again after the merge: none new.
- Release check: release event `verified`, execution 1589. The `sa-release` run
  `cookbook-78-release` ends `unknown`, as on every merge commit (`ai-review` is skipped
  there). `Depot CI / test`, `Depot CI / semgrep` and `Analyze (javascript-typescript)`
  passed on the merge commit.
- Installed: plugin 0.38.2; `with-key.mjs` copied from `47d7400` to `~/.local/bin` (the old
  one is in `~/.local/share/backups/2026-11-16-with-key-stall/`); `agent-key.ps1` there was
  already identical.
- Proof from the installed path, with the real key and `boat limits --json`: during 60
  seconds with 16 workers starting `git --version` (910 processes), 18 calls took 1.3 to 2.3
  seconds, all exit 0 with a JSON answer and no `with-key:` line, and no PowerShell key read
  started (Windows PowerShell event log, event 400: 0). Before the fix the same burst gave
  one read of 61 and one of 87 seconds.
- Not explained: without a burst, 95 calls in three runs took 0.7 to 2.5 seconds and one
  took 17.1 seconds (the third of the first ten). It was not seen again in 85 further
  rounds, where the key read with a trivial program took at most 2.1 seconds. No PowerShell
  was involved; whether the wait was in the launcher or in boat's own call is not known.
  Owner: Claude. Cleared by seeing it again while `split-timing.mjs` (evidence folder) runs.

**What was still reading a key through PowerShell** (searched for on the PC, 16 November):
- Claude Code's Firecrawl `headersHelper` and Codex's Firecrawl `http_headers_helper`:
  `agent-key.ps1 -Mode headers`, at every session start. A client waits a short time for
  its headers, so a stalled read leaves the session without the key.
- `firecrawl-secure.mjs` (behind the `firecrawl` command, used by `web-batch.mjs` too):
  PowerShell with no time limit. `parallel-secure.mjs` already went through `with-key.mjs`.
  Both were in no repository.
- `browserbase-key.ps1`: an older helper with its own key file outside the store. Nothing
  called it; its key had the same SHA-256 as `browserbase` in the store.
- Outside this repository, listed under Outstanding: the `google` launcher of the sign-in
  tools, a Python key reader in a product repository, a second Codex header helper for a
  local server, and an old chat-import script.

**The owner's answers** (question dialog, 16 November 2026).
- The header: "Own small file (Recommended)", over a mode in `with-key.mjs` and a local
  server without printing. The yes covers the warning GitHub's security review gives for a
  file that prints a key.
- The two launchers: "Cookbook (Recommended)". They live here now.
- The old helper: "Retire both (Recommended)": the script and its key file.
- Codex's second header helper, for a local workflow server: first "Dont Think we use it
  anymore?"; then, shown that the server last ran on 12 September, that no saved Codex
  session used its tools and that nothing listens on its port: "Remove the entry
  (Recommended)".

**What changed.**
- `skills/cookbook/scripts/key-header.mjs` (new): prints one stored key as
  `{"Authorization":"Bearer ..."}` for an MCP client's headers helper, read in its own
  process with no PowerShell. It is the one helper that prints a key. It refuses a
  terminal; a failed read prints nothing and ends with code 1.
- From GitHub's security review of the first push (one thread, on the printing): the helper
  prints only the keys its source lists, now `firecrawl`. Any other name in the store is
  refused before a read, and neither an argument nor the environment widens the list. The
  thread's other idea, a variable that switches printing on, was left out: whoever starts
  the helper can set it, so it stops nothing.
- From Graphify's review of the first push (medium, not verified by it; checked here against
  the pinned CLI's `--help`): the CLI also takes its address from an `--api-url` argument,
  and `env` writes the key into a `.env` file. First fixed with a list of setup commands
  that get no key.
- From the fallback review (a reviewer that did not write the change; three medium, two
  low): that list was too weak. A saved address in the CLI's credentials file was a third
  source; the hidden option `--enable <feature>` made the parser take its value for the
  command, so `--enable alexandria env` got the key; and `launch`, which starts an agent
  that inherits the key, was not on it. The launcher was turned round: a list of the
  commands that do get the key, and no unknown option before the command. The two low
  ones: the pages said the terminal check does more than it does (an agent's shell is a
  pipe, like a client), and three sentences in `recipes/keys.md` were not exact.
- Not listed, so without the stored key: `env`, `init`, `setup`, `make`, `config`, `login`,
  `logout`, `launch`, `doctor`, `view-config`, `update`. What each would do with
  a key was not tried. The CLI's short forms with a scrape option before the address
  (`firecrawl -u <url>`) get none either: write `firecrawl scrape <url> ...`.
- Graphify's other note, advisory: `main()` in `with-key.mjs` has more callers now (the
  two launchers). That is the design: one entry point reads the key and starts the program.
- `firecrawl-secure.mjs` and `parallel-secure.mjs` are in `skills/cookbook/scripts` and
  read through `with-key.mjs` in their own process: no PowerShell, one process less each.
- The Firecrawl launcher decides narrowly who gets the stored key (the old one handed it to
  every call unless `FIRECRAWL_API_URL` lacked the hosted name anywhere in it): only a
  command on its list, only with options it knows before the command, and only for
  `https://api.firecrawl.dev` (host and scheme compared, in the variable and in every
  `--api-url` argument). On that path it sets `FIRECRAWL_API_URL` itself, which outranks
  an address saved in the CLI's own credentials file. Any other call starts with the
  caller's environment as it is, and a refused command gets one line on stderr.
- `with-key.mjs`, the low finding of #78's last review: on Windows a value under the
  variable's name in another letter case is removed too, before the read, so neither a
  failed read nor a good one leaves a stale spelling for the program.
- `with-key.mjs`, the older fault: a program ended by a signal gives 128 plus the signal's
  number (SIGTERM: 143), not 1.
- `with-key.mjs`, the other older fault, checked and kept: a key that cannot be read still
  starts the program without the variable. The owner-questions broker relies on it (it
  starts, answers "no key" and leaves after its no-key lifetime), and so does any server
  started this way. It is written down as intended in the file and in `recipes/keys.md`.
- `recipes/keys.md`, the map row and `catalog.json` (the three copies named, the retired
  helper's entry removed).

**Verification.**
- 15 new tests: three in `scripts/with-key.test.mjs` (the letter case, the exit code for a
  signal, the launcher as a process ended by SIGTERM) and twelve in the new
  `scripts/key-header.test.mjs` (the header's form, a failed read, the list of keys, a
  terminal, usage, the
  helper as a process with a synthetic DPAPI key, and the two launchers with a stand-in
  CLI: no saved key, a self-hosted address, an address that only contains the hosted
  name, an `--api-url` argument, commands and options that get no key). Each was seen
  failing first.
- Both files on this PC: 35 tests, 33 pass, 2 skip (no right to make a link; no signals on
  Windows). On Linux with Node 24, in a sandbox, at the first push: 26
  pass, 6 skip (the Windows ones); the SIGTERM test runs there and gives 143.
- `npm test` on this PC, second run: 597 tests, 594 pass, 3 skipped. The first run had one
  failure, in a test that was not changed: "a key saved by agent-key.ps1 reads the same by
  both routes" starts real PowerShell, and that call was ended at the test's 140-second
  limit while a sandbox run and another PowerShell call ran beside the suite. It is the
  scan stall this work is about. A third run, after the fallback review: 621 tests, 616
  pass, 4 skipped, and the same one failure at 140 seconds while other chats worked on
  the PC; run alone straight after, that test passed in 44 seconds.
- The helper's command line for a client, with a key name that is not saved, so nothing
  can be printed: it starts and answers the same through `cmd.exe /Q /D /C "..."` (how
  Codex starts a helper, read in its source; it waits 10 seconds) and through a POSIX
  shell.

**Done on the PC before the merge, on the owner's answers.**
- `browserbase-key.ps1` is in `~/.local/share/backups/2026-11-16-key-read-paths/`; its key
  file outside the store is deleted. The same key is in the store.
- Codex's entry for the local workflow server is out of `~/.codex/config.toml` (the file as
  it was is in the same backup folder). `codex mcp list` reads the file and lists the rest.

**Outstanding.**
- After the merge, in the chat of this pull request and in its last comment: the five
  files copied to `~/.local/bin`; the Firecrawl entry of Claude Code and of Codex pointed
  at `key-header.mjs`; the proof from the installed path (a local stand-in server that
  compares the header it receives with the stored key by SHA-256, and the burst from
  `storm-compare.mjs`); `servers.mjs fingerprint --server firecrawl` against
  `scripts/measure/servers.json`, which this pull request already sets to the new entry.
- After an update of the pinned Firecrawl CLI: read its `--help` (hidden options are in
  `dist/index.js`) against the two lists in `firecrawl-secure.mjs`. Owner: Claude, with
  the update. A new command gets no key until then, which shows as "not authenticated".
- Key reads through PowerShell in other repositories, each a job there. Owner: Claude.
  - The sign-in tools' `google` launcher reads its keys with `agent-key.ps1` on every
    call. Cleared by importing `readKey` from `~/.local/bin/with-key.mjs`; saving and
    removing a grant stay on PowerShell (rare, and they write).
  - A product repository's Python key reader starts `agent-key.ps1 -Mode headers` with a
    time limit. Cleared in that repository, and not through `key-header.mjs`, which
    prints only the keys it lists: its program started through `with-key.mjs`.
  - An old chat-import script in `~/.local/share` (no repository, run by hand): left as
    it is.
- The one 17-second call (above).
- `npm test` on this PC can lose the one test that starts real PowerShell when other work
  runs beside it. Run it alone, and read a failure at 140 seconds as the stall. Owner:
  Claude; another chat had this test as its job on 16 November 2026. The test is the
  only proof that a key saved by the real helper reads back by the direct route.
- The `ai-review` job still answers `review unavailable` (no API credit); the fallback
  review reads each pull request until it is back. Owner: the owner (it is spending).
- Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-16-key-read-paths/`
  (`mcp-header-probe.mjs`, the three `npm test` logs); #78's is in
  `~/.local/share/claude-cookbook/evidence/2026-11-16-with-key-stall/`.
