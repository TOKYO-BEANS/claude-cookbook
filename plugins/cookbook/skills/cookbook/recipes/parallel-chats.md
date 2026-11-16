# Several chats at once

Each chat has its own worktree and branch, and every change merges through a pull request,
so chats never overwrite each other's files. What they lack is sight of each other: on
16 November 2026 the owner got the same question in two chats, and every running chat had
been started by another chat, two of them on one subject.

## A question another chat already asked

`hooks/owner-answers.mjs` in this plugin keeps
`~/.local/share/claude-cookbook/owner-answers/ledger.jsonl`: a note for each question dialog,
with the chat, the repository, the time and whether it was answered. **No question and no
answer is kept.** A note is removed after 72 hours.

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
host's own shape. The cost is one short turn, and a
look at another chat, when another chat has asked something new. An error in the hook lets
the call go ahead. Nothing is noted outside a repository or told across two, so the same
question can still reach the owner once per repository.

## Before a chat starts a new chat

The same hook stops `t3_thread_launch` and `create_threads` once (a delegate is not a chat):

1. `t3_thread_list` with `allProjects: true`, `settled: false`: the titles and the linked
   pull requests.
2. `gh pr list` in the job's repository.

A chat or pull request that has the job gets what you know (`t3_thread_send`), and no second
chat starts. One that only edits the same files is named in the new chat's brief, with the
files that stay out. The call then passes for ten minutes. Take the same look before
starting a job the owner gave, when it may already be running.

## The handoff is a file per entry

Where several chats work in one repository, an entry is a new file,
`handoff/YYYY-MM-DD-short-name.md`, never a new top of `HANDOFF.md`: two pull requests then
never edit the same lines. Here `HANDOFF.md` is closed and `npm test` fails when it changes;
a pull request that still has an entry there moves it to a file. Reading the handoff means
the newest files in `handoff/`, then a search of `HANDOFF.md` for what is older.

The `version` in `plugin.json` still collides: merge `main` in and take the next free number.
