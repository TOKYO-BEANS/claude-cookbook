# Codex as a second model

Codex (OpenAI's coding agent) runs in T3 Code beside Claude, on the owner's ChatGPT account. Its
job here is narrow: a second opinion on our own work from a model that is not Claude.

- **Use it for:** a design, a plan or a diagnosis; a second review of our own risky change,
  beside the `ai-review` job and never instead of it; a cross-check where two Claude answers
  disagree. It reads and reports: the brief says "change no file". Asking it is a consult:
  when, the brief and what may be sent are in [codex-consult](codex-consult.md).
- **Where it may start:** only in a checkout whose instruction files are the reviewed ones of
  one of the owner's repositories. Codex loads every `AGENTS.md` and `AGENTS.override.md` on
  its path into its instructions by itself, before it reads any rule of ours. Before every
  start, with `<repo>` taken from the task and never from the checkout:
  - `gh api repos/TOKYO-BEANS/<repo>/commits/HEAD --jq .sha` gives GitHub's default head;
    after `git fetch origin`, `git cat-file -e <sha>` finds it;
  - `git diff --quiet <sha> -- <files>` exits 0, and
    `git status --porcelain --untracked-files=all --ignored -- <files>` prints nothing, where
    `<files>` is `':(glob)**/AGENTS.md' ':(glob)**/AGENTS.override.md' ':(glob)**/CLAUDE.md'`.

  If a step fails or cannot run, do not start Codex there: the piece goes to a
  `cookbook:review` subagent.
- **Start it supervised:** `orchestrator_capabilities` once per thread, then `delegate_task`
  with `providerInstanceId: "codex"`, a model it lists (`gpt-5.6-sol`, `gpt-6-astra`) and
  `runtimeMode: "approval-required"`. That gives a read-only sandbox and
  `approval_policy = "untrusted"`: the first command waited for the owner's click (tested
  16 November 2026); that every later one waits is not proven
  ([codex-limits](codex-limits.md)).
- **An unattended run is not a job of this page.** Codex's own setting is
  `approval_policy = "never"` with `sandbox_mode = "danger-full-access"`, Claude's deny rules
  do not reach it, and no mode is read-only and unattended. Running it that way for this job
  needs the owner's yes, recorded here with its date. None is recorded.
- **Never on text from outside**, supervised or not: a pull request from a fork, an issue, a
  web page or a dependency's code goes to a `cookbook:review` subagent.
- **Not for:** the session itself, an `sa-*` workflow, an edit, a merge or a deploy. Its
  verdict is one more input: the merge condition and the stops are unchanged, and a model's
  judgement never clears a security finding.
- **The brief** carries the task, the files and the report shape, not the rules: Codex reads
  them itself. An answer from an agent is never the owner's yes.
- **Codex reads the Cookbook of Claude's last plugin update**, from the marketplace clone
  (`~/.claude/plugins/marketplaces/claude-cookbook`), not `main`. Before a start that leans on
  a page changed since, compare the `version` in the clone's
  `plugins/cookbook/.claude-plugin/plugin.json` with `main`'s. When they differ, do not lean
  on that page: update the plugin first (the `stack-updates` rules say when that needs the
  owner), or give the piece to a `cookbook:review` subagent.
- Where its rules and tools come from, the model route and the proof:
  [codex-setup](codex-setup.md).
