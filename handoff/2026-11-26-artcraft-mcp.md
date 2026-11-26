# 26 November 2026: ArtCraft MCP server, vetted, built and connected

**Why.** The owner asked in another project's chat to connect ArtCraft to Claude through the
community server `theCosmicCrafter/artcraft-mcp`, and to record it in the Cookbook if it
works. The question about the sign-in was asked with the question dialog in this chat
("ArtCraft MCP: vet, install, add to Cookbook"), and the owner chose "Read the app's sign-in":
the acceptance of the app's plain-text sign-ins (20 November 2026) covers this server reading
them. After the AI review of the first head, a second dialog in the same chat: the owner
chose "Accept them" for the three "unmaintained" notices (backoff, instant, chrono) for
this server.

**What changed.**
- On the laptop (not in this repository): the server built from commit `5cce1a7` inside the
  vetted ArtCraft 0.41.1 source, installed as `~/.local/share/artcraft-mcp/bin/artcraft-mcp`
  (SHA-256 `f9830c28...5e2a`), user-scope MCP server `artcraft` with `"alwaysLoad": false`.
  User permissions: 11 tools denied (checkout, subscription, billing portal, referral codes,
  visibility, comments, ratings, tags, three deletes) and 19 generation, edit and upload tools
  on `ask`. The settings file before the change: `~/.local/share/backups/claude-settings-20261126T162606.json`.
- The patches and the lockfile moves are listed in the new page `recipes/artcraft.md`. Six
  high advisories (openssl 0.10.75 x5, rustls-webpki 0.103.9) were fixed by newer versions,
  not accepted.
- The review's medium finding: the published `artcraft_download_media_file` wrote any path
  the model named. Our patch takes only a plain file name and never overwrites or follows an
  existing file. The second review (of `5468c41`) found `download_dir` still free: it must now
  be an existing folder inside `~/Artcraft/downloads` or the session's project, with no hidden
  folder below that root after links are resolved, and the tool is `ask` (20 artcraft tools
  on `ask` now).
- The sign-in did not reach the server (401 after the owner signed in): ArtCraft 0.41.1 keeps
  its cookie store in `~/.cache/ai.artcraft.app/.cookies`, the server looked in
  `~/.local/share/...`. Patched to read the cache folder first.
- This repository: `recipes/artcraft.md`, the catalog entry `artcraft` (a recipe and a second
  part `mcp`, installed as server `artcraft`, with a commit feed), and the map row for images.

**Verification.** Gitleaks (directory and git history): no leaks. OSV-Scanner and Trivy on the
lockfile, intersected with `cargo tree -p artcraft-mcp`: no advisory left but three
"unmaintained" notices. Seven Depot sandbox runs of the build and one start (the last for the
installed source): install exit 0, DNS only for crates.io and rustup, no other files than
rustup's and cargo's, no process left, no network at start, an `initialize` answer in
camelCase. Here: `claude mcp get artcraft` shows Connected; `tools/list` gives 61 tools; a
real call, `artcraft_get_session_info`, answers 200 from the API, signed out. The download
check: `../../x.png`, `.bashrc` and `a/b.png` each answer "filename must be a plain name"
before any network call; `ok-name_1.png` passes the check and reaches the API (404 for the
test token). The folder check, from a test project: `~/.ssh`, `~/Desktop`, a hidden
subfolder, a link to `~/.config` and the project's parent are refused before any network call;
a subfolder and the default pass. Signed in: `artcraft_get_credits` answers "Free credits: 0,
Monthly credits: 0, Banked credits: 0, Total: 0" (no 401).
`node scripts/check.mjs --room` passed. The release log is `release-cookbook-<pr>-merge.log`
in `~/.local/share/release-maintenance/evidence/`.

**Outstanding.** The account has 0 credits: a generation needs a purchase or a plan, the
owner's decision (a spend), made in the app; the image job waiting in the other chat asks for
its own yes with the cost. The tools beyond session
info, credits and the model list are not tried against the live API.

**Dead ends.** The commit as it stands does not build against 0.41.1 (a missing field and a
tokio feature), and its answers are snake_case, which MCP clients reject: the fixes of 14
November were on a branch merged into the repository's main less than 24 hours before, so
they were applied here as read patches. The server's own session path (`/v1/users/session_info`)
answers 404.

**Evidence.** `~/.local/share/vetting/artcraft-mcp-5cce1a7/` (`NOTES.md`, `out/`: scans,
sandbox logs, the patch, the lockfile diff, the installed binary's checksum).
