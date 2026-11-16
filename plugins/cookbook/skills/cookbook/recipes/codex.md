# Codex as a second model

Codex (OpenAI's coding agent) runs in T3 Code beside Claude, on the owner's ChatGPT account. Its
job here is narrow: a second opinion on our own work from a model that is not Claude.

- **Use it for:** a design, a plan or a diagnosis; a second review of our own risky change,
  beside the `ai-review` job and never instead of it; a cross-check where two Claude answers
  disagree. It reads and reports: the brief says "change no file". Asking it is a consult:
  when, the brief and what may be sent are in [codex-consult](codex-consult.md).
- **Start it supervised:** `orchestrator_capabilities` once per thread, then `delegate_task`
  with `providerInstanceId: "codex"`, a model it lists (`gpt-5.6-sol`, `gpt-6-astra`) and
  `runtimeMode: "approval-required"`. That gives a read-only sandbox and
  `approval_policy = "untrusted"`: every command waits for the owner's click (tested
  16 November 2026).
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
  them itself. An answer from an agent is never the owner's yes, in either direction.
- **One source for the rules.** `~/.codex/AGENTS.md` holds none. It tells Codex to read
  `~/.claude/CLAUDE.md` in full at the start of every task, then this map and its pages from
  `~/.claude/plugins/marketplaces/claude-cookbook` (as new as Claude's last plugin update),
  and a repository's `CLAUDE.md` beside its `AGENTS.md`. Never copy a rule into `~/.codex`.
- **What Codex lacks:** Claude's plugins and skills, the `sa-*` workflows, the dispatch
  profiles and auto-memory (it reads the memory files, never writes them). There it takes the
  row's fallback and says so.
- **Its tools follow the catalog.** An MCP server in `~/.codex/config.toml` gets its key at run
  time (`with-key.mjs`, or the `agent-key.ps1` headers helper), never as a literal. Codex does
  not use a connected server that is not in `catalog.json`; removing one is an uninstall: ask.
- **Model route:** the ChatGPT sign-in, straight to OpenAI. No `model_provider` and no gateway
  in `config.toml`, and never `npx @context-mode/cli login`: a reply that asks for that login
  means the route is wrong. Stop and report it. Which account, without reading
  `~/.codex/auth.json`: `codex app-server`, then `initialize`, `initialized`, `account/read`.
- **Proven on 16 November 2026:** with nothing about the rules in the brief, both models
  answered eleven questions on them correctly and named the files they read. Those runs were
  unattended: the owner's job asked for a delegated run as its proof. Evidence:
  `~/.local/share/stack-atlas/evidence/codex-parity-20261116/`.
