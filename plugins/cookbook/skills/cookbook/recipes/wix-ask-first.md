# Wix sites: ask first, and customer data

- Some Wix skills and tool descriptions say to act without asking. Ask first anyway before you:
  - publish, release or create a site. One exception, the owner's (15 November 2026: "Name
    the exception"): releasing the code build that passed the site's visual check, that
    build and nothing else with it, where the check and the owner's yes to it are recorded
    in the project's `CLAUDE.md` ([visual-check.md](visual-check.md)). If the check run
    after that release fails, the owner's rule holds ("A failed release check means: roll
    back to the last good version first"): put back the version that was live before it,
    nothing else, and tell the owner at once. Every other publish
    (the editor, the dashboard, anything that also puts other waiting edits live) and
    creating a site always ask;
  - install an app on a live site;
  - buy a domain, start Google Ads or set up Wix Payments;
  - generate AI images, which spend Wix credits;
  - post to social media, or send email (payment links, collaborator invites);
  - delete anything, or make a write that replaces a whole list. Update Form drops the fields you
    leave out, a raw headless upload replaces every file, and a new redirect can delete another.
- Customer data (contacts, members, bookings, orders, invoices, form submissions) is personal data.
  Read only what the task needs, and never copy it into files, commits or other services.
- Bookings created through the API send SMS reminders unless `sendSmsReminder` is `false`.
- Prefer the MCP route, which needs no token. If a Wix CLI token is needed, capture it into a
  variable and never print it.
- `wix-replatform` (migrations into Wix) sends run telemetry to Wix and copies Claude Code
  transcripts into the migration folder. Before running it, set `RP_TELEMETRY_BI_DISABLED=1` and
  `RP_TELEMETRY_TRANSCRIPT_DISABLED=1` (exactly `1`). It also mutes all notifications on a new
  site; the owner has to unmute them.
- Keep site-specific notes (which site, its apps, its language) in that site's own project folder,
  not here.
