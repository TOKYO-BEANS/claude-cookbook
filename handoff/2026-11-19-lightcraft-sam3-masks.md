# 19 November 2026: LightCraft + SAM 3 passes the masks test and takes the photo-masks row

**Why.** Photo masks had no tool since Adobe was retired and PhotoCraft failed the masks test
twice (#116). The owner chose "SAM 3 next" (17 November): test LightCraft's Describe masks,
which run Meta's SAM 3 locally. Begun on Windows on 18 November, handed off before the
switch to Linux, finished on the Ubuntu laptop once Meta approved the model access.

**What changed.**
- The map: "Photo masks by a word, colour by region" is LightCraft
  with SAM 3, own photos only; sharpening and the cut-out share the "none: say so" row. The
  skill description says so.
- `catalog.json`: a `lightcraft` entry (trial, github feed `storytold/lightcraft`, installed
  kind `command`). `recipes/photos.md` is the LightCraft page: how to run it, the own-photos
  condition, the cost, the error on a word that finds nothing, the gated model, how to update.
  The PhotoCraft condition (never a PDF or a file from outside) stays on the page.
  `options/plan-and-build.md` records the result.
- Line 34 of `handoff/2026-11-17-adobe-retired-photocraft-weighed.md`: PhotoCraft's baseline
  is that test's saved results only (a low finding on #116).

**Verification.** `npm test` on boat, after `main` was merged in: 706 tests, 699 pass, 0 fail,
7 skipped (Windows-only).
The vetting and the test follow.

**Vetting of the Linux build** (the Windows folder of 18 November did not come over, so this
is a full vetting).
- Release v0.21.1 (12 November, past the 24-hour age). The x86_64 tarball matches
  `SHA256SUMS.txt` and GitHub's digest; both carry good signatures from the key in the same
  release (integrity, not identity). No installer, no script; the CLI needs only libc.
- Gitleaks: no leaks in the source or the build. Trivy: the binaries gave it nothing to parse.
- OSV-Scanner, 758 packages: high or above only in the two crates the owner accepted on 18
  November ("Accept, own photos only"): zip 7.4.0 (through candle-core, the model loader) and
  rustls-webpki 0.102.8 (the downloader). No advisory newer than that answer. Today's scan
  rates one of zip's ids critical (GHSA-m665-v7pm-7grj, 9.4), where the record of 18
  November says "two high". Asked in a question dialog (this chat, 19 November 2026), the
  owner answered "Yes, it stands": own photos only, as before.
- boat sandbox run under the probe: quiet (no DNS name, no connection, no file outside the
  folder, no process left); $0.0002.
- Installed unpacked at `~/.local/share/lightcraft` (no root). The SAM 3 weights
  (3,439,938,512 bytes, SHA-256 equal to LightCraft's pin) are in
  `~/.local/share/lightcraft-sam3`, fetched with Claude's read-only Hugging Face token.

**The test.** The same 10 public-domain photos as the PhotoCraft test: outside files, so the
test stretched the owner's "own photos only" condition. Asked in a question dialog (this chat,
19 November 2026), the owner chose "Accept the test as done": the ten test photos are
accepted, and the condition stays as it was for everything after.
- Describe "person": all 5 people photos of the PhotoCraft test right (PhotoCraft: 1 of 5
  automatic, 3 of 5 with a box), the flag at the edge left out; also the people on three more
  photos. Edges clean at 1600 px.
- "face": every face, the darker-skinned person PhotoCraft's colour range missed included.
  "window": all windows of the room and both of the office, no screen. Colour by region
  clean. Correct "nothing matching" where there was none.
- Cost: 84 to 160 s and 3.3 to 4.3 GB a mask on the CPU (40 runs, 64 minutes).
- The runner now measures with `/usr/bin/time -v` instead of PowerShell.

- The update check reads the version with `{share}/lightcraft/bin/lightcraft-cli --version`
  (`tables.mjs`), beside the Linux paths #156 put there.

**Outstanding.**
- Not measured: several masks on one photo in one process (the image is analysed once).

**Dead ends.** Hugging Face restricted the automated browser at sign-up; the owner did the
bot check by hand (18 November).

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-18-lightcraft-test/`
(`RESULTS-lightcraft.md` first, previews and sheets in `out/`) and
`~/.local/share/vetting/lightcraft-0.21.1/` (`NOTES.md`, scanner reports and `sandbox.log` in
`out/`).
