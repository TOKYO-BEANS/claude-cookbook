# Pre-read of local bulk (measured three times, not in the map)

The goal: open only the relevant part of a log, test output, long file or other chat's
transcript. **No design met the bar, so no map row points here.** Big output stays with
[context-mode](context-mode.md); search a file, then read the ranges around the hits.

1. The bar: at least 90 % recall and no question with nothing opened; at most 10 % of the
   rows to open hold nothing relevant; at most 35 % of the text; recall above a keyword rule
   that opens as much.
2. Jev (`scripts/pre-read.mjs`, 17 November 2026). One request per part of at most 255
   lines. Three Nouls per part: 21 of 21 relevant parts, but 39 % of the `answers` rows were
   not relevant and 46 % of the text was to open. A Choice of lines with a Noul: 36 % of
   the relevant lines, 17.6 % wasted rows. A part holds several relevant places; one
   judgement names one. The script stays for measuring; never skip text on its verdict.
   How to run it: the comment at its top. Only with `--send` does text leave the PC, to
   TypeSafe (owner's yes, 17 November 2026: logs, long files, other chats' transcripts;
   not customer data or a product's live records), after what looks like a secret is taken
   out; nothing under the compaction plugin's `privateRoots` is sent. The accepted risk: a
   crafted text can steer its table (`handoff/2026-11-17-record-of-102.md`).
3. The plain options (17 November 2026, new labels on five new sources: a CI log, a test
   run, a README, two chats; 14 questions; 52 places of at most 40 lines, each with a key
   line, marked by readers who saw only the text). Recall is the mean over questions of
   the places whose key line lies in a row.

   | Method | Recall | Wasted rows | Text |
   | --- | --- | --- | --- |
   | `rg -i -C 3` with terms written from the question | 77.6 % | 89.6 % | 21.0 % |
   | the same, the 5 best 21-line windows | 38.4 % | 65.4 % | 3.0 % |
   | the keyword rule at 35 % of the text | 48.2 % | 94.4 % | 31.1 % |
   | `ctx_search`, the question as the query | 13.1 % | 90.9 % | 3.8 % |
   | `ctx_search`, the terms as the query | 29.6 % | 81.3 % | 1.8 % |
   | Claude's own Grep, then ranged Reads | 44.4 % | 12.0 % | 3.6 % |

4. What it showed. Claude's own search, then read, answered all 14 questions from 3.6 % of
   the text, and 88 % of its ranges held a relevant line; it misses on recall because an
   answer stated in several places is found once. A search that reaches most places opens
   mostly noise. A judge that filters the search's windows cannot pass 77.6 % recall,
   and a wider search brings back the regime where both Jev designs failed. So nothing was
   built.
5. A fourth attempt needs a new bar first: one scored on whether the opened text answers
   the question, not on finding every place. That is the owner's call.
