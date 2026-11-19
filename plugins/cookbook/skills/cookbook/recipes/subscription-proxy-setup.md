# Several subscriptions through one proxy: setup and evidence

The install behind [the proxy's recipe](subscription-proxy.md), on Linux since 19 November 2026.

- **Where things are:** in `~/.local/share/cliproxyapi`: the binary in `bin` (the
  `linux_amd64_no-plugin` build), the template `config.template.yaml` (edit that, not the
  copy), and the folder `private` (mode 0700, its files 0600): `config.yaml` while it runs,
  sign-ins in `auths`, the console in `static`, `logs`, and `claude-home`. The launchers are
  this skill's `scripts/cliproxyapi.mjs` and `scripts/claude-pool.mjs`, copied to
  `~/.local/bin` beside `#!/bin/sh` files named `cliproxyapi` and `claude-pool`.
- **Hardened** (read in the 8.0.76 source): it listens on 127.0.0.1:8317 only, and that
  bind alone keeps other machines from the management API. The API and the management API
  refuse a call without their key; the build has no plugin loader; the model list is the
  built-in one. The console is a pinned copy, never fetched: the launcher refuses to start
  without it, and starts the proxy without the variables it acts on (remote stores, a GitHub
  token, another folder).
- **What it still does:** it reads two version files every 3 hours (Antigravity's on Google
  Cloud, xAI's on npm): no switch. A request that ends in an upstream error is written with
  its body to `private/logs` (the newest 10 kept). **A sign-in listens on every interface**
  while it waits, on port 54545 (Claude) or 1455 (Codex).
- **An update** is a full vetting ([connecting](connecting.md)): checksums, the three
  scanners, a code read of what changed, the sandbox run, the owner's yes for any open
  finding; stop the proxy, unpack the new `linux_amd64_no-plugin` archive into `bin`, then
  `cliproxyapi start` and `status`. The console is updated the same way (its GitHub release
  digest) when the proxy's notes ask for it.
- **Open findings**, accepted by the owner for 8.0.76 (19 November 2026; five of them on
  18 November): six dependency advisories, two high (`klauspost/compress`
  GHSA-259r-337f-4rfw, `golang.org/x/net` CVE-2026-78661). No release up to 8.0.79 fixes
  them; one that does is the time to update.
- **On this PC:** 8.0.76 and the console page v1.28.3; `PROVENANCE.txt` is beside `bin`, the
  vetting record is `~/.local/share/vetting/cliproxyapi-8.0.76/VETTING.md`. Proven on
  19 November 2026 through the launcher: it listened on 127.0.0.1:8317 only; the API answered
  401 without the key and 200 with it, the management API the same with its secret; a second
  start was refused; `config.yaml` (0600) was gone after the stop.
