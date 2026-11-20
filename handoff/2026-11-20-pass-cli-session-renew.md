# 20 November 2026: the Proton Pass CLI signs in again by itself

**Why.** The daily update check reported the Proton Pass CLI broken ("non-existent session").
Proton gives an agent session 2 hours and no setting makes it longer, so every use more than
2 hours after a sign-in failed until someone signed in by hand. The owner asked for a longer
sign-in.

**What changed.**
- The launcher `~/.local/bin/pass-cli` (not in a repository; the old one is in
  `~/.local/share/backups/pass-cli-launcher-20261120/`) runs `pass-cli info` before a command.
  When that fails, it signs in with the agent token from the key store (`with-key.mjs
  proton-pass PROTON_PASS_PERSONAL_ACCESS_TOKEN`), output discarded, one line on stderr if it
  fails. `login`, `logout`, help and version skip the check, so the owner's own web sign-in for
  a new token is untouched.
- `recipes/sign-ins-setup.md` says so in place of the sign-in-by-hand command.

**Verification.** `pass-cli info` exits 1 on an empty session folder and 0 on a live one. Through
the new launcher with an empty session folder, `pass-cli item list Claude` signed in and listed
the vault (exit 0); that test session was logged out. The real session works.

**Also in this chat.**
- CLIProxyAPI compared with Theo Browne's published setup (his gist and the T3 Code docs):
  his runs always-on on a home box with 7 Claude and 3 Codex accounts signed in, reached over
  Tailscale, with Claude Code pointed at it through `ANTHROPIC_BASE_URL`. Ours is installed but
  idle and local only, with no account signed in, and T3 Code is not pointed at it. Getting
  closer would take the owner's sign-ins and an access change (an always-on service, Tailscale),
  each asked first, and a key route that keeps the proxy key out of settings files.

**Outstanding.**
- Codex 0.170.0 -> 0.171.0: the owner said yes (20 November 2026). It was published
  20 November 00:51 UTC, inside the 24-hour hold. The install follows after 21 November
  00:51 UTC (owner: Claude, a scheduled wake of this chat).
- The launcher is machine state outside any repository; the next machine-setup inventory
  should carry it.

**Dead ends.** A longer session: `pass-cli` has no setting for it, and Proton's docs fix agent
and token sessions at 2 hours.

**Evidence.** The launcher and its backup in `~/.local/share/backups/pass-cli-launcher-20261120/`
(with the logged-out test session folder).
