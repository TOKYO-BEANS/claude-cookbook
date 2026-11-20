# 20 November 2026: mail through Proton (Bridge and proton-mail.py)

**Why.** The owner asked for `nofix.dev` mail in their Proton account and for Claude to read and
send it. Owner's answers (question dialogs): the plan is Proton Unlimited (custom domains and
Bridge included, no spend); Claude may use the whole Proton account; Bridge 3.27.2 is installed
with its known findings accepted.

**What changed.**
- Proton Mail Bridge 3.27.2 (apt package `protonmail-bridge`) installed after the full vetting,
  signed in once by the owner, auto-updates off. It runs without its window as the user service
  `proton-bridge` (`scripts/proton-bridge.service`), IMAP 127.0.0.1:1143, SMTP 127.0.0.1:1025.
- `scripts/proton-mail.py` (Python standard library only, copy in `~/.local/bin`): `folders`,
  `list`, `search`, `read` (no read mark, text fenced as outside data), `send`. It trusts only
  Bridge's exported certificate (`~/.config/proton-mail/cert.pem`, names 127.0.0.1, hostname
  check on) and takes the password from `with-key.mjs proton-bridge`. Tests
  `scripts/proton-mail.test.mjs` (5).
- Key `proton-bridge`: vault note `key/proton-bridge` and the key store, never shown.
- Recipe `recipes/proton-mail.md`, catalog entry `proton-mail-bridge`, map row, the update
  check's version command (`dpkg-query --show protonmail-bridge`), the `nofix.dev` line in
  `recipes/cloudflare.md`. The map was at its byte limit: the parallel-chats row lost the
  hooks' explanation, which its recipe page has.

**Verification.** Sandbox run clean; the service listens on 127.0.0.1 only; `folders`, a `send`
to the owner's own address, `search` and `read` of that mail all worked through the hostname
check. `npm test` on boat: 738 tests, 0 failed.

**Outstanding.**
- DNS for `nofix.dev` in Proton (verification TXT, MX, SPF, DKIM): waiting on the owner's paste
  of Proton's verification value and the three DKIM targets; then Claude adds the records and
  the owner clicks Verify. Until then nothing can be sent or received at `nofix.dev` in Proton.
- Bridge 3.27.2 carries accepted findings; a newer release is vetted and its findings go to the
  owner again.

**Dead ends and failures.** Himalaya 2.2.1 was vetted and dropped (15 advisories, rustls among
them): a second acceptance for no gain over a standard-library script. The first `cert export`
also wrote Bridge's private key: shredded. The Proton Pass CLI session had run out for the
vault write: redone through the signing-in wrapper `~/.local/bin/pass-cli`.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-proton-mail/` (notes, scanner
reports, sandbox log); vetting folders `~/.local/share/vetting/proton-bridge-3.27.2` and
`~/.local/share/vetting/himalaya-2.2.1`.
