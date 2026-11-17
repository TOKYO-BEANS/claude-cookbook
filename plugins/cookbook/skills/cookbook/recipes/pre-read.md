# Pre-read of local bulk (measured, not in the map)

`scripts/pre-read.mjs` in the skill's folder (tests in the repository's
`scripts/pre-read.test.mjs`) is web batch's judge for local text. A log, a long file or another
chat's transcript is split into parts of about 3k tokens, Jev judges each part against one
question, and a table names the line ranges to open.

**It missed its bar, so no map row points here.** Big local output stays with
[context-mode](context-mode.md). Do not skip a part on its verdict; run it only to measure again.

1. The bar, written before the first call (`BAR` in the script): at least 90 % of the relevant
   parts come back `answers` or `uncertain`, and no question loses all of its own; at most
   10 % of `answers` rows are not relevant; the parts to open hold at most 35 % of the text;
   recall is above that of a keyword rule that opens as many parts.
2. Tested on 17 November 2026 (jev-1.14.0): two CI run logs, a 186 kB handoff file and two chat
   transcripts; 54 parts, 11 questions, 124 labels made by reader agents that saw only the
   parts and the questions. Recall was 21 of 21 (the keyword rule: 17 of 21). But 13 of 31
   `answers` rows were not relevant, and the parts to open held 46 % of the text: 34 of the 55
   opened parts were not relevant. It opens too much where every part is about a related
   subject (the handoff file: 21 of its 29 opened parts were not relevant). 518k Jev input
   tokens in 124 requests.
3. To measure again: `plan --question "<question>" <file>... --out <run>` splits and asks
   nothing. Label the parts (`{ "<source>.<part>": true | false }`; the labels never go to
   Jev), then `judge`, `report` and `score --out <run> --labels <file>`. `run` does plan, judge
   and report. `--kind log|file|transcript` overrides the guess (`.log`, a chat's `.jsonl`,
   else file). `--max-parts` (default 400, at most 2,000) caps a run; parts past it are listed
   as not judged. `show <file> --lines <a>-<b>` prints a chat's messages as text.
4. What leaves the PC: the text of each judged part goes to TypeSafe (owner decision,
   17 November 2026: local logs, long files and other chats' transcripts; customer data and a
   product's live records are another question). Never sent, and shown as an `error` row: a
   file in a folder of the compaction plugin's `privateRoots` ([compaction](compaction.md)), a
   file whose text or path names one, a chat that ran in or above one or that the plugin marked
   private, and every file when that list cannot be read. `--private-roots` adds folders.
5. What is written, in `~/.local/share/pre-read`: line ranges, sizes, hashes and
   probabilities. No text of a file or a chat goes into the run folder, the cache or the
   worker's job file: the worker reads each part from the file again and checks its hash. The
   key is `jev-compaction`, held only by the child that `with-key.mjs` starts. A failed call
   is an `error` row, never `doesn't`.
6. A next attempt changes the design, not the wording. TypeSafe's line-search cookbook asks one
   Choice over a part's lines beside the Noul, so a row names a few lines, not 3k tokens.
   Measure it on new labels: the 124 above are used up.
