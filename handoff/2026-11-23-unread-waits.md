# 23 November 2026: unread mail waits in its account folder

**Why.** The owner saw a new mail marked only under All mail: the sorter had already filed it
in a sender sub-folder under a collapsed account folder, and Proton shows no sub-folder's
unread count on its parent (open UserVoice requests since February 2026). Owner's choice in
the question dialog, 23 November 2026: unread mail stays in the account folder until read.

**What changed.** `proton-sort.py` asks the Bridge for the folder's unread mail (`UID SEARCH
UNSEEN`); unread mail goes to, or stays in, `Folders/<account>` and is filed under its sender
on the first run after it is read. Jev is not asked about unread mail. The run's line counts
the unread moved up and the unread waiting. `recipes/proton-mail-sorting.md` says so; a new
test covers it.

**Verification.** The suite on boat; after the merge the script is copied to `~/.local/bin`,
one run by hand and the timer checked (the recipe's "After a change").

**Outstanding.** None. Mail never read (newsletters) stays in the account folder until it is
marked read: that is the chosen behaviour.

**Dead ends.** None.

**Evidence.** The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-unread-waits/release-check.log`.
