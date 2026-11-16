# Debugging

- Reproduce first, trace the data flow (Graphify), form one hypothesis, write the failing test, then
  fix. After three failed fixes, question the design instead of trying a fourth.
- A failure that shows only in CI or only on Linux: reproduce it in a sandbox before pushing
  again, with `boat run --type small --no-env --timeout <seconds> --push . -- <failing
  command>` ([boat](boat.md)).
- A diagnosis that has failed twice is a case for a second provider's opinion:
  [codex-consult](codex-consult.md).
