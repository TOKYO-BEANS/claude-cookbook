# Options weighed: a frontend design skill on top of Claude Design

Tried 25 November 2026: Google's `gemini-frontend-design` (demolab, 10 November 2026) and the
`frontend-design` skill in Anthropic's plugin directory, each against Opus 5.5 with no design
skill. **Neither is used.** With no skill the pages scored best, and Gemini's skill made them
worse. Anthropic's skill was added on 26 November 2026 on a misreading of the owner's picks and
removed the same day on the owner's word (see "The owner's picks").

| Arm | Overall | Brief | Distinct | Craft | Phone | First | Last |
| --- | --- | --- | --- | --- | --- | --- | --- |
| No skill | 7.8 | 8.8 | 7.3 | 7.9 | 7.7 | 8 | 0 |
| `frontend-design` (Anthropic) | 7.4 | 8.7 | 8.3 | 7.3 | 6.7 | 4 | 3 |
| `gemini-frontend-design` (Google) | 6.0 | 7.5 | 6.9 | 6.0 | 6.1 | 0 | 9 |

Mean scores out of 10 over 12 blind judgements; "First" and "Last" count judgements. Build cost
was the same within 12 % (about 25,000 to 29,000 output tokens, 3.5 to 4 minutes per page).

- **Gemini's skill.** Its rules showed in the pages: no small label above headings, no stat
  row under the hero, one oversized centred headline. On Opus they
  cost more than they gave. The judge's reasons: phone layouts that scroll sideways or clip
  prices and day pickers, a conference programme set wholly in display type so the tickets fell
  below 7,000 px, and sections under a strong hero that turn plain. Written for Gemini models;
  on Claude it was last in 9 of 12 judgements and never first.
- **Anthropic's skill.** The most distinctive pages (8.3 against 7.3), but weaker craft and
  phone layouts, and 3 questions to the owner per run against 1.3. A narrow loss, not a gain.
- **The judge.** Read stills only and stopped at 7,000 px, so motion and page ends went unseen.
  Its scores are a measurement, not a choice of look: a look is chosen by a person who has
  seen the pages.
- **The owner's picks.** On 26 November the owner scrolled the 18 pages blind and picked one
  page per brief; the key maps all three to `frontend-design` runs. The picks answered one
  question only: is this page better than the Gemini skill's. They were not a liking for the
  skill in general, not a ranking over no skill, and not a yes to add it. The Cookbook read
  them as an adoption (#256). The first real job built with the skill was, in the owner's words,
  "a complete disaster", and the owner said to remove it: "the 3 I picked out yesterday was
  just a do you like this better over the Gemini skill, not adopt it".
- **What stays.** Claude Design for the look ([visual-design](../recipes/visual-design.md)),
  then Opus builds it with no design skill. Kept as plain checks after a build: a phone
  capture at 390 px with a sideways-scroll test, and the whole page captured, not only the
  first screen.
- **The lesson.** An answer to "which do you like better" says that one thing beat the other
  in that comparison, nothing more. Adding a tool is its own question to the owner
  ([connecting](../recipes/connecting.md)).

**How it was run.** Three briefs (a bicycle repair workshop, an on-call dashboard for a team of
twelve, a two-day conference), each built twice per arm: 18 runs of a fresh `claude -p` on the
plan token, Opus 5.5 at medium effort, an empty configuration with only that arm's skill, loaded
by name at the start, no network. Every page was captured at 1440 and 390 px by scrolling a real
window and stitching the screens. A window as tall as the page breaks sticky sections: the first
judge saw an empty page that way, and those captures and verdicts were set aside. An Opus 5.5
judge on the plan token, Read only, scored the three pages of each brief and repetition under
the labels X, Y and Z, twice with the arms in other places. The same page came first in both
orders in 4 of 6 groups. Captures stop at 7,000 px; every conference page ran longer, so ticket
sections were cut in all three arms and the conference scores weigh a little less.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-25-design-skill-trial/`:
`summary.json`, `runs/` (each page and its stream), `shots/`, `judge/` (each verdict with its
reasons), `harness/`, `versions.txt` (the skill commits), `owner-gallery/` (the
blind pages, their key and full phone captures).
