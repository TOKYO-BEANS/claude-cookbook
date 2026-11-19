# 19 November 2026: Codex's headers helper reaches the keyring

**Why.** Codex's `firecrawl` MCP server never connected on the laptop: every Codex start
logged "MCP HTTP headers helper exited with status 1". Codex starts an
`http_headers_helper` with a cleared environment (a probe helper saw only HOME, LANG,
LOGNAME, PATH, PWD, SHELL and USER), so `secret-tool` had no `DBUS_SESSION_BUS_ADDRESS`
and could not reach GNOME Keyring. Claude Code passes its environment through, so its
`firecrawl` server worked.

**What changed.** `with-key.mjs` (which `key-header.mjs` imports) has `sessionBusEnv`: on
Linux, when `DBUS_SESSION_BUS_ADDRESS` is unset and `/run/user/<uid>/bus` is a socket
owned by this user, `secret-tool` is started with `unix:path=/run/user/<uid>/bus`. A set
address is kept; no socket, a socket of another user, or no user id leaves the
environment as it was. Two tests in `scripts/with-key.test.mjs`; one line in
`recipes/keys.md`.

**Verification.** Before the merge, with `env -i PATH=/usr/bin:/bin HOME=...`: the
installed `key-header.mjs firecrawl` ended with 1, the branch's copy with 0 (stdout
discarded). `with-key.test.mjs` and `key-header.test.mjs` on boat: 36 pass, 6 skipped
(Windows only), 0 fail. The after-merge proof (copies in `~/.local/bin`, a fresh
`codex exec` with no helper failure for `firecrawl`) is recorded in the step-8 chat.

**Outstanding.** None for this fix. Codex's three Cloudflare servers (owner's OAuth) and
the dead n8n entry belong to the step-8 chat.
