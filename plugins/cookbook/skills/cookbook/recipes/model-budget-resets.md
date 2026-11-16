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
  the count) is "not read" too.
- **What the script does** (the owner's choices, 16 November 2026: "Keep T3 Code's list" as
  the source, then "Hold the advice" on GitHub's security review of #80). It adds the list
  to a reading only while T3 Code's file shows it, under an hour old by the file's own
  time, and saves it nowhere: that file is not signed, so nothing it says goes into a file
  the script signs. In the other minutes the resets are "not read": the script run by hand
  says so and gives no "Redeem" line.
- **What keeps the advice still.** The hook. A change of advice that comes while the list
  is missing waits until the list is back, an hour at most; then the change is said. A
  spent limit and a session start are never held back. The session's file holds what was
  said and since when the list is missing, never the list.
- **What that costs.** A session that starts in a minute without the list hears the advice
  without the resets (Opus where a banked Fable reset says Fable, no "Redeem" line), and
  hears the other one once the list shows. While the list is missing, a change that comes
  from the figures alone waits as well, up to the hour. And T3 Code's file still chooses,
  at the moment it is read, among the fixed lines: whoever can write it as the owner can
  have a session told to ask for a reset. Redeeming stays the owner's click in T3 Code,
  which shows the real list.
- **After a reset is used**, the next read of T3 Code's that gets through shows the new
  list, in a minute or two.

## Not chosen

- **Keeping the list** in a signed file of the script's own for an hour (0.38.0). It held
  the advice, and gave what an unsigned file said the standing of a signed one: the
  security review's finding.
- **The list as it stands, with nothing held** (0.35.4): the advice changed every minute.
- **Showing the list and never acting on it**: no "Redeem" line, and Opus where a banked
  Fable reset allows Fable.
- **Reading as Claude Code** (the `claude-cli` User-Agent). First-hand and signed, but it
  names the script as another client, past a gate Anthropic set; and the script's read gets
  through only now and then while T3 Code runs.
- **Claude Code's own saved reading** (`cachedUsageUtilization` in `~/.claude.json`). It has
  the limits and Fable's part of the week, and no resets.
