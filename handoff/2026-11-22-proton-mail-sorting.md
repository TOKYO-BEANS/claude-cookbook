# 22 November 2026: Proton mail sorted by account and sender

**Why.** The owner asked for the Gmail and work mailboxes to come into Proton with a folder
each, and for a sub-folder per sender ("same sender-ish"), with Jev helping. Owner's answers
(question dialog, this chat): both forward into Proton; the work forward is allowed; rules
first, Jev only for unclear senders (names and addresses only).

**What changed.**
- `scripts/proton-sort.py` (new, beside `proton-mail.py`): files mail from the Inbox and each
  `Folders/<account>` into `Folders/<account>/<sender>`; rules first, a Jev Choice over at most
  12 candidates plus "none of these", gated at `max(0.6, 1/n + 0.25)`. By rule a company is its exact domain and a person their address;
  everything alike (other endings, the same name) reaches Jev. Dead end: dropping endings by
  rule (country, .com) let a look-alike in twice (review rounds 4 to 6), so it was removed. State and Jev log in
  `~/.local/share/proton-sort/`. Units `scripts/proton-sort/proton-sort.{service,timer}`, every
  10 minutes.
- Recipe `proton-mail-sorting.md` (new); the folder bullet in `proton-mail.md` moved there.
- Tests `scripts/proton-sort.test.mjs` (8): sender rules, a hostile name as folder name, account
  routing, the Jev gate and bad replies, what Jev is sent, look-alikes, settings, and a whole
  run on a fake IMAP connection. No real addresses in the repository.
- Outside the repository: the folders for the two forwarded accounts made through Bridge; the
  `sort` block in `~/.config/proton-mail/config.json` (four accounts; Claude's two addresses
  left out so their mail stays readable as before).

**Verification.** Live: a dry run, then two test mails to an own address were moved (4 with
the sent copies) into a new sender folder; then moved to Trash and the folder removed. Live Jev
call on made-up senders: a known brand on another domain merged at 1.0, an unrelated one went
to "none" (0.66).

**Outstanding.** The owner sets the two forwards (Gmail, Outlook); the first forwarded mails
show whether Microsoft 365 keeps the original To (if not, an `also` alias in the config). The
older mail in Archive (about 430) is not sorted: the owner's choice.

**Dead ends and failures.** None.

**Evidence.** Run output in this chat; state and Jev log in `~/.local/share/proton-sort/`.
