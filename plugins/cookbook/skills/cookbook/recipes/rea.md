# Reverse engineering (REA)

- Use REA when a claim depends on shipped software whose source you don't have: a vendor binary or
  .NET assembly, an Electron or JavaScript app, an installer or archive, a database file, a saved
  HAR/SAZ capture. Typical jobs: how a closed system stores or exports its data, what changed between
  two versions of an app, how a feature in someone's product works before building your own.
- Not for a repository you have the source of (Graphify, `rg`), for reading live web pages (Firecrawl),
  or for anything you are not authorized to examine. REA's own disclaimer rules out bypassing DRM,
  licence checks, anti-cheat or authentication, and copying protected code.
- Follow the `reverse-engineer-anything` skill: route by target type, take the summary first, cite
  Evidence IDs, and keep observed, inferred and unknown apart. Close native sessions with
  `close_binary`. Decompiled output can be wrong: check consequential conclusions against a second
  kind of evidence.
- Static before runtime. Browser capture, process capture, Frida and adb run or attach to the target.
  Use them only when static evidence cannot answer, and ask first before touching a live third-party
  system (logins and licence pools count) or a production machine.
- Work on copies. Open a live SQLite database only through a quiescent backup snapshot. REA runs
  locally, but its results go to the model: keep credentials and personal data out of what you open.
- Native decompilation needs a provider (Ghidra, IDA or Hopper). Ghidra is free, but REA accepts only
  the Ghidra line its `rea doctor --provider ghidra` names (12.1.x for 6.8.0 and 6.9.0, not the newer 12.2), with
  a full JDK 21 or newer. Check `binary_session` with `{}` first; without a provider, say so and use
  the static PE/ELF tools (imports, exports, resources, certificates). Commercial providers must be
  properly licensed; REA grants no licence.
- The first call on a new binary imports it into Ghidra and can take a minute or two. Wait for it
  instead of repeating the call; later calls in the same session are fast.
- Register one exact version (`rea-agents@<version>`), never `@latest`. Before applying REA's own
  `setup --client claude_code`, review its `--dry-run` plan. To update, install the new exact version,
  run a dependency scan, rerun setup, then restart Claude Code.
- The `rea` server (229 tool names) is registered per project, not at user scope. In a folder that needs it: `claude mcp add-json -s local rea "$(cat
  ~/.local/share/rea/claude-mcp.json)"`, then a new session. The `rea` command line works without it.
