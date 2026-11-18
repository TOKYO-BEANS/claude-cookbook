# 18 November 2026: LightCraft + SAM 3 masks, interim (handed off before the Linux switch)

**Why.** Photo masks have no tool since Adobe was retired and PhotoCraft failed the masks test
twice (#116). The owner chose "SAM 3 next": test LightCraft's AI masks, which run Meta's SAM 3.
This PC is wiped for Linux before Meta answers the model access request, so the job is written
down here and continues on Linux.

**What changed.** This entry, and line 34 of
`handoff/2026-11-17-adobe-retired-photocraft-weighed.md`: PhotoCraft's "baseline" is that
test's saved results only (a low finding on #116). Nothing in the map yet.

**Verification so far** (evidence: `~/.local/share/claude-cookbook/evidence/2026-11-18-lightcraft-test/`,
`NOTES-interim.md` first; vetting: `~/.local/share/vetting/lightcraft-0.21.1/`).
- LightCraft 0.21.1 vetted: two high advisories in bundled crates (zip 7.4.0, rustls-webpki
  0.102.8); the owner accepted them for own photos only (18 November). The boat sandbox run
  was quiet. Installed portable, the CLI built with SAM support.
- Without a model, on the same 10 public-domain photos: 5 to 12 s a photo, 322 to 340 MB peak.
  Subject, sky and people masks are heuristics by LightCraft's own docs. Auto-straighten
  changed 5 of 10 photos. There is no cut-out (transparent background) command: LightCraft is
  a raw developer.
- SAM 3: Claude's own Hugging Face account (login in the vault "Claude", read-only token
  `huggingface-read` in the key store) requested access to `facebook/sam3`: awaiting Meta's
  review. `scripts/get-sam3.mjs` downloads the model and checks the SHA-256 LightCraft pins.

**Outstanding.** On Linux: install LightCraft 0.21.1's Linux build (check that the vetting
folder covers that build; if not, vet it first), check access with `scripts/hf-access.mjs` (token at run time through the
key helper). If approved: `get-sam3.mjs`, then `scripts/runner.mjs` for sam-person, sam-face,
sam-window and sam-colour; judge the previews against the bar in
`RESULTS-photocraft.md`; write `RESULTS-lightcraft.md`. If it passes, LightCraft goes into the
map, `catalog.json` and `recipes/photos.md`; if not, into `options/plan-and-build.md`. Recreate
the one-time check as a T3 scheduled task the first morning after the switch (see
`2026-11-18-linux-switch-scheduled-tasks.md`). Still awaiting: Meta's approval.

**Dead ends.** Hugging Face restricted the automated browser at sign-up; the owner did the bot
check by hand.

**Evidence.** The two folders above, carried over on the migration kit.
