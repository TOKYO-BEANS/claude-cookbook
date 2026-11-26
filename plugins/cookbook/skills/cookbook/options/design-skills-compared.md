# Options weighed: a frontend design skill on top of Claude Design

Tried 25 November 2026: Google's `gemini-frontend-design` (demolab, 10 November 2026) and the
`frontend-design` skill in Anthropic's plugin directory, each against Opus 5.5 with no design
skill. **Anthropic's skill is used** (26 November): an Opus judge put it second, but the owner,
scrolling all 18 pages blind, picked its page as best in all three briefs. Each page had parts
the owner liked and parts not, so options side by side stay.

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
- **Anthropic's skill.** The most distinctive pages (8.3 against 7.3); the judge marked down
  craft and phone layouts, and it asked 3 questions per run against 1.3. The owner weighs
  distinct over the judge's craft: the skill is used, its questions answered by Claude.
- **The judge.** Read stills only and stopped at 7,000 px, so motion and page ends went unseen.
  A judge on stills does not decide a visual choice: the owner's blind pick does.
- **What stays.** Claude Design for the look ([visual-design](../recipes/visual-design.md)),
  then Opus builds it with `frontend-design`, and after the build a phone capture at 390 px
  with a sideways-scroll test, the whole page captured.

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
