# The model budget: T3 Code settings, proofs, dead ends

Part of [model-budget](model-budget.md). Checked on 16 November 2026.

## T3 Code's own settings

In `~/.t3/userdata/settings.json` (Settings, Threads), set on 16 November 2026:

- `defaultModelSelection`: Fable 5.2, effort high. A new thread starts there.
- `fallbackModelSelection`: Opus 5.5, effort high. A new thread starts on it while a limit
  of the default model reads 100%. It acts only at 100% and only for new threads.
- `autoResumeLimitedThreads`: true. A thread stopped by a limit runs again at the reset.

## Proved

- **The reading.** `GET https://api.anthropic.com/api/oauth/usage` with Claude Code's stored
  sign-in returns the week (`weekly_all`), the Fable limit (`weekly_scoped`, "Fable"), Fable's
  part of the week (`weekly_scoped_shares`) and the reset time; `?cedar_ember=1` adds banked
  resets. T3 Code reads it the same way. It answers 429 when called often: the script reads
  at most once per ten minutes, shared by all sessions.
- **A thread switches itself.** `t3_thread_configure` then `t3_thread_send` with `queue`: the
  queued turn ran on Opus 5.5 with no one at the keyboard.

## Dead ends

- **Claude Code's `fallbackModel`.** Overload and unavailable models only; a rate-limit or
  usage-limit error never switches.
- **Redeeming a reset from a session.** No Claude Code command does it, and the help pages say
  the button is not in Claude Code. T3 Code's "Use reset" posts to an organization endpoint
  that is not documented. A script doing it is an unofficial write to the owner's account:
  the owner's decision, not built.
- **The status line's `rate_limits`.** It has the week and the session window, not the Fable
  limit.

## Weighed, not in the stack: several subscriptions through one hub

CLIProxyAPI (and EasyCLIProxyAPI) pools several Claude and Codex sign-ins behind one address,
on one home machine that stays on, reached over Tailscale; T3 Code can read a hub's limits
(Settings, Providers, Usage providers, Add hub). Its author warns of account bans. Not set up:
a second subscription is spending, and a proxy is a new route for a credential. Both are the
owner's decision. If set up, the budget then reads each account and the rules stay the same.
