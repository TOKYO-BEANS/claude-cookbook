# 19 November 2026: the catalog says how the tools are installed on Linux

**Why.** The first update check on the Ubuntu laptop compared Git with Git for Windows, told
the owner to use winget and an elevated PowerShell, and listed 57 things as "not in the
Cookbook": the dev toolbox of 18 November, four language-server plugins and npm globals that
Windows kept outside `~/.local/bin`.

**What changed.**
- How existing parts are installed and updated: Git (Ubuntu's apt package, no feed), the
  GitHub CLI and Node (apt, from their own repositories, with the owner's password), Depot's
  CLI and the three scanners (mise), Semgrep (`uv tool`, with a minimum age).
- New tools, by the catalog's own rule (a tool of the stack owns a job or is the route for
  one): **mise**, **uv** and **rustup** (how everything else is installed without root),
  **Language servers** (four Claude Code plugins behind the `LSP` tool) and **ast-grep**.
  `code-navigation.md` has the last two; `connecting.md` has the install routes. Version
  commands for mise, uv, rustup and ast-grep.
- `ignored`, with a reason each: linters, runtimes, the Rust toolchain's binaries, the
  language servers' own binaries, general utilities (act, difftastic, dive, duckdb, lazygit,
  watchexec, yq), npm globals from the Windows inventory, `t3`, `ollama`, and Aikido's plugin
  (installed switched off). The `.exe` names and `agent-key.ps1` are gone.
- The update report says "apt with your password, mise or uv" where it said winget and an
  elevated shell.

**Left out, and why.**
- No map row for the new tools: `SKILL.md` is 60 bytes under its limit. They are in the
  catalog and in the two recipe pages.
- The utilities are in `ignored`, not tools: no job in the map names them.
- The Shopify CLI's entry stays a pinned copy. On the laptop it is an npm global, which the
  catalog check refuses as an update route ("must not install unvetted"): the laptop should
  follow the catalog, not the other way round.
- What is routine (`ROUTINE_COMMAND_PARTS`) is unchanged: widening it is the owner's decision.

**Verification.** `npm test` on boat: 692 tests, 0 fail. A trial update check with this
catalog: "not in the Cookbook" went from 57 to 1 (the claude.ai Docs connector). Real calls
on 19 November: the `LSP` tool answered for JavaScript (with TypeScript 6.0.3), Python and Go;
`ast-grep run -p 'readKey($NAME)' -l js` found the four calls in the skill's scripts.

**Outstanding.**
- Shopify CLI: vet `@shopify/cli` and install it as the pinned copy `shopify-cli`
  (`pinned-vet.sh`, `pinned-install.sh`); removing the npm global is an uninstall and asks
  the owner. Until then the check reads it as missing.
- The Jev compaction plugin is not installed on Linux (it needs vendoring again).
- `ts-rust` reads as missing in the first site's lockfile; OpenSEO reads as broken outside
  its two projects. Both were so before this change.
- rust-analyzer gave no answer from a session for a crate outside the workspace.
- The claude.ai Docs connector is neither listed nor ignored: whether it is a tool of the
  stack is not decided.

**Dead ends.** The Shopify CLI as a `command` part with an `npm install -g` update note:
refused by `scripts/check.mjs`, rightly.

**Evidence.**
`~/.local/share/claude-cookbook/evidence/2026-11-19-linux-scripts-and-pages/update-check-trial-with-new-catalog.txt`
and `update-check-first-run.txt` there.
