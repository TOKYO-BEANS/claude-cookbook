# 20 November 2026: T3 shows the pooled limits (the proxy's hub)

**Why.** The owner asked that the pool behave as in Theo's setup, limits inside T3 included.

**Owner's answer, 20 November 2026 (question dialog):** "Yes, add the hub view". This reverses
the earlier "No, use the console" and adds a second exception to the key rule: T3 keeps the
proxy's management secret in its own secret store.

**What changed.** T3 settings: `usageLimitSources.cliproxy-127.0.0.1-8317` (label "CLIProxy
(this laptop)", URL `http://127.0.0.1:8317`, key `"••••••"`). The secret is
`~/.t3/userdata/secrets/usage-limit-source-<base64url id>.bin`, 0600, written from the key
store item `cliproxyapi-management` by a script that never printed it. Backup of the settings
before: `~/.local/share/backups/t3-settings.json.before-hub-2026-11-20`. Pages
`subscription-proxy.md` and `subscription-proxy-setup.md` say so.

**Verification.** T3's server trace: `UsageLimitSources.readSource`, `CliproxyApi.readAccounts`,
`.credits` and `.publish` all exited Success. The proxy's journal: `GET
/v0/management/auth-files` and three `POST /v0/management/api-call` answered 200.

**Outstanding.**
- The secret is a copy: a new management secret means writing the T3 file again.
- One Claude and one Codex account: pooling has nothing to rotate until a second account of a
  kind is signed in (the owner's step).

**Dead ends.** None.
