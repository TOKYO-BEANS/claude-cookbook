# 27 November 2026: ArtCraft Launcher 0.20.3 installed

**Why.** The owner: "install this for me", with the release's Flatpak bundle downloaded.

**What changed.**
- On the laptop: the release's portable tarball (same release, same signing key as LightCraft)
  copied to `~/.local/share/craft-launcher`, a menu entry with absolute paths in
  `~/.local/share/applications`, icons in `~/.local/share/icons/hicolor`. No root. Flatpak is
  not installed here; adding it would need apt with the owner's password and Flathub.
- `catalog.json`: entry `craft-launcher`. `recipes/artcraft.md`: one paragraph.

**Verification.** The bundle and the tarball match `SHA256SUMS.txt`; good signatures; Gitleaks,
OSV-Scanner and Trivy show nothing high or critical (one Gitleaks hit is a fixed test value in a
`#[test]`, reported to the owner, no exception added); one Depot sandbox run was quiet; the
installed binary has the vetted hash; `desktop-file-validate` passes.

**Evidence.** `~/.local/share/vetting/craft-launcher-0.20.3/` (`NOTES.md`, `out/`). Release
log: the `sa-release` run of this pull request.

**Dead ends.** The Flatpak bundle itself: no `flatpak` on this laptop (owner, what clears it:
a yes to apt + Flathub; not needed, the tarball is the same release).

**Failures.** The app was started once on the laptop before the sandbox step (`--help` is not
a flag it knows; 5 s, network calls). It wrote only its own data folder and an empty
`~/.local/share/ArtCraft/versions`. Probe a GUI binary only in the sandbox.

**Outstanding.** Apps installed or updated from inside the launcher, and its own "Update and
restart", skip the vetting and the 24-hour rule; that is the owner's own click.
