# The model budget: where the banked resets come from

Part of [model-budget](model-budget.md). Measured on 16 November 2026.

- **The endpoint lists them by client.** To the script's own read of `api/oauth/usage` it
  answers `cedar_ember.eligible: false`, `ineligible_reason: "surface"` and no resets;
  `skip_spend=1` changes nothing (one timed read, 200). T3 Code's read differs only in its
  User-Agent, `claude-cli/<version> (external, cli)`, and is shown them.
- **T3 Code's file** (`~/.t3/caches/claudeAgent.json`, `usageLimits.resetCredits`) has the
  list only in the minutes T3 Code's own read got through: every other one at times, none
  for ten minutes and more at others. No key is "not read"; a count of 0 is "none"; a list
  the script does not understand in full (a renamed label, entries that do not add up to
  the count) is "not read" too and replaces nothing. Taken as it stands, the list made the
  advice change every minute (0.35.4).
- **What the script does** (the owner's choice, 16 November 2026: "Keep T3 Code's list").
  When T3 Code's file shows a list newer than the kept one, the script saves it in
  `~/.local/share/model-budget/resets.json`, signed like its other files, and adds the kept
  list to every reading, whatever the source of the figures. Any hook event may save it;
  none goes on the network for it. A list last seen over an hour ago is dropped: the line
  then says "not read", and no "Redeem" line comes.
- **What that costs.** T3 Code's file is not signed, and the kept list is what it said.
  Whoever can write that file as the owner can have a session told to ask for a reset, or
  told Fable where the pace rule says Opus. That is still one of the fixed lines, and
  redeeming stays the owner's click in T3 Code, which shows the real list.
- **After a reset is used**, the next read of T3 Code's that gets through replaces the list,
  in a minute or two. Until then the old list stands.
- **A renewed sign-in.** Claude Code renews the sign-in about every 8 hours, and the script's
  files are signed with it: the kept list cannot be read until T3 Code's file next shows
  one. A change of advice in those minutes is not said to a running session (the hook waits
  five minutes, unless a limit is spent); a session started in them may be told the other
  model once.

## Not chosen

- **Reading as Claude Code** (the `claude-cli` User-Agent). First-hand and signed, but it
  names the script as another client, past a gate Anthropic set; and the script's read gets
  through only now and then while T3 Code runs.
- **Claude Code's own saved reading** (`cachedUsageUtilization` in `~/.claude.json`), for the
  figures or the resets. T3 Code gets its figures by asking Claude Code (`get_usage`), and
  that one read writes both files; a refused read moves T3 Code's alone. So Claude Code's is
  never newer, has no resets, and adds only Fable's part of the week, which changes no
  advice (weighed 16 November 2026).
