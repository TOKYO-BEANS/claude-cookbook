# Code navigation

- Graphify answers structure questions from an indexed snapshot. Compare its `commitSha` with your branch;
  a semantic match may name a different symbol, and an empty caller list does not prove code is unused.
- Unindexed changes (your branch, local edits) need `rg` and reading.
