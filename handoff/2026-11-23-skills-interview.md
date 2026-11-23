# 23 November 2026: the mattpocock/skills interview read against the measured runs

**Why.** The owner asked on 23 November 2026 whether the author's two-hour interview, with
its point about winning battles against winning the war, changes the result of #244.

**What changed.** It changes no owner and no number. It changes what the numbers say: they
are one-task results, and his claim is about a repository over months, which neither side
has measured.

- `options/skills-compared-interview.md` (new, linked from `options/skills-compared.md`):
  what he claims, what that does to our result, each of his long-run habits against what is
  here, why his setting is not ours, and what would measure the long run.
- `recipes/architecture-review.md`: the first candidate of the trial was built the same
  day, so "no candidate is built yet" is replaced by its result (the two files lost 713
  lines to one module of 607, and the move showed five old defects no review had named).
  Three descriptive clauses went for room: the dates of the 150 commits, "plus the main
  chat's checks" and "nothing installed". No rule sentence changed.
- `catalog.json`: `architecture-review` from `trial` to `active`. The entry for #242 set
  the condition, a built candidate.

**Verification.** The whole transcript was read (the video's own English captions, 1,326
cues, turned into text with a time mark per minute). The built candidate's numbers are
GitHub's per-file counts on the product's merged pull request (542 and 194 lines removed,
10 and 13 added, 607 in the new module); "five old defects" is the count in the summary of
the pull request that fixes them, which was open and in review when this was written. The
Cookbook check and the suite on boat for this commit.

**Outstanding.**

- Whether changes in those files cost less after the candidate is not measured. Owner:
  Claude, in the product's own chats; cleared by comparing pull requests on the same files
  before and after (tokens, files the review could not read, defects found later).
- The product's next candidate changes a file that an open draft pull request also changes,
  and that draft waits on the owner. The candidate starts after it, in its own chat.
- Medium against high effort is not measured here. Nobody is on it.
- `pr-text` stays at `trial`, as in the entry for #244.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-23-skills-compare/interview/`
(`v.en.vtt`, `v.info.json`, `transcript.txt`). The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-23-cookbook-skills-interview/release-check.log`.
