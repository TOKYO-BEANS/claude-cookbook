# 20 November 2026: the Windows key route and the last Windows files are gone

**Why.** The Windows PC is gone and the Windows CI job is retired (#174). The Stack Atlas
standard's `windows-ci` item for this repository read `blocked: owner-approval-required`
while the repository still held files its detector reads as Windows (`.ps1 .psm1 .psd1 .bat
.cmd .vbs .sln .vcxproj`, Stack-Atlas `standard/detect.mjs`): `agent-key.ps1` and three
stack-updates fixtures.

**What changed.**
- `scripts/agent-key.ps1` is deleted. `with-key.mjs` reads GNOME Keyring through
  `secret-tool` only: the DPAPI read through `node:ffi`, the PowerShell fallback, `keyPath`,
  `loadFfi`, `runPowerShell` and `POWERSHELL_TIMEOUT_MS` are gone. The key-name rule still
  holds before any read (`checkName`). On any platform other than Linux `readKey` fails with
  "the key store is read on Linux only (this is <platform>)"; the launcher then starts its
  program without the variable, as with any failed read. `key-header.mjs`: comments only.
- Tests: the Windows-only tests are gone; the launcher tests run on Linux with a stand-in
  `secret-tool`. New: off Linux no key is read and nothing else is tried. The two Windows
  process tests (the header helper; the firecrawl launcher hands the stored key to the
  hosted API only) are Linux tests now, with a stand-in keyring that holds one key.
- Fixtures in `scripts/fixtures/stack-updates/home/.local/bin`: `firecrawl.cmd`,
  `helper-key.ps1`, `odd-tool.exe` and `odd-tool.cmd` are `firecrawl`, `helper-key.sh`,
  `odd-tool` and `odd-tool.sh`; the ignored-twin test ignores `odd-tool.sh` and checks that
  `odd-tool` goes too.
- `recipes/keys.md`: Linux only; the helpers are four files.

**Verification.** `node scripts/check.mjs` passes; `npm test` on boat (see the pull request).
`git ls-files` lists no file with a detected Windows extension.

**Outstanding.**
- The Stack Atlas `windows-ci` item for claude-cookbook should now read `not-needed`. Owner:
  Claude, at the standard's next check of this repository. Clears: that reading.
- After the merge: copy `with-key.mjs` and `key-header.mjs` to `~/.local/bin` and prove a key
  through a copy (`recipes/keys.md`). `~/.local/bin/agent-key.ps1` does not exist on the
  laptop.

**Dead ends.** None.

**Evidence.** The pull request's checks and the boat test log in this chat's evidence
folder, `~/.local/share/claude-cookbook/evidence/linux-pages-2026-11-19/`.

**Left on purpose.** Harmless Windows lines with no Windows file behind them: `windowsHide`
on spawns, the letter-case rule of `dropVariable` for `win32`, `isMain`'s lower-casing of
paths, the `parallel-cli.exe` name in `parallel-secure.mjs` and its test, the `.exe`/`.cmd`
twin rule of the inventory (`SCRIPT_EXT`), in-test temporary names such as `git.exe`, and the
history in `HANDOFF.md`.

**From #179's review.** One low finding: the first sentence of `scripts/measure/tasks.json`'s
note still said every answer is shared by 0.28.4 and 0.30.2. It now speaks of set 2026-11-15
only; the set 2026-11-19 sentence stays the exception for L1-new-key.
