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
  (SHA-256 `5d257695...b663`), user-scope MCP server `artcraft` with `"alwaysLoad": false`.
  User permissions: 11 tools denied (checkout, subscription, billing portal, referral codes,
  visibility, comments, ratings, tags, three deletes) and 19 generation, edit and upload tools
  on `ask`. The settings file before the change: `~/.local/share/backups/claude-settings-20261126T162606.json`.
- The patches and the lockfile moves are listed in the new page `recipes/artcraft.md`. Six
  high advisories (openssl 0.10.75 x5, rustls-webpki 0.103.9) were fixed by newer versions,
  not accepted.
- The review's medium finding: the published `artcraft_download_media_file` wrote any path
  the model named. Our patch takes only a plain file name and never overwrites or follows an
  existing file. That fixes it only in part: `download_dir` is still the model's choice and is
  not confined, and the tool is neither `ask` nor denied, so it can create a new file in any
  directory the user can write. Outstanding below.
- This repository: `recipes/artcraft.md`, the catalog entry `artcraft` (a recipe and a second
  part `mcp`, installed as server `artcraft`, with a commit feed), and the map row for images.

**Verification.** Gitleaks (directory and git history): no leaks. OSV-Scanner and Trivy on the
lockfile, intersected with `cargo tree -p artcraft-mcp`: no advisory left but three
"unmaintained" notices. Five Depot sandbox runs of the build and one start (the last for the
installed source): install exit 0, DNS only for crates.io and rustup, no other files than
rustup's and cargo's, no process left, no network at start, an `initialize` answer in
camelCase. Here: `claude mcp get artcraft` shows Connected; `tools/list` gives 61 tools; a
real call, `artcraft_get_session_info`, answers 200 from the API, signed out. The download
check: `../../x.png`, `.bashrc` and `a/b.png` each answer "filename must be a plain name"
before any network call; `ok-name_1.png` passes the check and reaches the API (404 for the
test token).
`node scripts/check.mjs --room` passed. The release log is `release-cookbook-<pr>-merge.log`
in `~/.local/share/release-maintenance/evidence/`.

**Outstanding.** The owner signs in once in ArtCraft Studio (the owner's step, 26 November
2026). Then a signed-in read (`artcraft_get_credits`) proves the sign-in path; the image
job waiting in the other chat asks for its own yes with the cost. The tools beyond session
info and the model list are not tried against the live API. The download tool's
`download_dir` is not confined (AI review, medium): extend the patch to resolve it with
symlinks followed and refuse any path outside one fixed root, or drop the parameter, and
until then set `mcp__artcraft__artcraft_download_media_file` to `ask` in the user permissions.

**Dead ends.** The commit as it stands does not build against 0.41.1 (a missing field and a
tokio feature), and its answers are snake_case, which MCP clients reject: the fixes of 14
November were on a branch merged into the repository's main less than 24 hours before, so
they were applied here as read patches. The server's own session path (`/v1/users/session_info`)
answers 404.

**Evidence.** `~/.local/share/vetting/artcraft-mcp-5cce1a7/` (`NOTES.md`, `out/`: scans,
sandbox logs, the patch, the lockfile diff, the installed binary's checksum).
