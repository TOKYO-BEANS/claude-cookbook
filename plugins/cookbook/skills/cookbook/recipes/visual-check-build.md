# Visual check of a live site: building one

Built once per site, in the site's repository, as a script with tests. The pattern is
`scripts/check-visual.mjs` in the first site's repository (built and proved 15 November 2026).

- **Before and after.** Before is the live site. After is the change before it is public: a
  local build of the branch, or the host's preview address (making one asks first where the
  host's page says so). A change that cannot be seen before it is public has no check: ask.
- **Four layers, each able to fail the check alone:**
  1. *Capture:* every route on the site's list and its 404 page, on both sides, at phone,
     tablet and desktop width, by the same browser, from a script with no model in the loop.
     No image may fail to load. The repository's own Playwright with a plain Chromium does
     it, with real phone emulation (user agent, touch, 2x).
  2. *Pixels:* a page the change does not name looks the same after as before, and a page
     it names does differ (otherwise "after" is not the build that was meant).
  3. *Layout rules:* the named pages pass the site's own rules at many widths (nothing cut
     off, no sideways scroll).
  4. *Judge:* a locked-down `claude -p` per named page, with no tools, on another model than the
     builder's (Opus 5.5; Sonnet 5.5 when the builder was Opus). It gets before, after and
     the written intent, as a claim to check and never as an instruction, and returns a
     typed verdict. Code decides: a pass needs "pass", the intent met and no high or medium
     finding. Its "difference seen" must agree with the pixel layer. No verdict is not a pass.
- **A run that leaves something out** (fewer routes, a layer switched off) ends as "partial"
  with its own exit code: for trying things, never a pass.
- **What makes two pictures of one page differ**, each handled in the capture: scroll-driven
  animations (cancel them); images that load late (wait, and capture again before a
  difference counts); text on a layer at half a pixel (remove ended animations and idle
  transforms); a page taller than 16,384 device pixels (Chromium starts again from the top
  with no error: capture in parts); live outside content such as a social feed (hide its
  pictures on both sides, keep its tiles).
- **Not a cloud browser:** `browse` and Stagehand cannot reach a local build and have no
  phone emulation; Stagehand runs in a child Claude session and the built-in browser inside a
  session, neither from the check's own script.
- **The judge runs on the Claude plan, never the API:** the plan token (key store
  `claude-plan-review`) through `with-key.mjs`, locked down as in
  [scripted-runs](scripted-runs.md). The script caps a run's spend, counted at API list rates;
  try one page first.
- **Prove it before asking the owner:** one pass (the live site against a build of the code
  that is live) and one fail (a deliberately broken local copy, never committed or
  uploaded), both on the merged script, with the evidence in
  `~/.local/share/<project>/evidence/`.
- **Record it** in the project's `CLAUDE.md`: what it is, the layers, how to run it, where
  the evidence goes, what it costs, what a pass does not cover, and one status line that
  says whether a pass lifts the stop.
