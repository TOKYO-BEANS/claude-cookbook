# Options weighed: the `mattpocock/skills` interview, read against the numbers

The third page of [skills compared](skills-compared.md). The author spoke about the set for
two hours (NetworkChuck, published 20 November 2026, `youtube.com/watch?v=mU8WKII1gpk`).
Read whole on 23 November 2026 from the video's captions. A number in brackets is the
minute.

**What he claims:**

- An agent is good at the task in hand (the sergeant's battle) and poor at the long view
  (the general's war): it is trained and scored on single tasks, and a long-view mistake
  comes back months later (5 to 8). The code is what the next agent works in, so it gets
  worse run by run unless someone keeps it in order.
- The skills are there to make the agent do that keeping. A harness could do it with no
  person, he adds (73).
- He does not measure the skills: too hard and too dear. His check is what users report
  (81 to 83).

**What that does to our result.** No number in the table changes, and no skill replaces an
owner. But one-task runs are the scoring he describes: they show what a skill adds to one
task, nothing about a repository a year on. Neither side has numbers for that.

| His long-run habit | Here |
| --- | --- |
| A review comment becomes a lint rule or a test before a rule to read (51, 85) | The same order: [learning-loop](../recipes/learning-loop.md) |
| A pull request names its merge danger: the door, the blast radius (40) | `pr-text` |
| Small contexts: a session per ticket (25 to 28) | One job per chat, the owner's rule |
| Types, tests and linters as the agent's own feedback (48 to 50) | CI, CodeQL and Semgrep on every pull request |
| A structure review that finds shallow modules (56, 61) | [architecture-review](../recipes/architecture-review.md): its first candidate is built |
| That review daily, opening a pull request, one in five sampled (62) | Not taken: ours starts on a sign in the code, a walk is about 142,000 tokens, and the first repository has candidates waiting |
| A word list and decision records per repository (14 to 23) | Not taken: `domain-modeling` showed no gain on one task and was not run for longer. A handoff holds the decisions |
| Medium effort for all but verification, web research and debugging (30 to 32, 47) | Not measured here: [model-budget](../recipes/model-budget.md) decides |

**His setting is not ours:** personal software, no security work of his own, and a person
who reads the one-way doors (47, 80). Here no person reads the code, so the keeping is a
tool's job and needs a trigger. That makes the structure review's built result worth more
than the table.

**What would measure the long run:** the same files before and after a built candidate:
tokens per pull request, files the review could not read, defects found later. Nobody is on
it.

Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-23-skills-compare/interview/`
(the captions, the video's details and `transcript.txt`, a time mark per minute).
