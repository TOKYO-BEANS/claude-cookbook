<!-- Managed by Stack Atlas. -->
# Claude Cookbook — tool stack

Managed by Stack Atlas. This file describes intended tool use; it does not grant permissions or prove a live connection.

Project; the owner sets its purpose in Stack Atlas.

| Tool | Purpose in this project | State |
| --- | --- | --- |
| GitHub | Source code, pull requests and workflow coordination. | active |
| Gitleaks | Secret scan in the CI security job. | active |
| Depot | Depot CI runs the security, Semgrep and test jobs on every commit. | active |
| Semgrep | CI scan gate (scanState) for releases. | active |
| OSV-Scanner | Dependency vulnerability scan in the CI security job. | active |
| Aikido | Safe Chain in CI installs, dashboard and local scans (Free plan). | active |
| Trivy | Infrastructure-config scan in the CI security job. | active |

## Connections and purposes

| Connection | Type | Purpose |
| --- | --- | --- |
| Aikido connection | MCP | Security scanning and reviewable fixes through normal CI. |
| Depot connection | CLI | CI runners and container builds where configured. |
| GitHub connection | CLI | Source code, pull requests and workflow coordination. |
| Claude Code: aikido | Plugin | Claude Code on this laptop: Local SAST/secrets scans and issue review before PRs. |
| Claude Code: depot | CLI | Claude Code on this laptop: Depot CI and remote builds. |
| Claude Code: github | MCP | Claude Code on this laptop: Repos, PRs and CI status. |
| Claude Code: semgrep | CLI | Claude Code on this laptop: local Semgrep scans and checks (CLI), plus reading the CI semgrep job results. |

Live connection evidence and its expiry are shown in Stack Atlas. Keep existing project instructions and access rules in force. Credential values do not belong in this file.
