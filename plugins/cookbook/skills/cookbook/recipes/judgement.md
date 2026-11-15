# Classification and judgment (Jev)

- Use it whenever code needs a judgment about text that rules cannot make: routing, tagging, ranking,
  matching, extraction choices, "is this the same thing", gating an action.
- Ask for typed outputs, keep an explicit "no match / uncertain" outcome, cache by input fingerprint,
  and evaluate on labelled examples that are never sent as inputs.
- Keep exact calculations, permissions and fixed business rules in code; confidence alone never
  authorizes a write or clears a security finding. A literal fallback never gets the authority
  of a validated classification.
- A community Jev hook, compaction package or approval demo is a reference design: never a
  reason to enable transcript uploads, bypass approval or weaken credential handling.
- Measure the fixed rule first and write the bar before any call. In one local test (October 2026,
  small sets, one labeller per set) Jev cleared its bar in 5 of 19 tries, and never where a fixed rule
  already scored 0.925 or more.
- To match a request to a list (projects, files, tools), ask one Choice over the list plus two Nouls in
  the same request: "does it point to any of these?" and "could it mean more than one?". In that test
  this scored 0.917 on 24 held-out requests (7 of them answered with "which one?") against 0.417 for
  word overlap.
