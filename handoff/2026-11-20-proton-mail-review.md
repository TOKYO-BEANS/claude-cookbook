# 20 November 2026: proton-mail.py, the review findings of #195

**Why.** #195 merged with three low findings from the AI review and two P2 bugs plus one
unbounded-read note from Graphify. All five touch `proton-mail.py`, all are small.

**What changed.**
- `read`: a text part with an unknown or wrong charset is read as UTF-8 with replacements
  instead of ending in a traceback (Graphify P2).
- `--max` is 1 to 100000; `-1` printed nearly the whole mail (Graphify P2).
- `search`: the words go as a UTF-8 literal, so non-ASCII words work; a folder name must be
  given as `folders` prints it (ASCII, IMAP's modified UTF-7) (AI review, low).
- `send`: one address per `--to`/`--from` value; a comma or semicolon is refused, so one value
  cannot carry a second recipient past the check (AI review, low).
- `--body-file`: read at most 200,000 bytes, as UTF-8; a missing, non-UTF-8 or oversized file
  is a clean error (AI review, low; Graphify's unbounded read).
- `main()` reports a `UnicodeError` as an error line, not a traceback.
- Tests: 3 more in `scripts/proton-mail.test.mjs` (8 in all).
- Recipe: the SPF record as set (Email Routing's include kept beside Proton's).

**DNS, set the same day.** `nofix.dev`: Proton's verification TXT, MX `mail.protonmail.ch` 10
and `mailsec.protonmail.ch` 20, SPF `v=spf1 include:_spf.protonmail.ch
include:_spf.mx.cloudflare.net ~all` (was Cloudflare's alone). Public DNS (1.1.1.1) answered
with all of them; `in.nofix.dev` MX unchanged.

**Verification.** `scripts/proton-mail.test.mjs`: 8 passed, the new cases included
(non-ASCII words, two addresses in one value, a missing, Latin-1 and oversized body file, an
unknown charset, `--max -1`); `npm test` on boat for the head.

**Dead ends and failures.** None.

**Outstanding.** The three DKIM CNAMEs wait on the owner's paste from Proton's wizard; then the
owner clicks Verify for DKIM, and a test mail from a `nofix.dev` address proves it.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-proton-mail/`
(`pr195-reviews.json`, merge log).
