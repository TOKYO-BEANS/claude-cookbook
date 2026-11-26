# Paid services, CI cost and an always-on machine, measured

**Why.** The owner asked on 26 November 2026 for the Cloudflare method (read the bill, find the
driver, fix it at the source) across every paid service except Claude, for faster CI without a
weaker check, for what we could build ourselves, and whether boat or a rented server is worth it.
Three read-only investigators measured CI, the other services and boat against a server.

**What changed.** boat's AI credentials proxy is off (owner's yes in the chat; USD 1 a day, no
request since 18 November). The laptop no longer suspends when the lid closes on mains power
(a logind drop-in, `HandleLidSwitchExternalPower=ignore`; on battery it still suspends), so
scheduled runs no longer wait for the morning. Two jobs run as their own chats on the owner's
yes: the product repository's CI (it makes about 80% of the Depot bill: about 7 CI runs per
merged pull request and a 4 vCPU Windows job on every push; boat-before-push, Windows on ready
for review, a 2 vCPU trial), and boat replaced by Depot sandboxes, then cancelled.

**Verification.** Depot: `depot usage current` and `usage breakdown --group-by repository`
for 23 to 25 November, read twice (the investigator's and a re-read): about USD 340 a month at
that pace, against an October invoice of USD 52.69. GitHub: billing usage for November.
boat: `boat billing`, `boat ai usage`, then `boat ai proxy` read `enabled: false` after the
switch. logind: `busctl get-property ... HandleLidSwitchExternalPower` reads `ignore`.

**Outstanding.**
- Browserbase to the Free plan (owner's yes, 26 November): there is no API for the plan and no
  dashboard login in the vault, so the owner clicks it. Then `cloud-browser.md`'s cost line
  changes.
- The Advanced Security trial ends on 29 November. The Stack-Atlas chat "Team plan before the
  trial ends" owns it.
- The AI review was asked at push on only 60 of 201 pull requests merged 21 to 26 November; on
  the rest it started a median 34 s (p90 258 s) after CI. That is behaviour, not a missing rule
  (`fast-merges.md` has it); the next merge-script change should make it automatic.
- Bills only a dashboard shows: Cloudflare's invoice, the OpenSEO plan (above Base saves 20 to
  90 a month), the ChatGPT "team" plan (seats; paid to August 2027), Proton, Tailscale, the
  site hosts. Depot's pricing page lists 0.006 a runner minute against 0.004 invoiced: re-read
  the November invoice when it is final.

**Dead ends.** A rented server (Hetzner 16 vCPU, 32 GB, about EUR 38 a month with VAT) would sit
beside a sandbox, not replace it, and would loosen the key-store rule (no GNOME Keyring without
a desktop; the host can read memory). Not taken. Building our own replacements: an Artifact app
cannot run a VM, a browser, a scanner or CI, so no paid service moved there. Self-hosting
Graphify or OpenSEO costs more effort than the saving.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-26-costs-speed/` (`ci/`,
`services/summary.md`, `server/measurements.txt`).
