# 20 November 2026: a boat upload is a git checkout before the command

**Why.** Stack-Atlas's test "this repository's own tree holds no scanner ignore file and no
retired scanner file" runs `git ls-files` and failed on every boat run: the upload had no
`.git`. It passed on the laptop and in CI (`2026-11-20-boat-vs-local-tests.md`, Outstanding).

**Choice.** Fixed in boat-run, not in the test: a test that skips outside a git checkout
would also hide a broken checkout. `boat run --push` sends only the files of a folder, never
`.git` (its own `--help`), so a `git init` of the local copy would not reach the sandbox. With
`--push`, boat-run now runs the command as `sh -c '<AS_CHECKOUT>' boat-run <command...>`:
`git init`, `git add --all --force .` (a tracked file a `.gitignore` names stays in), one
commit with no hooks or signing, then `exec "$@"`. The command keeps its own arguments and
exit code; a run without `--push` is unchanged.

**What changed.** `scripts/boat-run.mjs` (`AS_CHECKOUT`, `boatArgv`), its tests (the argv
for a push, and a test that stages a real repository, runs the wrapped command under `sh` and
reads `git ls-files`, a clean `git status`, `HEAD` and a failing command's exit code; skipped
on Windows only, where no POSIX sh runs it; CI has no Windows job since #174), and `options/tests-on-boat.md`'s parity note.
`recipes/boat.md` is unchanged: it sits at the page limit and its sentence (no `.git` in the
upload) still holds.

**Verification.** On boat, `--type default`, with this branch's boat-run: the Cookbook suite
741 tests, 731 passed, 0 failed, 10 skipped (the new test passed); Stack-Atlas `3008589`
782 tests, 780 passed, 0 failed, 2 skipped, the git test among the passes.

**Outstanding.** None.

**Dead ends.** The first boat run failed two tests: the old argv test, and the page-size
test, because a sentence added to `recipes/boat.md` left it no room for that test's appended
link. Fixed by updating the argv test and leaving `boat.md` as it was.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-boat-git-checkout/`:
`boat-cookbook-suite.log`, `boat-cookbook-suite-after-main.log` (the same counts after merging #174), `boat-stack-atlas-suite.log`.
