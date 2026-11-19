# Google accounts: setup and evidence

- **The grants do not expire on a schedule.** The sign-in screen is "In production" (published on
  13 November 2026), so a grant lasts until it is revoked or unused for six months. Google allows that
  state only while the sign-in screen names a public home page and privacy policy: they are
  `https://nofix.dev/` and `https://nofix.dev/privacy`, served by the Worker `nofix-site`
  (`~/.local/share/google-auth/site`, `deploy.mjs` there). Keep both pages up. The app is not
  verified by Google, which is allowed for private use by fewer than 100 people; the consent page
  says so and warns that it "may stop working soon". If `google status` shows `works` as an error,
  run `google login` again for that account and click the consent. A grant that works but is not
  listed (a new machine) needs no consent: `google adopt <account>` ([google](google.md)).
- **On the laptop:** the Google Cloud project is `claude-tools-514616` in the owner's Google account
  (sign-in screen "Claude tools", External, In production; Drive, Sheets, Docs,
  Calendar, Search Console, Analytics Data and Analytics Admin APIs switched on). The client secret
  is the key-store key `google-oauth-client`, each grant the key `google-<account>`. The code is
  `~/.local/share/google-auth`; its source is the repository `TOKYO-BEANS/sign-in-tools` (`npm
  test` there runs against a stand-in for Google; `node install.mjs install` copies it here and
  writes `~/.local/bin/google`). `google` saves and removes its keys with `secret-tool` (a
  15-second limit, the value on standard input, the store read again afterwards) and reads them
  through `with-key.mjs`. gws is a pinned copy in `~/.local/share/gws`; `PROVENANCE.txt` there
  has the source, checksum and how to update. Never `npm install -g @googleworkspace/cli`, and never use
  gws's own `auth login`: it would keep a second copy of the grant.
- **Limits of gws 0.22.5:** no release since 31 March 2026, its support for several accounts was
  removed (which is why `google` selects the account), and `<api>:<version>` for unlisted services
  fails. Business Profile needs Google to approve the project first; not applied for yet.
- Vetted on 13 November 2026, and the Linux build on 19 November: the gws download matched the
  release checksum and passed `gh attestation verify` (built by the repository's release workflow
  at the tag). On the PC the binary was not signed, and Trivy and OSV-Scanner could not parse it,
  which is no result, not a clean one; no signature check and no scan is recorded for the Linux
  build.
- Proven on the laptop on 19 November 2026: `google adopt` for both accounts, `google status`
  (both grants work), one `google api owner GET` on Drive (200) and `google gws owner drive files
  list`. Not tried on Linux: `google login` (a new consent) and `logout`.
- Proven on the PC on 13 November 2026: for `owner`, Drive through `google api` and through gws,
  Calendar, Search Console and Analytics answered; for `camilla`, Search Console listed her site
  and returned a week of search data, and Drive was refused as intended.
