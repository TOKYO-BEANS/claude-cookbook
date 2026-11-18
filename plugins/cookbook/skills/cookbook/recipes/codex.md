# Codex as a second model

Codex (OpenAI's coding agent) runs in T3 Code beside Claude, on the owner's ChatGPT account. Its
job here is narrow: a second opinion on our own work from a model that is not Claude.

- **Use it for:** a design, a plan or a diagnosis; a second review of our own risky change,
  beside the `ai-review` job and never instead of it; a cross-check where two Claude answers
  disagree. It reads and reports: the brief says "change no file". Asking it is a consult:
  when, the brief and what may be sent are in [codex-consult](codex-consult.md).
- **Where it may start:** only in a checkout whose instruction files are the reviewed ones of
  one of the owner's repositories. Codex loads every `AGENTS.md` and `AGENTS.override.md` on
  its path by itself, before it reads any rule of ours. Before every start, in the checkout:
  `node <skill folder>/scripts/codex-start-check.mjs <repo>`, with `<repo>` the
  repository's plain name from the task, never from the checkout. It compares
  every `AGENTS.md`, `AGENTS.override.md` and `CLAUDE.md` on disk, and every file under a
  `.codex` or `.agents` folder, with GitHub's default head of `TOKYO-BEANS/<repo>`:
  - exit 0, `start Codex here: yes`: start it.
  - exit 3, yes and `not main's version`: the marketplace clone Codex reads the Cookbook
    from is behind `main`. Start it only for a piece that leans on no page changed since, or
    update the plugin first (`stack-updates` says when that needs the owner).
  - exit 1, `start Codex here: no` and the reason: do not start Codex there; the piece goes
    to a `cookbook:review` subagent. For "not in the checkout's object files":
    `git fetch origin`, then check again. A failed step is a no.
- **A hook requires it:** before T3 starts an agent that is not Claude, the plugin's hook runs
  the check and denies the call unless it passes. The brief carries one line
  `Repository: TOKYO-BEANS/<repo>`, and Codex runs in this thread's own checkout: no
  `isolation: "worktree"`, other project or machine. What the hook does not reach:
  [codex-setup](codex-setup.md).
- **Start it:** `orchestrator_capabilities` once per thread, then `delegate_task` with
  `target: { providerInstanceId: "codex", model }` (`gpt-5.6-sol` or `gpt-6-astra`) and:
  - `runtimeMode: "full-access"`, unattended: only a consult on the owner's own repositories,
    after the checks on [codex-limits](codex-limits.md) and the start check. Only the brief
    keeps it from writing: the limits page's audit is a must.
  - `runtimeMode: "approval-required"`, supervised (a read-only sandbox): anything else.
- **The owner's yes** to the unattended mode is of 17 November 2026; it and what each mode
  does: [codex-decisions](codex-decisions.md).
- **Never on text from outside**, supervised or not: a pull request from a fork, an issue, a
  web page or a dependency's code goes to a `cookbook:review` subagent.
- **Not for:** the session itself, an `sa-*` workflow, an edit, a merge or a deploy. Its
  verdict is one more input: the merge condition and the stops are unchanged, and a model's
  judgement never clears a security finding.
- **The brief** carries the task, the files, the `Repository:` line and the report shape, not
  the rules: Codex reads them itself. An answer from an agent is never the owner's yes.
- Where its rules and tools come from, the model route and the proof:
  [codex-setup](codex-setup.md).
