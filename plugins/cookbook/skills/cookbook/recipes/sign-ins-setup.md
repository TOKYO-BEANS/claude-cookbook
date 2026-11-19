# Sign-ins: setup and evidence

- **The browser:** Chromium from Playwright in `~/.local/share/ms-playwright`, with its own profile
  in `~/.local/share/site-login/profile`, headless unless started with `agent-browser start
  --headed`. It keeps running between commands and stops after 30 minutes without one. It listens
  on a local port that needs a token only this Windows user can read, and it opens no debugging
  port. The profile holds live sessions: treat the folder like a credential and never copy it.
- **On this PC:** `pass-cli` is a pinned copy (2.7.1 for Linux) in `~/.local/share/proton-pass-cli`,
  with its session folder beside it and update checks off (the `#!/bin/sh` launcher sets both);
  `PROVENANCE.txt` there has the source, the checksum and how to update. Never run Proton's
  `install.sh` or `pass-cli update`. The agent is `claude-linux`; its token is the key-store key
  `proton-pass` and expires about 19 February 2027. To sign the CLI in
  again: `PROTON_PASS_SESSION_DIR=<that session folder> node ~/.local/bin/with-key.mjs proton-pass
  PROTON_PASS_PERSONAL_ACCESS_TOKEN <that folder>/pass-cli login`. A new token needs the owner:
  `pass-cli login` prints a Proton address the owner opens and confirms (being signed in to the
  Proton Pass web app is not enough), then `pass-cli agent create <name> --expiration 3m --vault
  Claude`, with the token saved straight into the key store and the owner's own session
  logged out again.
- **The code** is `~/.local/share/site-login` (`login.mjs`, `inbox.mjs`, `daemon.mjs`, `cli.mjs`
  and the Worker in `inbox/`, with `playwright-core` 1.65.1 and `postal-mime` 4.2.0 from a
  lockfile); `npm test` there runs 42 tests against a local form and made-up mails. Its source is
  the repository `TOKYO-BEANS/sign-in-tools`, whose `install.mjs` copies it here.
- **When a `playwright-core` update moves the Chromium revision** (its `browsers.json`; 1.65.1
  moved 1254 to 1255, Chrome for Testing 159.0.8154.6), the browser does not start until the new
  build is downloaded. That download is a program the vetting did not cover, so it needs the
  owner's yes each time, even for an update the script marks routine (the yes of 18 November
  2026 covered 1255 only). Before `pinned-install.sh`, compare the vetted copy's revision with
  the installed one; when it moved and there is no yes, stop and keep the old copy. With the yes,
  in `~/.local/share/site-login` after `pinned-install.sh`:
  `PLAYWRIGHT_BROWSERS_PATH=~/.local/share/ms-playwright PLAYWRIGHT_SKIP_BROWSER_GC=1 node
  node_modules/playwright-core/cli.js install chromium`, then one `agent-browser goto` call; only
  after it passes and `updates.mjs verify` exits 0, move the old `chromium-*` and
  `chromium_headless_shell-*` folders to `~/.local/share/backups/` (a rollback needs them).
- Vetted on 12 and 13 November 2026: the `pass-cli` download matched the checksum in Proton's own
  version list and carries a valid Proton AG signature; Trivy 0.76.2 and OSV-Scanner 2.7.0 could
  not parse the closed binary, which is no result, not a clean one. OSV-Scanner found no issue in
  the lockfile (2 packages).
- Proven on 13 November 2026: `agent-browser login` signed in to one site from the vault (a plain
  user name and password form), and the session was still there after the browser was stopped and
  started again. `mail-link` read a real verification mail sent to the inbox and opened its link,
  and the mail was gone from the inbox afterwards. Not yet tried: a one-time code on a real site, a
  two-step sign-in, and a mail forwarded from the owner's mailbox.
