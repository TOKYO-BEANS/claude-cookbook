# 26 November 2026: boat's key retired, sandbox-run follow-up

**Why.** The outstanding steps of `2026-11-26-depot-sandboxes.md` after #261 merged
(`40fce12`, release check verified), and the four low findings that pull request's reviews
left for a follow-up.

**What changed.** In `sandbox-run.mjs`:
- **A failed create:** when the sandbox is not found by name, the run looks three times,
  2 seconds apart. If it is still not found, the run says one may still be running and holds
  the run's most in the ledger under the sandbox's name.
- **No double count:** once the held line is in the ledger, the run's place holds 0, so the
  month's check no longer counts a run under way twice.
- **The old name:** `boat-run.mjs` keeps boat-run's default size, `small`, when no `--type`
  is given.
- **A test name:** one test was named for more than it checks, and now says what it checks.

Outside the repository:
- Plugin updated to `40fce12`.
- The boat API key is revoked (`boat api-key revoke`; boat now answers 401). It is deleted from
  the key store (`secret-tool clear`) and from the vault "Claude" (`key/boat`).
- `~/.local/share/boat`, `~/.local/share/boat-run` and the `~/.local/bin/boat` launcher moved
  to `~/.local/share/backups/boat-2026-11-26/`.
- With the owner's yes, a refund of the USD 29.96 wallet was asked of boat's support through
  `boat feedback` (it answered `{"ok":true}`). The reply goes to the boat account's address.

**Verification.** The suite through `sandbox-run.mjs` on this branch (counts in the pull
request). The installed plugin's hook denies `npm test` in the main checkout and names the
sandbox-run command, and its `boat-run.mjs --list` answers. No boat sandbox existed before the
cancel (`boat list --all` empty).

**Outstanding.**
- boat's plan ends 16 December 2026. The refund answer is the owner's to read.
- machine-setup's `GUIDE.md` still lists boat among a new machine's tools (line 94). That
  repository is another job; it was sent to a chat of its own.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-26-depot-sandboxes/`; the
release log `release-cookbook-<pr>-merge.log` there.
