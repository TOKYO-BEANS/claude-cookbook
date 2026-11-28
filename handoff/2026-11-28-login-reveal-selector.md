# 28 November 2026: `agent-browser login --reveal-selector`

**Why.** `agent-browser login` could not sign in to OpenSEO: its email and password fields
appear only after a click on "Continue with email", and a slow "Signing in..." was judged too
early. Fixed in `TOKYO-BEANS/sign-in-tools` #35.

**What changed.** `recipes/sign-ins.md`: the sign-in line names `--reveal-selector` and the
20-second wait after submitting.

**Verification.** `node scripts/check.mjs`. The option itself: the tests and the live OpenSEO
sign-in recorded in sign-in-tools' `HANDOFF.md` (28 November 2026).

**Evidence.** sign-in-tools #35; release log
`~/.local/share/release-maintenance/evidence/2026-11-28-sign-in-tools-reveal-login/`.

**Outstanding.** None.

**Dead ends.** None.
