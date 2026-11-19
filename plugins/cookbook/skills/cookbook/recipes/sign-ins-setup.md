# Sign-ins: setup and evidence

- **The browser:** Chromium from Playwright in `~/.local/share/ms-playwright`, with its own profile
  in `~/.local/share/site-login/profile`, headless unless started with `agent-browser start
  --headed`. It keeps running between commands and stops after 30 minutes without one. It listens
  on a local port that needs a token, both in `~/.local/state/site-login/agent-browser.json`
  (`0600`, its folder and the profile `0700`), and it opens no debugging port. The profile holds
  live sessions: treat the folder like a credential and never copy it.
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
- **The code** is `~/.local/share/site-login`, with `playwright-core` 1.65.1 and `postal-mime`
  4.2.0 from a lockfile. Its source is the repository `TOKYO-BEANS/sign-in-tools`, where `npm
  test` runs: `node install.mjs install` there copies the code here and writes the commands
  `agent-browser` and `google` in `~/.local/bin`, and `check` compares both.
- **When a `playwright-core` update moves the Chromium revision** (its `browsers.json`; 1.65.1
  moved 1254 to 1255, Chrome for Testing 159.0.8154.6), the browser does not start until the new
  build is downloaded. That download is a program the vetting did not cover, so it needs the
  owner's yes each time, even for an update the script marks routine (the yes of 19 November
  2026 covered 1255 for linux64 only). Before `pinned-install.sh`, compare the vetted copy's
  revision with the installed one; when it moved and there is no yes, stop and keep the old copy.
  With the yes, in `~/.local/share/site-login` after `pinned-install.sh`:
  `PLAYWRIGHT_BROWSERS_PATH=~/.local/share/ms-playwright PLAYWRIGHT_SKIP_BROWSER_GC=1 node
  node_modules/playwright-core/cli.js install chromium`, then one `agent-browser goto` call; only
  after it passes and `updates.mjs verify` exits 0, move the old `chromium-*` and
  `chromium_headless_shell-*` folders to `~/.local/share/backups/` (a rollback needs them).
- Vetted on 19 November 2026: the Linux `pass-cli` matched the checksum in Proton's own version
  list (Trivy and OSV-Scanner could not parse the PC's copy: no result, not a clean one). In the
  lockfile with `playwright-core` 1.65.1 (2 packages) OSV-Scanner and Trivy found no issue.
  Gitleaks marked two lines of it: the handoff of 19 November has them.
- Proven on the laptop on 19 November 2026: `agent-browser goto`, `status` and `stop`, and a
  vault login read through `pass-cli`. Not tried on Linux: `login` on a real site, `mail-link`
  and `access` (proven on the PC, 13 and 14 November). Never tried: a one-time code on a real
  site, a two-step sign-in, a forward from the owner's mailbox.
