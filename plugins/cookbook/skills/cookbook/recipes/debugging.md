# Debugging

- Reproduce first, trace the data flow (Graphify), form one hypothesis, write the failing test, then
  fix. After three failed fixes, question the design instead of trying a fourth.
- A failure that shows only in CI or only on Linux: reproduce it in a sandbox with
  `boat run --push .` before pushing again ([boat](boat.md)).
- A diagnosis that has failed twice is a case for a second provider's opinion:
  [codex-consult](codex-consult.md).
