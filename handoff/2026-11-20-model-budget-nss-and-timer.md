# 20 November 2026: the model budget's group check asks whether a directory answers; #182's two lows; the update check's first timed run

**Why.** The AI review of #181 left one low finding: `soleGroup` reads only `/etc/passwd` and
`/etc/group`, but user and group lookups go through NSS, which may also ask a directory
(sssd, LDAP, winbind). There a group could have members the flat files do not show. This
laptop's `nsswitch.conf` lists `files systemd sss` for both, with sssd installed (Ubuntu's
default) and inactive, with no domain.

**What changed.**
- `model-budget.mjs`: before reading the flat files, `nsswitch.conf` must name `files` for
  `passwd` and `group`, and no source but `files` and `systemd`; `sss` counts only while sssd's
  lookup socket (`/var/lib/sss/pipes/nss`) is absent. Any other source, sssd running or no
  `nsswitch.conf` means "not the user's alone", and the 664 file is refused as before #181.
- `scripts/model-budget.test.mjs`: the account helper writes its own `nsswitch.conf` and socket
  path; eight new cases (Ubuntu's default with sssd off, sssd running, LDAP, winbind behind an
  action, a commented source, no group line, `files` missing, no file).
- #184's own two low review findings: `systemd` counts as a local source only while its user
  database can add no member (no file in `/etc/userdb`, `/run/userdb`, `/usr/lib/userdb`, and
  no systemd-homed socket); two more test cases. The register's Aikido row no longer says a
  session starts its processes "there".
- #182's two low review findings: `recipes/photos.md` now carries PhotoCraft's line (installed
  for the owner's editing, its update check off, the owner's condition); the duplicate "a new
  high finding goes to the owner" in the LightCraft lines is kept once. `recipes/connecting-load.md`
  names OpenSEO and Wix only, and the register's Aikido row says it is on in no project on the
  laptop (the Windows `settings.local.json` files did not move).
- The two open points of #182, answered by the owner on 20 November 2026 (question dialog):
  - **ArtCraft Studio 0.41.1**: "Install, no own keys". Installed from the vetted copy at
    `~/.local/share/artcraft` (binary SHA-256 809e87c3…, as vetted), a launcher in
    `~/.local/bin` and a menu entry with absolute paths; a catalog entry. Its advisories are
    accepted for this app; no API key of ours goes into it, since it keeps keys in plain text.
  - **Hook commands by name**: "No: plugin hooks by name". Recorded in
    `handoff/2026-11-20-hook-commands-by-name.md`, with a test.
- eSpeak NG 1.52.0 and ffmpeg 8.0.1 installed from Ubuntu's archive (one `sudo apt-get
  install`, the password through the secure card, its file deleted after). yt-dlp can now save
  formats that need merging.

**Verification.**
- `node --test scripts/model-budget.test.mjs`: 70 of 70. The real script on the laptop still
  reads T3 Code's saved reading.
- #181 after its merge and `claude plugin update` (06e9c63, 00:54 CET): the first new session
  (a minimal `claude -p` run) was told "opus", where every session since 22:28 UTC had been
  told "unknown".

- The update check's first run by its own timer: `stack-updates-daily.timer` fired at 07:00:52
  CET on 20 November 2026 (no one started it), the service ran in systemd's bare environment
  and ended `Result=success`, exit 0, in 27 seconds (13.8 s CPU, 405 MB peak). The run used the
  plugin with #182: OpenSEO is among the working connections (the settings file in the
  check's folder), `ts-rust/dependency` read 0.8.0 from its trial folder, and `missing` is
  empty. The two daily timers both fired (backup lists 06:30:52).

**Outstanding.**
- The 07:00 report names one new broken connection, the Proton Pass CLI ("failed to
  authenticate: non-existent session"). Not part of this job; it is the update report's to
  act on. Owner: Claude, with the stack-updates skill. Clears when the CLI's session answers.

**Dead ends.** Refusing whenever `nsswitch.conf` names `sss`: it would have refused on this
very laptop, where sssd is installed and off.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-audit-findings/`:
`model-budget-sessions-after.txt`, `release-cookbook-181-merge.log`,
`release-cookbook-182-merge-2.log`, `stack-updates-0700-result.json`, `stack-updates-0700-report.md`,
`stack-updates-0700-journal.txt`.
