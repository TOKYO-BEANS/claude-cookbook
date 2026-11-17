# 17 November 2026: pre-read of local bulk, fourth attempt: an answer-based bar, missed

**Why.** The owner wants Claude to open only the relevant part of local bulk (logs, CI and
test output, long files, other chats' transcripts). The third attempt showed Claude's own
Grep, then ranged Reads, answering every question from 3.6 % of the text but missing the
place-based recall. The owner chose "Yes, answer-based bar" (17 November 2026): score whether
the opened text answers the question, measure that method again, and give it a map row as a
plain recipe if it passes.

**Result.** It does not pass: 3 of the 5 points are missed, and a lenient reading still
misses all three. No map row; no new tool. `recipes/pre-read.md` records the fourth attempt and why
nothing further is tried.

## What changed

- `recipes/pre-read.md`: rewritten for four attempts (the answer-based bar, its scores, what
  they showed). `recipes/web-batch-measure.md`: "three attempts" became "four attempts".
- `handoff/2026-11-17-pre-read-plain-options.md`: its Outstanding item now points here.
- No code.

## The measurement (all local; only Claude's own subagents saw the text)

- **Order.** `bar.md` (the bar, the method's exact instruction, the sources by size and
  date, 14 questions written from the kind of source alone) before any source was read.
  Then the reference answers and the searchers, in parallel and blind to each other; then
  an addendum (two facts that state an absence, and point 5 on the 12 questions with facts)
  before any scoring; then the blind judges; then `score.mjs`.
- **Sources, all new:** the failed jobs of a CI run of another repository of the
  organisation (437 lines), a full local test run of it (398 lines), a 1,477-line module of a
  third repository, and two chats of two other projects of 17 November 2026 rendered by
  `pre-read.mjs show` (1,354 and 2,551 lines).
- **Reference answers:** five `cookbook:reader` agents, one per source, given only numbered
  copies in pages of about 3,300 bytes and the questions, told to read every page and not
  to search; each reported reading every page (182). A list of needed facts per question,
  with lines; two questions have none (no question dialog was used in either chat).
- **The method, S:** one `general-purpose` agent per question on the session's model, given
  only the file, the question and the instruction frozen in `bar.md` (Grep with `-n -i`,
  Read ranges of about 20 to 60 lines, stop when complete, end with JSON). The calls and
  what came back were taken from the transcripts. context-mode cut nothing; Claude Code's
  own large-output preview shortened one Grep, so "asked for" (the text point) counts the
  full `rg` result and the judges saw only what came back.
- **Judges:** five `cookbook:reader` agents, one per source, saw each question's needed
  facts and two texts as "X" and "Y" (S and the keyword rule at the same lines, order by
  question number), each as numbered blocks, with no method named. A sixth compared S's
  answers with the reference answers.

| Point | Bar | S | Met |
| --- | --- | --- | --- |
| 1. Answered by the opened text | at least 90 % | 9 of 14 (64.3 %) | no |
| 2. No wrong answer | none | 1 (the module's child processes) | no |
| 3. Wasted ranges | at most 10 % | 14 of 45 (31.1 %) | no |
| 4. Text | at most 35 % | 1,925 of 20,367 lines (9.5 %) | yes |
| 5. Above the keyword rule | more answered | 7 of 12 against 2 of 12 | yes |

- **Why each miss.** The wrong answer: the module starts `gitleaks` and `git` through an
  injected `run(...)`; S searched for `execFile` and `spawn`, found two programs and said
  "only these two". Q14: one failure of five in a chat was not found. Q1: the run's summary
  lines sat just above the range read. Q5: a side part of one fact (a "why") was not in the
  opened text. Q12: two facts (the details of the fix commit and the pull request's end
  state) were not in the opened text, though S's answer, from search hits, named both and
  was judged correct. Wasted ranges: 10 of the 14 are on the two
  questions with no answer, where every range read to confirm the absence holds nothing.
- **Leniency check.** Counting Q1, Q5 and Q12 as answered (the most generous reading) gives 12 of 14 (85.7 %), and
  leaving the two questions without an answer out of point 3 gives 4 of 35 (11.4 %): both
  still miss, and the wrong answer stands, so the result does not hang on the strict rule.

## Why nothing further is tried

The same method, search then read, has now missed two bars (the third and fourth attempts),
after two Jev designs missed the first. By the owner's rule (17 November 2026) no third
variant of a twice-failed approach is tried. It stays Claude's everyday practice with
context-mode, without a map row or a promise.

## Verification

- `score.json` in the evidence folder, recomputed by `score.mjs` from `refs.json`,
  `s-runs.json`, `k-runs.json` and `judgements.json`; every number above is from it.
- `npm test` on this PC, on this change: 670 tests, 666 passed, 4 skipped, none failed, in
  1,337 seconds (`npm-test.log` in the evidence folder). It ran before `main` was merged in;
  that merge brought only CI files (#112), and CI passed on the merged head. The review, the
  merge and the
  release check are recorded in the pull request's closing comment.

## Outstanding

- Whether to close the pre-read outcome or set a new direction is the owner's (asked in
  the chat, 17 November 2026).
- The launcher test that failed once under load (`scripts/key-header.test.mjs:213`):
  unchanged, its own job.

## Evidence

`~/.local/share/claude-cookbook/evidence/pre-read-answer-2026-11-17/`: `bar.md` (with its
addendum), `questions.json`, `refs.json`, `s-runs.json` (calls, lines asked and back,
blocks, answers; no source text), `k-runs.json`, `judgements.json`, `score.json`,
`sizes.json`, `npm-test.log` and the scripts (`pages.mjs`, `replay.mjs`, `score.mjs`). The CI log, the test
run and the module are in `sources/`; the two chats' renderings and all page copies were
removed (make them again with `pre-read.mjs show <file> --kind transcript --lines
1-999999`).
