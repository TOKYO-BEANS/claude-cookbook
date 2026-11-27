# 27 November 2026: renting a GPU, weighed

**Why.** The owner, in the chat that kept boat: "Perhaps also look into a gpu rental when we
create gpu heavier things to also get better and faster results their."

**What changed.**
- `options/gpu-rental.md`: our GPU-heavy jobs and what a rented GPU would change for each;
  Cloudflare Workers AI, Modal, RunPod, Vast.ai, Lambda, boat and Depot compared (prices,
  billing, start, free allowance, keys, data); the decision and the order for a later job.
- `options/plan-and-build.md`: one line pointing to it.

**Decision.** No GPU rented and no sign-up: nothing we run waits on a GPU. ArtCraft already
runs on its providers' GPUs; LightCraft's SAM 3 has no CUDA build and offloads only to a Mac;
Blender is used for proofs. When a job needs one: Workers AI (our Cloudflare account, free
daily allowance), then Modal (new sign-up, free USD 30 a month: the owner's yes first).

**Verification.** Prices read from each official page on 27 November 2026 (two `sa-research`
runs, then Firecrawl scrapes of the pricing pages for the gaps). Workers AI's model list read
live with the `cloudflare-wrangler` key (a free read; no model run). boat's sizes read from
its CLI. A Blender Cycles render on this laptop measured: 1920x1080, 128 samples, 84.6 s.
`node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the pull request).

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-gpu-rental/` (the two
research results, `bench.py`, `bench.png`). Release log: the `sa-release` run of this pull
request.

**Dead ends.** RunPod's serverless docs page and Lambda's docs page returned no readable text
to the research run; the prices came from their pricing pages instead. Depot's GPU runner
price is not published (Business plan, sales).

**Outstanding.** None for the owner. A first Whisper or FLUX job on Workers AI may need a
Cloudflare token with the Workers AI permission (the current one reads the model list).
