# 27 November 2026: the mail sorter shows and undoes each run

**Why.** The rule in `recipes/agent-changes.md`: an agent's or a model's change comes with a
summary, the changes and an undo. The sorter (Jev joins new senders to groups) printed a count
only, recorded no move, and had no undo: a wrong join meant moving mail by hand and editing
`state.json`.

**What changed.**
- `scripts/proton-sort.py`: each move is logged in `moves.jsonl` (run, from, to, Message-ID),
  and each Jev join too. A run that changed something prints its run id. New commands:
  `changes [--run ID]` (the moves by from, to and count, and Jev's joins) and
  `undo [--run ID] [--dry-run]`. Undo moves each mail back only if it is still where the run
  put it, and keeps it there in later runs (`kept` in the state, last 5,000). It gives each
  sender Jev joined a group of its own unless a person changed it since, and refuses a run
  already undone. Nothing is deleted; folders the run made stay. The mail already put back is
  kept even when a move fails partway (an AI fix commit, from the review's medium finding),
  and a sort and an undo hold a lock file in the state folder, so neither saves an older
  state over the other (the review's low finding). Splitting a Jev join moves every
  address that followed it (the same rule key) to the new group and gives the picked group
  back its addresses and tokens from before the join (the second review's medium finding).
- `recipes/proton-mail-sorting.md`: the new file and the two commands.
- `scripts/proton-sort.test.mjs`: two tests. One sorts, shows, undoes (dry and real), checks
  the boxes equal the start, re-sorts and finds nothing to move, then a second undo is refused.
  Another case leaves a mail a person deleted alone. The other test undoes a Jev join and the
  next run does not ask Jev again.

**Verification.** `node --test scripts/proton-sort.test.mjs`: 16 of 16 pass locally; the
whole suite runs in a Depot sandbox (see the pull request). After the merge, the script is
copied to `~/.local/bin/` and one run by hand is made (the recipe's "After a change").

**Dead ends.** None.

**Outstanding.** None for this pull request.

**Evidence.** The pull request's test output. Release log: the `sa-release` run of this pull
request.
