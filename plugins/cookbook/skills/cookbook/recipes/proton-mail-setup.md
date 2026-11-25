# Mail through Proton: updates and DNS

The setup side of [proton-mail](proton-mail.md): how Bridge is updated and what `nofix.dev`
needs in DNS for Proton.

- **Updates:** automatic updates are off in Bridge. A new release gets the full vetting
  ([connecting](connecting.md)): the `.deb` from the GitHub release, its signature (key ID
  `E6234B07`, checked against Proton's page), the three scanners, a sandbox run, then the
  owner's `sudo` password through `request_secret`. The owner accepted 3.27.2's known
  findings (Trivy 58 high) on 20 November 2026; a newer build's go to the owner again.
- **DNS for `nofix.dev`** (Cloudflare, key `cloudflare-wrangler`): Proton's verification TXT,
  MX `mail.protonmail.ch` 10 and `mailsec.protonmail.ch` 20, SPF `v=spf1
  include:_spf.protonmail.ch include:_spf.mx.cloudflare.net ~all` (Email Routing's include
  kept), the three DKIM CNAMEs. Email Routing keeps `in.nofix.dev`; its "misconfigured" for
  the apex is expected. DMARC
  `p=reject` stays: Proton signs with DKIM.
