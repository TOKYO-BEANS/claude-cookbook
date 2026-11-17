# Codex: what may be sent, refused models, cost

Part of [codex](codex.md) and [codex-consult](codex-consult.md).

## What leaves this PC

Everything Codex reads goes to OpenAI, under the owner's ChatGPT sign-in.

- **On every run:** its own start-up reading ([codex-setup](codex-setup.md)): the global rules
  file, the Cookbook's pages, the repository's instruction files and the memory files.
- **For the question:** the brief, and the files the child reads to answer it.
- **Nothing fences reading.** The child can read any file the owner's account can: an
  unattended run has full access, and a supervised run's sandbox is read-only, not fenced
  (only its first command was seen to wait for a click, 16 November 2026). So the rules below
  are kept by the session and the checks, not by a wall.

## Before the call: no check, no consult

- **A scan.** Run `gitleaks dir --no-banner --redact <path>` over the checkout. A finding
  stops the consult and is a security finding of its own. So does a Gitleaks that cannot run.
- **Ignored files.** `git status --short --ignored` lists what Git ignores. A file there that
  can hold a secret (`.env`, a key or token file) means: ask the owner first, even after a
  clean scan.
- **A narrow brief.** It names the paths the question is about and carries this line: "Read
  only what this question needs, and nothing outside the repository."

## The owner's decisions

What the owner allowed, with dates and words: [codex-decisions](codex-decisions.md).

## Models

- The Codex page names the models that answered. Refused on the ChatGPT sign-in
  (16 November 2026): `gpt-6-luna` and `gpt-6.1-sol` ("model is not supported when using
  Codex with a ChatGPT account"), although the capabilities list shows them.
- On a refusal, stop that consult and report two things only: the model that was tried and
  the exact text of the refusal. Never paste the contents of a configuration file into chat,
  a report or evidence, and never switch model unasked.

## Cost and no Codex

- A consult draws on the allowance of the owner's ChatGPT plan. An API key, bought credits, a
  faster tier or another plan is spending: ask the owner.
- Codex off or refusing: say that no second opinion was had. The row's fallback, a
  `cookbook:review` subagent, is a second look by Claude: name it as that, never as a consult.
