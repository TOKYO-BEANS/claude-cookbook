# Codex as a second model

Codex (OpenAI's coding agent) runs in T3 Code beside Claude, on the owner's ChatGPT account. Its
job here is narrow: a piece that gains from a model that is not Claude.

- **Use it for:** a second opinion on a design, a plan or a diagnosis; a second review of a
  risky change, beside the `ai-review` job and never instead of it; a cross-check where two
  Claude answers disagree.
- **Not for:** the session itself, an `sa-*` workflow, a merge or a deploy. Its verdict is one
  more input: the merge condition and the stops are unchanged, and a model's judgement never
  clears a security finding.
- **Start it:** `orchestrator_capabilities` once per thread, then `delegate_task` with
  `providerInstanceId: "codex"` and a model it lists (`gpt-5.6-sol`, `gpt-6-astra` on
  16 November 2026).
- **Read-only pieces.** Every use above reads and reports; the brief says "change no file". That
  is an instruction, not a control: Codex runs as the owner set it (`approval_policy = "never"`,
  `sandbox_mode = "danger-full-access"`), and Claude's deny rules do not reach it. A piece
  that edits is not in this job until a write run is proven and added here.
- **The brief** carries the task, the files and the report shape, not the rules: Codex reads
  them itself. An answer from an agent is never the owner's yes, in either direction.
- **One source for the rules.** `~/.codex/AGENTS.md` holds none. It tells Codex to read
  `~/.claude/CLAUDE.md` in full at the start of every task, then this map and its recipe pages
  from `~/.claude/plugins/marketplaces/claude-cookbook`, and a repository's `CLAUDE.md` beside
  its `AGENTS.md`. Change a rule in its own file; never copy one into `~/.codex`.
- **What Codex lacks:** Claude's plugins and skills, the `sa-*` workflows, the dispatch
  profiles and auto-memory (it reads the memory files and never writes them). There it takes
  the row's fallback and says so. It sees the Cookbook as of Claude's last plugin update.
- **Its tools follow the catalog.** An MCP server in `~/.codex/config.toml` gets its key at run
  time (`with-key.mjs`, or the `agent-key.ps1` headers helper), never as a literal. Codex does
  not use a connected server that is not in `catalog.json`; removing one is an uninstall: ask.
- **Model route:** the ChatGPT sign-in, straight to OpenAI. No `model_provider` and no gateway
  in `config.toml`, and never `npx @context-mode/cli login`: a Codex reply that asks for that
  login means the route is wrong. Stop and report it.
- **Which account, without reading `~/.codex/auth.json`:** start `codex app-server`, send
  `initialize`, `initialized`, then `account/read`.
- **Proven on 16 November 2026:** with nothing about the rules in the brief, both models
  answered eleven questions on them correctly and named the files they read. Evidence:
  `~/.local/share/stack-atlas/evidence/codex-parity-20261116/`. Not proven: a Codex piece that
  writes code and opens a pull request.
