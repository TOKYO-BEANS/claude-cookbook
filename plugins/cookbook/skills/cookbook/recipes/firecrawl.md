# Firecrawl without surprises

- Scrape, map and search cost credits; JSON/extract cost extra. Check the balance before batches.
- Every crawl gets an explicit `limit`; every agent run an explicit `maxCredits` and
  `effort: "low"`.
- A monitor gets an explicit schedule, and its `estimatedCreditsPerMonth` is read before it is
  created. A recurring monitor spends every month: it needs the owner's yes for that task.
- A blocked or bot-protected site is not fixed by retrying elsewhere: report it.
- HTTP 402 ("Insufficient credits") stops Firecrawl work: report it, use Parallel where it covers
  the need, and name the refill date (the 10th). A 429 is a rate limit: wait and retry.
- Alexandria (typed records about companies, people, jobs, filings, places): discover with
  `alexandria_library_search` (free), read the capability's contract and price, then run only a
  provider and capability that discovery returned. Report each call's returned cost, and reuse the
  request ID when retrying an uncertain run.
