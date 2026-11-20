# 20 November 2026: nofix.dev mail live in Proton

**Why.** The last step of the Proton mail job (#195, #196): the domain's DNS, the first
addresses and a live test of the merged script.

**What changed.**
- DNS for `nofix.dev`: the three DKIM CNAMEs (`protonmail`, `protonmail2`, `protonmail3`
  `._domainkey`, DNS only) beside the verification TXT, MX and SPF set earlier. Proton showed
  the domain, verification, SPF and DMARC as passed.
- The owner added `claude@nofix.dev` (Claude's sending address) and `claudesub@nofix.dev` (kept
  for a possible extra subscription for the pooled proxy).
- Recipe: Bridge searches the raw mail, so a word with letters outside ASCII, or one in an
  encoded subject, finds nothing (the AI review's low on #196 asked for proof of that path).

**Verification.** Live, through Bridge with the merged script (copy in `~/.local/bin` equal to
`main`): a mail from `claude@nofix.dev` to the owner and one from the owner to
`claude@nofix.dev` both arrived; the three DKIM CNAMEs answered on 1.1.1.1 and 8.8.8.8, and the
first one's target serves a DKIM key. `search Rechnung` found the test mail through the UTF-8
literal; `search März`, `Grüße` and `test 3` (in a subject with `ü`) found nothing.

**Outstanding.** Delivery from `nofix.dev` to a mailbox outside Proton is not yet proven: every
test stayed inside Proton. The first real outside mail shows it; a bounce or a spam folder
there means a look at DKIM and DMARC first.

**Dead ends and failures.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-20-proton-mail/`
(`pr196-reviews.json`, merge logs).
