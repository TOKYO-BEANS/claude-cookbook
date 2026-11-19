# 19 November 2026: which runs may stay on the Linux laptop

**Why.** The boat-route hook refuses local test and Semgrep runs in a repository on boat's
upload list. Its escape was worded for Windows: "Windows-only" in `boat-setup.md`, and
"Windows or this PC (DPAPI, PowerShell, a local app)" in the hook's own message. On Linux
neither named a real case, and the AI review of #157 read each rewording as a rule change.

**The owner's answer.** 19 November 2026, question dialog, "A closed list": only a run that
needs the laptop itself, namely its key store, its display, or an app installed on it.
Everything else runs on boat.

**What changed.** The hook's message (`hooks/boat-route-lib.mjs`) and `boat-setup.md` name
exactly those three cases. The hook's logic is unchanged: it still passes a command that ends
with `# local-run: <why>` and a reason of ten characters or more; the list tells a session
which reasons count.

**Verification.** `npm test` on boat passes; the hook's test checks that its message names
the three cases and nothing of Windows.

**Outstanding.** The hook does not check the reason against the list: a reason is read by
whoever reads the transcript. Making the hook judge it is a design change of its own.

**Dead ends.** None.

**Evidence.** None beyond the pull request's checks.
