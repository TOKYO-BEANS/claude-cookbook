# Several subscriptions through one proxy (CLIProxyAPI)

CLIProxyAPI pools Claude and Codex sign-ins behind one local address and shows each account's
limits in a console. Installed on 18 November 2026 on the owner's yes, ready but idle: no
account is signed in, and nothing starts it on its own.

- **The risk is the owner's.** Toward Anthropic it poses as Claude Code (its user agent,
  headers and an injected system line). The author of the video that suggested it warns that
  accounts get banned, and a ban takes the owner's own Claude Code with it. A sign-in through it
  is the owner's step, never Claude's.
- **Start, sign in, use:** `cliproxyapi start` runs it in a window (Ctrl+C stops it);
  `cliproxyapi login claude` (or `codex`, `codex-device`) opens the provider's sign-in;
  `cliproxyapi panel` opens the console and puts the management secret on the clipboard;
  `cliproxyapi status` answers whether it is up; `claude-pool` is Claude Code through it, in a
  home of its own (`CLAUDE_CONFIG_DIR`), so the normal sign-in is never touched.
- **Where things are:** the binary in `~/.local/share/cliproxyapi/bin`, the config template
  beside it (edit that, not the copy), and the private folder `~/.local/share/cliproxyapi/private`,
  which only the owner and SYSTEM can open. The launchers are this skill's
  `scripts/cliproxyapi.mjs` and `scripts/claude-pool.mjs`, copied to `~/.local/bin` with `.cmd`
  shims.
- **The key rules, and the one exception** (owner, 18 November 2026): the proxy reads its
  client key only from `config.yaml` and keeps sign-ins as JSON files, so both may be plain
  files in the private folder and nowhere else. The launcher writes a new client key on every
  start (also saved in the DPAPI store as `cliproxyapi-client` for `claude-pool`) and deletes
  `config.yaml` when the proxy stops. The management secret is the store's
  `cliproxyapi-management` and reaches the proxy only as `MANAGEMENT_PASSWORD`.
- **Hardened:** it listens on 127.0.0.1:8317 only; the API and the management API refuse a
  call without their key; plugins are off; the model list is the built-in one; the console is
  a pinned copy and is never fetched again. While running it still checks two version files
  every 3 hours (Antigravity's on Google Cloud, xAI's on npm): no switch turns them off.
- **An update** is a full vetting ([connecting](connecting.md)): checksums, the three scanners,
  a code read of what changed, the owner's yes for any open finding; stop the proxy, unpack the
  new `windows_amd64` zip into `bin`, then `cliproxyapi start` and `status`. The console is
  updated the same way (its GitHub release digest) when the proxy's notes ask for it.
- **Open findings**, accepted by the owner for 8.0.76: five dependency advisories (two high,
  in `klauspost/compress` and `golang.org/x/net`). A release that fixes them is the time to
  update.
- **Weighed:** EasyCLIProxyAPI, a desktop app around it: the proxy serves the same console,
  and the app rewrites agents' configs.
- **Several machines, Tailscale, an always-on box:** not set up. Each is an access change and
  goes to the owner first.
