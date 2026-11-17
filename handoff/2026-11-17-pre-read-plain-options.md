# 17 November 2026: pre-read of local bulk, third attempt: the plain options, not in the map

**Why.** The owner wants Claude to open only the relevant part of local bulk (logs, CI and
test output, long files, other chats' transcripts). Two Jev designs missed the bar (#98,
#102). The owner's direction for this attempt: rethink after two failures, simple first. So
the plain options were measured against the same bar before anything was built.

**Result.** None of six plain options met the bar, and the shortfall rules out a small build
on top of them, so nothing was built and the map has no row. `recipes/pre-read.md` records
why.

## What changed

- `recipes/pre-read.md`: rewritten for three attempts; the plain options' table and what it
  showed. `recipes/web-batch-measure.md`: "two designs" became "three attempts".
- `handoff/2026-11-17-pre-read-second-design.md`: its Verification section now points at
  `handoff/2026-11-17-record-of-102.md` (the AI review's low finding on #105).
- No code. `scripts/pre-read.mjs` and its tests are unchanged.

## The measurement (all local; nothing was sent to an outside service)

- **Order.** The bar, the questions and each question's search terms were written to
  `bar.md` before any source was read. Then the sources, the rows of B, C and K (their
  script reads no labels), the readers' labels, the scores of B, C and K; then an addendum
  for method S, written before S or the context-mode runs were scored.
- **The unit: a place.** At most 40 consecutive lines that hold an answer or a needed piece
  of it, with one key line. Opened: the key line lies in a row. Recall is the mean over
  questions, so a question whose answer is half of its source counts once.
- **Sources, all new:** a failed Windows test job of a CI run of another repository of the
  organisation (2,554 lines), `npm test` of this repository on this PC (889 lines; the run
  hung and was stopped at 1,200 seconds), context-mode 2.1.0's README (679 lines), and two
  chats of two other projects rendered by `pre-read.mjs show` (2,322 and 1,531 lines).
  Fourteen questions, two or three per source; one (DNS records) has no answer.
- **Labels:** five `cookbook:reader` agents, one per source, given only numbered copies in
  pages of about 3,300 bytes and that source's questions, told to read every page and not
  to search. Each reported reading every page (217 in all). 52 places. The page copies and
  the agents' saved search results left the scratchpad: with the two chats' renderings they
  were moved to `~/.local/share/backups/pre-read-plain-scratch-2026-11-17/`, since a
  recursive delete is blocked on this PC, and then, with the owner's yes in the chat
  (17 November 2026), deleted file by file (247 files).
- **Methods and scores:**

  | Method | Recall | Wasted rows | Text | Above the keyword rule |
  | --- | --- | --- | --- | --- |
  | B: `rg -i -C 3` with terms written from the question | 77.6 % | 355 of 396 | 21.0 % | yes (44.9 %) |
  | C: the same hits, the 5 best 21-line windows | 38.4 % | 17 of 26 | 3.0 % | yes (14.2 %) |
  | K: the keyword rule at 35 % of each source | 48.2 % | 1,078 of 1,142 | 31.1 % | yes, above a blind rule (28.5 %) |
  | A: `ctx_search`, the question as the query | 13.1 % | 60 of 66 | 3.8 % | no (21.2 %) |
  | A2: `ctx_search`, the terms as the query | 29.6 % | 52 of 64 | 1.8 % | yes (11.5 %) |
  | S: an agent per source, Grep then ranged Reads | 44.4 % | 3 of 25 | 3.6 % | yes (16.9 %) |

- **S in detail.** Five agents on the session's model, given only the file and its
  questions. Their Grep and Read calls were taken from their transcripts and replayed. They
  answered all 14 questions, the DNS question with "none"; read against the labelled
  places, no answer contradicts them. Recall is low because an answer stated in several
  places of a chat is found once (a pull request named in 7 places), and because three
  questions have no place opened: one was answered from a Read made for an earlier
  question, one from Grep lines without context (not opened under the frozen rule), one
  from lines beside the labelled places. Counting every line shown as opened: 64.4 %
  recall, 88.5 % wasted rows.
- **context-mode's cut** (4,096 bytes) replaced four of the agents' Grep or Read results
  with a pointer; the agents narrowed and asked again. The replay counts what was asked for.

## Why nothing was built

B is the only option near the recall point (77.6 %), and 90 % of its windows hold nothing
relevant. A judge that filters B's windows (a Jev Noul per window) can lower the waste but
cannot raise recall above 77.6 %; a wider search to raise recall brings back the many
windows and the share of text where both Jev designs failed. That would be a third variant
of a twice-failed approach.

## Verification

- `npm test` on this PC, on this change: 658 tests, 654 passed, 4 skipped, none failed, in
  1,402 seconds (over the 1,200-second guide on a busy PC). An earlier run on `main` plus
  the handoff fix, made as a source for the measurement, hung and was stopped at 1,200
  seconds with 10 failures: Windows exit code 0xC0000142 (a child process could not start)
  under load, not this change.
- The scores: `score-*.json` in the evidence folder, recomputed by `score.mjs` from the
  rows and the labels.

## The record of #109 (17 November 2026)

- The one `ai-review` run, on the head `9b42a63` when it was marked ready, posted "review
  unavailable" (the review key's credit balance is too low). A fallback review by a
  `cookbook:review` subagent read the whole diff with the base branch's rubric: two low
  findings, both about this entry's wording, fixed here. Every number in the change matched
  the evidence's score files.
- Checks on the head passed (`Depot CI / test`, `Depot CI / semgrep`, `Analyze (actions)`,
  `Analyze (javascript-typescript)`, `CodeQL`, `test (windows-2025)`, `Graphify`); `Graphify
  Formal Verification` did not run (Markdown only).
- Merged by `sa-release` as `1f79f02` ("review gate: allowed (fallback review)"). The
  release check of `1f79f02`: `verified`, acknowledged, execution 1692, five checks on the
  merge commit. The installed plugin was updated from `8ee6081` to `1f79f02`.

## Outstanding

- **A fourth attempt, with an answer-based bar** (owner: Claude, a new chat). The bar
  counts every place an answer is stated; the outcome is that Claude reads little and
  answers right. Asked in the chat on 17 November 2026, the owner chose "Yes,
  answer-based bar": write a bar scored on whether the opened text answers the question,
  before any run; new labels; measure Claude's own Grep, then ranged Reads, against it. If
  it passes, a map row as a plain recipe, no new tool.
- The launcher test that failed once under load (`scripts/key-header.test.mjs:213`):
  unchanged, its own job.

## Evidence

`~/.local/share/claude-cookbook/evidence/pre-read-plain-2026-11-17/`: `bar.md` (with its
addendum), `release-cookbook-109-merge.log`, `result-cookbook-109-merge.json`, `questions.json`, `labels/labels.json`, `rows/*.json`, `score-*.json` and the
scripts (`pages.mjs`, `methods.mjs`, `ctxrows.mjs`, `replay.mjs`, `score.mjs`). The CI log,
the test output and the README are kept in `sources/`; the two chats' renderings are not
(make them again with `pre-read.mjs show <file> --kind transcript --lines 1-999999`).
