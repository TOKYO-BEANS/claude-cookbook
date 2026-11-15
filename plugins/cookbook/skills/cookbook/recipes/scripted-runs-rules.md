# Scripted Claude Code runs: permission rules and limits

- File rules use `Edit(...)`, which also covers the Write tool; a `Write(path)` rule never matches. On
  Windows, write the path as `//c/...`.
- A Bash allow rule matches the command word for word. A run that phrases a command differently is
  denied and can still exit 0 having done nothing, so check the result, not the exit code.
- Under `acceptEdits`, add `--disallowedTools Bash PowerShell` unless the run needs a shell: in the
  test, `acceptEdits` let an `echo >>` append through outside the allow list.
- From Git Bash, start with `MSYS_NO_PATHCONV=1`, or `/skill-name` and `//c/` paths turn into Windows
  paths.
- Files under a `.claude/` folder are protected: a headless run cannot edit them, even with an allow
  rule. Run self-editing skills interactively.
- Read `--output-format stream-json` to confirm the skill ran; tool calls, denials and errors are there.
- Limits: `--setting-sources project,local` and `--strict-mcp-config` narrow what loads but do not
  isolate the run. Claude Code still writes its own files under the user profile (`~/.claude.json`
  backups, session-env folders). `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` was set on every run, but no run
  proved that it stops a memory save.
