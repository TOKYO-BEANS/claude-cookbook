# Documents and notebooks

PDFs, Word files and notebooks made by script on the Linux laptop (owner's yes, 20 November
2026). Images, vector and 3D: [creative-kit.md](creative-kit.md). Editing an existing Office
file or PDF: the bundled `docx`, `pdf`, `pptx` and `xlsx` skills.

| Job | Tool | One call |
| --- | --- | --- |
| A designed PDF: report, one-pager, invoice layout, slides | **Typst** | `typst compile report.typ report.pdf` |
| Markdown to DOCX, HTML or EPUB | **pandoc** | `pandoc notes.md -o notes.docx` |
| Markdown to PDF | **pandoc** with Typst | `pandoc notes.md -o notes.pdf --pdf-engine=typst -V mainfont="Libertinus Serif"` |
| Run a notebook headless and keep its outputs | **Jupyter** | `jupyter nbconvert --to notebook --execute --output out.ipynb in.ipynb` |

- **Typst** is the PDF engine: no LaTeX is installed. Write the `.typ` file from code (data in
  a JSON or CSV beside it, read with `json()` or `csv()`), compile, then check the page count
  or render a page to PNG (`typst compile in.typ page-{p}.png`) when the look is the check.
  `typst watch` serves a live preview; `@preview/...` packages are fetched from Typst's
  package host on first use.
- **pandoc 3.7 with Typst 0.15:** pandoc's Typst template passes an empty font list, which
  Typst 0.15 rejects ("font fallback list must not be empty"). Always pass `-V mainfont=...`
  (a font Typst embeds: Libertinus Serif, New Computer Modern, DejaVu Sans Mono), or convert
  to a body with `pandoc in.md -t typst -o body.typ` and compile that. A house style: a
  `--reference-doc=style.docx` for Word, a Typst template for PDF.
- **Jupyter:** `jupyter`, `jupyter-nbconvert` and `jupyter-lab` from one uv tool (JupyterLab,
  nbconvert, ipykernel). A notebook from elsewhere is code: run it only in a boat sandbox. A
  notebook with secrets reads them through `with-key.mjs`, never from a cell.

## How they are installed

- Typst: a mise tool (`mise use -g typst@<version>`), the newest release over 24 hours old,
  after the three scans and a boat sandbox run; the installed binary's SHA-256 matched the
  vetted one. Never `typst update` (its self-update): mise moves it.
- **Accepted findings (owner, 20 November 2026):** the Typst 0.15.1 binary bundles zip 8.0.0
  (one critical and three high advisories, in the self-update code only), quick-xml 0.38.3
  (two high: slow parsing of citation XML) and time 0.3.37 (medium). Own documents only. A
  new critical finding goes to the owner.
- pandoc: Ubuntu's own apt package, updated with Ubuntu (3.7 does every job here).
- Jupyter: `uv tool install --force --exclude-newer <now minus 24 h> --python 3.12
  "jupyterlab==<version>" --with nbconvert --with ipykernel --with-executables-from
  jupyter-core,nbconvert`, after the locked set was scanned and run once in a boat sandbox.
- Evidence: `~/.local/share/vetting/typst-0.15.1/`, `~/.local/share/vetting/jupyter-2026.11.19/`
  and `~/.local/share/claude-cookbook/evidence/creative-kit-2026-11-20/`.
