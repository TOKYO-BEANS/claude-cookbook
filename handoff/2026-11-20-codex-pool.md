# 20 November 2026: Codex through the pooled proxy, no literal key

**Why.** Follow-up to #190 and #191: the owner's Codex account was signed in to the proxy but
nothing used it. Theo Browne's setup puts the client key in `~/.codex/config.toml`
(`experimental_bearer_token`), which the key rule forbids.

**What changed.**
- `scripts/codex-pool.mjs` (copied to `~/.local/bin` beside a `#!/bin/sh` `codex-pool`): reads
  `cliproxyapi-client` from the key store at run time into `CLIPROXYAPI_CLIENT_KEY` of the Codex
  process only, and gives the provider as `-c` overrides (`model_provider="cliproxyapi"`,
  `base_url` 127.0.0.1:8317/v1, `env_key`, `wire_api="responses"`, `supports_websockets=true`).
  `config.toml` is not changed; the plain `codex` keeps its own sign-in. It drops
  `OPENAI_API_KEY`, `CODEX_API_KEY`, `OPENAI_BASE_URL`, and refuses `login`/`logout`.
- No separate `CODEX_HOME`: T3 joins Codex threads by home (`continuationKey
  codex:home:<home>`), and the home holds the MCP servers, hooks and AGENTS.md, as with
  `claude-pool`. The env-key provider never reads `auth.json`.
- T3: provider instance `codexPool` ("Codex (pool)", driver `codex`, `setupMode: existing`,
  binary `~/.local/bin/codex-pool`) in `~/.t3/userdata/settings.json`. No key in T3.
- Tests `scripts/codex-pool.test.mjs` (7); recipe, setup page, map row, catalog, model-budget page.
- Follow-up to the AI review's low on #193: the `login`/`logout` guard finds the subcommand
  after Codex's global options and their values (`codex-pool -c x=1 logout` is refused).

**Verification.** `codex-pool exec` answered through the proxy (POST `/v1/responses` 200,
session affinity miss then hit); websockets on and off both work; a delegated T3 turn on
"Codex (pool)" (gpt-6-luna) answered "ok" through the proxy; an unlisted model fails with
"unknown provider for model"; `auth.json` and `config.toml` hashes unchanged throughout.

**Outstanding.**
- T3 shows Codex's own model list for "Codex (pool)", not the proxy's: pick a listed one.
- One Codex account: a limit hit has nowhere else to go (more accounts are the owner's step).

**Dead ends and failures.** No approach was dropped. GNOME Keyring aborted at 10:58:56 (assertion in
`gkd_secret_service_get_pkcs11_session`) and came back locked, so every chat's key reads hung
until the owner unlocked it (11:14:42). It coincided with the first `codex-pool` start (Codex
reads its MCP OAuth tokens from the keyring) and a `gh` call from another chat; the cause is
not established. If it happens again, note what ran at that second.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-codex-pool/` (`notes.txt`,
hashes, journal lines); T3 settings backup
`~/.local/share/backups/t3-settings.json.before-codex-pool-2026-11-20`.
