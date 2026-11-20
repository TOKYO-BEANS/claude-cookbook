# 20 November 2026: the creative kit and the documents kit

**Why.** The owner said yes (chat "AI Development Tool Availability") to an image and vector
kit, Blender, and a documents and notebooks kit on the Linux laptop, each in the Cookbook. The
owner then said: install now; the 24-hour rule picks the version, it is not a wait.

**What changed.**
- Installed: ImageMagick 7.1.2-18, libvips 8.18.0, Inkscape 1.4.3 and pandoc 3.7.0.2 (Ubuntu
  apt); Blender 5.2.4 LTS (Blender Foundation snap, `5.2lts/stable`, the vetted revision 7997);
  Typst 0.15.1 (mise); Jupyter (uv tool `jupyterlab` 4.6.6 with nbconvert and ipykernel, now
  with the `jupyter` and `jupyter-nbconvert` commands; it replaced the 19 November tool).
- Owner's answers (question dialog in this chat, 20 November 2026): Typst installed with its
  bundled advisories accepted (zip 8.0.0 in the self-update code, quick-xml 0.38.3, time
  0.3.37), own documents only; Blender as the snap with its bundled-pip advisories accepted.
- Cookbook: recipe pages `recipes/creative-kit.md` and `recipes/documents-kit.md`, one map row,
  seven catalog entries, seven version commands, Jupyter's other commands in `ignored`.
  SKILL.md was at its byte limit: the dispatch row now names the profiles as
  `cookbook:*` (the session lists them), and the memory row points at `handoff/` only.

**Verification.** Each tool made a real output: a WebP (ImageMagick), a thumbnail (vips), a
PNG from SVG (Inkscape), a Cycles render (Blender), a PDF (Typst), a DOCX and a PDF (pandoc),
an executed notebook printing 45 (Jupyter). The version commands read all seven.

**Dead ends.** pandoc 3.7 with `--pdf-engine=typst` fails on Typst 0.15 ("font fallback list
must not be empty"): pass `-V mainfont=...` (in the recipe).

**Outstanding.** None.

**Evidence.** `~/.local/share/vetting/typst-0.15.1/`, `.../blender-5.2.4/`,
`.../jupyter-2026.11.19/` (NOTES.md, scans, sandbox logs) and
`~/.local/share/claude-cookbook/evidence/creative-kit-2026-11-20/` (the proof outputs).
