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
- Every Cookbook pull request edited the top of `HANDOFF.md` and the `version` in
  `plugin.json`, so each one conflicted with the next. 23 pull requests merged that day; one
  job saw `main` move six times under it.

**The owner's answer (question dialog, 16 November 2026).** To "Should I build the fix in
the Cookbook now?": "Build all three (Recommended)", the three being a look at other chats'
questions before asking, a handoff and version that stop colliding, and a look at running
chats before a job starts.

**What changed.**
- `hooks/owner-answers.mjs` (with `owner-answers-lib.mjs` and `owner-answers-store.mjs`), on
  `PreToolUse` and `PostToolUse` in `hooks.json`:
  - after a question dialog it writes the question, options, answer, repository and chat to
    `~/.local/share/claude-cookbook/owner-answers/ledger.jsonl`;
  - before a question dialog it denies the call once and shows what other chats asked in the
    last 72 hours and what is open (12 hours); the second call passes;
  - before `t3_thread_launch` or `create_threads` it denies the call once with the two looks
    to take (`t3_thread_list`, `gh pr list`); it then passes for ten minutes.
  It judges nothing: the chat that asks decides, with the list in front of it and the limits
  in the text (another item is another question; every stop in the ground rules is asked each
  time). It never fails a session.
- `skills/cookbook/scripts/owner-answers.mjs`: `list` and `add`, for an answer given as a
  chat message.
- `recipes/parallel-chats.md`, a map row, and the "Memory across sessions" row now names the
  handoff folder.
- The handoff is a file per entry in `handoff/`. `HANDOFF.md` is closed: `scripts/check.mjs`
  pins its text, so `npm test` fails when it changes, and names in `handoff/` are checked.

**Decisions that were mine.**
- No model in the hook. A word match would miss a reworded question, and a second Jev
  question would need its own measurement. The cost is one short turn when another chat has
  asked something new.
- Text shaped like a key is not written to the list: a known prefix, a name and password in
  a URL, a three-part signed token, or one unbroken run of 32 or more letters and digits
  that mixes digits and both cases.
- The list is outside `~/.claude` and outside every repository.

**Verification.** See the pull request for the checks of its head. Before the push:
- `node --test scripts/owner-answers.test.mjs`: 16 tests, one of them the hook file and the
  command end to end on a folder of their own; then `npm test` on this PC.
- A `cookbook:review` subagent that did not write the change read the commit before the
  push. One medium finding, fixed with a test: a chat that had been shown a question as open
  was never shown its answer (the "seen" mark held the id alone, now the id and the state).
  Four low findings fixed (a temporary file per process, a quote inside an answer given as
  text, more key shapes, every stop named in the denial). Its second read passed the commit
  with two more low findings, both fixed (a newer answer to the same question is shown
  again; an answer with `", "` in it). Two low findings left: an answer added by hand
  outside T3 is shown once to the chat that added it, and the small state files in
  `sessions/` are never removed.
- **One existing test was changed, not loosened**: "hooks.json runs the gate before the
  three T3 tools" in `scripts/codex-start-check.test.mjs` required exactly one `PreToolUse`
  group. It now requires exactly two, keeps every assertion about the Codex gate's group
  (still the first, still the only one that runs the gate, still `onFailure: "block"`), and
  pins the second group whole. The owner-answers hook only denies or stays silent, so it
  cannot let through a call the gate denies.
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
- **Open pull requests with an entry in `HANDOFF.md`** fail `npm test` after merging `main`
  until the entry is moved to a file: intended, one round each.
- **Stack Atlas has the same handoff collisions**: the same layout there is its own pull
  request in that repository.
- **The two memory notes about the AI review's credit** say one thing twice; merge them.

**Dead ends.**
- A `claude-code-guide` subagent for the documentation: it had no web tool and answered from
  memory. The pages were read directly instead (`plugins/loading.md`, `hooks`).
- A Claude session inside a boat sandbox as a way to spread the chats: the owner said "You
  have my yes if it helps you". Not used: it draws on the same Claude usage and runs without
  T3's tools, these hooks, memory and the GitHub login. The yes is in memory.
