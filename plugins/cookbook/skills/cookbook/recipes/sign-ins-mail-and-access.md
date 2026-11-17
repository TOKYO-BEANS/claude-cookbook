# Sign-ins: mailed links and Cloudflare Access

- **Claude's own accounts:** an account only Claude uses signs up as `<service>@in.nofix.dev`
  (owner, 17 November 2026): one address per service, made with `address <service>` below, and
  the login in the vault "Claude" as [sign-ins](sign-ins.md) says. The inbox drops mail after
  15 minutes, so the address serves sign-in links and codes, never mail that must be kept.
  `mail-link` opens a link; no command reads a mailed code yet, so it is built for the first
  site that needs one. No forward: a service whose mail must be kept (bills, security notices,
  closing warnings) is not one only Claude uses, so it goes to the owner.
- **A site that mails a sign-in link:** `agent-browser mail-link <name>@in.nofix.dev --host <site>`
  waits for the mail (`--timeout`, 120 seconds unless said otherwise), opens the sign-in link in
  the browser, deletes the mail and answers with `ok`, the sender and the page it landed on. The
  link is never printed, and page addresses are printed with long query values cut. It only opens
  an `https` link on `<site>` or a subdomain of it; when two links look equally likely it stops
  and asks for `--match <pattern>`. The inbox is the Cloudflare Worker `login-inbox` on the
  owner's domain `nofix.dev`: it keeps mail for 15 minutes, has no web address and is read only
  through the Cloudflare API. An address exists only after `node ~/.local/bin/with-key.mjs
  cloudflare-wrangler CLOUDFLARE_API_TOKEN node ~/.local/share/site-login/inbox/deploy.mjs address
  <name>` (`addresses` lists them, `remove <name>` deletes one); use one address per site. The
  mail gets there either because the account's own address is that inbox address, or through a
  forwarding rule in the owner's mailbox limited to that site's sender. For any account but
  Claude's own, either is the owner's decision: whoever receives a site's mail can reset its
  password.
- **A site behind Cloudflare Access:** `agent-browser access <site>` signs in with an Access
  service token instead of a one-time mail code. A short child process reads the token's client ID
  and secret from the key store and sends them in one request to the site's exact login address;
  they never enter the browser, and only the session cookie the site answers with does. Sites are
  listed in `site-login/access.json` (login address, the two key names, the cookie name). What the
  session may do is the site's decision. Today that file has one site, the owner's own product
  in production (`<site>` is its key there): a reader for one hour that sees what the shared
  view link shows and is never the owner; `/admin` needs a personal account. Print status, address and title only from its pages: they hold staff and
  business data. A new site needs the owner's yes: a service token and its Access policy are an
  access change. Proven on 14 November 2026.
