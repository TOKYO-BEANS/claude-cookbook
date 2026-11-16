# Keys and tokens

One store, and helpers that read it. Checked on 16 November 2026.

- **The store** is `~/.secrets/<name>.dpapi`: each key encrypted with Windows DPAPI for this
  user, in a folder only this user and SYSTEM can open. `~/.local/bin/agent-key.ps1` keeps it:
  `-Mode list`, `status -Name x` and `self-test` are safe to run; `save -Name x` opens a
  masked window for a new or rotated key. Run it with Windows PowerShell 5.1
  (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`). Never ask for a key in
  chat, and never put one in a file, an environment variable or a command line.
- **A program gets a key at run time only:**
  `node ~/.local/bin/with-key.mjs <name> <ENV_VAR> <program> [args]`. The launcher prints no
  key. It ends with the program's exit code, 128 plus the signal's number after a signal,
  127 when the program could not start.
- **A header for an MCP client** (`headersHelper`, Codex's `http_headers_helper`):
  `"C:/Program Files/nodejs/node.exe" C:/Users/<user>/.local/bin/key-header.mjs <name>`
  prints `{"Authorization":"Bearer ..."}`. It is the one helper that prints a key: a client
  reads the helper's stdout. Never run it in a shell whose output is shown: it refuses a
  console window, but cannot tell an agent's shell from a client. It prints only the keys
  its source lists (now `firecrawl`); a new name is a pull request. A script that needs a
  key in its own process imports `readKey` from `with-key.mjs`.
- **The direct read starts no PowerShell** (64-bit Windows with `node:ffi`: Node 26,
  experimental): the helpers call `CryptUnprotectData` themselves. The PC's security
  software scans every PowerShell script block, and while many processes start each scan
  can wait 30 seconds; a read through `agent-key.ps1` crosses several. In a 60-second
  burst: 61 and 87 seconds through PowerShell, 0.4 to 1.7 direct. Elsewhere, and after any
  failure of the direct read, a saved key is read through `agent-key.ps1 -Mode headers`,
  ended after 15 seconds.
- **A key that cannot be read does not stop the program.** `with-key.mjs` says why on
  stderr (`with-key: could not read key "x" (...)`) and starts it without the variable, on
  purpose: a server must start to answer "no key" (the owner-questions broker does). A
  value the caller had under that name is removed. `key-header.mjs` prints nothing, says
  `key-header: could not read key ...` and ends with code 1.
- **The `firecrawl` command** hands the stored key only to the commands its launcher
  lists, for `https://api.firecrawl.dev`. A setup command (`env`, `init`, `launch`, ...) or
  an unknown option before the command starts without it, with one line on stderr. Every
  start turns the CLI's self-update off. After an update of the pin, read its
  `--help` against the launcher's lists.
- **Any other PowerShell call can stall the same way.** Give it a time limit, keep it out
  of a path that runs often, and never change the security software's settings.
- **Where the helpers live.** This skill's `scripts/`: `with-key.mjs`, `key-header.mjs`,
  `agent-key.ps1`, and the launchers `firecrawl-secure.mjs` and `parallel-secure.mjs`.
  Tests: `scripts/with-key.test.mjs`, `scripts/key-header.test.mjs`. Callers use the copies
  in `~/.local/bin`, which stay put when the plugin updates; the other three `.mjs` files
  import `with-key.mjs` from their own folder. After a change: merge it, copy all five,
  then prove it with a real call through a copy: a program that needs the key answers,
  and stderr has no `with-key:` line.
