# 17 November 2026: Claude's own accounts use `<service>@in.nofix.dev`

**Why.** The owner decided on 17 November 2026 to put the domain `nofix.dev` to work: the
inbox `in.nofix.dev` becomes the sign-up address for accounts only Claude uses; private pages
behind Cloudflare Access only if they truly help; other ideas go to the owner.

## What changed

- `recipes/sign-ins-mail-and-access.md`: a new first bullet, "Claude's own accounts". One
  address per service, the login in the vault "Claude", mail kept 15 minutes, so links and
  codes only. No forward for important mail: a service whose mail must be kept is not one only
  Claude uses, and it goes to the owner. The owner's-decision sentence for mail routes now
  reads "for any account but Claude's own".
- `recipes/sign-ins.md`: the `pass-cli item create` example uses `--email
  <service>@in.nofix.dev`. The rule that each new login needs the owner's yes in the current
  chat is unchanged: the owner's decision sets the address, not that stop.
- `recipes/sign-ins-setup.md`: the code is no longer "not in a repository"; its source is
  `TOKYO-BEANS/sign-in-tools`, copied to `~/.local/share/site-login` by its `install.mjs`.
- `recipes/cloudflare.md`: what the domain is for, and private pages on `nofix.dev` subdomains behind Access are weighed and not
  built. Artifacts and `html_render` already give private pages; Access pages would add a
  Worker, an Access policy (an access change) and a sign-in per page for nothing more.

## Outstanding

- **A mailed one-time code.** `agent-browser mail-link` opens links only; no command reads a
  code from the inbox. Built (in `sign-in-tools`) for the first site that needs one; owner:
  Claude; clears when such a site comes up.
- **Google consent screen.** On or after 21 November 2026, `google status` should still show
  both accounts working (it did on 17 November). The apex `nofix.dev` and `/privacy` were not
  touched by this change. Owner: Claude; a one-time T3 scheduled task runs the check.
- The inbox still has 0 addresses; the first one is made with the first account.
