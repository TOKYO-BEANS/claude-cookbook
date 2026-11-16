# 16 November 2026 (night): several chats at once (0.39.0)

**Why.** The owner asked whether the nine chats then open could overlap on merges and
pushes, and said the same questions were reaching them in different chats. Measured that
evening:

- Files and merges were safe: each chat has a worktree and a branch of its own (37 worktrees
  in this repository), and every change merges through a pull request with required checks.
- No chat saw the others. Two chats had saved the same fact about the AI review's credit to
  memory two minutes apart, and two running chats had that one subject. All eight running
  chats that were read had been started by another chat (`createdBy: agent`), none by a
  check of what was already running. Only the newest 40 of 223 unsettled threads were read.
  While this was built, two chats built the same merge-gate change in Stack Atlas (#200 and
  #202; one was closed).
- Every Cookbook pull request edited the top of `HANDOFF.md` and the `version` in
  `plugin.json`, so each one conflicted with the next. 23 pull requests merged that day; one
  job saw `main` move six times under it, and this one four times.

**The owner's answer (question dialog, 16 November 2026).** To "Should I build the fix in
the Cookbook now?": "Build all three (Recommended)", the three being a look at other chats'
questions before asking, a handoff and version that stop colliding, and a look at running
chats before a job starts.

**What changed.**
- `hooks/owner-answers.mjs` (with `owner-answers-lib.mjs` and `owner-answers-store.mjs`), on
  `PreToolUse` and `PostToolUse` in `hooks.json`:
  - when a question dialog is shown and when it is answered, it writes a note to
    `~/.local/share/claude-cookbook/owner-answers/ledger.jsonl`: the chat, the repository, the
    time and the state. No question, option or answer, not even as a hash on its own;
  - before a question dialog it denies the call once and names the other chats of the same
    repository that put questions to the owner (72 hours; open ones 12 hours), with the two
    T3 tools that show what was asked and answered there; the second call passes;
  - before `t3_thread_launch` or `create_threads` it denies the call once with the two looks
    to take (`t3_thread_list`, `gh pr list`); it then passes for ten minutes.
  It judges nothing, prints a denial or nothing, and never fails a session.
- `recipes/parallel-chats.md`, a map row, and the "Memory across sessions" row now names the
  handoff folder.
- The handoff is a file per entry in `handoff/`. `HANDOFF.md` is closed: `scripts/check.mjs`
  pins its text, so `npm test` fails when it changes, and names in `handoff/` are checked.

**The design changed in review, and why.** The first two pushes kept the question and the
owner's answer as text and showed them to the next chat. GitHub's security review wrote two
threads on each push (prompt injection; sensitive text kept and replayed). Cleaning and
quoting the text did not settle them, and the finding was right: any chat on this PC can
write that file, so a chat gone wrong could plant an "owner's answer" that other chats act
on. The third push keeps no text at all. The list is a pointer; the answer is read from the
host's own record of the chat that asked, which a chat cannot write. Every value the hook
puts in front of a model is a count, a date or a chat id in T3 Code's own shape, which is
hexadecimal digits (tested with planted lines). A note with a time in the future is no note. What it costs: a chat may have to read another chat before it asks, and a
question asked in one repository is not seen from another.

**Decisions that were mine.**
- No model in the hook: the chat that asks decides whether another chat's question is its
  own.
- Nothing is noted outside a GitHub repository, and nothing is told across two.
- The list is outside `~/.claude` and outside every repository; the repository is read from
  git's own files, with no program started, because a hook gets a short `PATH`.
- One chat at a time reads the list, decides and writes (a lock file with the holder's mark,
  a wait of 1.5 seconds, then ahead without it).
- **One existing test was changed, not loosened**: "hooks.json runs the gate before the
  three T3 tools" in `scripts/codex-start-check.test.mjs` required exactly one `PreToolUse`
  group. It now requires exactly two, keeps every assertion about the Codex gate's group
  (still the first, still the only one that runs the gate, still `onFailure: "block"`), and
  pins the second group whole. The owner-answers hook only denies or stays silent, so it
  cannot let through a call the gate denies.

**Verification.** See the pull request for the checks of its head and the reviews.
- `npm test` on this PC before the first push: 582 tests, none failed, one skipped. Later
  pushes: the three touched test files and `node scripts/check.mjs` here, the suite in CI.
- A `cookbook:review` subagent that did not write the change read every commit before it
  was pushed, and the whole diff of the head for the fallback review record (the in-CI
  review had no API credit; Stack Atlas #200). Its findings and Graphify's five are in the
  pull request's comments with what was done about each.
- **boat did not run the suite**: `boat-run.mjs` answered `BOAT-RUN: not started: no result
  (boat limits did not answer in time)` three times that evening, with nine chats on this
  PC. Not worked around; the suite ran here.

**Outstanding.**
- **The version still collides** (owner: Claude; clears: a pull request of its own). Leaving
  `version` out of `plugin.json` makes Claude Code follow commits (documented: "To let users
  track commits instead, leave `version` out of both the manifest and the entry"), but the
  update check cannot read that yet: `marketplaceLatest` in
  `skills/stack-updates/scripts/lib/feeds.mjs` throws "No stable plugin version was found",
  and the `apply` step compares a version. It needs a look at what `installed_plugins.json`
  records for a plugin with no version, on the real install, so it is not in this pull
  request.
- **Proof in a real chat** (owner: Claude; clears: the first question dialog after the
  plugin updates). The hook was run as a process with real input shapes (the dialog's result
  was read from this session's transcript: `{ questions, answers }`), not yet by Claude Code.
  Not tried: the lock against a real antivirus stall on Windows.
- **Open pull requests with an entry in `HANDOFF.md`** fail `npm test` after merging `main`
  until the entry is moved to a file: intended, one round each.
- **Stack Atlas has the same handoff collisions**: the same layout there is its own pull
  request in that repository.
- **`boat-run.mjs` did not start under load**: its limits call times out when the PC is
  busy, which is when a sandbox would help most.
- A dialog the owner closes without answering stays "open" in the list for 12 hours; a chat
  that looks finds no open dialog there and asks.

**Dead ends.**
- Keeping the owner's answer as text for the next chat, however cleaned (above).
- An `add` command for an answer given as a chat message: a command any chat can run to
  write "the owner said" is the same hole. Such an answer goes to memory when it should last.
- A `claude-code-guide` subagent for the documentation: it had no web tool and answered from
  memory. The pages were read directly instead (`plugins/loading.md`, `hooks`).
- A Claude session inside a boat sandbox as a way to spread the chats: the owner said "You
  have my yes if it helps you". Not used: it draws on the same Claude usage and runs without
  T3's tools, these hooks, memory and the GitHub login. The yes is in memory.
