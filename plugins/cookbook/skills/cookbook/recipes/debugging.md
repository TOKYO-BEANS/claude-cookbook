# Debugging

- Reproduce first, trace the data flow (Graphify), form one hypothesis, write the failing test, then
  fix.
- **A second failed fix stops the attempts.** Before any third, start one Codex consult on the
  diagnosis ([codex-consult](codex-consult.md)): what was tried, what each failure showed, the
  question. Weigh the answer, then rethink from the start, the simplest way first; never a third
  variant of the same approach. Say in the reply what the consult said, taken and declined.
- A failure that shows only in CI or only on Linux: reproduce it in a sandbox before pushing
  again, with the `sandbox-run.mjs` script: `--timeout <seconds> --push . -- <failing command>`
  ([sandboxes](sandboxes.md)).
