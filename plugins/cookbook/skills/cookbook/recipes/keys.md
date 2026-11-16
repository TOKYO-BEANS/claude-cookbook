# Keys and tokens

One store, two helpers. Checked on 16 November 2026.

- **The store** is `~/.secrets/<name>.dpapi`: each key encrypted with Windows DPAPI for this
  user, in a folder only this user and SYSTEM can open. `~/.local/bin/agent-key.ps1` keeps it:
  `-Mode list`, `status -Name x` and `self-test` are safe to run; `save -Name x` opens a
  masked window for a new or rotated key. Run it with Windows PowerShell 5.1
  (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`). Never ask for a key in
  chat, and never put one in a file, an environment variable or a command line.
- **A program gets a key at run time only:**
  `node ~/.local/bin/with-key.mjs <name> <ENV_VAR> <program> [args]`. The key is in that
  program's environment and nowhere else.
- **A header for an MCP `headersHelper`:** `node ~/.local/bin/with-key.mjs --headers <name>`
  prints `{"Authorization":"Bearer ..."}`. Never run it in a shell whose output is shown.
- **The read starts no PowerShell.** `with-key.mjs` calls Windows' `CryptUnprotectData`
  itself, through `node:ffi` (Node 26; experimental there). The reason: the PC's security
  software scans every PowerShell script block, and while many processes start (a test
  suite, many `git` calls) each scan can wait 30 seconds. A read through `agent-key.ps1`
  crosses several. Measured during a 60-second burst of process starts: 61 and 87 seconds
  through PowerShell, 0.4 to 1.7 seconds direct.
- **The fallback** is `agent-key.ps1 -Mode headers`, used where `node:ffi` is missing (an
  older Node). It is ended after 15 seconds, and the launcher says why on stderr:
  `with-key: could not read key "x" (...)`. The program then starts without its variable,
  as before; `--headers` ends with code 1 instead.
- **Any other PowerShell call can stall the same way.** Give it a time limit, and keep
  PowerShell out of a path that runs often. Never change the security software's settings:
  raise a recommendation to the owner.
- **Where the helpers live.** Their source is this skill's `scripts/with-key.mjs` and
  `scripts/agent-key.ps1`, with tests in `scripts/with-key.test.mjs`. Callers use the copies
  in `~/.local/bin`, a path that does not move when the plugin updates. After a change to
  either file: merge it, copy both to `~/.local/bin`, then prove it with one real call
  (`node ~/.local/bin/with-key.mjs --headers <name>` with its output discarded, exit code 0).
