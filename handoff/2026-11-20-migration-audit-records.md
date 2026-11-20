# 20 November 2026: the migration audit's Cookbook findings, recorded and fixed

**Why.** The independent migration audit of 20 November 2026 (five auditors, each gap checked
again by a second agent) named seven Cookbook findings. The model budget fault is #181. This
entry holds the others; each was checked again on the laptop before any change, and each check
had a second, adversarial reader.

**What changed.**
- **The Claude API key's example** (`recipes/scripted-runs.md`): the caption script it named
  existed only on the Windows PC, is in no repository, and was never run on an image. The page
  now points at the visual check's judge, which runs on the same key with all four parts of the
  pattern. The rule sentences are word for word as before. The script was not written again: no
  job needs captions.
- **The `cf` CLI** (`recipes/cloudflare.md`, the map row, the catalog reason, the connector
  register): not installed, and now said so. Like Wrangler it is pinned per project; no project
  here has a `cloudflare.config.ts`; npm's `latest` tag is a 1.0.0 release candidate (22 stable
  0.x releases exist). The page names the plugin's `npm install --global cf` as not the route.
- **The 24-hour rule** (`recipes/connecting.md`): the owner's standing exception of 20 November
  2026, in line with the machine rules: Ubuntu's own updates, snap apps, the apt apps from the
  added sources and the self-updating apps (T3 Code, Claude Code) update with no wait; npm, uv,
  mise and GitHub releases wait.
- **Apps installed through apt** (`recipes/update-check-routine.md`): the update check reads no
  apt or snap package, so the browser (Helium, the laptop's default since 19 November) and the
  other apt apps need no catalog or `ignored` entry; the app list and the apt sources belong to
  the `machine-setup` repository. `recipes/cloud-browser-rules.md`: `browse --local` needs a
  Chrome or Chromium on `PATH`, and the laptop has none.
- **Plugins switched on per project** (`recipes/seo.md`, `recipes/connecting-load.md`, the
  register): both site projects now switch OpenSEO (and the first site Wix) on in a tracked
  `.claude/settings.json`, so a T3 worktree thread has it too.
- **The update check:**
  - OpenSEO was "broken" because the check lists MCP servers in its own folder, where the
    plugin is off. Proven: in a folder whose `.claude/settings.json` switches it on, `claude
    mcp list` shows `plugin:openseo:openseo ... ✔ Connected`. That file is now in
    `~/.local/share/stack-updates/.claude/` (written by hand, recorded in
    `recipes/update-check.md`). The catalog part keeps its `server`: the check stays a real one.
  - `ts-rust` was "missing": the first site keeps the trial in `checks/tsc-rs-trial`, not in the
    root lockfile. A project part may now name that folder (`"path"`); `scripts/check.mjs`
    and `lib/inventory.mjs` accept only a plain relative folder. Tests:
    `scripts/stack-updates-project-path.test.mjs` (new) and three assertions in
    `scripts/check.test.mjs`.
  - The Shopify CLI was "missing" only because its pinned copy (5.0.2) came forty minutes after
    the 19 November run: no change.
- **The owner's Windows apps on Linux** (owner, 20 November 2026: all five wanted). Catalog
  entries for PhotoCraft, yt-dlp, eSpeak NG and Grammarly; version-table rows for the first
  two (`lib/tables.mjs`, with samples in `scripts/stack-updates-inventory.test.mjs`).
  - **PhotoCraft 0.23.1**: installed at `~/.local/share/photocraft`, launchers in
    `~/.local/bin`, a menu entry with absolute paths and no file types, and its in-app update
    check off (`~/.config/photocraft/preferences.json`): a copy in the home folder can replace
    itself, which would skip the vetting. Vetting: the one high advisory (lopdf, the PDF
    reader) is the one the owner accepted on 17 November on the condition "never a PDF or a
    file from outside"; the Linux binaries do not even carry lopdf. Sandbox run quiet.
  - **Video Grabber** (1.0.0.0, most likely Auslogics Video Grabber): Windows only, no Linux
    build. Its stand-in is **yt-dlp 2026.10.26** (a `uv tool`, locked at the 24-hour cut-off,
    scanned and run once in a sandbox). No ffmpeg yet, so formats that need merging wait.
  - **Grammarly**: no Linux app. The browser extension in Helium, which the owner adds and
    signs in to.
  - **eSpeak NG**: Ubuntu's own apt package; not installed yet (it needs the owner's password).
  - **ArtCraft Studio 0.41.1**: a signed Linux build exists and was vetted, and it is not
    installed: it carries high and critical advisories no acceptance covers (rustls-webpki
    0.103.9 in the binary; axios, `@remix-run/router` and others in the web front end), sends
    Microsoft Clarity session recording by default, and keeps every key and session in plain
    text under `~/Artcraft/credentials`.
  - **Upscayl 2.15.0**: a Linux build exists; not wanted (tested and not adopted on Windows),
    and it needs a Vulkan GPU this laptop's integrated Radeon may not give.
- **Hook commands by name** (finding 6): no change. The nine commands in `hooks/hooks.json` start
  `node` and `bash` by name. Every `PATH` measured on the laptop (T3 Code, the Claude Code
  sessions, the desktop session, a bare `env -i`) holds `/usr/bin`, where both are, with
  nothing ahead of them. Claude Code's own plugin example starts its interpreter by name, and
  on the CI runner Node is not in `/usr/bin`. Whether the rule "absolute paths in hooks" covers
  this shipped file is the owner's to say (Outstanding); the closed `HANDOFF.md` read it as
  covering it on Windows (lines 578-583, 1287).

**Verification.** `node --test scripts/stack-updates-project-path.test.mjs
scripts/check.test.mjs`: 42 of 42; `node scripts/check.mjs` passes, every touched page under
4,000. The full `npm test` is this pull request's CI. After the merge and the plugin update:
the next run of the check (the 07:00 timer) shows no broken connection, `ts-rust/dependency`
read at 0.8.0 and an empty `missing`.

**Outstanding.**
- Finding 6: whether the absolute-path rule covers the plugin's own `hooks.json`. Owner: the
  owner (asked in the chat that closes the audit's Cookbook findings). Clears with the answer:
  "yes" means a launcher that finds Node, since a fixed path fails on the runner; "no" means
  this entry stands.
- ArtCraft Studio: install it with its advisories accepted, or not. Owner: the owner (the
  same chat). Clears with the answer; the vetted copy and the install command are in
  `~/.local/share/vetting/artcraft-0.41.1/NOTES.md`.
- eSpeak NG and ffmpeg: one `sudo apt install espeak-ng ffmpeg` from Ubuntu's archive. Owner:
  Claude, with the owner's password through the secure card (it timed out at night). Clears
  with that one command.
- Not measured: the `PATH` the Claude desktop app gives a hook (installed, never opened).
- The `cf` CLI: a new `cf` project needs `cf` before it has a `package.json`; that day the
  install question returns with a job behind it.

**Dead ends.**
- Dropping OpenSEO's `server` from the catalog (the first proposal): it would have turned a
  real check into "unchecked". The settings file keeps the check.
- `"installed": { "kind": "none" }` for `ts-rust`: it ends the false "missing" but says nothing
  is installed and could never say the trial is behind.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-audit-findings/`:
`item2-caption.md`, `item3-cf-cli.md`, `item5-helium-apt.md`, `item6-hook-paths.md`,
`item7-update-check.md` (each with its second check). `~/.local/share/vetting/`:
`photocraft-0.23.1/`, `artcraft-0.41.1/`, `yt-dlp-2026.10.26/` (each `NOTES.md` with its
second check, the scanner outputs and the sandbox log).
