# 27 November 2026: Claude jobs in Depot sandboxes on the plan token

**The owner's answer.** In the laptop-memory chat (after #281), question dialog, 27 November
2026: "we put the claude subscription token on Depot then, and use opus 5.5 high". It
overturns the 20 November answer ("Claude jobs: not on Depot"): Claude jobs may run in Depot
sandboxes with the plan token, Opus 5.5 at high effort, to spare the laptop's memory.

**What changed.**
- `sandbox-run.mjs --claude`: reads the key-store key `claude-depot` in its own process and
  sends it as `CLAUDE_CODE_OAUTH_TOKEN` with the job's command only (`RunCommand`'s `env`;
  proved by a probe: an unknown field such as `environment` is ignored without an error). Not
  with the sandbox, the unpack step or `--vet`. The token is masked in the output, also when
  it is split across pieces.
- `sandbox-claude.mjs`: the one-shot job. Claude Code at this laptop's version, one locked-down
  `claude -p` (Opus 5.5 high, listed tools, `dontAsk`, no settings, no MCP, no saved session,
  a budget cap, `env -i`), ended at its first event unless `apiKeySource` is `none`. Back
  come the event stream, the error output and a patch, unpacked only under their three names,
  scanned by Gitleaks, never applied by the script; a run whose files hold the token sends
  nothing back.
- Pages: new `recipes/sandboxes-claude.md`; `recipes/sandboxes.md` (the whole-thread bullet
  corrected, `--claude`, the token as the one standing credential exception);
  `recipes/scripted-runs.md`; `options/sandboxes.md`; the Depot entry in `catalog.json`.
- The token: made by the owner with `claude setup-token` (subscription account) through T3's
  secret card, saved as the vault note `key/claude-depot` and in the key store; both copies
  checked equal by hash, the card's file deleted. Never shown.

**Verification.** A real job from this worktree (read a page, run a command, write a file):
20 s here, the sandbox 14.3 s at 2 vCPU, USD 0.0014 by Depot's record; `claude-opus-5-5`,
`apiKeySource` `none`, 4 turns, USD 0.05 at list rates on the plan; the patch held exactly the
new file; the token was in none of the returned files. Here the job's two Node processes
peaked at 83 MB. Tests: `scripts/sandbox-claude.test.mjs` and the `--claude` tests in
`scripts/sandbox-run.test.mjs`; the suite in a Depot sandbox (see the pull request).

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-claude-jobs-on-depot/`
(the proof run's `summary.json`, `changes.patch`, the env probe). Release log: the
`sa-release` run of this pull request.

**Dead ends.** Depot's host-bound secrets (the value stays outside, a gateway fills it in)
exist only for Managed Runs connections; the Claude Code connection needs a Claude Team or
Enterprise plan (Depot's docs, 27 November 2026). Weigh again when plain sandboxes get them.

**Outstanding.** A whole T3 chat in a sandbox (a T3 linked environment) needs a sandbox that
lives as long as the chat: a recurring cost (`small` USD 0.36 an hour) and the token held for
hours. Asked of the owner in the chat that made this entry; the answer goes in the next entry.
