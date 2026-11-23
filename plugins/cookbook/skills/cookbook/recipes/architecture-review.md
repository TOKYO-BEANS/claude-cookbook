# Architecture review

The **architecture-review** skill (`cookbook:architecture-review`, in this plugin) reviews
the structure of one whole repository and names where to deepen. Claude starts it.

- **When:** the owner asks for one; a repository's most-changed files have outgrown what the
  reviews can read; before a large job in a hot area. Not on a schedule and not per pull
  request: that is the `ai-review` job's, and a commit range is `sa-review`'s.
- **How:** hot spots from the commit history, one walk by a `cookbook:review` subagent
  (read-only, with Graphify, runs nothing), then the main chat checks each number and the
  open pull requests and reports in chat: candidates, what was cleared, one "do this first".
- **It changes nothing.** A candidate worth doing is a new job in a new chat.
- **Fallback:** a `cookbook:review` walk whose brief holds the skill's vocabulary and questions.
- **Source:** our adapted copy of `improve-codebase-architecture` and `codebase-design` from
  `mattpocock/skills` (MIT; the licence and the upstream commit are in the skill's folder).
  Taken out: the HTML report (Tailwind and Mermaid from a CDN), the interview loop with its
  `grilling` and `domain-modeling` calls, `GLOSSARY.md` and `docs/adr` as required inputs,
  and design-it-twice, which the trial did not use. Added from the trial: the number check,
  the open pull request check, no refactoring in the review chat, and a brief that names
  what not to read and says to run nothing.
- **An upstream change** shows in the update check, which follows both upstream folders.
  Read the diff, take what fits into our copy by hand and write the new commit into the
  skill file. Never copy a folder over ours. No sandbox run, as for any skill:
  [vetting-sandbox-report](vetting-sandbox-report.md).

## The trial (23 November 2026)

One run on a product repository.

- **Cost:** one walk, 142,109 tokens, 57 tool calls, 4.5 minutes.
- **Hot spots**, last 150 commits: the routes file (15,302 lines, 32 commits), the render
  file (14,796 lines) and the database file (8,600 lines). 26 of 39 feature commits
  changed routes and render together.
- **Found, and named by no review before:** the view-state URL is parsed, normalised and
  written in two files, with about 20 "keep the two in step" comments; the request handler
  is one function of 2,744 lines with 51 copies of the same guard, and three test files find
  its routes by a regular expression over the source; a loader of about 21 database reads
  in a load-bearing order, with 36 call sites, lives in the routes file.
- **Cleared:** the deletion test kept five small service files, and the two-adapters rule
  showed the storage seam is real, which put "split the database file" last, not first.
- **What the reviews had seen:** in the last four feature pull requests on those files the
  `ai-review` job listed the routes file under "Not reviewed" (over its input budget); its
  findings in that stretch were three, all low and about single lines. The `cookbook:review`
  passes found lows and one medium, all about the change in hand. None was about structure,
  and the one-function handler is also why the file goes unread.
- **Built that day:** the first candidate, behaviour proven unchanged. The two files lost
  713 lines to one module of 607. The move showed old defects no review had named: five,
  by the fix still in review. Later cost: not measured.
- **Limits:** one repository; the walk left the render file past line 1,060 and two
  folders unread.
