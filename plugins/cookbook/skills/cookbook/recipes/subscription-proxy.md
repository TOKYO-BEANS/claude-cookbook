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
- **Always on:** the systemd user service `cliproxyapi` (`systemctl --user status|restart
  cliproxyapi`, log in `journalctl --user -u cliproxyapi`) runs `cliproxyapi start` while the
  owner is signed in to the desktop; the key store is locked otherwise. It restarts after a
  crash. `cliproxyapi status` answers whether it serves; `cliproxyapi panel` opens the console
  (management secret: Proton Pass, vault "Claude", item `key/cliproxyapi-management`, pasted
  into the login box, never on the clipboard or shown).
- **Routing as Theo's:** accounts in turn (`round-robin`), a session kept on one account for
  an hour (`session-affinity`, TTL `1h`: prompt caches are per account), `request-retry: 3`.
- **In T3 Code:** the provider instance "Claude (pool)" (`claudePool`) runs `claude-pool` as its
  binary, with the normal Claude home, so a thread can switch between "Claude" and "Claude
  (pool)". `claude-pool` takes the client key from the key store at run time; nothing in T3
  holds it. In a pooled session claude.ai connectors are off (Claude Code's own warning).
- **The keys, and the one exception** (owner, 18 November 2026): the proxy reads its client key
  only from `config.yaml` and keeps sign-ins as JSON files, so both may be plain files in the
  private folder (0700) and nowhere else. Each start makes a new client key, saved in the key
  store as `cliproxyapi-client`; `config.yaml` is deleted when the proxy stops. A restart makes
  open pooled threads fail with 401 until their session starts again.
- **Not set up:** T3's pooled-limits view (Usage providers, Add hub) and Codex through the
  proxy; the reasons are on the setup page. Several machines, Tailscale or linger are access
  changes and go to the owner first.

Where its files are, how it is hardened, an update and the open findings:
[setup and evidence](subscription-proxy-setup.md).
