# 17 November 2026: the Semgrep gate's wording follows Stack Atlas v21

**Why.** Stack Atlas standard v21 (TOKYO-BEANS/Stack-Atlas, handoff entry "the Semgrep gate
reads Semgrep's own exposure classes") changed what fails the `semgrep` job. The gate read
only `sca_info.reachable`, which Semgrep sets `false` on every `upgrade-only` finding although
its own report counts `upgrade-only` and `malicious` as reachable and `legacy` as
undetermined. It now fails on a high or critical finding unless Semgrep classes it
unreachable, and on a `malicious` one at any severity.

**What changed.** Wording only, in the three places that said "reachable":
`catalog.json` (Semgrep's purpose), `options/check.md` and `recipes/security.md`. No tool
was added, changed or retired.

**Verification.** `npm test`.

**Outstanding.** None here. The rollout of v21 and the findings it holds back are in Stack
Atlas's handoff.
