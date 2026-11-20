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
- #182's two low review findings: `recipes/photos.md` now carries PhotoCraft's line (installed
  for the owner's editing, its update check off, the owner's condition); the duplicate "a new
  high finding goes to the owner" in the LightCraft lines is kept once. `recipes/connecting-load.md`
  names OpenSEO and Wix only, and the register's Aikido row says it is on in no project on the
  laptop (the Windows `settings.local.json` files did not move).

**Verification.**
- `node --test scripts/model-budget.test.mjs`: 70 of 70. The real script on the laptop still
  reads T3 Code's saved reading.
- #181 after its merge and `claude plugin update` (06e9c63, 00:54 CET): the first new session
  (a minimal `claude -p` run) was told "opus", where every session since 22:28 UTC had been
  told "unknown".

**Outstanding.** None known.

**Dead ends.** Refusing whenever `nsswitch.conf` names `sss`: it would have refused on this
very laptop, where sssd is installed and off.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-audit-findings/`:
`model-budget-sessions-after.txt`, `release-cookbook-181-merge.log`.
