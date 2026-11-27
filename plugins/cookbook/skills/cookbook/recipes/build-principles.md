# Build principles

How we build anything people use: sites, apps, forms, screens, and the parts of our own tools
a person touches (a command's defaults, a report, a status form). Every build and every design
follows them; the [UI checklist](ui-checklist.md) then measures the finished page. Owner's yes,
27 November 2026, from a public design interview's lessons (evidence
`~/.local/share/claude-cookbook/evidence/2026-11-27-video-lessons/`, lessons 1, 3 to 6, 12, 13 and
18 to 20).

Each principle has a **Check**: what a builder confirms before calling the job done, and what a
reviewer reads in the change or the running product. A miss is a finding like any review
finding. Where a principle meets an owner rule, the owner's rule stands, and the principle says
so.

## The principles

1. **The right way is the default; the rarely right option is one step deeper.** The default
   path (a form's first view, a menu's top level, a command with no flags) holds what most
   people should use. An option that is right only now and then stays available behind one
   more step (a "More" menu, an advanced section, a flag), not removed and not beside the
   default with the same weight.
   *Check:* for each option on the default path, the product wants most people to use it; a
   rarely right one there, or a requested one removed instead of tucked away, is a finding.
2. **A form asks only what the system cannot derive.** Status updates, handoffs, reports,
   sign-ups: every field is something only the person knows. What the system already holds
   (dates, names, links, counts, check results, what changed) is filled in or shown, never
   asked. Free text goes in a small box sized for the answer wanted (a note, not an essay),
   with no template to fill, and health is one signal (on track, at risk, off track), never
   several scores.
   *Check:* list the fields; one the system could fill is a finding, and so is a second
   rating. Box sizes are measured by the UI checklist's item 14.
3. **Decide the mood first.** Before the first screen of a product, decide what it is for and
   so its mood: **work** (calm and quiet: no sound, no rewards, motion only with a purpose) or
   **playful** (rewards, sound and livelier motion are welcome). Write it as one line,
   `Mood: work` or `Mood: playful`, in the product's `CLAUDE.md`. Claude decides it from what
   the product is for; when the owner's brief leaves that unclear, it is a question about the
   outcome and is asked.
   *Check:* the line exists, and the change fits it: sound, streaks, confetti or a reward
   screen in a work product is a finding.
4. **Delight is small, ends fast and never blocks.** A moment of fun (a surprise after a
   cleared list, a playful empty state) comes only after the work is done, ends by itself
   within a few seconds or with one action, never covers or delays a main action, and is
   still under `prefers-reduced-motion: reduce`. In a work product it stays rare.
   *Check:* the delight shows only after a finished task, a person can carry on working at
   once, and it never runs on a path someone uses to get work done.
5. **Lists become tasks in one action.** Wherever a product with tasks lets people write a
   list (notes, meeting notes, a checklist in a document), one action turns the chosen items
   into tasks: one task each, linked back to where it was written.
   *Check:* a list surface in a product with tasks and no such action is a finding. A product
   with no tasks is not held to it.
6. **Use what we build, and file every annoyance.** Claude uses our products and tools in its
   daily work where they fit, and every annoyance met there (a slow step, a confusing label, a
   wrong default, a missing tooltip), by Claude or told by the owner, is filed at once as an
   issue in that repository, one line on what and how to see it, even when nobody fixes it
   now. The [weekly quality fix](quality-fix.md) picks from those issues. In a public
   repository the issue names no project or client.
   *Check:* a handoff, review or chat that names an annoyance with no issue linked is a
   finding.
7. **A date never beats the quality bar.** The bar: every check passes, the review's high and
   medium findings are fixed or answered, the site's visual check and the UI checklist pass
   where they apply, and nothing a user would notice is shipped knowingly broken. A date
   Claude set itself (a target, a release slot) moves; the bar does not.
   *The owner's rule stands:* a deadline the owner sets is kept by cutting scope, never the
   merge condition or a check. When even the cut scope cannot meet the bar by that date, the
   owner is asked before it, with the question dialog ([owner questions](owner-questions.md)).
   *Check:* a pull request that ships a known user-visible flaw "to fix later" without an
   owner's deadline behind it is a finding.
8. **Build an important screen two or three ways, and use them before choosing.** An important
   screen is where people spend most of their time, a product's main or first screen, or a
   flow that is costly to change later. Build two or three working versions (real code and
   real data, on a preview or behind a flag), use each for the real task through its key
   interactions, note what using it showed, then keep one and delete the rest. Every other
   screen gets one version: size the method to the job ([building](building.md)).
   *The owner's rule stands:* a new look (a new site, a redesign, a product's first screen) is
   picked by the owner from full-page pictures ([visual design](visual-design.md)); the
   versions go to the owner as those pictures, with what using them showed. Inside a look
   that already exists, Claude chooses.
   *Check:* the pull request for an important screen names the versions tried, what using
   them showed, and why the kept one won.
9. **Speed is core architecture.** An app people use daily answers from local data first and
   syncs with the server in the background: a person's action shows at once, never after a
   network round trip. This is decided at the start of a build, in its design, and never
   added later as a fix. Which shared sync layer we use is still being chosen; this page
   links that outcome once it exists.
   *Check:* the design of a daily-use app says where its local copy lives and how it syncs;
   one whose main actions wait on the network is a finding. The UI checklist's items 12 and
   13 measure the result.

## Where they apply

- **Building and reviewing:** read this page before designing anything people use, and hold
  the change to each Check before it is called done ([building](building.md)).
- **The visual check:** the UI checklist measures the page; these principles cover the choices
  behind it (what is on the default path, what a form asks, the mood). When the checklist
  becomes part of the Stack Atlas standard, this page joins it.
- A product's own rules win where stricter. Nothing here lifts a stop: a change customers see
  on a live site still needs its visual check or the owner's yes.
