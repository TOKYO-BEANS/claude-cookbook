# 20 November 2026: CLIProxyAPI always on this laptop, a pooled Claude in T3

**Why.** The owner's choice of 20 November 2026 (chat "CLI-Proxy Setup Comparison"): run the
proxy always on, close to Theo Browne's published setup, on this laptop only and without
Tailscale; the iPhone's T3 Connect chats run on this laptop.

**What changed.**
- `scripts/cliproxyapi.service`: a systemd user unit that runs `cliproxyapi start` under
  `graphical-session.target` (no linger: the key store is unlocked only while the owner is
  signed in), `Restart=always`, `UMask=0077`, `KillMode=mixed`, and an `ExecStopPost` that
  deletes `config.yaml` after a launcher that was killed. The launcher is unchanged, so its
  hardening holds: key store, 0700 folder, a new client key per start, the config deleted on
  stop. Installed in `~/.config/systemd/user` and enabled.
- The installed template got Theo's `routing` block: `round-robin`, `session-affinity` with
  TTL `1h`, `retry.request-retry: 3`, `max-retry-interval: 30` (8.0.76 reads the v8 layout).
- `claude-pool.mjs` no longer sets a Claude home of its own and no longer sets a 077 mask: T3
  reads a thread's history from the home it set for the instance, and threads switch only
  between instances with the same home. With the normal home the pooled instance keeps the
  owner's hooks, plugins and memory; the sign-in stored there is unused and unchanged.
- T3: provider instance `claudePool` ("Claude (pool)", driver `claudeAgent`, binary
  `~/.local/bin/claude-pool`) in `~/.t3/userdata/settings.json`. No key in T3.
- Recipe, setup page, catalog, the map row and the model-budget page say "always on".

**Verification.** `node --test scripts/cliproxyapi.test.mjs` passes (20). As a service:
127.0.0.1:8317 only; 401 without or with a wrong key, 200 with it; management API the same;
the routing read back from the management API; a manual start refused; a new key per start;
`config.yaml` gone after a stop and after the launcher was killed, the service back in 10 s;
no key in the journal. A pooled `claude-pool -p` reached the proxy (400, no account) and left
`~/.claude/.credentials.json` unchanged. T3 listed "Claude (pool)" with its models.

**Outstanding.**
- No account is signed in: the owner's step (`cliproxyapi login claude`, one per account).
  Then a pooled turn in T3, and a look at the cache reads per Theo's note on affinity.
- T3's hub view of the pooled limits is not set up: T3 keeps a hub's management secret as a
  plain file in its secret store or as a 1Password reference, never from the key store. It
  would need an exception to the key rule (owner); the console shows the same limits.
- Codex through the proxy is not built (Theo's `config.toml` holds a literal key; `env_key`
  with a launcher would not). When Codex accounts are signed in.
- A restart of the service makes open pooled threads fail with 401 until their session
  restarts (the key is new per start).
- The two high dependency advisories stay open upstream (update check).

**Dead ends.** `systemctl --user kill -s SIGKILL` as a crash test also kills the
`ExecStopPost` command; a kill of the launcher's PID is the real case and passes.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-cliproxyapi-always-on/`
(`proof-run.txt`, `proof.mjs`, `notes.txt`).
