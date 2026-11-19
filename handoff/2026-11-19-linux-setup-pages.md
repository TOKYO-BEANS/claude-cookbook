# 19 November 2026: the setup pages say what is on the Linux laptop

**Why.** The pages' "On this PC" facts still described the Windows install: `.cmd` shims that
decrypt DPAPI keys, `pass-cli.exe`, Proton's `install.ps1`, boat's installer and AppData. The
map's "Keys and tokens" row still named the DPAPI store.

**What changed.** Facts only; every rule and stop reads as before.
- The map and `options/reach-outside.md`: keys are in the OS key store (GNOME Keyring).
- `boat-setup.md`: the `boat` launcher, the pinned Linux binary with its `PROVENANCE.txt`, why
  the installer is never run, the upload list (not carried over: empty), the hook's escape.
- `sign-ins-setup.md`: `pass-cli` 2.7.1 for Linux, the agent `claude-linux`, its token's end
  (about 19 February 2027), `install.sh`.
- `cloud-browser-setup.md`, `google-setup.md`, `cloudflare.md`, `web-batch.md`,
  `codex-setup.md`, `ai-review.md`, `scripted-runs.md`, `visual-check-build.md`,
  `compaction.md`, `owner-questions.md`, `context-mode.md`: "DPAPI" and "shim" wording.
- `keys.md`: the Firecrawl pin's new `zod` override (4.6.7; 1.29.0 resolves to 3.25.76,
  GHSA-mrhx-c7xc-m3w5, high).

**Verification.** `node scripts/check.mjs` passes (every page within the 4,000-byte limit);
`npm test` passes. Each fact was read on the laptop: the three launchers in `~/.local/bin`,
the two `PROVENANCE.txt` files, the Firecrawl pin's `package.json`.

**Outstanding.** Left as they are, and why:
- The browser bullet of `sign-ins-setup.md` ("a token only this Windows user can read") and
  the rest of `google-setup.md`: the sign-in tools are being installed on Linux by another
  chat, which owns those facts.
- `scripted-runs-rules.md` (the `//c/` path rules, Git Bash) and the blast-radius note in
  `add-ons.md`: rules proven on Windows, not proven again on Linux.
- `security.md` and `safe-chain.md` (the Windows CI job): they change with that job's
  retirement, its own pull request.
- The boat-route hook's own message still names DPAPI and PowerShell as reasons for a local
  run; `boat-setup.md` keeps the escape's scope (only a run that cannot run in boat).
- The vetting pages (the "Windows binary" exemption from the sandbox run) and the update
  skill's install table: the next pull request of this job.

**Dead ends.** None.

**Evidence.** None beyond the pull request's checks: the facts are files on the laptop.
