<!-- stack-atlas-standard:begin v32 -->
## Stack Atlas standard

This repository follows the Stack Atlas standard. `.stack-atlas.json` records the standard version and level it is on.

- The standard manages these files: this section, `.stack-atlas.json`, `.depot/semgrep-requirements.txt`, `.github/dependabot.yml` and the AI review's and the AI fix's `.depot/ai-review/` files and workflows `.depot/workflows/ai-review.yml` and `.depot/workflows/ai-fix.yml`. It manages the Aikido Safe Chain step in `.depot/workflows/ci.yml` and in the Windows jobs of `.github/workflows/ci.yml`, the `semgrep` and `codeql` jobs in `.depot/workflows/ci.yml` with the `codeql` job's `.depot/codeql/` files, and the repository ruleset `Stack Atlas checks`. Change them only through the `stack-atlas-onboard` skill, which opens a pull request. Do not edit them by hand.
- Every change reaches the default branch through a pull request whose checks all pass. Never force-push.
- Fix or triage security findings, GitHub's code-scanning and secret-scanning alerts included; a model's judgement never clears one. Never silence a scanner with an ignore file (`.semgrepignore`), and never add workflow-level `defaults` or `env` to `.depot/workflows/ci.yml`; the standard reads each as modified.
- The AI review runs once, for the commit that is about to merge: when the pull request is marked ready for review, never on a push. The merge commands ask for it when the head has no `ai-review` run, never for a draft. By hand: `gh pr ready <n> --undo`, then `gh pr ready <n>`. A fix is a new head, which needs a new request; never ask again for a head whose review ran.
- The AI fix (`.depot/workflows/ai-fix.yml`) pushes at most one fix commit per head commit, three per pull request, to a same-repository pull request whose Depot CI failed or whose AI review found a high or medium problem. The fix commit runs CI and needs a new AI review like any push; it never merges by itself. Review it like any change, and add the label `no-ai-fix` to a pull request it should leave alone. List paths it must never change (a gate the owner keeps, such as a site's visual check) in `.ai-fix-protected` on the default branch, one glob per line.
- In CI, every package install runs after the Safe Chain step.
- The tool stack is defined by the Cookbook (`TOKYO-BEANS/claude-cookbook`, `plugins/cookbook/catalog.json`); use its `cookbook` skill to choose tools. Add, change or retire tools there.
<!-- stack-atlas-standard:end -->
