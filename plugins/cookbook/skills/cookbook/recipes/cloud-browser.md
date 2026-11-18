# Cloud browser (Browserbase)

The route to Browserbase is its official `browse` CLI: one short command, one short JSON answer, no plugin
and no MCP server, so it adds nothing to a session.

- **Use it** when a public page has to be operated, not just read (click, fill, wait for a
  state, read a value, take a screenshot), from a script or for one step. Several steps
  go to Stagehand in a child session ([stagehand.md](stagehand.md)), with `browse` as its
  fallback. Reading a page stays on Firecrawl and Parallel. A site that needs a sign-in goes to agent-browser ([sign-ins.md](sign-ins.md)), never to a cloud session.
- **A session:** `browse open <url> --remote --session <name>`, then `browse snapshot` (the page as
  an accessibility tree with element refs), `browse click <ref>`, `browse fill <ref> "<text>"`,
  `browse get title` or `browse get text <ref>`, `browse screenshot`, and always
  `browse stop --session <name>` at the end. `browse skills show` prints the CLI's own guide for
  its version: read it on first use.
- **What it costs (Developer plan, USD 20 a month, since 12 November 2026):** 100 browser hours
  a month, billed by the minute with a one-minute minimum per session; 25 browsers at once; a
  session can run 6 hours; 25 new sessions a minute. Always `browse stop` a session, and reuse
  one named session for a task.
- **Never past the allowance without the owner's yes.** Past it the plan keeps going and bills
  overage with no cap: USD 0.12 a browser hour, USD 12 a GB of proxy traffic, USD 1 and USD 7 per
  1,000 fetch and search calls. Before any task that opens more than a few sessions, read
  `browse cloud projects usage <project id>` (`browse cloud projects list` prints the id). Stop
  at the allowance and say so; a batch that could use more than 10 browser hours needs the
  owner's yes before it starts, however much allowance is left.

More: [limits and what stays out](cloud-browser-rules.md), [setup and updates](cloud-browser-setup.md), [Browser automation in a session (Stagehand)](stagehand.md).
