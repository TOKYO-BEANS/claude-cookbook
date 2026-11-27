"""Watch a video: its words (captions) and its pictures (frames), for recipes/video.md.

Run with `python3 -I`, from outside the work folder (the folder holds downloaded files).

  fetch <url> <dir> [--video]   captions + details into <dir>; --video also saves an mp4 (1080p max)
  transcript <dir>              <dir>/transcript.txt: captions without the rolling repeats,
                                a [m:ss] mark about every 20 s; prints title, length, size
  sheet <video> <out.jpg> <start_s> <step_s>
                                8 frames, one every step_s from start_s, in a 4x2 sheet
                                with the time on each frame
  frame <video> <out.jpg> <t_s> one full frame, 1280 wide
"""
import html
import json
import pathlib
import re
import subprocess
import sys

TS = re.compile(r"(\d+):(\d\d):(\d\d)\.\d+ -->")
TAG = re.compile(r"<[^>]+>")


def run(argv):
    subprocess.run(argv, check=True)


def fetch(url, folder, video):
    if not re.match(r"^https://[^\s]+$", url):
        sys.exit("fetch: give an https:// address")
    out = pathlib.Path(folder)
    out.mkdir(parents=True, exist_ok=True)
    run(["yt-dlp", "--skip-download", "--write-info-json", "--write-subs", "--write-auto-subs",
         "--sub-langs", "en,en-orig,en-US,en-GB", "--sub-format", "vtt",
         "-o", str(out / "v.%(ext)s"), "--", url])
    if video:
        run(["yt-dlp", "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]",
             "--merge-output-format", "mp4", "-o", str(out / "video.%(ext)s"), "--", url])


def pick_vtt(folder):
    for name in ("v.en.vtt", "v.en-US.vtt", "v.en-GB.vtt", "v.en-orig.vtt"):
        if (folder / name).exists():
            return folder / name
    found = sorted(folder.glob("v.*.vtt"))
    if not found:
        sys.exit("transcript: no captions in this folder; the video has none in English")
    return found[0]


def transcript(folder):
    folder = pathlib.Path(folder)
    vtt = pick_vtt(folder)
    parts, last, now, mark = [], None, 0, -999
    for raw in vtt.read_text(encoding="utf-8").splitlines():
        m = TS.match(raw)
        if m:
            h, mi, s = map(int, m.groups())
            now = h * 3600 + mi * 60 + s
            continue
        if not raw.strip() or raw.startswith(("WEBVTT", "Kind:", "Language:")):
            continue
        text = html.unescape(TAG.sub("", raw)).strip()
        if not text or text == last:
            continue
        last = text
        if now - mark >= 20:
            parts.append(f"\n[{now // 60}:{now % 60:02d}] ")
            mark = now
        parts.append(text + " ")
    info = {}
    if (folder / "v.info.json").exists():
        info = json.loads((folder / "v.info.json").read_text(encoding="utf-8"))
    head = [f"Title: {info.get('title', '?')}", f"Channel: {info.get('channel', '?')}",
            f"Uploaded: {info.get('upload_date', '?')}", f"Length: {info.get('duration_string', '?')}",
            f"Captions: {vtt.name}"]
    for ch in info.get("chapters") or []:
        start = int(ch["start_time"])
        head.append(f"Chapter [{start // 60}:{start % 60:02d}] {ch['title']}")
    body = "".join(parts).strip()
    (folder / "transcript.txt").write_text("\n".join(head) + "\n\n" + body + "\n", encoding="utf-8")
    print("\n".join(head[:5]))
    print(f"transcript.txt: {len(body)} characters, {body.count(chr(10)) + 1} lines")


def sheet(video, out, start, step):
    start, step = float(start), float(step)
    draw = (f"fps=1/{step},scale=640:-1,drawtext=text='%{{pts\\:hms\\:{start}}}':x=8:y=8:"
            "fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=4x2")
    run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", str(start), "-i", video,
         "-t", str(step * 8), "-vf", draw, "-frames:v", "1", out])


def frame(video, out, t):
    run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", str(float(t)), "-i", video,
         "-frames:v", "1", "-vf", "scale=1280:-1", "-q:v", "3", out])


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    cmd, args = argv[1], argv[2:]
    if cmd == "fetch" and len(args) in (2, 3):
        fetch(args[0], args[1], "--video" in args[2:])
    elif cmd == "transcript" and len(args) == 1:
        transcript(args[0])
    elif cmd == "sheet" and len(args) == 4:
        sheet(*args)
    elif cmd == "frame" and len(args) == 3:
        frame(*args)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
