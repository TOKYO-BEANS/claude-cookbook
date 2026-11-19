# 19 November 2026: the npm command-line tools on the laptop are pinned copies

**Why.** Thirteen npm packages were installed on the Ubuntu laptop on 19 November with
`npm install -g`, on the 24-hour hold only and with no vetting. The Cookbook's route for an
npm CLI is a pinned copy from a vetted lockfile behind a launcher. The AI review of #160
raised it (medium); `2026-11-19-linux-catalog.md` listed it as outstanding.

**What starts each one** (hooks, MCP configurations, `~/.codex`, T3 Code's providers, the
plugins' language-server commands, the shell history and every repository were read):
- Tools of the stack: `@openai/codex` (T3 Code's Codex provider starts the `codex` on the
  path; there is no Codex desktop app on Linux), `typescript-language-server` with
  `typescript` and `pyright` (the `typescript-lsp` and `pyright-lsp` plugins), `@shopify/cli`
  (the catalog's Shopify CLI).
- Nothing starts them: `@earendil-works/pi-coding-agent` (T3's Pi provider is disabled, no
  `~/.pi`), `gh-axi`, `chrome-devtools-axi`, `lavish-axi`, `quota-axi`, `tasks-axi`,
  `firecrawl-mcp` (Firecrawl's MCP server is the hosted one) and `@napi-rs/keyring` (no
  command, no script imports it).

**What changed on the laptop.** Four pinned copies in `~/.local/share` (`codex-cli`,
`typescript-language-server` with `typescript` beside it, `pyright`, `shopify-cli`), each
vetted with `pinned-vet.sh` and installed with `pinned-install.sh` as a first install, and
four `#!/bin/sh` launchers in `~/.local/bin` (`codex`, `typescript-language-server`,
`pyright-langserver`, `shopify`). The five npm globals they replace are removed. `tsc`,
`tsserver` and `pyright` are no longer commands: nothing in the stack starts them.

**What changed here.** The catalog: Codex has a pinned part in place of "the desktop app
ships the binary"; Language servers has three pinned parts (`typescript` with no feed: it
is held on 6.x); the Shopify CLI names its page; `pyright-langserver` is in `ignored` as a
launcher, like `parallel-cli`. New page `recipes/pinned-copies.md` (a first copy, the
launcher, what is installed, the vetting, the proof), linked from `vetting-sandbox.md` and
`code-navigation.md`.

**The owner's answers, 19 November 2026, question dialog.** "Install, accept the six" (the
Shopify CLI's Gitleaks marks). "Install, accept the 19" (pyright's). "Duplicates only" (the
uninstall: the five replaced globals go, the eight unused ones stay).

**Verification.** The vetting results are on the new page. A session's `LSP` tool answered a
hover for a `.mjs` and a `.py` file from the pinned servers, also after its running server
was stopped; T3 Code started `codex app-server` from the copy; `shopify version` and
`shopify theme check` answered; all four again after the uninstall. A trial update check with
this catalog reads the five pinned parts at their versions, none missing or behind.
`node scripts/check.mjs` passes; `npm test` on boat: 708 tests, 701 pass, 0 fail, 7 skipped.

**Outstanding.**
- Eight npm globals stay, by the owner's choice; the update check lists their seven commands
  as "not in the Cookbook" every day. Removing them is an uninstall: ask again only when the
  owner raises it.
- A new pinned part is routine under the existing rule for the `pinned` kind. A pyright or
  Shopify CLI update will show Gitleaks marks again: the owner accepted them for these two
  versions only.
- `typescript` has no feed: a 6.x patch release is not reported. It moves when an update of
  the language server needs it.
- A first vetting needs a `package.json` written by hand and taken out again before the
  install (`pinned-copies.md`): the two scripts do not share a first-copy path.
- Not changed: `codex-setup.md` still says nothing about where the command comes from (the
  page is 58 bytes under its limit); the new page has it.

**Dead ends.** Proving the pinned TypeScript server with the session's `LSP` tool straight
after the launcher swap: the session's server was already running from the old global, so
the answer proved nothing. Stopping that server first did: the session started the pinned
one. `npm uninstall -g` deleted the four launchers, because they carry the names of the
packages' commands; they were written again from a copy.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-pin-npm-cli-tools/`: the
five `vet-*.log` files, `proof-*.txt`, `npm-global-before.txt` and `-after.txt`, the
launchers, `lsp-call.mjs` and the trial update check (`trial-run/`). The scanners' own
reports are in `~/.local/share/vetting/<folder>-<version>/out/`.
