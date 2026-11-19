# Keys and tokens

One store, and helpers that read it. Linux since 19 November 2026.

- **The store** is the desktop keyring (GNOME Keyring, Secret Service): one item per key with
  the attributes `service claude-keys` and `name <name>`, label `key/<name>`. Every key comes
  from the Proton Pass vault "Claude" (`key/<name>` notes, field `note`), piped from `pass-cli
  item view` into `secret-tool store` and read back, never shown ([sign-ins](sign-ins.md)).
  Names only: `secret-tool search --all service claude-keys`, filtered to `attribute.name`
  lines (the command prints values too). Never ask for a key in chat, and never put one in a
  file, an environment variable or a command line.
- **A program gets a key at run time only:**
  `node ~/.local/bin/with-key.mjs <name> <ENV_VAR> <program> [args]`. The launcher prints no
  key. It ends with the program's exit code, 128 plus the signal's number after a signal,
  127 when the program could not start.
- **A header for an MCP client** (`headersHelper`, Codex's `http_headers_helper`):
  `/usr/bin/node /home/<user>/.local/bin/key-header.mjs <name>`
  prints `{"Authorization":"Bearer ..."}`. It is the one helper that prints a key: a client
  reads the helper's stdout. Never run it in a shell whose output is shown: it refuses a
  console window, but cannot tell an agent's shell from a client. It prints only the keys
  its source lists (now `firecrawl`); a new name is a pull request. A script that needs a
  key in its own process imports `readKey` from `with-key.mjs`.
- **How it reads:** on Linux `secret-tool lookup` (package `libsecret-tools`), ended after
  15 seconds (a locked keyring waits on a prompt). On Windows the old DPAPI store
  (`~/.secrets`, `agent-key.ps1`) is still read, for the Windows CI job's tests.
- **A key that cannot be read does not stop the program.** `with-key.mjs` says why on
  stderr (`with-key: could not read key "x" (...)`) and starts it without the variable, on
  purpose: a server must start to answer "no key" (the owner-questions broker does). A
  value the caller had under that name is removed. `key-header.mjs` prints nothing, says
  `key-header: could not read key ...` and ends with code 1.
- **The `firecrawl` command** hands the stored key only to the commands its launcher
  lists, for `https://api.firecrawl.dev`. A setup command (`env`, `init`, `launch`, ...) or
  an unknown option before the command starts without it, with one line on stderr. Every
  start turns the CLI's self-update off. After an update of the pin, read its
  `--help` against the launcher's lists. The pin (`firecrawl-cli` 1.29.0 in
  `~/.local/share/firecrawl-cli`, `npm ci --ignore-scripts`) overrides `zod` to 4.6.7 since
  19 November 2026: 1.29.0 resolves to 3.25.76 (GHSA-mrhx-c7xc-m3w5, high, fixed in 4.6.6).
  Drop the override once the CLI resolves to a fixed version.
- **Where the helpers live.** This skill's `scripts/`: `with-key.mjs`, `key-header.mjs`,
  `agent-key.ps1`, and the launchers `firecrawl-secure.mjs` and `parallel-secure.mjs`.
  Tests: `scripts/with-key.test.mjs`, `scripts/key-header.test.mjs`. Callers use the copies
  in `~/.local/bin`, which stay put when the plugin updates; the other three `.mjs` files
  import `with-key.mjs` from their own folder. After a change: merge it, copy all five,
  then prove it with a real call through a copy: a program that needs the key answers,
  and stderr has no `with-key:` line.
