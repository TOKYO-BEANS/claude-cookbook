# Keys and tokens

One store, and helpers that read it. Checked on 16 November 2026.

- **The store** is `~/.secrets/<name>.dpapi`: each key encrypted with Windows DPAPI for this
  user, in a folder only this user and SYSTEM can open. `~/.local/bin/agent-key.ps1` keeps it:
  `-Mode list`, `status -Name x` and `self-test` are safe to run; `save -Name x` opens a
  masked window for a new or rotated key. Run it with Windows PowerShell 5.1
  (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`). Never ask for a key in
  chat, and never put one in a file, an environment variable or a command line.
- **A program gets a key at run time only:**
  `node ~/.local/bin/with-key.mjs <name> <ENV_VAR> <program> [args]`. The key is in that
  program's environment and nowhere else; the launcher prints none. It ends with the
  program's exit code, 128 plus the signal's number when a signal ended the program, 127
  when the program could not start.
- **A header for an MCP client** (`headersHelper` in Claude Code, `http_headers_helper` in
  Codex): `"C:/Program Files/nodejs/node.exe" C:/Users/<user>/.local/bin/key-header.mjs <name>`
  prints `{"Authorization":"Bearer ..."}`. It is the one helper that prints a key, because
  the client reads the helper's stdout. Never run it in a shell whose output is shown; it
  refuses a terminal. A script that needs a key in its own process imports `readKey` from
  `with-key.mjs` and prints nothing.
- **No read starts PowerShell.** The helpers call Windows' `CryptUnprotectData` themselves,
  through `node:ffi` (Node 26; experimental there). The reason: the PC's security software
  scans every PowerShell script block, and while many processes start (a test suite, many
  `git` calls) each scan can wait 30 seconds. A read through `agent-key.ps1` crosses
  several. Measured during a 60-second burst of process starts: 61 and 87 seconds through
  PowerShell, 0.4 to 1.7 seconds direct.
- **The fallback** is `agent-key.ps1 -Mode headers`, used where `node:ffi` is missing (an
  older Node). It is ended after 15 seconds, and the helper says why on stderr:
  `with-key: could not read key "x" (...)`.
- **A key that cannot be read does not stop the program.** `with-key.mjs` starts it without
  the variable, on purpose: a server started this way must start to answer "no key" (the
  owner-questions broker does). A value the caller already had under that name is removed.
  `key-header.mjs` prints nothing and ends with code 1.
- **Any other PowerShell call can stall the same way.** Give it a time limit, and keep
  PowerShell out of a path that runs often. Never change the security software's settings:
  raise a recommendation to the owner.
- **Where the helpers live.** Their source is this skill's `scripts/`: `with-key.mjs`,
  `key-header.mjs`, `agent-key.ps1`, and the launchers behind two commands,
  `firecrawl-secure.mjs` and `parallel-secure.mjs`. Tests: `scripts/with-key.test.mjs` and
  `scripts/key-header.test.mjs`. Callers use the copies in `~/.local/bin`, a path that does
  not move when the plugin updates; the four `.mjs` files import `with-key.mjs` from their
  own folder, so they are copied together. After a change to any of them: merge it, copy all
  five to `~/.local/bin`, then prove it with one real call through a copy: a program that
  needs the key answers, and stderr has no `with-key:` line.
