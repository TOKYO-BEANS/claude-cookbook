# What fifteen MEGA Drops changed in the setup

**Why.** On 18 November 2026 the owner asked for 15 mega.dev Drops (August to October 2026:
Adam Gospodarczyk, Angie Jones, John Lindquist, Kent C. Dodds, Olaf Sulich, Theo Browne) to be
read and used to improve the setup. Each idea was checked against the Cookbook and measured on
this PC before anything changed.

**What was measured.**

- Model switches (the Drop on reasoning effort: "switching mid-conversation wipes your prompt
  cache"). In 141 transcripts of the last four days the model budget switched a thread between
  Fable and Opus 21 times; the first message after a switch wrote a median of 191,443 tokens of
  cache, 3.1% of all cache writes. True, and small: no change.
- The owner-questions hook (the Drop on Jev: "log every pick, pave what repeats"): 1,028 stops
  from 16 to 18 November, 1,025 judged by Jev, 2 by the phrase list, 446 ms median, 86 stops
  blocked. Its input is free prose, so no pick repeats exactly enough to pave: no change.
- The AI review (Theo Browne: "take a review comment you keep writing, put it in a file the
  agent must check"): on the last 60 merged pull requests, 46 of 60 review comments were "review
  unavailable" (the credit, fixed since #139/#144), and 114 findings (15 medium, 99 low) came from
  the review and the fallback reviews. 32 of the 114 are about the handoff entry itself: a part
  missing, a claim with no saved evidence, a count that does not match the diff.

**What changed.**

- `scripts/check.mjs`: `npm test` reads every entry named from 2026-11-19 on and fails when one
  lacks a What changed, Verification, Outstanding, Dead ends or Evidence label or heading, or
  when its evidence points at a temp folder or `~/.claude` (the owner's rule in the global
  CLAUDE.md, now a check rather than a review comment). Test in `scripts/check.test.mjs`.
- `recipes/judgement.md`: the Jev lessons: the menu is the product ("none of these", narrow in
  code first), gate a Choice on its lead over an even split with a bar per action, pin the
  model, one request for every question, log and pave.
- `recipes/dispatch.md`: effort follows the piece; `xhigh` and `max` only on a named need.
- `recipes/context-mode.md`: how to read long texts whole under the 4,096-byte cut.

**Verification.** The new test failed first (`handoffEntryErrors is not a function`), then
passed with the old handoff test; `node scripts/check.mjs` passes. Every existing entry is
older than the cut-off, so none fails. The whole suite runs in CI on the pull request.

**Already in place, so nothing to add.** Separate implementer and reviewer (the AI review and
the fallback review), checks that decide the merge, the repository as durable memory (handoff,
CLAUDE.md, the Cookbook), cheaper workers under a planning thread (the dispatch profiles: the
orchestrator pattern), deterministic scripts for repeated jobs (web batch, model budget, merge
when green), remote use from the phone (T3 Connect and Tailscale), a Linux box away from the PC
(boat), and "close the gap" for every step a person still carries between two tools.

**Set aside, and why.** A VPS with Herdr, Pi, Moshi and Grok Bot: T3 Code, Tailscale and boat
cover it here, and a VPS is a new monthly cost. Cursor's Router: not our harness. Kody packages:
the Cookbook's scripts already are packages. Cloud routines were weighed before
(`recipes/scheduled-runs.md`: they cannot reach the key store). WebMCP and llms.txt: young
standards, the Drop itself says to wait.

**Outstanding.**

- Two owner questions, asked in the chat on 18 November 2026: whether to study moving the first
  site from a visual editor to a Markdown site on Cloudflare (Adam Gospodarczyk's Webflow to
  Astro move: the editor is where agents are slowest here); and a weekly scheduled agent that
  turns recorded workarounds into fixes and prunes stale memory (Kent C. Dodds' friction log
  and legacy reaper; a recurring run needs the owner's yes).
- The next repeated review theme, Windows paths, quoting and shells (16 of 114), could become a
  check the same way.

**Failures and dead ends.** The pages were fetched with a plain HTTP read (public, no sign-in)
rather than Firecrawl, whose results would have been cut the same way. A line about the new
check in `recipes/parallel-chats.md` put the page over 4,000 bytes; the check's own message
says what is missing instead.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-18-mega-dev-learnings/`: the 15
article texts, `findings.txt` (the parsed review findings), `measure.mjs` and its output
`measure-output.txt`.
