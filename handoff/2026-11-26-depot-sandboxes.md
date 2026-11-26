# 26 November 2026: boat replaced by Depot sandboxes, boat cancelled

**Why.** The owner's yes of 26 November 2026 ("Yes, all three"): replace boat with Depot
sandboxes and cancel boat once the Depot route is proven. boat cost USD 20 a month (and USD 30
a month for its AI credentials proxy, switched off the same day), and the stack used 1.6% of
its plan.

**What changed.** `scripts/sandbox-run.mjs` is the one route to a cloud sandbox: Depot's
Connect API by `fetch`, the `depot-org` key read from the key store into its own process only.
It keeps boat-run's interface and guarantees (tracked files only, Gitleaks first, the upload
list, the data-shaped file stop, a timeout, ten at once, exit 75 for a run that did not start)
and adds a spend guard (a ledger of Depot's own records, USD 10 a month, a fifth kept for
vetting), a stop of every sandbox in a `finally` with a look at the org's list after, and
`--vet` for the vetting probe. `boat-run.mjs` stays as its old name. The state folder moved
to `~/.local/share/sandbox-run` (the upload list copied over). The hook is now
`hooks/sandbox-route*.mjs`. `pinned-sandbox.sh` runs the probe through `--vet`. Retired and
deleted: `boat-claude.mjs` and its page (Depot's Claude route needs a Team or Enterprise plan;
the plan-token `claude -p` route stays), `boat-snapshots.md`, the boat catalog entry, its
version and connection checks. `recipes/sandboxes*.md` and `options/sandboxes.md` replace
the boat pages; the map row, CLAUDE.md's test command and every page naming boat follow.

**Verification.** The suite through `sandbox-run.mjs` on the final tree, five runs: 772
tests, all passed; wall time 13.4 to 14.7 s (median 13.5 s; boat's was 15.4 s); Depot's record
11.2 to 12.5 s at 4 vCPU, USD 0.0022 to 0.0025 a run. `--list` after: no sandbox left. The
hook denies `npm test` here and names the sandbox-run command; `# local-run:` still passes. A
vetting run (`pinned-sandbox.sh codex-cli @openai/codex 0.172.0`): 39.1 s, USD 0.0039; its
report matches boat's for the same package line for line (only the image's patch versions
differ). Eight runs in all, USD 0.0214 by the ledger. `node scripts/check.mjs` passes.

**boat's plan.** `boat billing cancel --yes` ran: the plan does not renew and ends on
16 December 2026; boat does not refund the rest of the paid month (already paid, so the
cancel loses nothing). The wallet, USD 29.96 (USD 30 paid on 17 November plus a USD 10
credit, less the proxy's USD 1 a day), stays on the boat account and never expires; boat
refunds it only on a request to its support, a message to other people, so the owner's call.

**Outstanding.** After the merge and `claude plugin update`: revoke the boat API key
(`boat api-key revoke`), then delete it from the key store and the vault "Claude", and
remove `~/.local/share/boat`, `~/.local/share/boat-run` and the `boat` launcher (to
`~/.local/share/backups/`). The release log is `release-cookbook-<pr>-merge.log` in the
evidence folder.

**Dead ends.** `depot sandbox exec` cannot reach an API sandbox (20 November); the API's
`RunCommand` does. Parallel's free tier rate-limited the search for boat's refund terms;
Firecrawl read the page.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-26-depot-sandboxes/`: `runs/`
(each suite run's log), `ledger.jsonl`, `image-probe.log`, the two codex vetting reports.
