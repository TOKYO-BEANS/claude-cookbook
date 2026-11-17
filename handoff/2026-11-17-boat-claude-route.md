# 17 November 2026: Claude jobs in boat sandboxes (#121 and its follow-up)

**The job.** The owner's outcome ("Keep on, build it"): long Claude jobs run in boat sandboxes,
off this PC, on the owner's Claude subscription through boat's AI credentials proxy, under a
guard that keeps runaway prompts from draining the wallet.

**What changed.** #121 merged as `68af216`. `scripts/boat-claude.mjs` runs one job:
`--model <full id> --timeout <s> --task <file.md> [--requests] [--effort] [--type] [--push]`.
It starts in the environment `claude-proxy` (or the default), checked each run to be safe for
third parties with proxy AI credentials on, so only the proxied Claude sign-in goes in. Its
spend guard: a request cap polled every 20 s (200 default, 500 most; three failed readings
stop the run), the timeout, 2,000 requests a day and a USD 5 wallet floor (500 kept for each
other run under way), 3 runs at once. A halt blocks the placeholders (asked twice),
interrupts and deletes; signals clean up too. `RESULT.md` and a `changes.patch` come back,
Gitleaks-scanned, to `~/.local/share/boat-run/claude/`. `recipes/boat-claude.md` is the page.
`boat-run.mjs`'s gate refused every run once the wallet held the proxy's money; it now checks
boat's own figures instead (next start priced at nothing, starts left, the plan's time). The
follow-up pull request fixes the four lows of the third fallback review (per-stream line
buffers; a start that names no sandbox finds it by the run's own name and deletes it; a
delete before any fetch when neither block nor interrupt is confirmed; a `main` test for
the other runs' reserve). A signal is handled only after the synchronous `boat new` returns.

**Owner steps, 17 November.** Set safe-for-third-parties and proxy AI credentials on `base`
by hand (the key had 403 on `environment.write`). Then "Yes, plus account.admin": the DPAPI
key `boat` is a new key with environment writes and account.admin (ends 17 November 2027);
it made `claude-proxy`. "Revoke both": the old keys "Production" and "claude-proxy" are
revoked. Turning the proxy on or off still asks the owner (USD 1 a day while on).

**Verification.** Suite on boat at each head (660 tests at `d7f63be`, 0 fail); CI green;
`merge-when-green` merged and the release check passed (`merge verified`). Live: Haiku 5.5
counted the recipe pages (66) and sent a one-file patch, 6 requests, USD 0.006; caps of 5 and
3 stopped runs at 9 and 8 requests with the block confirmed; every sandbox deleted.

**Reviews.** The AI review was unavailable on all three heads (credit balance); three
fallback reviews by `cookbook:review` (6, 6 and 4 findings, the last all low), records on
#121. Graphify's one P2 was the same as a medium of round two, fixed.

**Dead ends.** `--no-env` carries no sign-in ("Claude login required", while `boat prompt`
exits 0). `boat scp` fails from this PC; files come back through `boat exec --json`. boat refused
`claude-opus-5-5` ("invalid model"): its id is `opus-5-5`, so the follow-up maps it
(`BOAT_MODEL`); Opus then ran live (4 requests, the proxy reported `claude-opus-5-5`).
Haiku and Opus were run live; Sonnet and Fable ids are in boat's list as given.

**Outstanding.** Snapshots for repeated setup (`--from`, owner's question in this chat): a
separate job. Evidence: `~/.local/share/claude-cookbook/evidence/release-pr121.log`; the
runs under `~/.local/share/boat-run/claude/`.
