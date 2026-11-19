# Code navigation

- Graphify answers structure questions from an indexed snapshot. Compare its `commitSha` with your branch;
  a semantic match may name a different symbol, and an empty caller list does not prove code is unused.
- Unindexed changes (your branch, local edits) need `rg` and reading.
- `set_workspace` changes the account-wide default and `remember` saves a note the whole
  workspace shares: use either only on purpose. Keep private data out of queries.
- **Language servers** (four Claude Code plugins behind the `LSP` tool) answer from the
  checkout as it is now: a definition, the references, a symbol's type, also for changes
  Graphify has not indexed. Proven on 19 November 2026 for TypeScript and JavaScript, Python
  (pyright) and Go (gopls). The TypeScript server needs a `typescript` with a `tsserver`:
  6.0.3 is installed, because 7.0.2 ships none. Rust gave no answer for a crate outside the
  session's workspace: not proven from a session.
- **A change of one code shape across many files: `ast-grep`.** `ast-grep run -p
  '<pattern>' -l <language> <folder>` finds it, `--rewrite '<new code>'` changes it; the
  pattern is code with `$HOLES`. Read the matches before a rewrite. A literal string stays
  with `rg`.
