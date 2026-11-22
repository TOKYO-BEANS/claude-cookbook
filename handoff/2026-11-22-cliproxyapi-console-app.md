# 22 November 2026: the proxy's console as an app

**Why.** The owner asked how they had opened the console and signed in to it, and for an app
that makes it easy.

**What changed.** `scripts/cliproxyapi-console.desktop` ("CLIProxyAPI Console" in the app grid)
runs `cliproxyapi.mjs panel` from `~/.local/bin`. Started without a terminal, `panel` also shows
its lines as a desktop notification (`notify-send`), the note on where the secret is included;
the secret is never in it. "Not running" now names `systemctl --user start cliproxyapi`. The
login is unchanged: the management secret is copied in Proton Pass and pasted in. Installed on
this laptop: the launcher in `~/.local/bin` (backup
`~/.local/share/backups/cliproxyapi.mjs.2026-11-22`) and the app in
`~/.local/share/applications`.

**Verification.** `desktop-file-validate` clean; the proxy tests 25 of 25; the Cookbook check
passed; `gio launch` of the installed app opened the console with the service active.

**Outstanding.** None.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-22-cliproxyapi-console-app/verify.txt`.
