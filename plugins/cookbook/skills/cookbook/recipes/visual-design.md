# Visual design (Claude Design)

- The default for anything visual: new pages, screens, dashboards, layouts, component looks and
  redesigns. Start on a Design canvas before writing UI code whenever the look needs a decision.
- Call the Artifact tool with `action: "quickstart"` and `intent: "design"`, then publish from the
  Design type it returns. Use the project's design system when one exists, otherwise the default.
- Put 2–3 options side by side. Start them from a look a person already likes: a site of the
  owner's, a reference site someone named. A look only Claude has seen is a guess.
- A new look (a new site, a redesign, a product's first screen) is picked by the owner, from
  pictures: every option as a full page at 1440 and 390 px, sent as images in the chat. Build
  nothing more until one is picked, then carry over the parts of the others the owner names.
  Pick alone only inside a look that already exists. The canvas is the decision record; the
  repository holds the real implementation (themes, components, tests).
- Every design follows the [build principles](build-principles.md): the mood decided first,
  the right way on the default path, and two or three working versions of an important screen
  used before one is kept.
- Build the chosen option with no design skill on top: Google's `gemini-frontend-design` and
  Anthropic's `frontend-design` were both tried and neither is used
  ([weighed](../options/design-skills-compared.md)).
- After the build, capture the whole page at 1440 and 390 px and check the phone for sideways
  scroll. Captures nobody looked at check nothing: a reader that did not build the page
  compares them with the picked option before the job is called done, and the owner gets the
  pictures with the report.
- Not for backend or non-visual work, or a small fix inside an existing, clear design.
- Canvases stay private until the user shares them. Send only what the mockup needs: no secrets,
  customer data or private repository content.
- Syncing a local component library to a claude.ai design system is a separate flow (`/design-sync`)
  that the user starts.
- Standalone Claude Design (claude.ai/design) closes on 14 December 2026; design systems are artifacts
  in Claude now. Start nothing there (2 November 2026: nothing of ours to move).
