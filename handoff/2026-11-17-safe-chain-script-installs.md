# 17 November 2026: Safe Chain does not check an install that a script starts

**Why.** Found the same day in one repository on the standard: its `pretest` script ran
`npm ci` for a nested package, and Safe Chain (1.5.27, the standard's pin, set up as the CI
step does it) did not check that install. The Cookbook did not say so, and the other
repositories had not been looked through.

**The mechanism.** The wrappers Safe Chain puts on `PATH` for `npm`, `pip3` and `python3`
end with `unset PKG_EXECPATH; PATH=<without the wrappers> exec safe-chain <command> "$@"`.
Whatever the wrapped command starts finds the plain commands. The wrappers of 1.5.27: `bun`, `bunx`,
`npm`, `npx`, `pdm`, `pip`, `pip3`, `pipx`, `pnpm`, `pnpx`, `poetry`, `python`, `python3`,
`rush`, `rushx`, `uv`, `uvx`, `yarn`.

**`pip`: the same, measured.** One boat sandbox run (`small`, 17 seconds, Node 24.22.1,
Python 3.12.3, pip 24.0), the pinned installer with its checksum and `--ci`, then Aikido's
test package `safe-chain-pi-test`. Safe Chain's proxy stops it with HTTP 403 and "Exiting
without installing malicious packages"; the real index does not hold it, so an install that
does not pass Safe Chain ends with "Could not find a version". That difference is the proof:
unlike with `npm`, nothing installs in the unchecked case.

| Install started | Checked |
| --- | --- |
| `pip3 install`, by a shell | yes |
| `python3 -m pip install`, by a shell | yes |
| `pip3 install` inside `make` (not a wrapped command) | yes |
| `pip3 install` and `python3 -m pip install` inside `npm run` | no |
| `pip3 install` from a Python program (`subprocess`), started as `python3` | no |
| `sys.executable -m pip install` from that program | no |
| a virtual environment's `python -m pip install`, by path | no |
| `pip install` and `python -m pip install` in an activated virtual environment | no |
| `env -u PKG_EXECPATH safe-chain pip3 install` inside `npm run` | yes |
| control: `npm install safe-chain-test`, by a shell | yes (stopped) |
| control: the same inside `npm run` | no (installed) |

Not tested: `uv`, `poetry`, `pipx`, `pdm`, `yarn`, `pnpm`, `bun`, `rush`, and Windows. Only
the `pip3` and `python3` wrappers were printed and read.

**What changed.**
- `recipes/security.md`: the rule and the checked form, four lines; the page is at 3,990 of
  4,000 bytes. `options/check.md` is unchanged: it holds why a tool was chosen, and has
  37 bytes left.
- `catalog.json`: Aikido's purpose says the same in one clause.

**The look through the repositories.** The standard's inventory of 17 November 2026 lists
eight repositories, all at level `full`; each was cloned at its default branch. Read in
each: the commands of every workflow in `.depot/workflows/` and `.github/workflows/`, every
script in every `package.json`, every shell, PowerShell and batch script (no repository has
a Makefile), and every line that names an install command or starts a package manager from
code.
- One hit, already in the checked form: the repository of the first finding (`pretest`,
  through `safe-chain npm ci` with `PKG_EXECPATH` removed, failing in CI without Safe Chain).
- No other script that CI runs installs a package. Every other install is a workflow step
  after the Safe Chain step, and no `setup-node` or `setup-python` step comes after that
  step (one would put its own folder ahead of the wrappers on `PATH`).
- Not hits, and why: the standard's `semgrep` job installs with a virtual environment's
  `python -m pip` by path, which Safe Chain does not see; it is locked by hash
  (`--require-hashes`). The vetting scripts here and the onboard skill's refresh script
  install on this PC or in a sandbox, never in CI; the tests of the vetting scripts use
  stand-ins for `npm`.
- No private repository's code is in this pull request. File and line of each reading are in
  the evidence folder.

**Verification.** `npm test`: see the pull request. The sandbox run ended with exit 0 and
the sandbox deleted.

**Outstanding.**
- After the standard's Safe Chain pin moves, run the probe again (`pip-probe.sh` in the
  evidence folder). Owner: the Stack Atlas chat that bumps the pin.
- The untested wrappers above: test one when a repository first installs with it in CI.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-17-safe-chain-script-installs/`:
`pip-probe.sh` and `pip-probe.out` (the run), `inventory.json`, `scan.mjs`, `scan.txt`,
`ci-commands.txt`, `scripts.txt`, `code-hits.txt` (the look through).
