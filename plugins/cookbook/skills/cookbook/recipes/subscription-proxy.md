# Several subscriptions through one proxy (CLIProxyAPI)

CLIProxyAPI pools Claude and Codex sign-ins behind one local address and shows each account's
limits in a console. Installed on the owner's yes (18 November 2026; on Linux since
19 November), ready but idle: no account is signed in, and nothing starts it on its own.

- **The risk is the owner's.** Toward Anthropic it poses as Claude Code (its user agent,
  headers and an injected system line). The author of the video that suggested it warns that
  accounts get banned, and a ban takes the owner's own Claude Code with it. A sign-in through it
  is the owner's step, never Claude's.
- **Start, sign in, use:** `cliproxyapi start` runs it in a terminal (Ctrl+C stops it);
  `cliproxyapi login claude` (or `codex`, `codex-device`) opens the provider's sign-in;
  `cliproxyapi panel` opens the console in the browser. The management secret is never put on
  the clipboard or shown: copy it in Proton Pass (vault "Claude", item
  `key/cliproxyapi-management`) and paste it into the login box. `cliproxyapi status` answers
  whether it is up; `claude-pool` is Claude Code through it, in a home of its own
  (`CLAUDE_CONFIG_DIR`), so the normal sign-in is never touched.
- **The key rules, and the one exception** (owner, 18 November 2026): the proxy reads its
  client key only from `config.yaml` and keeps sign-ins as JSON files, so both may be plain
  files in the private folder and nowhere else. The launcher makes a new client key on every
  start, saves it in the key store as `cliproxyapi-client` (`secret-tool store`, the value on
  stdin) for `claude-pool`, and deletes `config.yaml` when the proxy stops and before each
  start; one start or login runs at a time. The management secret is the store's
  `cliproxyapi-management` and reaches the proxy only as `MANAGEMENT_PASSWORD`.
- **Weighed:** EasyCLIProxyAPI, a desktop app around it: the proxy serves the same console,
  and the app rewrites agents' configs.
- **Several machines, Tailscale, an always-on box:** not set up. Each is an access change and
  goes to the owner first.

Where its files are, how it is hardened, an update and the open findings:
[setup and evidence](subscription-proxy-setup.md).
