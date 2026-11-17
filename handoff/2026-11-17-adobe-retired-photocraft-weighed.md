# 17 November 2026: Adobe retired, PhotoCraft weighed and not adopted

**Why.** The owner cancelled the Adobe trial on 17 November 2026 (the chat "Replace Adobe With
ArtCraft"): photo sharpening gets no tool, and ArtCraft's local apps were to take over the
masks, cut-out and colour job after vetting and a side-by-side test.

**What changed.**
- The map: both photo rows now read "none: say so" and point at `recipes/photos.md`, rewritten
  as a short page: no tool yet, what was retired and tested, the upload gate and personal-data
  check for any outside service, and the lessons of the 10 November job.
- Removed: the Adobe Firefly and Adobe for creativity catalog entries, the four
  `photos-adobe-connector*` pages, `scripts/adobe-session.mjs`, `scripts/adobe-window.ps1` and
  their test. `options/plan-and-build.md` records what was weighed; the connector register
  marks the connector retired; `connecting-load.md` no longer points at the Adobe pages.

**Vetting of PhotoCraft 0.23.1** (`~/.local/share/vetting/photocraft-0.23.1/`).
- The Windows x64 portable zip and the Linux tarball match `SHA256SUMS.txt`; the sums and the
  tarball carry good signatures from the key in the same release (integrity, not identity).
- Gitleaks: two hits in the source, both test fixtures (read); none in the build. Trivy: no
  finding in the source's three targets; the Windows binaries gave it nothing to parse.
- OSV-Scanner: 926 packages, 15 advisory ids: 9 "unmaintained" or "unsound" notices, three
  without a score, one medium (`rmcp`), and one **high** under two ids: `lopdf` 0.38.0,
  RUSTSEC-2026-0187 and GHSA-6fj4-rcr3-r7rr, a
  stack overflow on a crafted nested PDF. It is in the binary and still on upstream `main`.
  The owner accepted it on 17 November 2026 (question dialog, this chat) on the condition
  that PhotoCraft never opens a PDF or a file from outside, only our own JPEG, PNG or TIFF;
  `photos.md` says so. The test photos below came from Wikimedia Commons and were opened after
  that answer, so the test stretched the condition; the advisory is in the PDF reader, which
  a JPEG never reaches. The owner was told.
- boat sandbox run of the Linux build under the probe: quiet (no DNS name, no connection, no
  file outside the folder, no process left).
- Installed as the portable build in `~/.local/share/photocraft-0.23.1` (no admin). It stays
  for the next test as a baseline; removing it is an uninstall, so it waits for the owner.

**The test** (evidence: `~/.local/share/claude-cookbook/evidence/2026-11-17-photocraft-test/`,
`RESULTS-photocraft.md` first). Ten public-domain photos from Wikimedia Commons, five with
people; no owner or client photo. Driven through `photocraft-cli run`.
- Failure 1, Select Subject (3 to 8 s a photo): right on 1 of 5 people photos, usable on 1,
  partial on 1, wrong on 2 (background selected, person left out).
- Failure 2, Object Selection with a box drawn around the person: 3 of 5 right; one cut the
  hair, one kept 69 % of a flag at the edge.
- Skin by colour range missed a darker-skinned person; face detection is refused. A window by
  point: one pane of two, then nothing. No selection by name, no automatic straighten.
- Both failures share one cause: the segmentation has no learned model. Stopped there under
  the owner's rule of two.

**Outstanding.**
- Next job, owner's yes of 17 November 2026: LightCraft's AI masks, which run Meta's SAM 3.
  Its weights (3.4 GB) are gated on Hugging Face: Claude makes its own Hugging Face account on
  the owner's domain, requests `facebook/sam3` access (accepting the SAM License), saves the
  token in the DPAPI store, then vets LightCraft and repeats this test. On Windows it runs on
  the CPU only. Owner: Claude; clears when the test passes or fails.
- The Adobe connector is still connected in claude.ai; disconnecting it is the owner's call.

**Dead ends.** A `head -1` on the CLI's output closed the pipe and killed 7 of 10 runs before
they saved: capture the output to a file. The context-mode read limit refuses image previews
over about 15 KB: keep previews at 300 px or less.
