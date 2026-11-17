# Codex: the owner's decisions

Part of [codex](codex.md) and [codex-limits](codex-limits.md): what the owner allowed for a
consult, with dates and words. The checks before the call are on the limits page.

- **The standing yes**, 16 November. With the limits page's checks passed, a session may
  start a consult on its own judgement, for code in the owner's own repositories, without a
  question in chat; the report names the model and the repository.
- **Unattended**, 17 November, two yeses in the question dialog: "May Claude start Codex
  without you watching, for read-only second opinions on our own work?", then "Claude may
  start a consult that runs without your clicks, with full access, on your own repositories
  only, after the scan, ignored-files and start checks." Only the second names full access.
- **The two modes.** Unattended (`runtimeMode: "full-access"`): Codex's own
  `approval_policy = "never"` and `sandbox_mode = "danger-full-access"` apply and Claude's
  deny rules do not reach it. Supervised (`runtimeMode: "approval-required"`): a read-only
  sandbox and `approval_policy = "untrusted"`; only its first command was seen to wait for
  the owner's click (16 November). No mode is both read-only and unattended, so the first
  answer above could not be met as asked; the second is the one in force.
- The standing yes answers findings of GitHub's security review: the owner chose it twice on
  16 November over a confirmation before every consult, the second time knowing that the
  sandbox does not fence reading and that the session decides alone.
- The unattended yes accepts no security finding in advance. On #113 the owner accepted four
  of Graphify's as known limits of the mode (only the brief keeps it from writing; the audit
  sees the repository only; repository text could steer it; the hook has no gate of its own
  for this mode). Any other finding is fixed or goes to the owner.
- Loosening either yes is the owner's decision.
