# Google accounts (google and gws)

One consent per Google account, then no sign-in: the `google` command holds a grant for each account
and gets a short-lived access token whenever it is used. Added on 13 November 2026 as a trial.

- **Accounts:** `owner` (Drive, Docs, Sheets, Calendar, Search Console, Analytics read-only) and
  `camilla` (Search Console and Analytics read-only, nothing else). `google status` lists them and
  says whether each grant still works.
- **Any Google API:** `google api <account> <METHOD> <https://…googleapis.com/…> [json body]`
  prints the status and the answer (4,000 characters unless `--max` says otherwise). It refuses any
  address that is not `https` on `googleapis.com`.
- **Drive, Sheets, Docs, Calendar with less typing:** `google gws <account> <arguments>` runs the
  Google Workspace CLI as that account, for example `google gws owner drive files list --params
  '{"pageSize":5}'` or `google gws owner schema drive.files.list`. gws 0.22.5 lists only the
  Workspace services; Search Console, Analytics and the rest go through `google api`.
- **Ask before a write** in either account, and read only what the task needs: these are private
  Drive files, calendars and a live site's search data. Gmail is not connected and has no short
  scope name on purpose: reading a mailbox means being able to reset every password tied to it.
- **More access or another account:** `google login <account> --scopes drive,sheets,docs,calendar,
  searchconsole,analytics,business` prints `{"open": "<address>"}` and waits five minutes. Open
  that address in the built-in browser (add `&login_hint=<the account's address>`), check the
  account and the list on Google's consent page and click Allow. The owner's yes is needed before
  each consent; a consent replaces the account's earlier grant, so name every scope it should keep.
  `google logout <account>` revokes a grant at Google and forgets it.
- **A new machine:** `google status` lists an account only when its note is in
  `google-auth/accounts/`, and the notes belong to one machine. `google adopt <account>` writes
  the note again from a grant that is already in the key store: Google says whose grant it is
  and what it covers, with no consent. A grant that no longer works needs `google login` instead.

More: [setup and evidence](google-setup.md).
