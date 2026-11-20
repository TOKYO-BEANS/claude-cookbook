# 20 November 2026: a Proton folder per address

**Why.** The owner asked for each address (two of the owner's own addresses, `claude@nofix.dev`,
`claudesub@nofix.dev`) to have its own inbox. Proton has one inbox per account, so the owner
chose folders fed by filters, set up by Claude (question dialog).

**What changed.**
- Proton (not this repository): folders `Folders/<address>` for the three addresses that had
  none, made through Bridge (IMAP CREATE); three Sieve filters ("recipient matches" in To, Cc
  or Bcc, then `fileinto`), made in Proton's settings in the T3 browser after the owner signed
  in. The owner's older filter for the fourth address has the same rule and was left as is.
- The Inbox's 5 old mails were moved into the folders of their addresses (owner's yes); the
  Inbox is empty.
- Recipe `proton-mail.md`: the folder per address, where Claude's own mail is, and three
  bullets made shorter to stay under the page limit (the vetting evidence path is in the
  #195 handoff).

**Verification.** One test mail to each of the four addresses landed in its own folder and
none in the Inbox; the sent copies are filed too, since Proton runs filters on sent mail.

**Outstanding.** None new; delivery outside Proton is still unproven (see the "live" entry).

**Dead ends and failures.** None.

**Evidence.** The folder listing and move counts are in this chat; nothing kept on disk.
