# Code navigation

- Graphify answers structure questions from an indexed snapshot. Compare its `commitSha` with your branch;
  a semantic match may name a different symbol, and an empty caller list does not prove code is unused.
- Unindexed changes (your branch, local edits) need `rg` and reading.
- `set_workspace` changes the account-wide default and `remember` saves a note the whole
  workspace shares: use either only on purpose. Keep private data out of queries.
