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

## The owner's decisions, 16 and 17 November 2026

- **The standing yes**, 16 November. With the checks above passed, a session may start a
  consult on its own judgement, for code in the owner's own repositories, without a question
  in chat; the report names the model and the repository. The owner chose it twice that day
  over a confirmation before every consult (asked for by three threads on #63), the second
  time knowing that the sandbox does not fence reading and that the session decides alone.
- **Unattended**, 17 November, two yeses in the question dialog: first to Codex started
  without the owner watching, for second opinions on our own work; then to these words:
  "without your clicks, with full access, on your own repositories only, after the scan,
  ignored-files and start checks". It allows the mode; a finding about it is handled as any.
- **Never pointed at.** Secrets, keys and tokens; customer data; personal data; files outside
  the repository, beyond Codex's own start-up reading.
- **Ask first.** Anything else: a repository that is not the owner's, a client's private
  material, data exports, logs with real users in them. The question names the provider, the
  model and what would be sent, by path, and why. No yes, no consult.
- Loosening either is the owner's decision.
