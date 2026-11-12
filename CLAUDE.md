<!-- stack-atlas-standard:begin v16 -->
## Stack Atlas standard

This repository follows the Stack Atlas standard. `.stack-atlas.json` records the standard version and level it is on.

- The standard manages these files: this section, `.stack-atlas.json`, `.depot/semgrep-requirements.txt`, `.github/dependabot.yml` and the AI review's `.depot/ai-review/` files. It manages the Aikido Safe Chain step in `.depot/workflows/ci.yml` and in the Windows jobs of `.github/workflows/ci.yml`, the `semgrep` and `ai-review` jobs in `.depot/workflows/ci.yml`, and the repository ruleset `Stack Atlas checks`. Change them only through the `stack-atlas-onboard` skill, which opens a pull request. Do not edit them by hand.
- Every change reaches the default branch through a pull request whose checks all pass. Never force-push.
- Fix or triage security findings, GitHub's code-scanning and secret-scanning alerts included; a model's judgement never clears one. Never silence a scanner with an ignore file (`.semgrepignore`), and never add workflow-level `defaults` or `env` to `.depot/workflows/ci.yml`; the standard reads each as modified.
- In CI, every package install runs after the Safe Chain step.
- The tool stack is defined by the Cookbook (`TOKYO-BEANS/claude-cookbook`, `plugins/cookbook/catalog.json`); use its `cookbook` skill to choose tools. Add, change or retire tools there.
<!-- stack-atlas-standard:end -->
