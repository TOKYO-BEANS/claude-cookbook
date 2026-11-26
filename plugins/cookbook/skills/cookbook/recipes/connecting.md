# Connecting a new app or service

- Check this Cookbook first: the stack may already do the job.
- Then take the lightest route that works, in this order: the maker's official connector or CLI, a
  community CLI, the API (a key from the encrypted store, called from a small script), and a community
  MCP server last. A CLI call is one short command with one short answer; an API answer is longer; an
  MCP server adds its tool names to every session in its scope. Say which case applied.
- Find candidates with Parallel Search and Firecrawl developer search, and check that each one exists
  today, is maintained and has a licence that fits. Never guess one.
- Before any install: read the code, scan it locally (OSV-Scanner, Gitleaks with `--config`, Trivy),
  run it once in a sandbox ([sandboxes.md](sandboxes.md), [vetting-sandbox.md](vetting-sandbox.md)) and get the
  owner's yes. Then add the tool here in the same pull request. These three scanners run
  only here, on outside code, never as part of a repository's CI. The sandbox run is a step, not
  a choice. The one exemption is in [vetting-sandbox-report.md](vetting-sandbox-report.md) (a Claude
  Code plugin or skill copy): the vetting notes say when it applied, and the owner hears it
  with the scan results.
- An ad-hoc Gitleaks scan (a download, a copied folder, a deploy pre-flight) passes `--config` with a
  config you control and `--gitleaks-ignore-path` set to a folder with no `.gitleaksignore`, with
  `GITLEAKS_CONFIG` and `GITLEAKS_CONFIG_TOML` unset. Otherwise Gitleaks loads `.gitleaks.toml` and
  `.gitleaksignore` from the scanned folder, and a planted one turns a real finding into a pass. A
  Gitleaks exception is one rule and one exact value pattern, never a `paths` allowlist.
- **How a tool is installed here, without root:** a runtime or a release-binary CLI through
  `mise` (`mise use -g <tool>@<version>`, never `mise upgrade`), a Python tool through `uv tool` with
  `--exclude-newer`, Rust through `rustup`, an npm CLI as a pinned copy from a vetted
  lockfile, never `npm install -g`. The 24-hour rule picks the version, never the day: install at once
  the newest release that is over 24 hours old, by publish time, not by calendar day. An apt
  package needs the owner's password. Standing exception (owner, 20 November 2026): Ubuntu's
  own updates, snap apps, the apt apps from the added sources and the apps that update
  themselves (T3 Code, Claude Code) update with no age rule; npm, uv, mise and GitHub releases take the newest one over 24 hours old.
- A scan proves only what it parsed. An ad-hoc OSV-Scanner run passes `--no-ignore` and `--config` with
  a file you control (otherwise it skips git-ignored files and reads a planted `osv-scanner.toml`); 0
  packages parsed or exit code 128 ("No package sources found") is no result, not a clean one.
- Install Trivy only from immutable releases, never `trivy-action` or `setup-trivy` (CVE-2026-33634).
- An MCP server that only some projects need goes in project scope (`.mcp.json`), not user scope.
  What each server costs a session start, and the three ways to keep one out of it:
  [connecting-load.md](connecting-load.md).
- A server that serves skills for a job one of our skills does replaces ours once its skills
  load in T3 Code; a plugin's duplicate copy is turned off: [mcp-features](../options/mcp-features.md).
