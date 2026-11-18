# 18 November 2026: CLIProxyAPI installed, idle

**Why.** The owner asked for CLIProxyAPI to be set up "in case I'm gonna need it", after a video
on pooling Claude and Codex subscriptions behind one proxy.

**What changed.**
- Vetted 8.0.76 (v8.0.77 was inside the 24-hour hold): checksums against `checksums.txt` and the
  GitHub asset digests, Gitleaks, OSV-Scanner, Trivy, and a read of the code. No sandbox run:
  the Windows binary exemption. A Linux run was tried twice as extra evidence, and boat's API
  answered 500, then timed out.
- Owner, 18 November 2026, question dialog: "Install now, hardened" (the five dependency
  findings accepted for this install; a sign-in through it is the owner's step and risk), and
  "Exception, owner-only folder" (its config and sign-in files may be plain files, only in
  `~/.local/share/cliproxyapi/private`).
- Installed: the binary in `~/.local/share/cliproxyapi/bin`, a config template, the private
  folder (owner and SYSTEM only), two DPAPI entries, and the launchers `cliproxyapi` and
  `claude-pool` in `~/.local/bin` (sources in the skill's `scripts/`). The Cookbook gets a map
  row, the catalog entry, `recipes/subscription-proxy.md` and a version command.

**Verification.** A live run on the PC, 18 November 10:51: it listened on 127.0.0.1:8317 only.
Without the key the API answered 401, and with it 200. The management API answered 401 without
the secret and 200 with it. `claude-pool -p` reached `/v1/messages` and got "unknown provider"
because no account is signed in. The launcher deleted `config.yaml` on stop.
`node scripts/check.mjs` passes.

**Outstanding.**
- No account is signed in. The owner does that with `cliproxyapi login claude` when needed.
- The two high dependency advisories (`klauspost/compress`, `golang.org/x/net`) are open
  upstream. Update when a release fixes them (owner: Claude, at the next update check).
- Two version checks run every 3 hours with no off switch. They are recorded, not blocked.

**Evidence.** `~/.local/share/vetting/cliproxyapi-8.0.76/VETTING.md`, with the scanner output
and the first start log in `out/`.
