# SEO (OpenSEO)

- Use the OpenSEO plugin's skills (audit, keyword research, competitors, backlinks, local SEO,
  reports). Research uses credits: ask before a planned batch over 2,000 credits.
- It never buys credits or changes a subscription.
- It loads only in the projects that switch it on (16 November 2026; it cost every session 2,303
  tokens): the plugin is off in the user settings and on in the `.claude/settings.json` of each
  project that uses it. That file is in git, so a T3 worktree thread has it too. Another project
  that needs it gets the same line
  (`"enabledPlugins": {"openseo@openseo": true}`); for one question elsewhere, a child session
  ([connecting-load.md](connecting-load.md)).

## Hosted or self-hosted (owner, 28 November 2026: hosted, and track it)

- We keep the hosted Base plan: USD 10 a month, which includes USD 10 of usage; OpenSEO charges
  DataForSEO's price plus 28 %. Self-hosting (EveryApp, on the Cloudflare Workers Paid plan we
  already pay) needs a DataForSEO key (USD 50 minimum top-up, or the `treg` reseller) and an
  OpenRouter key: two new paid services, so it is asked first.
- Measured 28 November 2026: USD 4.50 spent in 30 days, so self-hosting would cost about
  USD 3.50 and save about USD 6 a month.
- The rule, with U the hosted spend in 30 days: hosted costs max(10, U), self-hosted about
  U / 1.28. Raise the switch with the owner when that saving is over USD 10 a month two checks
  running (U over about USD 46), or when U is under USD 1 (then: cancel, or self-host).
- The check: the T3 scheduled task "OpenSEO: hosted or self-hosted", every 30 days. It reads
  "Spent in the last 30 days" on `https://app.openseo.so/billing` with `agent-browser` (vault
  item `app.openseo.so (copy)`) and adds a line to
  `~/.local/share/claude-cookbook/evidence/openseo-usage/usage.tsv`. The sign-in form appears
  only after "Continue with email", which `agent-browser login` does not click yet.
