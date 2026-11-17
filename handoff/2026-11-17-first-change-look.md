# 17 November 2026: a look before a chat's first change

**Why.** The owner asked, with twelve chats open, whether chats could still overwrite each
other, do the same work twice or stack the same pull request, and whether another chat was
already on that very question. Measured then:

- The look at other chats (#86, `handoff/2026-11-16-parallel-chats.md`) ran only when a chat
  started another chat. A chat the owner starts, and a chat that takes up a second job, was
  held to it by a sentence in the recipe, not by a hook.
- The chat that was asked sat in the main checkout on `main`, four commits behind: "each chat
  has its own worktree" holds for worktree threads only.
- Three running chats were heading for a pull request to this repository; nothing showed a
  chat which files the open pull requests change.
- No other chat had the question: six ran, none on it (`t3_thread_list`, `t3_thread_search`).

**What changed.**
- `hooks/owner-answers-lib.mjs`, `decideEdit`: before a chat's first `Edit`, `Write` or
  `NotebookEdit` to a file of a GitHub repository, the call is denied once with the look to
  take: `t3_thread_list` (`allProjects: true`, `settled: false`, `includeSubagents: false`)
  and `gh pr list --json number,title,headRefName,files`. One look per repository, taken
  again after four hours (`EDIT_PASS_MS`). When the default branch is checked out, one more
  line says to move to a worktree or a branch first.
- `hooks/owner-answers-store.mjs`: `gitFolders` (taken out of `originUrl`, which behaves as
  before), `onDefaultBranch` and the store's `checkout(cwd, file)`. The repository is the
  edited file's own, so a memory file or a scratch file stops nothing.
- `hooks.json`: the hook's matcher gains `Edit|Write|NotebookEdit`; the description says so.
- The denial before a new chat now names the same look (`includeSubagents: false`, and the
  files of the open pull requests).
- `recipes/parallel-chats.md` and its map row.

**What it costs.** One node start before every `Edit`, `Write` and `NotebookEdit`. The
reviewer measured it that afternoon, with twelve chats and CI running on this PC: 2.6 and
4.3 seconds for the hook, 1.8 seconds for a bare `node -e 0`. The model budget hook already
starts node after every tool. After ten seconds the call goes ahead without the hook.

**Decisions that were mine.**
- The look is asked for, not done by the hook: a hook gets a short `PATH` and ten seconds,
  and `gh pr list` took over two minutes on this PC that afternoon. The chat judges whether
  a job is the same one.
- The denial is one of two fixed texts. The branch's name, the file and the chat's id never
  reach it (tested with planted words): a branch name is text anyone can choose.
- A subagent (`agent_id`) and a delegate child are not stopped: their chat took the look,
  and a `cookbook:mechanical` subagent has no T3 tool to take it with.
- Four hours, not once per chat: the chats that ran longest that day were the ones most
  likely to meet a chat started after them.
- Shell commands are not matched. The boat route hook already runs on every one, and what a
  shell command changes cannot be told from its text.
- **One existing test was changed, not loosened**: the pin of the second `PreToolUse` group
  in `scripts/codex-start-check.test.mjs` now holds the new matcher, whole as before.

**Verification.** See the pull request for the checks of its head and its review.
- `node --test scripts/owner-answers.test.mjs` on this PC, first push: 26 tests, 25 passed,
  one skipped (the file-mode test, Linux only). Six were new: the stop and its four hours,
  one look per repository, the subagent and delegate, the two fixed texts, the default
  branch read from git's files (a checkout, a worktree, a detached HEAD, no record of
  origin's default), and the hook file end to end. The second push added a seventh (a look
  that cannot be noted never stops a change) and cases to two of them; CI ran those.
- The new tests were written before the code but first run after it, so they were not seen
  to fail.
- **boat did not run the suite**: `BOAT-RUN: not started: the wallet holds money, so use
  past the plan would spend it: the owner's yes first`. Not worked around; CI ran the suite.
- A `cookbook:review` subagent that did not write the change read the first head: nothing
  high or medium, six low. Fixed in the second push: the two denials name the same look,
  "GitHub repository" in the page and the description, a stale comment, the missing tests.
  The other two are below.

**Outstanding.**
- **A change made by a shell command alone is not stopped** (owner: Claude; clears: a
  measured case where it mattered).
- **Two chats that look in the same minutes see nothing of each other** until one has a
  pull request or a title that says its job (owner: Claude; clears: the same).
- **The line about the default branch can be missed** (owner: Claude; clears: a case where
  it mattered). The look is kept per repository and the branch belongs to a checkout: a chat
  that looked from a worktree and then edits the main checkout is not told for four hours.
  A clone with no record of origin's default branch and a default that is not `main` or
  `master`, and a repository in git's reftable format, are never told. Each fails silent.
- **The hook is live in a chat only after `claude plugin update`** and a new session; chats
  already running keep the hook they started with.
