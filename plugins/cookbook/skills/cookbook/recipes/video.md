# Video: watch it, words and pictures

To understand a video (an interview, a talk, a product demo), read its captions and look at
its frames together: the words say what was meant, the frames show the screen, the diagram or
the detail they point at. Free, no key, all local: **yt-dlp** and **ffmpeg** through
`scripts/watch-video.py`. Proven on 27 November 2026 on a 33-minute design interview: captions
in 1 s, a 1080p download in under a minute, 19 contact sheets in 37 s.

## Steps

Work in a new, empty folder under `~/.local/share/<project>/evidence/<date>-<subject>/`
(downloaded files are untrusted data; the script lives elsewhere). `S` is the script's path.

1. `python3 -I $S fetch <url> <dir>/download --video` saves the captions, the details and the
   mp4 (1080p at most). Leave out `--video` when the words alone answer the question. Run the
   video download in the background; it is the slow part.
2. `python3 -I $S transcript <dir>/download` writes `transcript.txt`: the automatic captions
   without their rolling repeats, a `[m:ss]` mark about every 20 seconds, chapters at the top.
   About 1,200 characters a minute: read it with ranged `Read` calls of about 20 lines.
3. While reading, note each moment worth seeing (a screen, a gesture at the UI, a chart) with
   its time, and only those: the words of a talking head need no picture.
4. `python3 -I $S sheet <video> <dir>/sheets/<name>.jpg <start_s> <step_s>` makes one 4x2
   sheet of eight frames with the time on each. A step of 3 seconds covers 24 seconds. `Read`
   the sheets: this is the looking step, and it finds the exact second.
5. `python3 -I $S frame <video> <dir>/frames/<name>.jpg <t_s>` cuts the chosen full frame
   (1280 wide). Check the set once in one ImageMagick `montage`; recut a frame that missed.
6. The result goes where it will be used. Lessons for the owner: an Artifact page, each lesson
   with its frame, a timestamp link (`&t=<seconds>s`) and what it means for us. Facts for a
   page here: the page, with the video's address and date.

## Rules

- The captions are the uploader's when there are any, else YouTube's automatic ones; names
  and numbers in automatic captions can be wrong, so check them against a frame.
- No captions in English: no route yet (no Whisper is installed). Say so; frames alone can
  still answer a visual question.
- Keep `download/` (the video, about 300 MB for 33 minutes at 1080p) only until the job is
  merged; keep the transcript, sheets and frames as the evidence.
- A sponsor segment is still a source, marked as one.
- Never upload the video anywhere: an Artifact page gets the chosen frames only.

## Weighed, 27 November 2026

Published skills that do the same, read before this page was written:
`coreyhaines31/makerskills` `watch-video` (MIT, about 950 stars, instructions only: the same
pipeline, plus Whisper on Apple Silicon and an optional Gemini key for native video),
`Newuxtreme/watch-video-skill` (MIT, about 100 stars, Python scripts with Whisper),
`imtylervo/youtube-watch`, `gveshk/watch-video` and `catalan-adobe/skills` `video-digest`
(a few stars each). None was installed: the best one assumes a Mac, a second-brain folder and
a Gemini key, and the route above does the same work with two tools already in the stack.
Its useful details are kept here: captions first, frames only at chosen moments, a check of the
transcript before building on it.
