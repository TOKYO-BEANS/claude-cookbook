# 27 November 2026: the mail sorter's undo, the two low review findings

**Why.** The last AI review of the sorter's undo (#280) had two low findings, kept for a
follow-up: a hand run that waited on the lock could get the same run id as the timer's sort
(the id was the time to the second), so `undo` would reverse both together; and a split moved
only the run's own mail, leaving older mail of the split senders in the folder Jev picked
without a word.

**What changed.**
- `scripts/proton-sort.py`: a run id is the time plus six random hex characters
  (`new_run_id`); `undo` counts the split senders' older mail in the picked folder (a read-only
  search by sender address) and names the count, to move by hand. It moves none of it: that
  mail was not the run's change.
- `recipes/proton-mail-sorting.md`: one sentence on that count.
- `scripts/proton-sort.test.mjs`: "two runs in the same second get run ids of their own", and
  the split test now finds one older mail and checks the sentence.

**Verification.** `node --test scripts/proton-sort.test.mjs`: 17 of 17 pass locally; the
whole suite runs in a Depot sandbox (see the pull request). After the merge the script is
copied to `~/.local/bin/` and one sort is run by hand.

**Then (the review of that follow-up, two lows).** The count runs only after a real undo
(in a dry run the run's own mail would be counted as older), and a failed count is named in
the summary instead of hiding what the undo did; tests "a failed count of older mail never
hides what the undo did" and the dry-run line in the split test. 18 of 18 pass locally.

**Dead ends.** None.

**Outstanding.** None.

**Evidence.** The pull request's test output. Release log: the `sa-release` run of this pull
request.
