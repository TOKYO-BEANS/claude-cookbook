# Scripted Claude Code runs: permission rules and limits

- File rules use `Edit(...)`, which also covers the Write tool; a `Write(path)` rule never matches. An
  absolute path starts with two slashes: `Read(//home/mk/dir/**)`.
- A Read rule also scopes Grep and Glob: under `dontAsk` with only `Read(//dir/**)` allowed, all
  three work inside the folder and are refused outside it (Claude Code 2.1.325 on Windows; 2.1.328
  on the laptop, 19 November 2026). A bare `Glob` or `Grep` in `--allowedTools` lets the run search
  every file the user can read.
- A Bash allow rule matches the command word for word. A run that phrases a command differently is
  denied and can still exit 0 having done nothing, so check the result, not the exit code.
- Under `acceptEdits`, add `--disallowedTools Bash` unless the run needs a shell: an `echo >>`
  into a file in the working folder went through outside the `Edit(...)` allow list (again on the
  laptop, 2.1.328; outside the working folder it was held).
- Files under a `.claude/` folder are protected: a headless run cannot edit them, even with an allow
  rule. Run self-editing skills interactively.
- Read `--output-format stream-json` to confirm the skill ran; tool calls, denials and errors are there.
- `--setting-sources project` does not keep the user's `~/.claude/CLAUDE.md` out (Claude Code 2.1.325,
  15 November 2026: a run named both rules files). A run that must not load it passes `--settings`
  with `claudeMdExcludes` naming that file; one cheap run that lists its instruction files proves it
  (`scripts/measure/measure.mjs probe` in the Cookbook repository).
- `dontAsk` honours every allow rule it loads: a run that keeps the user settings can call
  what they allow, with no `--allowedTools` at all. To let such a run call nothing without
  changing what the model sees, add a PreToolUse hook that exits 2 in its `--settings` (a deny
  rule or `--tools ""` takes the tools out of the context). `scripts/measure/servers.mjs` does it.
- Limits: `--setting-sources project,local` and `--strict-mcp-config` narrow what loads but do not
  isolate the run. Claude Code still writes its own files under the user profile (`~/.claude.json`
  backups, session-env folders). `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` was set on every run, but no run
  proved that it stops a memory save.
