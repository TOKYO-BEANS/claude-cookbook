# Several subscriptions through one proxy: setup and evidence

The install behind [the proxy's recipe](subscription-proxy.md), on Linux since 19 November 2026,
always on since 20 November.

- **Where things are:** in `~/.local/share/cliproxyapi`: the binary in `bin` (the
  `linux_amd64_no-plugin` build), the template `config.template.yaml` (edit that, not the copy;
  its `routing` block is Theo's), and `private` (0700, files 0600): `config.yaml` while it runs,
  sign-ins in `auths`, the console in `static`, `logs`. The launchers are this skill's
  `scripts/cliproxyapi.mjs` and `scripts/claude-pool.mjs`, copied to `~/.local/bin` beside
  `#!/bin/sh` files of the same names; the unit is `scripts/cliproxyapi.service`, copied to
  `~/.config/systemd/user` and enabled under `graphical-session.target` (no linger).
- **Hardened** (read in the 8.0.76 source): it listens on 127.0.0.1:8317 only, which alone
  keeps other machines from the management API. Both APIs refuse a call without their key; no
  plugin loader; the built-in model list. The console is a pinned copy, never fetched. The
  launcher starts the proxy without the variables it acts on; the unit adds `UMask=0077` and an
  `ExecStopPost` that deletes `config.yaml` after a launcher that was killed.
- **What it still does:** it reads two version files every 3 hours (Antigravity's on Google
  Cloud, xAI's on npm): no switch. A request that ends in an upstream error is written with its
  body to `private/logs` (the newest 10 kept). The journal gets one line per request (status,
  path), no key. **A sign-in listens on every interface** while it waits (54545 Claude, 1455
  Codex).
- **T3's pooled limits, not set up:** T3 needs the management secret for a hub, and keeps it
  either as a plain file in its own secret store (`~/.t3/userdata/secrets`) or as a 1Password
  reference; it has no GNOME Keyring or command source. That secret also reads the sign-in
  files through the management API. The console shows the same limits.
- **Codex through the proxy, not set up:** Theo's `config.toml` holds the key as a literal;
  Codex's `env_key` with a launcher like `claude-pool` would not. Build it when Codex accounts
  are signed in.
- **An update** is a full vetting ([connecting](connecting.md)); then `systemctl --user stop
  cliproxyapi`, unpack the new archive into `bin`, `systemctl --user start cliproxyapi`,
  `cliproxyapi status`. The console the same way when the proxy's notes ask for it.
- **Open findings**, accepted by the owner for 8.0.76 (19 November 2026): six dependency
  advisories, two high (`klauspost/compress` GHSA-259r-337f-4rfw, `golang.org/x/net`
  CVE-2026-78661). No release up to 8.0.79 fixes them; one that does is the time to update.
- **On this PC:** 8.0.76 and the console v1.28.3; `PROVENANCE.txt` beside `bin`; vetting record
  `~/.local/share/vetting/cliproxyapi-8.0.76/VETTING.md`. Proven 20 November 2026 as a service:
  127.0.0.1:8317 only; 401 without or with a wrong key, 200 with it; the routing read back from
  the management API; a manual start refused; a new key per start; `config.yaml` gone after a
  stop and after the launcher was killed; T3 listed "Claude (pool)" with its models.
