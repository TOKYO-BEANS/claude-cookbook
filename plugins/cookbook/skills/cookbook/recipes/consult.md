# Consult: a second provider's opinion

A consult is one read-only question to a model from another provider. Since 16 November 2026
Codex is on in T3 Code as the second provider, signed in with the owner's ChatGPT account. A
Claude session asks Codex; a Codex session asks Claude. The answer is advice: the session that
asked checks each point against the code and decides.

- **When.** Before building on a choice that is costly to reverse (a data model, a migration,
  a security-sensitive design, two real options); when a diagnosis has failed twice; before a
  reply to a review finding you dispute; when the owner says "consult" or "ask Codex".
- **Not for.** What a test or a check can decide; a public fact (research); routine edits; a
  second look by the same provider (that is `cookbook:review`). Never one on every pull request.
- **How.** Call `orchestrator_capabilities` once per thread: Codex must show
  `canRunChildTask: true`. Then one `delegate_task` with
  `target: { providerInstanceId: "codex", model: "gpt-6-astra" }` and `role: "review"`; add
  `mode: "wait"` only when this turn needs the answer. Leave `serviceTier` alone. From a Codex
  session the target is `{ providerInstanceId: "claudeAgent" }` (not yet proven by a real call).
- **The brief.** The child gets no history. Give it the repository path, the base commit or
  the files, the question, what is already ruled out, and this line: "Read-only: do not edit,
  commit, push, comment on a pull request or start subagents." Ask for a verdict, findings with
  file, line and evidence, and what it could not check. No secrets and no customer data in a
  brief.
- **While it runs.** Do not edit the files it reads. A timeout, an error or no reply is not
  agreement. One model, one consult per question; a re-check after changes is a new
  `delegate_task`, three rounds at most.
- **Afterwards.** Check each point yourself. Report what the consult said, what was taken and
  what was declined, with the reason.

## What a consult does not replace

- The `ai-review` job owns the review of every pull request, and its comment is part of the
  merge condition ([ai-review](ai-review.md), [ci-releases](ci-releases.md)). A consult's
  approval counts for nothing there, and a high finding still disputed after two replies goes
  to the owner as before.
- It never clears a security finding, a failed check or one of the stops.
- tstack's `sol-loop` and `council` are not in use: see [ship](../options/ship.md).

## Limits

- **Model.** With the ChatGPT sign-in only `gpt-6-astra` answered (16 November 2026).
  `gpt-6-luna` and `gpt-6.1-sol` were refused ("model is not supported when using Codex with a
  ChatGPT account"), although the capabilities list shows them. On a refusal, stop that consult
  and report it with the `model` line of `~/.codex/config.toml`: never switch model unasked.
- **Cost.** A consult draws on the allowance of the owner's ChatGPT plan. An API key, bought
  credits, a faster tier or another plan is spending: ask the owner.
- **No second provider.** Off, refusing or at its usage limit: say that no second opinion was
  had and carry on. There is no fallback: a `cookbook:review` subagent is the same provider,
  and T3's rule is never to fall back to another route unasked.
