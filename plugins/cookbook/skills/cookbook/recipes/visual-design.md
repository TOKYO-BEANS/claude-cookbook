# Visual design (Claude Design)

- The default for anything visual: new pages, screens, dashboards, layouts, component looks and
  redesigns. Start on a Design canvas before writing UI code whenever the look needs a decision.
- Call the Artifact tool with `action: "quickstart"` and `intent: "design"`, then publish from the
  Design type it returns. Use the project's design system when one exists, otherwise the default.
- Put 2–3 options side by side, pick the strongest yourself and build it in code; show the
  others when the owner asks. The
  canvas is the decision record; the repository holds the real implementation (themes, components,
  tests).
- Build the chosen option with no design skill on top: Google's `gemini-frontend-design` and
  Anthropic's `frontend-design` both scored below no skill ([weighed](../options/design-skills-compared.md)).
  After the build, capture the whole page at 1440 and 390 px and check the phone for sideways scroll.
- Not for backend or non-visual work, or a small fix inside an existing, clear design.
- Canvases stay private until the user shares them. Send only what the mockup needs: no secrets,
  customer data or private repository content.
- Syncing a local component library to a claude.ai design system is a separate flow (`/design-sync`)
  that the user starts.
- Standalone Claude Design (claude.ai/design) closes on 14 December 2026; design systems are artifacts
  in Claude now. Start nothing there (2 November 2026: nothing of ours to move).
