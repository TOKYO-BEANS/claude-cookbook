# 19 November 2026: CLIProxyAPI and its launchers on Linux

**Why.** The two launchers ran only on Windows (`cli-proxy-api.exe`, PowerShell to save the
client key and to hold the clipboard, `cmd.exe /c start`, `claude.exe`), and the proxy itself
was not on the Ubuntu laptop.

**What changed.**
- `cliproxyapi.mjs`: the Linux binary; the client key saved with `secret-tool store` (the
  value on stdin, never an argument or a variable) and read back; the private folder made
  0700 with a 077 mask for everything the launcher and the proxy write, `config.yaml` and the
  lock 0600; `panel` opens the console with `xdg-open`.
- No clipboard: nothing on the desktop marks a copy as one a clipboard manager must not keep.
  `panel` says where the management secret is (Proton Pass, vault "Claude", item
  `key/cliproxyapi-management`); the owner copies it there and pastes it into the login box.
- From the code read of 8.0.76: the launcher drops every variable the proxy acts on, in any
  case (the proxy reads lower-case spellings too); the template must hold the placeholder
  exactly once; no start without the pinned console (the proxy would download one) or beside a
  `.env` (the proxy would load it).
- `claude-pool.mjs`: `~/.local/bin/claude`, a 077 mask for its separate home.
- The recipe is split: `subscription-proxy.md` and `subscription-proxy-setup.md` (files,
  hardening, what the proxy still does, updates, open findings). The catalog's update note
  names the Linux archive.

**The install.** 8.0.76, asset `linux_amd64_no-plugin` (no plugin loader at all), console page
v1.28.3. Full vetting: checksums against `checksums.txt` and GitHub's digests, the three
scanners, a code read, one boat sandbox run under the probe. Owner, 19 November 2026, question
dialog: "Install, accept the six" (six open dependency advisories, two high; five were
accepted on 18 November; no release up to 8.0.79 fixes them).

**Verification.** `npm test` passes. A proof run through the installed launcher: it listened
on 127.0.0.1:8317 only; the API answered 401 without a key and with a wrong one, 200 with the
client key; the management API the same with its secret; the client key was new; a second
start was refused; after Ctrl+C the config and the lock were gone and nothing answered. The
update check reads "CLIProxyAPI 8.0.76". It is idle: not running, no account signed in.

**Outstanding.**
- The two high advisories are open upstream: update when a release fixes them (owner:
  Claude, at the update check).
- A sign-in listens on every interface while it waits (54545 or 1455), and an upstream error
  is logged with its request body in the private folder: both are in the setup page. The
  sign-in is the owner's step.
- `claude-pool` against the running proxy was not run (no account is signed in); its two
  process tests use a stand-in keyring and a stand-in Claude Code.

**Dead ends.** A clipboard route that keeps the secret out of clipboard history: no clipboard
tool is installed, and the packaged `wl-clipboard` cannot mark a copy as secret.

**Evidence.** `~/.local/share/vetting/cliproxyapi-8.0.76/VETTING.md` (scanner reports, the code
read and the sandbox log in `out/`);
`~/.local/share/claude-cookbook/evidence/2026-11-19-linux-scripts-and-pages/cliproxyapi-proof-run.txt`.
