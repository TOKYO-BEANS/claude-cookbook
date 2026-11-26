# ArtCraft (generative images)

- **What:** the owner's ArtCraft account (API `api.storyteller.ai`) from Claude Code through
  the community MCP server `theCosmicCrafter/artcraft-mcp` (Apache-2.0): 61 tools for image,
  video, audio and 3D generation, edits, uploads, jobs and credits. Server `artcraft`, user
  scope, `"alwaysLoad": false`: `ToolSearch` with `select:mcp__artcraft__<tool>` first. A
  session started before 26 November 2026 does not have it. ArtCraft Studio, the app, stays
  the owner's own tool.
- **Installed** 26 November 2026 as `~/.local/share/artcraft-mcp/bin/artcraft-mcp`, built
  from commit `5cce1a7` (17 November, the newest over 24 hours old) inside the vetted
  ArtCraft 0.41.1 source. The repository ships only a Windows binary. The build carries our
  patches: the manifest fitted to 0.41.1 (no `workspace-build-acceleration`, `dirs` 6, tokio's
  `rt-multi-thread`), one field 0.41.1 added, the three protocol fixes of 14 November
  (camelCase answers, `ping`, notifications, the version handshake: without them a client
  rejects the server), the session path (`/v1/session`) and a download check (below). The
  lockfile moved openssl to 0.10.82 and rustls-webpki to 0.103.17 (six high advisories) and
  eleven more crates past their advisories, each over 24 hours old. Left: three "unmaintained" notices (backoff
  RUSTSEC-2025-0012, instant RUSTSEC-2024-0384, chrono RUSTSEC-2026-0543), accepted by the
  owner for this server on 26 November 2026. Evidence and the patch: `~/.local/share/vetting/artcraft-mcp-5cce1a7/` (`NOTES.md`).
- **Sign-in:** the server reads the session cookie the app keeps in plain text
  (`~/.local/share/ai.artcraft.app/.cookies`), or `~/Artcraft/credentials/*.txt` when they
  exist. The owner's answer of 26 November 2026: the acceptance of the app's plain-text
  sign-ins covers this server reading them. Never write those files and never copy the cookie
  elsewhere. Signing in is the owner's step, in the app. Signed out, reads answer and
  generations fail. `artcraft_get_credits` shows whether it is signed in.
- **Spend:** every generation, edit and upload tool is `ask` in the user permissions; before
  one, `artcraft_estimate_cost` and `artcraft_get_credits`, then the owner's yes in the chat
  that names the cost. Denied outright: checkout, subscription and billing portal, referral
  codes, media visibility, comments, ratings, tags, and the three deletes.
- **Photos:** an upload of a photo follows [photos.md](photos.md), a yes per file. Never a
  generative edit of a photo of a real person.
- **Downloads:** `artcraft_download_media_file` takes only a plain `filename` (letters,
  digits, `-`, `_`, `.`; no leading dot, no `..`) and never overwrites or follows an existing
  file: our patch, since the server as published wrote any path the model named. Pass a
  `download_dir` inside the project.
- **Known gaps:** the session tool prints "?" for its fields. The server was written against a newer ArtCraft
  than 0.41.1: a tool that fails with a 404 or a parse error may be the API drifting from
  the build, not a sign-in fault.
- **To update:** the feed shows new commits. Rebuild from the newest commit over 24 hours old
  with the patches still needed, scan the source (Gitleaks, Trivy) and the server's dependency
  tree (OSV-Scanner on the lockfile, `cargo tree -p artcraft-mcp`), run `vet-build.sh` and
  `vet-start.sh` once in a Depot sandbox ([vetting-sandbox](vetting-sandbox.md)), then
  install over the binary. A new high finding goes to the owner.
