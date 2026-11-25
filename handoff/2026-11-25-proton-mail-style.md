# 25 November 2026: drafts written as the owner follow a private style file

**Why.** After #252 the owner sent the first draft and asked what would make the next one easier. Two things showed
in the mails themselves: the related order mail went to one of the owner's addresses, while `draft` defaults to the
Bridge account's address, so a draft from the default would have come from the wrong address; and the chat's first
version had placeholders for the name, the order number and the price that the mails already held.

**What changed.** `recipes/proton-mail.md`: before writing as the owner, read `~/.config/proton-mail/style.md`
(private, mode 600, not in this public repository: the sign-off, the language, which address), send `--from` the
address the related mail went to, fill facts from the mail, and after the owner sends, compare the sent copy with the
draft and add what changed to that file. The file was written from the sent mail of 25 November 2026.

**Dead ends.** Weighed and not done: A project or folder for mail drafting: a mail request comes in whatever chat is open, and
the recipe reaches every project through the Cookbook, so a separate place adds a choice without adding a tool. A
reply command that threads a draft under a received mail (`In-Reply-To`): not needed yet; this mail was a new
message to a shop's address.

**Verification.** `node scripts/check.mjs --room` passed; the suite on boat for the head.

**Outstanding.** None.

**Evidence.** This entry and the pull request. The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-25-cookbook-proton-mail-style/release-check.log`.
