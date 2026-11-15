# Visual check of a live site

The owner's rule, quoted (global rules, "How we work", 15 November 2026). Stop and ask for:
"A change customers see on a live site (Wix, Shopify or any other host), unless that change has
passed the site's visual check: screenshots at desktop and phone size, judged against the
intended design by an agent that did not build the change. Until a site's check is recorded in
that project's `CLAUDE.md` and the owner has said yes to it once, always ask."

- **Each site has its own check:** a script in the site's repository. This page lifts no stop,
  and neither does a check that exists: the project's `CLAUDE.md` is the record.
- **Does a pass lift the stop here?** Only when that `CLAUDE.md` holds both the check (what it
  is, how to run it, what a pass does not cover) and the owner's yes to it, in the owner's
  words with the date. If either is missing: ask before every customer-visible change.
- **For a change:** write the intent first (what the change is meant to do, and that nothing
  else changes). Run the full check: the live site before, the change after. A pass is the
  script's own pass (exit 0). A failed, partial or stopped run, or one with no verdict, is not
  a pass: fix the change and run again, or ask. Release exactly the build that was judged,
  with nothing added after the run and nothing else going live with it. Then tell the owner
  what went live, with the evidence folder.
- **After the release** run it the other way round: what was judged before, the live site
  after. A difference is a failed release check, and the owner's rule for one holds (global
  rules, and [ci-releases.md](ci-releases.md)): "A failed release check means: roll back to
  the last good version first, then fix through a new pull request." Roll back to the
  version that was live before this release, to nothing else, and tell the owner at once
  with the evidence.
- **What a pass does not cover**, so these still ask: what the check cannot see (a page not on
  its route list, hover, focus and motion, what needs a real phone); anything outside the
  pages it photographs (prices, products, booking rules, a host's dashboard); a person's
  approval of texts and designs; whatever the project's `CLAUDE.md` lists as still asking;
  and every other stop in the ground rules.
- **The check is the gate.** A change to its thresholds, its route list, what its capture
  hides or skips, the judge's instructions or its pass rule needs the owner's yes, like any
  change that weakens a check. A false alarm is investigated, never waved through.
- **A site with no check:** build one ([how](visual-check-build.md)), prove it with one pass
  and one fail, record it in the project's `CLAUDE.md`, then ask the owner once: "May a pass
  of this check lift the stop for this site?" Until the yes is recorded, always ask.
- **The first one:** wecarestudio.dk, `scripts/check-visual.mjs` in `TOKYO-BEANS/WeCare-Wix`
  (15 November 2026). Copy its shape, not its settings. Whether its pass lifts that site's
  stop is in that project's `CLAUDE.md`, not here.
