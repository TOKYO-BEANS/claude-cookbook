# 20 November 2026: stack updates of the day, and four commands ignored

**What changed.** The on-demand update check of 20 November listed nothing routine
(`apply.routine` empty). With the owner's yes (question dialog, 20 November 2026), these
were installed tonight, each about 3 to 22 hours after its release. The owner chose "now" for
each, which overrides the 24-hour wait for these four only:
- Codex CLI 0.170.0 -> 0.171.0 (pinned copy): `pinned-vet.sh` clean (OSV, Gitleaks and Trivy
  found nothing; the sandbox asked only the registry), `pinned-install.sh`, `verify` exit 0, a
  `codex-pool exec` answer through the proxy. Same global options, so `codex-pool.mjs` is unchanged.
- Browserbase `browse` 0.11.4 -> 0.12.0 (pinned copy): the same medium advisory and the same 11
  Gitleaks strings as 0.11.4, nothing new; `verify` exit 0.
- Depot CLI 2.103.28 -> 2.103.33: `mise use -g` (checksum sha256), `verify` exit 0.
- CLIProxyAPI 8.0.76 -> 8.0.80: a full vetting, recorded in
  `~/.local/share/vetting/cliproxyapi-8.0.80/VETTING.md`. The owner accepted the same six
  advisories again for 8.0.80 (second dialog). Service restarted; status 200; `verify` exit 0.
- `catalog.json` `ignored`: `bat`, `fd` and `python` (links to Ubuntu's apt programs) and
  `proton-mail.py` (the skill script's copy). `artcraft` and `codex-pool` were already covered by
  the current catalog; the report ran on an older plugin. The seven npm globals the owner kept on
  19 November stay listed, as decided.

**Verification.** `findUnlisted` with this catalog lists only those seven globals. `npm test`
on boat: 749 tests, 745 pass, 0 fail, 4 skipped.

**Outstanding.** mise 2026.11.11: the owner chose to wait for the 24 hours, which end on
21 November at 15:20 UTC. A once-task in the update chat installs it after that. The Cookbook
plugin is updated after this merge. REA cli 6.10.1 becomes routine on 21 November, and
Firecrawl CLI 1.30.0 on 22 November. The daily runs list them.

**Dead ends.** None.

**Evidence.** `~/.local/share/stack-updates/evidence/2026-11-20/`, the `~/.local/share/vetting/`
folders `codex-cli-0.171.0`, `browserbase-cli-0.12.0` and `cliproxyapi-8.0.80`, and the 8.0.76
binary in `~/.local/share/backups/cliproxyapi-8.0.76/`.
