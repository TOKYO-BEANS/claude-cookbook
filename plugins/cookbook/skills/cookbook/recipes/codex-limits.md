# Codex: what may be sent, refused models, cost

Part of [codex](codex.md) and [codex-consult](codex-consult.md).

## What leaves this PC

A consult sends the brief and whatever the child reads in the checkout to OpenAI, under the
owner's ChatGPT sign-in.

- **The standing yes.** The owner decided on 16 November 2026 that a session may start a
  consult on its own judgement, for code in the owner's own repositories. No question is
  asked in chat before such a consult. The report afterwards names the model and the
  repository.
- **What that yes is not.** It is not the yes for an unattended run: a consult still starts
  supervised, as the Codex page says.
- **Never sent.** Secrets, keys and tokens; customer data; personal data; files outside the
  repository. Do not point the child at them, and do not put them in the brief.
- **Ask first.** Anything else: a repository that is not the owner's, a client's private
  material, data exports, logs with real users in them. The question names the provider, the
  model and exactly what would be sent. No yes, no consult.
- This rule came from a finding of GitHub's security review on the pull request that added
  the page; the owner chose it over a confirmation before every consult. Loosening it is the
  owner's decision.

## Models

- The Codex page names the models that answered. Refused on the ChatGPT sign-in
  (16 November 2026): `gpt-6-luna` and `gpt-6.1-sol` ("model is not supported when using
  Codex with a ChatGPT account"), although the capabilities list shows them.
- On a refusal, stop that consult and report two things only: the model that was tried and
  the exact text of the refusal. Never paste the contents of a configuration file into chat,
  a report or evidence, and never switch model unasked.

## Cost

- A consult draws on the allowance of the owner's ChatGPT plan. An API key, bought credits, a
  faster tier or another plan is spending: ask the owner.

## Codex off or refusing

- Say that no second opinion was had. The row's fallback, a `cookbook:review` subagent, is a
  second look by Claude: name it as that, never as a consult.
