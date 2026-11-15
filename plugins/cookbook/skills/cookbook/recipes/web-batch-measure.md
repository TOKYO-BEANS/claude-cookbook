# Research across many pages (web batch): measuring a run

6. Stages for checking a run: `search`, `fetch`, `judge`, `report` on one `--out` folder. To
   measure it, label the fetched pages before `judge` (the labels never go to Jev), then
   `score --out <run> --labels <labels.json>` (`{ "<url>": true | false }`) reports recall and
   false `answers`.

Tested on 5 November 2026 (jev-1.14.0): 20 URLs from one search, 19 scraped for 19 credits (one
site failed and showed as an `error` row), two questions over the same pages, 38 labels made by a
separate agent before judging. Recall was 18 of 18 and 12 of 12 relevant pages, with no false
`answers`. In the second question 3 of the 15 pages to open were not relevant, all `uncertain`.
The pages held about 460k tokens; the parts to open held 51k and 41k. Each judge pass used about
630k Jev input tokens (about 160 requests). Two questions are a small test: before automating on
the verdicts, score a labelled run in the new domain.
