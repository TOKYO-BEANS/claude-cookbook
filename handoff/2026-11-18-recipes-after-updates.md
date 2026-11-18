# 18 November 2026: the recipes after two stack updates

**Why.** Two updates were installed on 18 November 2026 with the owner's yes: site-login's
`playwright-core` 1.65.0 to 1.65.1, with Chromium build 1255 (Chrome for Testing
159.0.8154.6) downloaded by the pinned copy's own installer, and the Cloudflare plugin 1.0.1
to 1.0.4. The stack-updates skill says a recipe that names the old version is updated.

**What changed.**
- `recipes/sign-ins-setup.md`: `playwright-core` 1.65.1; site-login's `npm test` runs 42
  tests (it said 20); a new bullet for an update that moves Playwright's Chromium revision:
  the download needs the owner's yes each time, even when the script marks the update
  routine (the yes of 18 November covered build 1255 only), then the install command, one
  `agent-browser goto` call, and only then the old builds to `~/.local/share/backups/`.
- `recipes/cloud-browser-setup.md`: Playwright's Chromium is a separate case beside a
  package whose own install script fetches a program (the Parallel CLI): site-login's lockfile
  has no install script, and the build comes from `cli.js install chromium` when
  `browsers.json` moves the revision.
- `skills/stack-updates/SKILL.md`: the `pinned` row names that download and its yes.
- `recipes/cloudflare.md`: the plugin's `cloudflare-one` skill (1.0.4) reads an Access
  service token "from the project's configured secret store or environment variables"; here
  that is the DPAPI store, and the token (two keys) goes only through `agent-browser access`,
  never an environment variable, a `.env` file or a command line, and only for a site listed in
  `site-login/access.json` (a new site needs the owner's yes). No page named plugin 1.0.1.

**Verification.** `node scripts/check.mjs`; `npm test` on boat. The API review was
unavailable on `ece85d4` (credit balance); its fallback review had three lows, fixed on the
branch: the Chromium download is not an install script, the cloudflare bullet lacked the
`access.json` limit, and the quotation left out "configured". The fallback review of
`616ba37` had two lows: `with-key.mjs` passes one key, so it was dropped as a route for the
two-key token, and the pull request's description was brought in line with the files. The
fallback review of `ece0907` had one low: the revision is now compared before
`pinned-install.sh`, and without a yes the install stops with the old copy kept.

**Outstanding.** None from this change.

**Evidence.** `~/.local/share/vetting/site-login-1.65.1/notes.txt` and `out/` (vetting,
Chromium install log, the real call, `npm test` 42 of 42, `verify`);
`~/.local/share/vetting/cloudflare-plugin-1.0.4/notes.txt`.
