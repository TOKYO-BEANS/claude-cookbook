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
  rule (country, .com) let a look-alike in twice (review rounds 4 to 6), so it was removed. Jev also answers "imitation?" in the same request; a
  join needs it under 0.5 (live: `danskebank-verify.io` and `paypal-account-update.com` 0.98
  to 0.99 though Jev called them the same sender; own domains 0.04 to 0.13). State and Jev log in
  `~/.local/share/proton-sort/`. Units `scripts/proton-sort/proton-sort.{service,timer}`, every
  10 minutes.
- Recipe `proton-mail-sorting.md` (new); the folder bullet in `proton-mail.md` moved there.
- Tests `scripts/proton-sort.test.mjs` (8): sender rules, a hostile name as folder name, account
  routing, the Jev gate and bad replies, what Jev is sent, look-alikes, settings, and a whole
  run on a fake IMAP connection. No real addresses in the repository.
- Outside the repository: the folders for the two forwarded accounts made through Bridge; the
  `sort` block in `~/.config/proton-mail/config.json` (four accounts; Claude's two addresses
  left out so their mail stays readable as before).

- Follow-up PR: a company folder names its domain too (`Name (domain)`), so a look-alike
  that writes first never holds the bare name; Jev's candidates are ranked before the cut at
  12; one failed Jev call ends Jev for that run.
- Installed after #223 (6e73614): script in `~/.local/bin`, units enabled, a run under systemd
  read both keys from the store.

**Verification.** Live: a dry run, then two test mails to an own address were moved (4 with
the sent copies) into a new sender folder; then moved to Trash and the folder removed. Live Jev
call on made-up senders: a known brand on another domain merged at 1.0, an unrelated one went
to "none" (0.66).

**Outstanding.** The Gmail forward is on (set the same evening in the built-in browser and the
owner's own browser: Google's "verify it's you" and "Proceed" windows are pop-ups the built-in
browser does not show); a test sent from the Proton account itself never came back (Proton keeps
one copy per Message-ID), so the first real Gmail mail in its folder is the proof. The work
forward is off: the tenant answered `550 5.7.520` (no outside forwarding); the owner chose to
leave work mail out (question dialog), and the work address left the sorter's config. An app
route is closed as well: a Mail.Read sign-in with Microsoft's own Graph command-line client ends
"Need admin approval" (AADSTS90094), so only the tenant's IT can open it (outside forwarding, or
admin consent for an app). Asking IT is outstanding: the owner answered "not now" on 22 Nov 2026
(owner; cleared when IT allows one of the two, then switch it on and test). The
older mail in Archive was sorted on the owner's yes (question dialog, this chat): 419 of 432
mails matched an account and went to 59 sender folders (Jev asked 9 times); 13 matched no
account and stay in Archive. Of #224's last review's two low findings, the 401/403 one is fixed
(a key error ends Jev for the run); the other (state from before #224 keeps old folder names)
needs nothing: the state was empty when #224 was installed.

**Dead ends and failures.** Dropping endings by rule (country, `.com`) to merge a company's
domains: two variants let a look-alike in (review rounds 4 to 6); removed, Jev decides instead.

**Evidence.** Run output in this chat; state and Jev log in `~/.local/share/proton-sort/`.
