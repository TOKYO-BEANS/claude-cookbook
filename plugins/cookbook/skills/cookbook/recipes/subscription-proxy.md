# Several subscriptions through one proxy (CLIProxyAPI)

CLIProxyAPI pools Claude and Codex sign-ins behind one local address and shows each account's
limits in a console. Since 20 November 2026 it is always on, on this laptop only, close to Theo
Browne's published setup (owner's choice; no Tailscale: the iPhone's T3 Connect chats run here).

- **The risk is the owner's.** Toward Anthropic it poses as Claude Code. Accounts can be banned,
  and a ban takes the owner's own Claude Code with it. A sign-in is the owner's step, never
  Claude's: `cliproxyapi login claude` (or `codex`, `codex-device`) in a terminal, one account
  at a time. Beside the running service a login uses its proxy's config, and the proxy picks
  the new account up without a restart.
- **Theo's rules hold:** Claude subscriptions only in Claude Code through the proxy; never anyone
  else's traffic; a home connection, not a VPN, an exit node or a datacenter address (checked
  20 November 2026: Wi-Fi, no exit node). A laptop away from home sends from where it is.
- **Antigravity** (owner's yes, 22 November 2026; not in Theo's guide): Gemini only, its Claude
  models excluded (`oauth-excluded-models`). Google's terms name proxy use as grounds for
  suspension.
- **Always on:** the systemd user service `cliproxyapi` (`systemctl --user status|restart
  cliproxyapi`, log in `journalctl --user -u cliproxyapi`) runs `cliproxyapi start` while the
  owner is signed in to the desktop; the key store is locked otherwise. It restarts after a
  crash. `cliproxyapi status` answers whether it serves; the app "CLIProxyAPI Console" or
  `cliproxyapi panel` opens the console (management secret: Proton Pass, vault "Claude", item
  `key/cliproxyapi-management`, pasted in, never on the clipboard or shown).
- **Routing as Theo's:** accounts in turn (`round-robin`), a session kept on one account for
  an hour (`session-affinity`, TTL `1h`: prompt caches are per account), `request-retry: 3`.
- **In T3 Code:** "Claude (pool)" (`claudePool`) runs `claude-pool` with the normal Claude
  home, so a thread can switch to and from "Claude". The client key comes from the key store
  at run time, never from T3. In a pooled session claude.ai connectors are off.
- **Codex:** `codex-pool` is Codex through the proxy, and T3's "Codex
  (pool)" (`codexPool`, existing CLI) runs it with the normal Codex home. The client key goes
  in one variable named by `env_key`, the provider in `-c` overrides: `config.toml` unchanged,
  so plain `codex` keeps its sign-in. It refuses `login` and `logout`. A model the proxy
  does not list (`cliproxyapi status`) fails: "unknown provider for model".
- **The keys, and the two exceptions** (owner, 18 and 20 November 2026; the second is T3's
  hub, below): the proxy reads its client key only from `config.yaml` and keeps sign-ins as
  JSON files, so both may be plain files in the private folder (0700) and nowhere else. Each start makes a new client key, saved in the key
  store as `cliproxyapi-client`; `config.yaml` is deleted when the proxy stops. A restart makes
  open pooled threads (Claude or Codex) fail with 401 until their session starts again.
- **T3's pooled limits** (Usage providers, hub `cliproxy-127.0.0.1-8317`): set up 20 November
  2026 on the owner's yes, a second exception: T3 keeps the management secret in its own
  secret store (0600). Several machines, Tailscale or linger: access changes, owner first.

Where its files are, how it is hardened, an update and the open findings:
[setup and evidence](subscription-proxy-setup.md).
