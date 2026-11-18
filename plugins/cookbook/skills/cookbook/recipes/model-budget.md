# The model for a thread (the model budget)

The plan has one weekly limit for every model and a Fable limit inside it: Fable may take
half of the week, and what Fable uses is gone for Opus as well. Usage credits are off and
stay off: buying usage is the owner's decision. So a thread runs on Fable 5.2 high or on
Opus 5.5 high, and a script chooses.

- **The line.** `node <skill folder>/scripts/model-budget.mjs` (`--json` for the numbers)
  prints the week, the Fable share, the pace, the weekly reset, the model to use and the
  banked resets. The plugin's hook gives every session the advice alone (the model, or a
  reset to ask for), no figures, at its start, and as "Model budget changed" when it changes
  (after a tool, checked at most every five minutes). Only a session start reads the usage
  over the network, once per ten minutes for all sessions, and saves it signed with the
  sign-in, so a changed file is ignored. While T3 Code runs that read is mostly refused: the
  last signed reading stands in for an hour, then T3 Code's own saved one. With no reading
  under an hour old a session says "unknown" once. Before a long piece of work, run the script for
  the figures. Follow the advice: it is arithmetic, not a view to weigh. A model the owner
  names in a message wins over it.
- **The rules** (`RULES` in the script):
  - Fable while its share is no more than 10 points ahead of the week's pace. Spent evenly,
    the share is used up at the weekly reset and none of it is lost.
  - Opus when Fable is further ahead, when the whole week is ahead of pace, and always from
    90% of the Fable share, so that no turn is held on the Fable limit.
  - "Wait" when the week or the session window is spent: nothing runs before the time named.
- **Switching this thread** (T3 Code). `t3_thread_configure` with `modelSelection`: instance
  `claudeAgent`, the model id, option `effort` `high`. The running turn keeps its model; the
  switch counts from the next turn. So finish the step, queue the rest to this thread
  (`t3_thread_send`, `mode: "queue"`, a message that says what is left) and end the turn. Say
  the switch in one line and do not ask. Outside T3 Code only the owner can switch (`/model`):
  say the line.
- **Pieces.** A dispatch profile keeps its own model. An untyped subagent or a fork inherits
  the thread's: on Opus advice, pass `model: "opus"`.
- **A banked reset.** Anthropic gives limit resets now and then; each expires. The script says
  when one is worth its most: a Fable reset at 95% of the Fable share, a weekly or full reset
  at 95% of the whole week, a session reset at 95% of the session window; never one that would
  leave the week or the session window spent, so nothing could run. With a weekly reset
  banked, a spent Fable share means Opus first: redeeming then would throw the Opus half of
  the week away. A reset is held when the weekly reset is under 12 hours off, and redeemed
  at half spent when it expires within 12 hours. Redeeming is the owner's click: T3 Code,
  Usage, Limits, "Use reset". On a "Redeem" line, ask with the question dialog, naming the
  reset and why now, and run on Opus until it is done. The list is T3 Code's, read
  when its file shows it; the hook holds the advice otherwise:
  [source](model-budget-resets.md).
- **Unknown.** When the line says unknown, keep the thread's model and say so. Unknown is
  never "enough left".
- New threads and stopped threads are T3 Code's own settings, and the proofs and dead ends
  are listed: [model-budget-setup](model-budget-setup.md).
