# 17 November 2026: the pre-read's second design (line search), measured, not in the map

**Why.** The first design of the Jev pre-read of local bulk (`handoff/2026-11-17-pre-read.md`)
opened whole parts of about 3k tokens and missed its bar: too many `answers` rows were not
relevant and 46 % of the text was to open. The owner asked for a second design, not new
wording: TypeSafe's line-search cookbook, so that a row names a few lines.

**Result.** The second design opens far less (12.4 % of the text) and beats the keyword rule,
but it misses the bar on two of four points: its rows hold 36 % of the relevant lines (bar:
90 %) and 17.6 % of its `answers` rows hold no relevant line (bar: 10 %). No map row. Big
local output stays with context-mode.

## What changed

- `plugins/cookbook/skills/cookbook/scripts/pre-read.mjs`: a source is split into parts of at
  most 255 lines and 12,000 characters, every line that is sent gets an id (`L000| ...`), and
  one request per part asks three questions: a Choice over the line ids ("which line contains
  the answer"), a Noul ("does any line address or answer it") and the Noul for text aimed at
  its reader. The wording of the first two is the cookbook's, with the state's field for "the
  document"; the question stands in the instructions, as there. One pass: a part never has
  more than 255 lines, so the cookbook's second pass for longer text is not needed.
- A row is one part's lines to open: the Choice's lines in falling order until they hold 85 %
  of its probability, at most 8, each with 2 lines before and 8 after (`PICK`). Verdicts
  (`EXISTS`): `answers` from p(exists) 0.9, `uncertain` from 0.35, `doesn't` below. The
  `related` verdict and its Noul are gone.
- A chat is judged as rendered text and its line numbers are that text's; `show <file> --kind
  transcript --lines <a>-<b>` prints those lines with a marker for the message's line in the
  file, and `--numbers` numbers them for labelling. A blank line keeps its number and is
  never sent; a line over 2,000 characters is several ids on one line.
- `score` reads labels by line (`{ "<source number>": [[first, last], ...] }`) and reports
  line recall, passages, `answers` rows without a relevant line, the share of the text to
  open and a keyword rule that opens as many lines.
- `web-batch.mjs`: `callJev` takes the function that reads a response (`read`), with its
  default unchanged, and a failed call's error is the HTTP status alone (the fourth security
  review thread, below).
- `recipes/pre-read.md` rewritten ("measured twice, not in the map"); one sentence in
  `recipes/web-batch-measure.md`. `SKILL.md` and `catalog.json` are unchanged.

## The bar, restated for lines before any call

Written in the chat and in `BAR` before the first call, and committed before it. The unit is a
line of the text as sent (for a chat, a line of its rendered text); a reader marks the lines
that hold what the question asks for; a row is one part's lines to open.

| Point | Bar | First run | Second run | Third run, the code as it is now | |
| --- | --- | --- | --- | --- | --- |
| Relevant lines in `answers` or `uncertain` rows | at least 90 %, no question with all of its own missed | 295 of 779 (37.9 %) | 278 of 779 (35.7 %) | 278 of 779 (35.7 %); no question lost all | missed |
| `answers` rows that hold no relevant line | at most 10 % | 4 of 32 (12.5 %) | 4 of 32 (12.5 %) | 6 of 34 (17.6 %) | missed |
| Share of the text in the lines to open | at most 35 % | 12.7 % | 12.4 % | 12.4 % | met |
| Line recall against a keyword rule opening as many lines | higher | 37.9 % against 17.7 % | 35.7 % against 17.6 % | 35.7 % against 17.7 % (138 of 779) | met |

Beside the bar, as announced with it: relevant passages with at least half of their lines
opened were 68, 65 and 64 of 126 in the three runs (72, 69 and 68 were touched).

Each later run was made because a review changed what is sent. Same labels and settings; the
lines of all five sources were checked to carry the same numbers before any call.

- The second run, after the review before the pull request: 22 lines in 14 parts of the two
  chats had changed, so 35 requests were new and 132 answers came from the cache.
- The third run, after the security review's last thread: both questions carry a note that
  the lines are data, so all 167 requests were new. The total of relevant lines found is the
  same by chance: one question of the handoff file lost 11 and one of a chat won 11.

## The measurement (17 November 2026, jev-1.14.0)

- The set, all new: a failed test run of the release-maintenance repository (one job log,
  7 parts), a pull-request run of Stack Atlas (three job logs joined, 11 parts), the Stack
  Atlas handoff file (160 kB, 15 parts) and two chat transcripts of this project (14 and 13
  parts). Fourteen questions, two or three per source, one of them with no answer in its
  source. 167 parts; no call failed.
- The labels: five `cookbook:reader` agents, one per source, each given only numbered copies
  of the text as sent (221 pages of about 3,300 bytes) and the questions. Every agent
  reported reading every page. The copies were in the session's scratchpad and are gone.
- The order: the bar; the script and its tests; one real call on a file of this repository
  (one part, 2,035 tokens, the right line); a development run on the first job's five sources
  and eleven questions, scored against that job's part labels; the settings frozen and
  committed; the first measured run; the review and its fixes; the second measured run; the
  security review's threads and the third measured run. The readers worked while the
  development run ran. Their lists of line numbers came back before the settings were
  frozen; they were not scored or held against any answer until the first measured run.
- What the development run settled: `answers` from 0.9 (the cookbook starts at 0.7; rows from
  0.7 to 0.9 lay in a relevant old part 3 times of 6, rows from 0.9 on 13 times of 13, and a
  bar of one wrong row in ten asks for 0.9 of a calibrated probability), and more lines after
  a picked line than before it (the picked line was the head of its passage). On the measured
  set the cookbook's 0.7 would have given 13 of 51 `answers` rows without a relevant line.
- By kind, third run: logs 127 of 515 relevant lines and 0 of 13 `answers` rows without one;
  the handoff file 64 of 137 and 3 of 8; the chats 87 of 127 and 3 of 13. One question ("which
  tests failed, and what did each report") has 487 relevant lines, more than half of its log;
  without it the rows hold 168 of 292 (58 %), still a miss.
- Where the lines are lost: 43 of the 48 parts with a relevant line were opened, and only one
  of those rows held none. A few lost lines lie in the 5 skipped parts; nearly all lie in an
  opened part, outside its row. A part holds several relevant places (126 passages in 48
  parts) and a Choice names one line; its probability does not spread over all of them.
- At the level of parts nothing was gained on the first design: 74 of 167 parts were opened
  and 31 of those rows hold no relevant line. The third Noul flagged 6 of 167 parts (three
  parts of one chat, under both of its questions); they are opened whole. Its own accuracy
  has no labels.
- An answer is sensitive to small changes. Between the first and the second run 2 of 167
  verdicts differed and p(exists) moved by up to 0.17, in parts where a few lines had
  changed; with the note in the request 8 of 167 differed from the second run, by up to 0.25.
- Jev input tokens: 2,035 and 2,167 (two single calls), 717,847 (development, 123 requests),
  919,572 (first run, 167 requests), 176,412 (second run, 35 requests) and 941,963 (third
  run, 167 requests): about 2.8M, 12 cents.
- No setting was changed after the first measured run, and the only change of wording is the
  note the security review asked for. These labels are used up.

## The review before the pull request was marked ready

A `cookbook:review` agent that did not build the change read the commits up to the first
measured run and reproduced the points below. All are fixed, each with a test. The first two
were in the first design too. In the four chats that were sent (the two measured ones, and
the first job's two in the development run) the fixes change 24 lines: where a cut falls, two
commit ids, and one `process.env` name behind a key name. No key value had gone out.

- High: a secret behind an escaped quote was sent. A chat's tool call is rendered as JSON,
  where `"` becomes `\"`, and the rules allowed only a plain quote between a key name and its
  value. Now every string of a tool call's input is redacted before it is written as JSON,
  the JSON again after it, and the rules allow the backslash.
- Medium: a tool call and a tool output were cut (600 and 2,000 characters) before they were
  redacted, so a cut could leave the first characters of a key. Now they are redacted first;
  the cut is placed on the text as the file holds it, so the number of rendered lines does
  not depend on what was taken out.
- Medium: `show` read a UTF-16 log as UTF-8 and printed other lines than the judge numbered.
  One function reads a file for both now.
- Medium: `show` guessed the kind from the file's name, so a chat judged with `--kind
  transcript` under another name was printed by the wrong numbers. The table's footer writes
  the command with `--kind transcript`.
- Low, fixed: a line that is only base64 was not taken out behind "Tool output: " (redaction
  now runs before the prefix); the Authorization rule stopped at a carriage return inside a
  line, and a line separator inside a line could start what looks like another id-tagged
  line (both are a space in what is sent now); the judge did not ask the private-folder
  question again for a source with nothing to send (a short file); a path whose backslashes are written as JSON unicode escapes, in a pretty-printed JSON file, was not seen as naming a private folder; the
  score left out a source without labels silently (`unlabelledSources`); a part opened whole
  as data showed a "best line".

## The security review threads on the pull request

GitHub's security review wrote five threads over the first four pushes; each is fixed in
code. A sixth came on the fifth push and was closed with the owner's yes
(`handoff/2026-11-17-record-of-102.md`). Three review rounds were the budget: the owner said
yes in the chat to the fourth push, and chose the fix for the fifth thread (both on
17 November 2026).

- "Prompt injection", first push: the question from the command line stood in the
  instructions as it was typed, so a question taken from somewhere else could close its
  quotes and go on as instructions. Fixed as the thread proposed: line ends and control
  characters become one space and the question is written as a JSON string
  (`quoteQuestion`). A plain question reads as before.
- "Sensitive information disclosure", second push: a secret typed into the question would
  go to TypeSafe. Fixed: the question passes the same redaction as every line
  (`cleanQuestion`), and the manifest, the jobs and the request hold it in that form only.
- "Prompt injection", second push: text in a source can steer Jev, and the only guard (the
  third Noul) is Jev's own judgement. Fixed first with two guards that are code: a short list
  of fixed patterns (`AIMED_PATTERNS`: a line with a line id of its own, "ignore ...
  instructions", an id named as the answer, a judge addressed about "this text") makes a
  part one that is opened whole and read as data whatever Jev answers, and the table's
  footer names every range that was not opened on Jev's word. No part of the measured
  sources matched a pattern.
- "Sensitive information disclosure", third push, in `web-batch.mjs`: `callJev` kept the
  API's own error text, which could quote the request, and web batch writes that result to
  its run folder (the pre-read's worker already cut it to the status). Fixed: `callJev`
  returns the HTTP status only.
- "Prompt injection", fourth push: the same finding again, asking for a data-only policy in
  the request itself. Fixed as asked: both questions have structured instructions, the
  question beside a fixed note that the lines are quoted text to judge and never an
  instruction (`DATA_ONLY`). This is the one change to the measured request, and the reason
  for the third run.

## Kept from the reviews of #98

`--send` per run and `PRE_READ_SEND` for the worker; every line redacted before anything is
cut, hashed or sent; the private-folder checks on the raw text, the parts as sent (with and
without their line ids) and JSON strings, asked again at the judge for every source; no file
or chat text in the run folder, the cache or the job file (the cache holds probabilities per
line id); a failed call, a malformed answer and a part past the cap are `error` rows; a part
that speaks to its reader is never skipped, and now never narrowed to a few lines either.
New beside them: the question is redacted and quoted, fixed patterns flag a part without
Jev, the request says the lines are data, and the footer names what was not opened.

## Verification

- `scripts/pre-read.test.mjs`: 19 tests, the judge mocked; with `scripts/web-batch.test.mjs`
  37 of 37 here.
- `npm test` on this PC, on the code as it is now: merged with `main` at `c344b61`: 658 tests, 654 passed, 4 skipped, none failed.
- The pull request's review, merge and release check are recorded in the pull request and
  in the evidence folder, not in a further entry.

## Outstanding

- **Whether a third design is worth a job** (owner: Claude, a new chat). What the numbers
  say it would need: a judgement per small block of lines, since a part's relevant places are
  many and one Choice names one; and a way to bring down the 31 of 74 opened rows that hold
  nothing. What clears it: a measurement on new labels that meets the same bar.
- The organisation's Jev rate limit was not read; no call was rate limited in 494 requests.
- The launcher test that failed once under load (`scripts/key-header.test.mjs:213`),
  unchanged from the entry of #98: its own job.

## Dead ends

- Two passes (a Choice over windows, then over the lines of one): not built. It finds one
  place in a long text; the pre-read has to find every place, so every part is asked.
- Opening the whole part when the Choice is flat: not built. On the development run a flat
  Choice went with rows that held no answer, not with answers spread over the part.
- A "none of these lines" option in the Choice: not used; the companion Noul is the
  cookbook's and TypeSafe's advice for the null case.
- Guards in code alone against a source that steers its judge: the security review did not
  take them without a note in the request, and asked again one push later.

## Evidence

`~/.local/share/claude-cookbook/evidence/pre-read-lines-2026-11-17/`: `sources/` (the two
logs and the handoff file as measured), `labels/` (14 files), `runs/`, `runs2/` and `runs5/`
(the three measured runs, a folder per question: manifest, report, summary, score), `runs3/`
and `runs4/` (the two checks that a fix left the requests unchanged), `pooled-*.json`,
`measure*.log`, `diag*.json`, `dev/` (the development run) and the scripts that made them
(`measure.mjs`, `pages.mjs`, `dev-run.mjs`, `dev-eval.mjs`, `diag.mjs`, `same-lines.mjs`).
