# Agent changes: a summary, the changes and an undo

The owner's yes, 27 November 2026, from a design interview's lesson ("made some changes", with
a short summary, a "show changes" toggle and an undo): wherever a model or an agent changes
something people use, they get those three. It holds for Claude, `claude -p`, Codex, Jev and
a T3 scheduled task, in products and in our own tools, for data, files, settings, mail,
pages and dashboards.

## The three, and how each is checked

1. **A summary.** One or two plain lines where the person already looks (the pull request,
   the record, the page's log, the run's report): what changed, how many, and that a model
   did it ("AI fix", "Jev's guess"). A setting changed outside the diff (a ruleset, a
   deploy, a scheduled task) is named too. Check: read the summary without the code and say
   what changed.
2. **Show changes.** Before and after for each item, kept where the summary points: the
   commit, a log row with the old and new value of every field it changed, a copy of the
   file or the earlier version. A count alone is not a diff. Check: pick one item from the
   summary and find its before and after.
3. **An undo.** One step, named beside the summary (a button, a command, `git revert
   <sha>`), that puts back the before state. The before state is stored before the change,
   all of it: an undo that cannot restore one field (a sort number, an earlier reading) is
   not an undo. A person's own choice always wins over a model's, and an undo never
   overwrites what a person changed after the model. Check: a test makes the change, undoes
   it, and finds the item equal to the original.

## Each kind

| Kind | Summary | Show changes | Undo |
| --- | --- | --- | --- |
| Commits and pull requests (AI fix, `sa-*` builds, onboarding) | the pull request comment or body, the model's own summary included | the commit; a setting's old value in the body | `git revert <sha>` and, for the AI fix, the `no-ai-fix` label, both named in the comment |
| Product data a model changes (Jev in a product) | a label on the record and a line in the page's log | the log row: old and new value of every field | per row or per run, on the same page |
| Mail, files or notes a script moves or edits | one line per run | a log per item: id, from, to | a command that plays the run's log backwards |
| Dashboards and artifacts an agent refreshes | one line per run | the earlier version kept | publish the earlier version again |
| Memory, notes and other files outside git | the run's report names each file | a copy of the file before the edit, in `~/.local/share/claude-cookbook/agent-changes/<date>/` | copy it back |
| Actions on a website in a browser | the report names each change | page, action and target, never a typed value | the way back on that site, named; none means it is a write on a live system and its stops hold |

Out of scope: what changes no one's data (a review comment that only reports, a model's own
context, report files in an output folder) and a change made by fixed rules alone, even
when an agent runs it.

## What cannot be undone

A sent mail, a payment, a publication or a deletion at a provider has no undo. It gets the
summary and a preview before it happens (a draft, a dry run) and goes through the ground
rules' stops: a message to other people is asked first. An undo that itself deletes data
that cannot be restored asks the owner. An undo of a change customers see passes that site's
visual check like any other change ([visual-check](visual-check.md)).

## New work

A pull request that adds a place where a model changes something adds the three with it,
with the undo test; the reviewer checks them. The inventory of 27 November 2026 and what
each gap got: the handoff entry `handoff/2026-11-27-agent-changes.md`.
