# Creative kit

Command-line tools for images, vector art and 3D, all driven by script on the Linux laptop
(owner's yes, 20 November 2026). Documents and notebooks: [documents-kit.md](documents-kit.md).
Photos (masks, colour by region): [photos.md](photos.md). The look of a design: Claude Design.

| Job | Tool | One call |
| --- | --- | --- |
| Convert, resize, crop, compose, annotate a few images | **ImageMagick** 7 | `magick in.png -resize 1200x -quality 82 out.webp` |
| Hundreds of large images, low memory | **libvips** (`vips`) | `vips thumbnail in.jpg out.jpg 400` |
| An SVG to PNG or PDF at an exact size | **Inkscape** 1.4 | `inkscape in.svg --export-type=png --export-filename=out.png -w 1024` |
| A product shot, scene or turntable | **Blender** 5.2 LTS | `blender -b --factory-startup -noaudio --python scene.py` |

- **Batch by script**, never by hand: a loop or a short Python file writes the outputs to a
  folder and prints a count. Look at an output only when looking is the check.
- **ImageMagick:** `magick` (`convert` is the deprecated version 6 name); `magick identify`
  reads size and format. Its policy (`/etc/ImageMagick-7/policy.xml`) caps an image at 256
  megapixels and 1 GiB of memory: a bigger job goes to libvips, never a loosened policy.
- **libvips:** the fast path for big batches and huge images; `vipsheader` reads a file.
- **Inkscape:** headless through `--export-*` flags; several steps in one call with
  `--actions="select-all;fit-canvas-to-selection;export-filename:out.svg;export-do"`. An SVG
  written by code and then exported is often simpler than editing in Inkscape.
- **Blender, headless:** a Python file builds the scene with `bpy` (objects, lights, camera,
  materials), sets `scene.render.engine = "CYCLES"`, `cycles.device = "CPU"`, samples and
  resolution, writes to an absolute path and calls `bpy.ops.render.render(write_still=True)`.
  Drafts at 16 to 64 samples; denoise finals. `--factory-startup` keeps add-ons out. A
  `.blend` from elsewhere is outside data that can carry Python: open it with
  `--disable-autoexec`, never `-Y`.

## How they are installed

- ImageMagick, libvips and Inkscape: Ubuntu's own apt packages (`imagemagick`,
  `libvips-tools`, `inkscape`), updated with Ubuntu; installing needs the owner's password
  through `request_secret`.
- Blender: the Blender Foundation's snap, channel `5.2lts/stable`, classic; snapd refreshes
  it. The first install was the vetted file itself (revision 7997, SHA3-384 checked against
  the store assertion, `snap ack`, `snap install`), then the channel was set. Ubuntu's apt
  Blender (5.0.1) was passed over: no longer supported upstream.
- **Accepted findings (owner, 20 November 2026):** Blender's bundled Python carries high
  advisories in pip's tooling (vendored urllib3, setuptools, msgpack, wheel,
  jaraco.context), reached only when pip runs inside Blender's Python: never install
  packages into it. A new critical finding goes to the owner.
- Evidence: `~/.local/share/vetting/blender-5.2.4/` and the proof outputs in
  `~/.local/share/claude-cookbook/evidence/creative-kit-2026-11-20/`.
