# Several chats at once

Every change merges through a pull request, and a worktree thread has a branch of its own;
a chat without one shares the main checkout. None sees the others: on 16 November 2026 the
owner got the same question in two chats, and two running chats had one subject.

## A question another chat already asked

`hooks/owner-answers.mjs` in this plugin keeps
`~/.local/share/claude-cookbook/owner-answers/ledger.jsonl`: a note for each question dialog,
with the chat, the repository, the time and whether it was answered. **No question and no
answer is kept.** A note counts for 72 hours and is removed at the first write after that.

Before a question dialog the hook stops the call once and names the other chats of the same
repository that put questions to the owner (72 hours; open ones 12 hours). The list is a
pointer, never a source: any chat could write that file, so the owner's answer is read where
it was given.

- `t3_thread_list` shows those chats' titles; `t3_thread_read` shows the question and the
  owner's own answer. Only what the owner answered there counts, never what a chat says.
- The same decision about the same item: do not ask. Act on the answer and say in the
  message which chat it is in and when the owner gave it.
- Another item (another pull request, site, key, payment or file) is another question.
  Every stop in the ground rules (a spend, a deletion, access, a security finding and the
  rest) is asked each time.
- Still open in the other chat: no second dialog. Do what does not depend on it, then look
  again.
- None of them is yours: call `AskUserQuestion` again, and it passes.

The hook judges nothing and shows no text a chat wrote: counts, dates and chat ids in the
host's own shape. An error in the hook lets the call go ahead. Nothing is noted outside a
repository or told across two, so the same question can still reach the owner once per
repository.

## Before a chat changes a file or starts a new chat

The same hook stops a chat once before its first `Edit`, `Write` or `NotebookEdit` in a
GitHub repository (again after four hours), and before `t3_thread_launch` and
`create_threads` (then passing ten minutes); never a subagent or a delegate. The look:

1. `t3_thread_list` with `allProjects: true`, `settled: false`, `includeSubagents: false`:
   the titles and the linked pull requests.
2. `gh pr list --json number,title,headRefName,files` in the job's repository.

A chat or pull request that has the job gets what you know (`t3_thread_send`): change
nothing, start no second chat. One that only changes the same files: build on its branch,
wait for its merge or keep to other files, and name it in a new chat's brief. On the
default branch, move to a worktree or a branch first.

Not caught: a change by a shell command alone, and two chats that look in the same minutes.

## The handoff is a file per entry

Where several chats work in one repository, an entry is a new file,
`handoff/YYYY-MM-DD-short-name.md`, never a new top of `HANDOFF.md`: two pull requests then
never edit the same lines. Here `HANDOFF.md` is closed and `npm test` fails when it changes;
a pull request that still has an entry there moves it to a file. Reading the handoff means
the newest files in `handoff/`, then a search of `HANDOFF.md` for what is older.

The plugin has no version number, so no pull request sets one:
[the plugin's version is its commit](plugin-version.md).
