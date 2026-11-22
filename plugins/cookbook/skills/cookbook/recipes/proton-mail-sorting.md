# Proton mail sorting (folders per account and sender)

The owner's Proton mail is filed by account, then by sender: `Folders/<address>/<sender>`.
Owner's choices, 20 and 22 November 2026: a folder per address; the owner's Gmail and work
mailbox (Microsoft 365) forward into Proton; a sub-folder per sender, "same sender-ish"; rules
first, Jev only for a sender the rules cannot place.

- **Folder per address:** a Proton filter (Sieve, recipient in To, Cc or Bcc) files the mail of
  each Proton address, sent copies too, into `Folders/<address>`. A new address gets a folder
  and a filter like the others. The Inbox stays empty.
- **Forwarded accounts:** Gmail and Microsoft 365 forward to the Bridge account's own address;
  the owner sets the forward (Gmail: Settings, Forwarding, the code Proton receives; Outlook:
  Settings, Mail, Forwarding, keep a copy). Proton has no filter for them: the sorter files them.
  A work tenant that blocks outside forwarding answers with `550 5.7.520`: only its admin can
  change that.
- **The sorter:** `scripts/proton-sort.py`, beside `proton-mail.py` in `~/.local/bin`, run by
  the user timer `proton-sort.timer` every 10 minutes (`scripts/proton-sort/`). It reads the
  Inbox and each `Folders/<account>`, finds the account (Gmail's `X-Forwarded-For` first, then
  To and Cc, then `Delivered-To`, then the folder it sits in) and moves the mail to the sender's sub-folder, which it
  makes when missing. Mail from the owner's own addresses stays where it is.
- **Sender groups:** by rule, a company is its exact domain without sub-domains
  (`mail.amazon.dk` is `amazon.dk`) and a free-mail address, or a colleague on the account's own
  domain, is that address. Anything else that looks alike (`amazon.com`, `danskebank.io`, the
  same name on another address) never joins by rule: it goes to Jev (`jev-1.14.0`, key `jev-compaction`): one Choice over at most 12 candidates plus "none
  of these", kept only above `max(0.6, 1/n + 0.25)`. Jev sees the sender's name and address and
  the candidates' names and three addresses each, never a subject or a text. At most 25 calls a
  run; without the key the rules decide alone.
- **Config:** `"sort": {"accounts": [...], "own": [...]}` in `~/.config/proton-mail/config.json`
  (addresses stay out of this public repository). An account written `{"address": ...,
  "also": ["alias@..."]}` also matches a forwarding alias.
- **State:** `~/.local/share/proton-sort/state.json` (sender to group; a group once made keeps
  its senders) and `log.jsonl` (each Jev pick and its scores). To move a sender to another
  group, edit its line in `senders` and move its folder's mail by hand.
- **Run by hand:** `node ~/.local/bin/with-key.mjs proton-bridge PROTON_BRIDGE_PASSWORD node
  ~/.local/bin/with-key.mjs jev-compaction TYPESAFE_API_KEY python3 -I
  ~/.local/bin/proton-sort.py sort --dry-run --verbose`. Without `--dry-run` it moves.
- **After a change:** merge, copy the script and the two units, `systemctl --user
  daemon-reload`, then one run by hand and `systemctl --user list-timers proton-sort.timer`.
