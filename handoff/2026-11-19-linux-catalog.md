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
- `ignored`, with a reason each: linters, runtimes, the Rust toolchain's binaries,
  rust-analyzer and gopls, general utilities (act, difftastic, dive, duckdb, lazygit,
  watchexec, yq), `t3`, `ollama`, and Aikido's plugin (installed switched off). No npm
  global is in it (below). The `.exe` names and `agent-key.ps1` are gone.
- The update report says "apt with your password, mise or uv" where it said winget and an
  elevated shell.

**Low findings of the reviews of #157 and #159, fixed here.** `pinned-install.sh`: a retry
after a failed first install is a first install again, so a failed copy cleans up and does
not point at `--back` (with a test). `vetting-sandbox.md`: "the one exemption".
`sign-ins-setup.md`: the Proton Pass sign-in command goes through the launcher, which keeps
the update check off.

**Left out, and why.**
- No map row for the new tools: `SKILL.md` is 60 bytes under its limit. They are in the
  catalog and in the two recipe pages.
- The utilities are in `ignored`, not tools: no job in the map names them.
- The Shopify CLI's entry stays a pinned copy. On the laptop it is an npm global, which the
  catalog check refuses as an update route ("must not install unvetted"): the laptop should
  follow the catalog, not the other way round.
- What is routine (`ROUTINE_COMMAND_PARTS`) is unchanged: widening it is the owner's decision.

**Verification.** `npm test` on boat: 708 tests, 701 pass, 7 skipped, 0 fail. A trial update
check with this catalog: "not in the Cookbook" went from 57 to 13 (twelve commands of npm
globals and the claude.ai Docs connector). Real calls
on 19 November: the `LSP` tool answered for JavaScript (with TypeScript 6.0.3), Python and Go;
`ast-grep run -p 'readKey($NAME)' -l js` found the four calls in the skill's scripts.

**Outstanding.**
- **npm globals on the laptop, installed without a vetting** (`npm install -g` on
  19 November 2026): the language servers' programs (`typescript-language-server`, `pyright`,
  `typescript`), `@shopify/cli`, `@openai/codex`, `@napi-rs/keyring`, `firecrawl-mcp`,
  `pi-coding-agent` and five `*-axi` tools. The Cookbook's route for an npm CLI is a pinned
  copy from a vetted lockfile. They are not in `ignored`, so the update check lists them as
  "not in the Cookbook" every day until each is a pinned copy or gone; removing one is an
  uninstall and asks the owner. The AI review of this pull request raised it (medium).
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
