# 19 November 2026: keys on Linux, and the plugin's hooks run there

**Why.** The owner's PC moved from Windows to Ubuntu 26.04 on 19 November 2026. On Linux the key
helpers read only the Windows DPAPI store, so no program got a key, and the plugin's hooks did
not run: five called `C:/Program Files/nodejs/node.exe`, and the model-budget gate was sourced
with `.` in `/bin/sh` (dash), which fails on its bash syntax after every tool call.

**What changed.**
- `with-key.mjs` (and so `key-header.mjs` and the two launchers) reads a key on Linux from the
  desktop keyring: `secret-tool lookup service claude-keys name <name>`, ended after 15 seconds.
  The name rule is checked first; a failure says which (no item, `secret-tool` missing, no
  answer, another exit) and never repeats what `secret-tool` printed. Windows is unchanged.
- `hooks.json`: the five hooks run `node`, and the gate runs with `bash`.
- `recipes/keys.md` describes the Linux store; `recipes/codex-setup.md` says the hook runs
  `node` from `PATH`.
- Tests: four new Linux tests in `scripts/with-key.test.mjs` (route and arguments, name rule,
  each failure, the launcher as a process against a stand-in `secret-tool`). Tests of the DPAPI
  file now pass `platform: "win32"`; tests that start a launcher as a process put a stand-in
  `secret-tool` (answers "no item") first on `PATH`, so they never read the real keyring and
  run the same in CI without `libsecret-tools`.

**Review.** The AI review of `ab0f6b2` (on the plan) found three lows, all fixed on the next
head: an exit 1 from `secret-tool` with an error on stderr (no D-Bus session, no unlocked
keyring) now says the key store could not be reached instead of "no key is saved" (stderr is
captured, never shown); `parallel-secure.mjs` starts `vendor/parallel-cli/parallel-cli` off
Windows (its install script unpacks `parallel-cli.exe` only there), and its test expects that
name per platform; the gate tests run the gate as `hooks.json` now does (`bash <gate> <root>`).

**Verification.** On the Linux laptop: the key and hook test files pass (with-key and
key-header 34 pass, 6 skipped Windows-only; model-budget, owner-questions and codex-start-check
150 pass), then the full `npm test`: 687 tests, 680 pass, 7 skipped (Windows only), 0 fail,
in 6 seconds.

**Outstanding.**
- After the merge: copy the five helpers to `~/.local/bin` and prove a key through a copy
  (`recipes/keys.md`, "Where the helpers live").
- Other Windows-only pages and scripts (PowerShell, `agent-key.ps1`, `.cmd` shims, the
  Windows CI job) are a later pull request; retiring the Windows CI job has the owner's yes of
  18 November 2026.

**Dead ends.** Set aside before trying: letting the process tests use the real keyring. On
the owner's laptop they would read real keys, and in CI (no `libsecret-tools`) they would fail
on a different message. The stand-in `secret-tool` on `PATH` avoids both.

**Evidence.** The test logs of this change are not kept; the suite's result is in the pull
request's checks. The keyring setup is recorded in the owner's private setup guide.
