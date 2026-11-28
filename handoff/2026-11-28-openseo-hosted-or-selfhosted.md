# 28 November 2026: OpenSEO, hosted or self-hosted

**Why.** The owner asked whether EveryApp (by OpenSEO's maker) could self-host OpenSEO on the
Cloudflare account we already pay, so the OpenSEO subscription could go.

**What we found.** The hosted Base plan is USD 10 a month and includes USD 10 of usage; OpenSEO
charges DataForSEO's price plus 28 %. Self-hosting needs a DataForSEO key (USD 50 minimum top-up,
or the `treg` reseller) and an OpenRouter key. The billing page, read 28 November 2026, showed
USD 4.50 spent in 30 days, so self-hosting would save about USD 6 a month.

**Owner's answer (28 November 2026):** keep the hosted plan, and keep something that tracks
when switching would be worth it.

**What changed.**
- `recipes/seo.md`: the section "Hosted or self-hosted", with the rule (raise the switch when the
  saving is over USD 10 a month two checks running, or spend is under USD 1).
- T3 scheduled task "OpenSEO: hosted or self-hosted", every 30 days, first run 28 December 2026.
  It reads the billing page and appends to the usage log.

**Verification.** `node scripts/check.mjs` passes; the suite runs in a Depot sandbox (see the
pull request). The first log line was read from the live billing page.

**Evidence.** `~/.local/share/claude-cookbook/evidence/openseo-usage/usage.tsv`. Release log:
the `sa-release` run of this pull request.

**Failures and dead ends.** `agent-browser login "app.openseo.so (copy)"` failed twice ("no
password field", then "the sign-in form is still shown" while it was still signing in); owner:
Claude; cleared by the sign-in tools fix below.

**Outstanding.** `agent-browser login` cannot open OpenSEO's form: the email field appears only
after "Continue with email", and the tool judged the sign-in before it finished. A one-off script
signed in today. The fix (a reveal-click option and a later check) is its own chat in the
sign-in tools repository; until it merges, a monthly check that finds the session expired
records "signed out" and says so.
