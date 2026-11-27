# 27 November 2026: watching a video, words and pictures

**Why.** The owner asked for a design interview to be transcribed, with screenshots at every
useful moment, and asked whether a published skill already does that well before one is built.

**What changed.**
- `recipes/video.md`: the route (captions, transcript, contact sheets, chosen frames, result
  page) and the published skills weighed.
- `scripts/watch-video.py`: `fetch`, `transcript`, `sheet`, `frame`; yt-dlp and ffmpeg only.
- `catalog.json`: entry `ffmpeg` (Ubuntu's apt package); `yt-dlp` now names the new page.
  `stack-updates` reads ffmpeg's version.
- `SKILL.md`: the images row also covers watching videos and links the page. To make room
  (14,000-byte limit) the two photo rows are one row with the same content, "this PC ... on
  Linux" reads "this laptop", and three "**Cookbook**" are no longer bold.

**Verification.** Every script command run on the 33-minute interview: captions and details in
about 1 s, a transcript of 38,552 characters with no HTML entities left, a contact sheet, a
frame, the usage text on a wrong command, and a refusal for a non-https address.
`node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the pull request).

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-video-lessons/`
(`transcript-clean.txt`, `sheets/`, `frames/`; `download/` with the video is removed after the
merge). The lessons page is a private Artifact for the owner. Release log: the `sa-release`
run of this pull request.

**Dead ends.** Installing a published skill: the best one (`coreyhaines31/makerskills`
`watch-video`) assumes a Mac, Whisper and a Gemini key; the others are small and newer. Reason
and what was kept are on the page.

**Outstanding.** A video with no English captions has no route (no Whisper installed); owner's
call if one is ever needed.
