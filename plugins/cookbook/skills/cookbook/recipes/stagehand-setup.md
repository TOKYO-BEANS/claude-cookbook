# Browser automation in a session (Stagehand): setup and evidence

- **On this PC:** built from source, since upstream does not publish this server as a package.
  Commit `6f2686d` of `browserbase/stagehand` is in `~/.local/share/stagehand`; pnpm 11.11.0, the
  version that repository names, is a pinned copy in `~/.local/share/pnpm` with its store in
  `~/.local/share/pnpm-store`. Only the server package, the extension and what they depend on
  are installed (401 of the lockfile's 1,787 packages), with `--ignore-scripts`. The MCP entry
  `stagehand` is in `~/.local/share/stagehand-mcp.json` (until 17 November 2026 at user scope in
  `~/.claude.json`; the copy from before is in `~/.local/share/backups/`): `with-key.mjs browserbase
  BROWSERBASE_API_KEY node <install folder>/packages/integrations/core/dist/facade/stdio-server.mjs`,
  with absolute paths. `STAGEHAND_FACADE_ARTIFACT_ROOT` points at
  `~/.local/share/stagehand-artifacts`; without it the server writes into the current project.
- **Telemetry:** none found in what is installed. The built server and SDK name only Browserbase's
  own API hosts; "telemetry" in their source is run statistics returned to the caller and one line
  on stderr. The PostHog key that Gitleaks flagged is in `packages/cli`, the `browse` CLI, which
  is not part of this build (the `browse` shim turns that one off).
- **What the daily check sees:** the catalog part names no server, since `claude mcp list` no
  longer lists it, so the connection shows as unchecked, never as working; its feed is the SDK's npm
  releases. A new SDK release is a prompt to look at upstream, not a statement about this build:
  the check cannot read which commit is installed, so it never says the build is behind, and a
  change to the server that ships without an SDK release is not reported. The installed commit is
  the one named in this recipe. A reported SDK release carries no notes: that repository tags its
  releases `<package>@x.y.z`, which the notes reader does not follow, so read them on GitHub.
- **Vetted on 14 November 2026:** OSV-Scanner 2.7.0 read the lockfile's 1,787 packages and found
  4 high advisories (`extract-zip` 2.0.1 twice, `zod` 3.24.0 and 3.25.76). None of those
  packages is in the installed set, which has `zod` 4.6.6 only. Trivy 0.76.2 found no high
  advisory and no secret. Gitleaks 8.30.1 flagged 15 strings: test fixtures, example files and a
  public telemetry key, read one by one, which is an assessment and not a clean result. pnpm
  11.11.0: one package, no install script, OSV-Scanner and Trivy found nothing, Gitleaks flagged
  a PGP header string and two public registry keys. Evidence:
  `~/.local/share/vetting/stagehand-6f2686d/` and `~/.local/share/vetting/pnpm-11.11.0/`.
- **Proven on 14 November 2026:** called over MCP with no model, `run` opened example.com on a
  cloud browser and returned its title in 7.8 seconds, `snapshot` returned the tree, and no
  session was left running afterwards. Not proven: use from the desktop app, and `local` mode.
  On 17 November 2026 the child-session route returned example.com's title in 55 seconds,
  start-up included.
