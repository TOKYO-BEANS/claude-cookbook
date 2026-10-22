<!-- stack-atlas-standard:begin v6 -->
## Stack Atlas standard

This repository follows the Stack Atlas standard. `.stack-atlas.json` records the standard version and level it is on.

- The standard manages these files: this section, `.stack-atlas.json`, `.gitleaks.toml`, `.depot/osv-scanner.toml` and `.depot/semgrep-requirements.txt`. In `.depot/workflows/ci.yml` it manages the `security` job (and the `semgrep` job at full level) and the Aikido Safe Chain step. Change them only through the `stack-atlas-onboard` skill, which opens a pull request. Do not edit them by hand.
- Every change reaches the default branch through a pull request whose checks all pass. Never force-push.
- Fix or triage security findings; a model's judgement never clears one. A Gitleaks exception names one rule and one anchored value pattern, never `paths` or `[[rules]]`. Never silence a scanner with an ignore file (`.gitleaksignore`, `.semgrepignore`, `.trivyignore`) or a `gitleaks:allow` comment, and never add workflow-level `defaults` or `env` to `.depot/workflows/ci.yml`; the standard reads each as modified.
- In CI, every package install runs after the Safe Chain step.
- The tool stack is defined by the Cookbook (`TOKYO-BEANS/claude-cookbook`, `plugins/cookbook/catalog.json`); use its `cookbook` skill to choose tools. Add, change or retire tools there, never only in Stack Atlas.
- Read `.tool-stack/README.md` at the start of a task: Stack Atlas writes it with the tools this project uses and what each is for. It describes intended use and grants no permissions.
<!-- stack-atlas-standard:end -->
