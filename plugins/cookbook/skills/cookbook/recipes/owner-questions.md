# Open questions for the owner

The owner's list of what waits on them is T3 Code's sidebar, never a page or a queue. Checked in
the live window on 16 November 2026: one list across all projects, pinned chats on top with a pin
icon, a chat with an open question dialog shown as "Waiting", and about 28 characters of a title
visible.

- **A chat that waits on the owner** without an open dialog is pinned and renamed to `❓ ` plus
  the question in at most 25 characters (`❓ Packaging firm: go?`). Its last message begins
  with the question. Find them all: `t3_thread_list` with `allProjects` and `titleContains`
  `❓`. When it is answered, unpin it and give it back its title (or `regenerate_title`).
- **Ask with the dialog first**: `AskUserQuestion`, one question per item, each with a "Not
  now" option. A "not now" goes into the handoff as outstanding.
- **A finished chat is settled** (`t3_thread_organize`, `settle`, as the last call).

## The Stop hook that enforces it

`hooks/owner-questions.mjs` in this plugin runs at the end of every main-session turn (proved
in a real T3 thread on 16 November 2026). It stops the turn once, with exact instructions, when:

- the closing message leaves something with the owner and the turn neither called
  `AskUserQuestion` nor marked the thread;
- in T3, the closing message says the job is done and the turn did not settle the thread;
- in T3, the thread is still marked but the closing message leaves nothing open.

A second stop always passes (`stop_hook_active`), so it never loops. It skips subagents (they
fire `SubagentStop`), T3 delegate children (`thread:delegated-task:` ids), scripted runs (a
`budget_usd` attachment, an `sdk-*` entrypoint, or a `t3-code` entrypoint without the T3 tools,
which is a `claude -p` started inside a thread) and unknown hosts. A terminal or desktop session
gets the dialog rule only.

**The judgement is Jev** (`recipes/judgement.md`): two Nouls on the last 6,000 characters,
`owner_item` (open at 0.6 or more) and `declares_done` (0.5, or a done phrase). Measured on 79
real closing messages, labels never sent: on 30 held out, Jev found 11 of 11 owner items with 3
false alarms (0.900); the fixed phrase list found 8 of 11 with 7 (0.667). A false alarm costs
one short extra turn; a miss is what this hook is for.

**The key** is the Cookbook's own `jev-compaction`. Reading it from the DPAPI store takes 2 to
27 seconds, so the hook starts a broker once (`owner-questions-broker.mjs`, through
`with-key.mjs`) that holds the key in memory only and answers on a local named pipe, its
random name kept in the profile (`pipe.json`). It exits after 3 hours idle, 20 hours in all, 10
minutes without a key, or when a hook of another question version asks. A warm check takes
under a second; the hook's own limit is 12 seconds (20 in `hooks.json`).

**A Jev failure is not "nothing open".** No broker, a timeout or an error falls back to the
phrase list, and the owner sees it: a system message "used its phrase list: Jev was not asked
(code)", also added to any stop it makes. Only fixed codes are shown, never broker text, and an
answer that is not two numbers from 0 to 1 counts as a failure.

**Cost**: about 250 turns a day end in T3 (11 to 16 November 2026), so about 250 calls and
200k input tokens, about USD 0.01 a day at USD 0.042 per million.

**Log**: `~/.local/share/claude-cookbook/owner-questions/log.jsonl`, one line per check with
scores, source and the stop's reasons, never the message.
