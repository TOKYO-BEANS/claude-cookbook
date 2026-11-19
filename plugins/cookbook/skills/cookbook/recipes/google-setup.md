# Google accounts: setup and evidence

- **The grants do not expire on a schedule.** The sign-in screen is "In production" (published on
  13 November 2026), so a grant lasts until it is revoked or unused for six months. Google allows that
  state only while the sign-in screen names a public home page and privacy policy: they are
  `https://nofix.dev/` and `https://nofix.dev/privacy`, served by the Worker `nofix-site`
  (`~/.local/share/google-auth/site`, `deploy.mjs` there). Keep both pages up. The app is not
  verified by Google, which is allowed for private use by fewer than 100 people; the consent page
  says so and warns that it "may stop working soon". If `google status` shows `works` as an error,
  run `google login` again for that account and click the consent.
- **On this PC:** the Google Cloud project is `claude-tools-514616` in the owner's Google account
  (sign-in screen "Claude tools", External, In production; Drive, Sheets, Docs,
  Calendar, Search Console, Analytics Data and Analytics Admin APIs switched on). The client secret
  is the key-store key `google-oauth-client`, each grant the key `google-<account>`. The code is
  `~/.local/share/google-auth` (`npm test` runs 8 tests against a stand-in for Google; not in a
  repository yet). gws is a pinned copy in `~/.local/share/gws`; `PROVENANCE.txt` there has the
  source, checksum and how to update. Never `npm install -g @googleworkspace/cli`, and never use
  gws's own `auth login`: it would keep a second copy of the grant.
- **Limits of gws 0.22.5:** no release since 31 March 2026, its support for several accounts was
  removed (which is why `google` selects the account), and `<api>:<version>` for unlisted services
  fails. Business Profile needs Google to approve the project first; not applied for yet.
- Vetted on 13 November 2026: the gws download matched the release checksum and passed `gh
  attestation verify` (built by the repository's release workflow at the tag); the binary is not
  signed, and Trivy and OSV-Scanner could not parse it, which is no result, not a clean one.
- Proven on 13 November 2026: for `owner`, Drive through `google api` and through gws, Calendar,
  Search Console and Analytics answered; for `camilla`, Search Console listed her site and
  returned a week of search data, and Drive was refused as intended.
