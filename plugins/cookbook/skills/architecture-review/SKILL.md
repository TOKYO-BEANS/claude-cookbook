---
name: architecture-review
description: Use when the owner asks for a review of a whole repository's structure or architecture, when a repository's most-changed files have outgrown what the reviews can read (the AI review lists them under "Not reviewed", files of thousands of lines), or before a large job in an area that changes often. One repository per run. Not for one pull request or commit range, and never on a schedule.
---

# Architecture review

A review of one repository's structure: where a change costs more than it should, and which
module to deepen first. A pull request review reads the change in hand; this reads the whole.
It reports candidates in chat. It changes nothing and runs nothing: no tests, no scanners and
no installs, in the main chat or in the walk.

Adapted from `improve-codebase-architecture` and `codebase-design` in `mattpocock/skills`
(MIT: `LICENSE` beside this file), at upstream commit
`abeeaf95660ba9e8b7c753eb38f441ca707a8823` (19 November 2026).

## Vocabulary

Use these words exactly, in the walker's brief and in the report. Do not drift into
"component", "service", "API" or "boundary".

- **Module**: anything with an interface and an implementation: a function, a class, a
  package, a slice across tiers.
- **Interface**: everything a caller must know to use the module correctly: the types, and
  also the invariants, the order of calls, the error modes, the configuration.
- **Depth**: how much behaviour a caller or a test reaches for each piece of interface it has
  to learn. **Deep**: much behaviour behind a small interface. **Shallow**: an interface
  nearly as complex as the implementation.
- **Seam**: the place where an interface lives, where behaviour can change without an edit
  there.
- **Adapter**: a concrete thing that satisfies an interface at a seam.
- **Leverage**: what callers get from depth. One implementation pays back across many call
  sites and tests.
- **Locality**: what maintainers get from depth. A change, a bug and the knowledge about it
  sit in one place.

Three checks decide what is a candidate and what is not:

- **The deletion test.** Imagine the module deleted. If the complexity vanishes, it was a
  pass-through: a candidate. If the complexity comes back in every caller, the module earns
  its keep: leave it.
- **One adapter is a hypothetical seam, two is a real one.** Propose no seam where nothing
  varies across it. A seam that already has two adapters is real: do not propose to remove
  it, and weigh a change near it by what both adapters need.
- **The interface is the test surface.** Tests that reach past the interface (they read the
  source, or private state) say the module has the wrong shape.

## Steps

1. **Scope by hot spots.** Deepening pays back where the code keeps changing. Count the
   files in a good stretch of history (about the last 150 commits):
   `git log -150 --name-only --format=`, counted per file, with each hot file's line count
   and how often two hot files change in the same commit. No clear hot spot: widen the
   stretch. If the owner named an area, that area is the scope, and the count gives its
   numbers.
2. **Read the project's own notes** where they exist: its instruction files, its handoff, a
   decision log. Use the project's words for its domain. A candidate that goes against a
   recorded decision is reported only when the friction is real, and names the decision.
3. **One walk by a fresh-context reader**: a `cookbook:review` subagent (read-only, with
   Graphify). Its brief has:
   - the repository path, the commit, and the hot spots with their numbers;
   - the Vocabulary section above, word for word;
   - the questions: where does one concept mean bouncing between many small modules? Where
     is a module shallow? Where does the same knowledge live twice, held together by "keep
     these in step" comments? Where were functions pulled out for tests while the bugs hide
     in how they are called? What is untested, or tested only past its interface?
   - what not to read: `.env*`, `.dev.vars*` and credential stores;
   - **run nothing**: no tests, no scanners, no installs. Git read commands, file reads and
     Graphify only. Graphify's indexed commit is compared with the checkout first; with no
     index, or an old one, the files are read instead;
   - what to send back: candidates with the six parts of step 6, what the three checks
     cleared, and the files it did not read.
4. **Check every number yourself** before it is reported: each line count, number of copies,
   number of call sites and "N of M commits" gets one count or one read in the main chat. A
   number that could not be checked is reported as not checked.
5. **Check the open pull requests** (`gh pr list` with their files) before naming the first
   candidate. A candidate whose files an open pull request changes is not the first one: name
   the pull request. When that holds for every candidate, say so and name no first one.
6. **Report in chat**, with no file and no web page:
   - the scope: the commit, the stretch of history, the hot spots with their numbers;
   - the candidates, strongest first. Each has six parts: **files**; **problem**; **change**, in plain
     words and with no interface design yet; **what it makes easier**, said as leverage and
     locality, and what happens to the tests; **risk**, which names what the module depends
     on (pure in-process code is the safest to deepen, a dependency with a local stand-in
     comes next, a network service needs a seam with two adapters); **strength**: strong,
     worth exploring or speculative;
   - what was rejected, and by which of the three checks;
   - one **"do this first"**, with the reason;
   - what the walk did not read, and what the walk cost (tokens, tool calls and minutes,
     from the subagent's usage line).
7. **Stop there.** No refactoring in this chat. A candidate worth doing is a new job in a
   new chat, whose brief is the candidate as reported.

## Mistakes this prevents

| Mistake | Instead |
| --- | --- |
| Passing on the walker's numbers as they came | Step 4: one count or read each |
| "The largest file is the problem: split it" | Size is not shallowness. Apply the deletion test and the two-adapters rule first: a real seam inside a large file puts its split last |
| Listing only what to change | Report what the three checks cleared as well: it stops the next review from proposing it again |
| A first candidate in files an open pull request is changing | Step 5 |
| Designing the new interface in the report | The report names the change. The design belongs to the job that builds it |
| Starting the first candidate "while the context is warm" | Step 7: a new chat |
| Running the tests "to see what is covered" | The review runs nothing. Coverage is read from the test files |
