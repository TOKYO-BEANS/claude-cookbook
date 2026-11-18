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
- `recipes/cloud-browser-setup.md`: Playwright's Chromium is the second case of a package
  whose own installer fetches a program, beside the Parallel CLI.
- `skills/stack-updates/SKILL.md`: the `pinned` row names Playwright's Chromium and its yes.
- `recipes/cloudflare.md`: the plugin's `cloudflare-one` skill (1.0.4) reads an Access
  service token from "the project's secret store or environment variables"; here that is the
  DPAPI store, through `agent-browser access` or `with-key.mjs`, never a saved environment
  variable, a `.env` file or a command line. No page named Cloudflare plugin 1.0.1.

**Verification.** `node scripts/check.mjs`; `npm test` on boat.

**Outstanding.** None from this change.

**Evidence.** `~/.local/share/vetting/site-login-1.65.1/notes.txt` and `out/` (vetting,
Chromium install log, the real call, `npm test` 42 of 42, `verify`);
`~/.local/share/vetting/cloudflare-plugin-1.0.4/notes.txt`.
