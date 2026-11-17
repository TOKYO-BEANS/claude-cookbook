# Pre-read of local bulk (measured twice, not in the map)

`scripts/pre-read.mjs` in the skill's folder is web batch's judge for local text. A log, a
long file or another chat's transcript is split into parts of at most 255 lines; every line
gets an id, and one request per part asks Jev, as TypeSafe's line-search cookbook does: a
Choice (which line contains the answer) and a Noul (does any line address or answer it). A
table names, per part, the few lines to open.

**Both designs missed the bar, so no map row points here.** Big local output stays with
[context-mode](context-mode.md). Do not skip text on its verdict; run it only to measure again.

1. The bar, written before the first call (`BAR` in the script), per line of the text as sent:
   at least 90 % of the relevant lines lie in rows that come back `answers` or `uncertain`,
   and no question loses all of its own; at most 10 % of `answers` rows hold no relevant line;
   the lines to open hold at most 35 % of the text; recall is above that of a keyword rule
   that opens as many lines.
2. Measured on 17 November 2026 (jev-1.14.0): two CI logs, a 160 kB handoff file and two chat
   transcripts; 167 parts, 14 questions, the relevant lines marked by reader agents that saw
   only the text and the questions. The rows held 278 of 779 relevant lines (36 %; the
   keyword rule 18 %) and 4 of 32 `answers` rows held none (12.5 %): two points missed. The
   lines to open were 12.4 % of the text. 42 of the 48 parts with a relevant line were
   opened; the lost lines lie in those parts, outside the row, because a part holds several
   relevant places and a Choice names one. About 5.5k Jev input tokens a part.
3. The first design (three Nouls per part, the whole part opened) found 21 of 21 relevant
   parts, but 12 of 31 `answers` rows were not relevant and 46 % of the text was to open.
4. Settings (`EXISTS`, `PICK`), frozen on the first design's sources before the new labels
   were scored: `answers` from p(exists) 0.9, `uncertain` from 0.35; a row is the Choice's
   lines that hold 85 % of its probability, at most 8, each with 2 lines before and 8 after.
5. To measure again: `plan --question "<question>" <file>... --out <run>` asks nothing. Mark
   the relevant lines (`{ "<source number>": [[first, last]] }`; they never go to Jev), then
   `judge --send`, `report` and `score --out <run> --labels <file>`. A chat is judged as
   rendered text, with that text's line numbers: `show <file> --kind transcript --lines <a>-<b>`.
6. What leaves the PC, and only with `--send`: the judged text goes to TypeSafe (owner
   decision, 17 November 2026: local logs, long files and other chats' transcripts; customer
   data and a product's live records are another question), after what looks like a secret
   is taken out (best effort). Never sent, and shown as an `error` row: a file in a folder
   of the compaction plugin's `privateRoots` ([compaction](compaction.md)), a file whose text
   or path names one, a chat that ran in or above one or that the plugin marked private, and
   every file when that list cannot be read (`--private-roots` adds folders).
7. The text is data. A third Noul asks whether a part speaks to whoever judges it; such a
   part is opened whole (6 of 167; its accuracy is not measured). On disk
   (`~/.local/share/pre-read`): line numbers, hashes and probabilities, never text. The key is
   `jev-compaction`, held only by `with-key.mjs`'s child. A failed call is an `error` row.
8. A next attempt needs a judgement per small block of lines, and new labels.
