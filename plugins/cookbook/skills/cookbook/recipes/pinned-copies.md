# Pinned npm copies: setup and evidence

An npm CLI of the stack is a copy in `~/.local/share/<folder>`, installed from a vetted
lockfile, behind a `#!/bin/sh` launcher in `~/.local/bin` that names `/usr/bin/node` and the
copy's program. The rule and the scanners: [connecting.md](connecting.md).

- **A first copy** (no install folder yet): write `<folder>/package.json` (`"private": true`,
  the package and its exact version under `dependencies`). Run `pinned-vet.sh <folder>
  <package> <version>` ([vetting-sandbox.md](vetting-sandbox.md)) with `npm_config_before` set
  to 24 hours ago, so nothing it resolves is younger. Read the report. Take that
  `package.json` out again, then `pinned-install.sh <folder> <version>` installs the vetted
  pair as a first install. Two packages in one folder: one vetting each, one install.
- **The launcher** takes an old link's place by a rename (`mv -fT`), never by writing through
  the link. `npm uninstall -g <package>` deletes the command of that name, a launcher too:
  write it again afterwards.
- **On this PC since 19 November 2026** (npm globals without a vetting before that):
  - Codex CLI, `@openai/codex` 0.172.0 (26 November 2026), folder `codex-cli`, command `codex`: what T3 Code
    starts. There is no Codex desktop app on Linux.
  - TypeScript server: `typescript-language-server` 6.1.0 and `typescript` 6.0.3 in the
    folder `typescript-language-server`. The server starts the `tsserver` beside it;
    `typescript` 7 ships none, so it stays on 6.x, has no feed and moves with the server.
  - pyright 1.1.414, folder `pyright`, command `pyright-langserver`.
  - Shopify CLI, `@shopify/cli` 5.0.2, folder `shopify-cli`, command `shopify`, with
    `SHOPIFY_CLI_NO_ANALYTICS=1` in the launcher. Its `esbuild` has an install script that
    does not run here; esbuild 0.28.1 answered a transform without it.
- **Vetted 19 November 2026** (OSV-Scanner 2.7.1, Gitleaks 8.30.1, Trivy 0.76.2, one boat
  sandbox run per package). OSV-Scanner read 7, 2, 2 and 82 packages and found no advisory;
  Trivy found none and no secret. Every sandbox run asked only the npm registry and left no
  process; Shopify's ran the `esbuild` install script; Codex wrote a lock file in its own
  `~/.codex`. Gitleaks: 0 in Codex and the TypeScript folder; 6 in the Shopify CLI (an
  `apiKey` string in its error-reporting setup, five long identifiers in bundled code); 19 in
  pyright (lines of bundled type stubs: pywin32 18, paramiko 1). All are rule
  `generic-api-key`. The owner accepted both sets for these versions on 19 November 2026
  (question dialog); no model cleared them.
- **Proven 19 November 2026:** a session's `LSP` tool answered a hover for a `.mjs` and a
  `.py` file from the pinned servers, also after its running TypeScript server was stopped;
  T3 Code started `codex app-server` from the copy; `shopify version` and `shopify theme
  check` answered. Then the five npm globals were removed (owner: "Duplicates only").
- **Still npm globals, the owner's choice** (nothing starts them): `pi-coding-agent`, the
  five `*-axi` tools, `firecrawl-mcp` and `@napi-rs/keyring`. The update check lists them as
  not in the Cookbook.
