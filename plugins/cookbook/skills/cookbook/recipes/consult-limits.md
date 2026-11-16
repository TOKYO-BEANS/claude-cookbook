# Consult: what may be sent, model and cost

Part of [consult](consult.md).

## What leaves this PC

A consult sends the brief and whatever the child reads in the checkout to the other provider:
to OpenAI, under the owner's ChatGPT sign-in, when Codex is asked.

- **The standing yes.** The owner decided on 16 November 2026 that a session may start a
  consult on its own judgement, for code in the owner's own repositories. No question is
  asked before such a consult. The report afterwards names the provider, the model and the
  repository.
- **Never sent.** Secrets, keys and tokens; customer data; personal data; files outside the
  repository. Do not point the child at them, and do not put them in the brief.
- **Ask first.** Anything else: a repository that is not the owner's, a client's private
  material, data exports, logs with real users in them. The question names the provider, the
  model and exactly what would be sent. No yes, no consult.
- This rule came from a finding of GitHub's security review on the pull request that added
  the page; the owner chose it over a confirmation before every consult. Loosening it is the
  owner's decision.

## Model

- With the ChatGPT sign-in only `gpt-6-astra` answered (16 November 2026). `gpt-6-luna` and
  `gpt-6.1-sol` were refused ("model is not supported when using Codex with a ChatGPT
  account"), although the capabilities list shows them.
- On a refusal, stop that consult and report two things only: the model that was tried and
  the exact text of the refusal. Never paste the contents of a configuration file into chat,
  a report or evidence, and never switch model unasked.

## Cost

- A consult draws on the allowance of the owner's ChatGPT plan. An API key, bought credits, a
  faster tier or another plan is spending: ask the owner.

## No second provider

- Off, refusing or at its usage limit: say that no second opinion was had and carry on. There
  is no fallback: a `cookbook:review` subagent is the same provider, and T3's rule is never to
  fall back to another route unasked.
