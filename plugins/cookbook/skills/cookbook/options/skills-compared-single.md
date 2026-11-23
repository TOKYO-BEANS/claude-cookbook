# Options weighed: the `mattpocock/skills` with no match here

The second page of [skills compared](skills-compared.md). Each skill ran against the same
agent with no skill, on one made-up task that fits it. A judge on Opus 5.5 that did not know
the arm scored six criteria written from the owner's need, never the skill's own format.

| Skill and task | Skill | None | Runs | Verdict |
| --- | --- | --- | --- | --- |
| `prototype`: a try-out of booking rules | 6.0 | 6.0 | 2 | no gain |
| `wizard`: a guided script for two dashboards and CI secrets | 5.2 | 3.8 | 5 | better at its job, which we do not have: its script writes keys to `.env`, against the key rule |
| `codebase-design`: pricing into one tested module | 5.5 | 5.0 | 2 | noise; its words are in `architecture-review` |
| `domain-modeling`: a word list and decisions | 6.0 | 5.5 | 2 | noise |
| `wayfinder`: a long effort as decision issues | 4.6 | 3.8 | 5 | small gain for 4.8 owner questions, and it plans in an issue tracker |
| `to-questionnaire`: questions for a non-technical person | 3.6 | 4.4 | 5 | worse: it asked the owner what the repository answers |
| `teach`: a first lesson from the learner's own script | 5.4 | 4.8 | 5 | small gain at twice the cost; no job here asks for it |
| `wait-what`: re-explain an update | 4.0 | 4.5 | 2 | no gain: plain words are already the rule |
| `triage`: six issues in local files | 5.0 | 5.0 | 2 | no gain |
| `ask-matt`: which skills, in which order | | | 2 | names his own flow right; of use only with his set |
| `setup-matt-pocock-skills` | | | 2 | wrote its five files, 3 owner questions; only his tracker skills need it |

`improve-codebase-architecture` had its own trial:
[architecture-review](../recipes/architecture-review.md). `grill-me` only calls `grilling`.

**How it was run.** `claude plugin eval` (Claude Code 2.1.329) compares a plugin with no
plugin only, has no grader that runs a command, reports no tokens or time per run and has no
scripted user. So a small harness ran each arm as a fresh `claude -p` on the plan token, in
an empty configuration with only that arm's skills as a plugin folder. Every Bash command ran
in bubblewrap with no network and no home folder; Claude Code's own sandbox does not start on
Ubuntu 26.04, where AppArmor refuses its nested user namespace. A stand-in on Sonnet answered
as the owner from a fact sheet and counted the questions. Hidden tests ran after the agent
ended. 16 of the 27 run only when typed: the test copy had the flag removed. Nothing of his
was installed. In all 233 runs (172 Sonnet, 43 Haiku, 18 Opus) and 133 judge calls, USD 34 at
list rates, all on the plan.

**Limits:**

- Small made-up tasks. A job that fits one context shows what a method costs, not what it
  saves on a job that does not; the coding tasks hit the ceiling on every model.
- Two runs per arm on most rows: a gap under one point is noise.
- The judge called pasted test output invented when it differed from the task's stored
  output. A program check against each run's own tool results replaced that count: no arm
  showed an output line it had not been given.
- The four retrospective lines were written after seeing what our method missed, and tested
  on the same three logs. The Opus runs of the pull request tasks had an Opus judge.
