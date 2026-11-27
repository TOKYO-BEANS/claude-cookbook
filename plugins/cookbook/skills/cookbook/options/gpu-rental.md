# Options weighed: renting a GPU for creative work

**Decision, 27 November 2026: rent no GPU now.** The owner asked whether a rented GPU would
give better or faster results for GPU-heavy work. None of our jobs is held back by the missing
GPU today: the generative work already runs on the providers' GPUs, the masks tool cannot use
an NVIDIA card, and nothing renders or transcribes often enough to pay for a machine. When a
job needs one, the order is: **Cloudflare Workers AI** first (our account, a free daily
allowance, no new service), then **Modal** (per second, USD 30 of free compute a month, a new
sign-up: the owner's yes first). Measured and read on 27 November 2026.

## Our jobs, and what a GPU would change

This laptop: AMD Ryzen 5 5500U, 12 threads, 13 GB, AMD Radeon graphics (no CUDA).

| Job | Runs on now | A rented GPU |
| --- | --- | --- |
| ArtCraft Studio and its MCP server: images, video, 3D, voice | ArtCraft's cloud models (Nano Banana, FLUX, Kling, Veo...), paid in ArtCraft credits | No gain: it already runs on their GPUs. Our own GPU would only run open models, which are not the ones it sells |
| LightCraft masks (SAM 3) | this CPU: 84 to 160 s and 3.3 to 4.3 GB a mask | No gain as built: no CUDA in the build; its remote SAM 3 reaches a Mac (Metal) through SSH only. Another SAM 3 tool would need its own vetting and masks test, and photos of people are an upload stop |
| Blender, Cycles | this CPU | Faster. Measured: 1920x1080, 128 samples, a plain scene, 84.6 s here. Used for a proof so far: no load to rent for |
| Watching a video (yt-dlp, ffmpeg) | network and CPU: 19 contact sheets of a 33-minute video in 37 s | No gain worth a machine |
| Speech to text (Whisper) | nothing: a video without captions has no route | A gain, but Workers AI's Whisper does it per minute of audio, with no machine |
| Local language models | none: Claude runs on the plan | None planned |

## The rentals, read from each official page

| | Entry GPU | Large GPU | Billing; start | Free |
| --- | --- | --- | --- | --- |
| **Cloudflare Workers AI** | not a machine: per model call. Whisper USD 0.0005 an audio minute; FLUX.1 schnell about USD 0.00005 a 512x512 tile | FLUX.2 dev and klein, Lucid Origin (about USD 0.007 a tile) | USD 0.011 per 1,000 neurons; no machine to start | 10,000 neurons a day (about USD 0.11) |
| **Modal** | L4 USD 0.80/h (0.000222/s), A10 USD 1.10/h | A100 80 GB USD 2.50/h, H100 USD 3.95/h | per second, idle not billed; a container start, seconds with memory snapshots | USD 30 of compute a month on Starter (USD 0 plan) |
| **RunPod** | Pods: L4 USD 0.69/h, RTX 4090 USD 0.89/h; Serverless 24 GB USD 0.75/h | Pods: A100 80 GB USD 1.19 (Community) to 2.19/h (Secure), H100 SXM USD 2.69 to 4.39/h; Serverless H100 PRO USD 5.89/h | per second, rounded up; Serverless bills the cold start and 5 s of idle by default | none found |
| **Vast.ai** | marketplace: L4 from USD 0.19/h (median 0.32), RTX 4090 median USD 0.48/h | A100 SXM4 median USD 0.84/h, H100 SXM from USD 1.73/h | per second, no minimum; prices change hourly | none found |
| **Lambda** | A10 USD 1.29/h, A6000 USD 1.09/h | A100 40 GB USD 1.99/h, H100 PCIe USD 3.79/h, SXM USD 4.89/h, plus VAT | whole instances; "in minutes" | none |
| **boat** | no GPU: four CPU sizes (`boat new --type`, CLI 1.0.106) | — | — | — |
| **Depot** | no GPU for sandboxes or Depot CI; GPU runners only on the Business plan, price not published | — | — | — |

Workers AI's model list was read live with our key-store token (27 November 2026): text to
image (FLUX.1 schnell, FLUX.2 klein 4B and 9B, FLUX.2 dev, Leonardo Phoenix and Lucid
Origin), speech to text (Whisper, Whisper large-v3-turbo, Deepgram Nova-3 and Flux), no
segmentation model.

## Keys and data

- **Keys.** Each takes its key from an environment variable, so `with-key.mjs` hands it over
  at run time ([keys](../recipes/keys.md)): Workers AI the Cloudflare token
  (`cloudflare-wrangler` can read the model list; running a model may need a token with the
  Workers AI permission); Modal two values, `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (two
  `with-key.mjs` calls nested); RunPod `RUNPOD_API_KEY`; Vast.ai `VAST_API_KEY`; Lambda a
  bearer key on its API. Never their setup commands: `modal token set`, `runpodctl doctor`
  and `vastai set api-key` write the key in plain text (`~/.modal.toml`,
  `~/.runpod/config.toml`, `~/.config/vastai/vast_api_key`).
- **Data.** Workers AI: Cloudflare does not train on what it processes and keeps no inputs
  or outputs of a plain call. Modal: function inputs and outputs kept up to 7 days, then
  deleted, encrypted at rest; a region can be pinned. Vast.ai: community hosts are other
  people's machines with Docker isolation; its Secure Cloud (data centres) is the tier for
  private data. RunPod: storage may be deleted when the balance runs out. Any upload of a
  photo of a person stays under the photo rules ([photos](../recipes/photos.md)), whatever
  the host.

## Why this order

- **Workers AI** needs no new service, no machine to start or stop, and its free allowance
  covers about 220 minutes of Whisper or about 2,000 FLUX.1 schnell tiles a day. It has no
  segmentation and runs only its own models.
- **Modal** is the machine rental for a real GPU job (a Blender render, a model Workers AI
  lacks): per second, nothing billed idle, and the free USD 30 is about 37 hours of an L4 a
  month. A sign-up, even free, is the owner's yes.
- Weighed and not first: RunPod (cheaper large GPUs, but Serverless bills its cold start);
  Vast.ai (cheapest, but other people's hosts: public data only); Lambda (whole instances,
  for long jobs); boat and Depot (no GPU).

**Weigh again** when a job runs often enough to wait on: Blender renders every week, Whisper
on long videos, or a model Workers AI does not offer.

Sources (read 27 November 2026): developers.cloudflare.com/workers-ai/platform/pricing and
/data-usage, modal.com/pricing and /docs/guide/security, runpod.io/pricing,
docs.runpod.io/serverless/pricing, vast.ai/pricing and /compliance, lambda.ai/pricing,
depot.dev/pricing, docs.boat.dev/pricing. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-27-gpu-rental/`.
