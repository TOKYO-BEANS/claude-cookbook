# Pre-read of local bulk (measured four times, not in the map)

The goal: open only the relevant part of a log, test output, long file or other chat's
transcript. **No design met its bar, so no map row points here.** Big output stays with
[context-mode](context-mode.md); search a file, then read the ranges around the hits.

1. Jev (`scripts/pre-read.mjs`), against a place bar: 90 % of the places that hold an
   answer opened, at most 10 % of the rows wasted, at most 35 % of the text, above a keyword
   rule. Whole parts: 21 of 21 relevant parts, but 39 % wasted rows and 46 % of the text. A
   Choice of lines: 36 % of the relevant lines, 17.6 % wasted. The script stays for
   measuring; never skip text on its verdict. How to run it: the comment at its top. Only
   with `--send` does text leave the PC, to TypeSafe (owner's yes, 17 November 2026: logs,
   long files, other chats' transcripts; not customer data or a product's live records),
   after what looks like a secret is taken out; nothing under the compaction plugin's
   `privateRoots` is sent. The accepted risk: a crafted text can steer its table
   (`handoff/2026-11-17-record-of-102.md`).
2. The plain options, same bar, new labels. `rg -i -C 3` with terms from the question:
   77.6 % recall, 89.6 % wasted, 21 % of the text. `ctx_search`: 13 to 30 % recall.
   Claude's own Grep, then ranged Reads: all 14 questions answered from 3.6 % of the text,
   12 % wasted, but 44.4 % recall: an answer stated in several places is found once.
3. An answer-based bar (owner's choice, 17 November 2026). A question counts when the
   opened text states every needed fact of a reference answer, written by readers who saw
   only the text, judged blind. Bar: 90 % answered, no wrong answer, at most 10 % wasted
   ranges, at most 35 % of the text, more answered than the keyword rule at the same lines.
   Claude's own Grep, then ranged Reads, one agent per question (14 questions, five new
   sources): 9 of 14 answered, one answer wrong, 14 of 45 ranges wasted, 9.5 % of the
   text, 7 of 12 against the keyword rule's 2. Missed on the first three points; a lenient
   reading (12 of 14, 11.4 % wasted without the two questions with no answer) still misses.
4. What it showed. Search, then read, opens little and is mostly right, but it misses what
   its words do not reach: programs started through a helper (`run("git", ...)`) when it
   searched for `execFile`, one failure of five in a chat, a summary just above the range
   read. A question with no answer costs ranges that hold nothing. The same method missed
   two bars, so no further variant is tried: it stays everyday practice, not a recipe.
