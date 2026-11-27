# UI quality checklist

The details our sites and apps are held to, and a layer of each site's visual check
([visual-check](visual-check.md)). Owner's yes, 27 November 2026, from a public design
interview's lessons (evidence `~/.local/share/claude-cookbook/evidence/2026-11-27-video-lessons/`).

## How the check uses it

- **A fifth layer, "UI rules",** in the site's own check script, beside the layout rules: the
  same browser, on the pages a change names, before and after the change. It can fail the
  check alone. Once a site's check has the layer, a run that leaves it out is "partial",
  never a pass. A check built before the list keeps its recorded pass rule, with no more
  reach than before, until its layer is merged and proved; its `CLAUDE.md` says which.
- **Each item is checked by the script where it can be, else by the judge** (the check's
  `claude -p` on another model). The script measures and writes a table per item; the judge
  gets the tables as data with the pictures, never as instructions.
- **An item applies where its element exists:** a page with no menu passes the menu items.
  Hover items run at desktop width only; a phone has no hover.
- **New against old.** A violation the "after" side has and "before" had not fails the
  check, and so does one made worse. One the live site already has is listed in the report
  as a finding to fix, and does not fail a change that leaves it as it was.
- **The site's settings** (in its config, under the check's protected paths): the key
  interactions with their budgets, which of them local data answers, the palette's base
  tokens, and any timing that differs from the defaults here. Changing them changes the
  gate: the owner's yes, as for thresholds.
- This layer adds checks. It does not shorten the list of what a pass does not cover on
  [visual-check](visual-check.md): hover, focus and motion outside its probes still ask.

## The items

1. **Tooltips on every icon button.** *Script:* every button, link or `role=button` with no
   visible text has an accessible name and a tooltip drawn on the page (a native `title`
   alone does not count: it cannot be timed or seen). Where the action has a shortcut
   (`aria-keyshortcuts` or the site's list), the tooltip shows it.
2. **Tooltip timing.** *Script:* the first tooltip appears after a warm-up (default 500 to
   1,000 ms of hover); moving to a neighbour within 1 s of leaving shows its tooltip at once
   (default within 50 ms); after a pause the warm-up returns. *Judge:* from the table of
   measured delays per control, each delay fits how urgently its information is needed.
3. **Menus grow from their trigger.** *Script:* open each menu (`aria-haspopup` or
   `aria-expanded` trigger); while it animates, its `transform-origin` lies on the side that
   touches the trigger, at the trigger's end (opening down-right: top left; down-left: top
   right). Menus that open up are probed the same way.
4. **The submenu safe triangle.** *Script:* with a submenu open, move the pointer in ten steps
   along a straight diagonal from its parent item to the submenu's far item, across the
   sibling items; the submenu stays open at every step and the pointer lands in it.
5. **Pickers open focused.** *Script:* opening a picker (combobox, listbox, a menu with a
   search) puts focus inside it, on its search field or first option; arrow keys move.
6. **Filter by typing.** *Script:* typing a prefix of an option's label leaves only options
   that contain it, and Enter picks the highlighted one.
7. **Nothing moves under the cursor.** *Script:* ticking an option leaves every option where
   it was (within 1 px) until the picker closes; regrouping (picked ones on top) waits for the
   next opening.
8. **Controls show their state.** *Script:* toggling a control with a state (`aria-pressed`,
   `aria-expanded`, `aria-checked`, `aria-selected`, `role=switch`, `details`) changes both
   the attribute and the control's pixels.
9. **Controls teach their gestures.** *Script:* an element with a drag or resize cursor
   (`grab`, `col-resize`, `row-resize` and the like) has a tooltip or label. *Judge:* that
   text names the gesture ("Drag to resize, click to collapse") and any shortcut.
10. **Animation only with a purpose.** *Script:* the inventory of animations and transitions
    that run during load and the probes (`document.getAnimations()`: element, property,
    duration); an endless one outside a loading state fails; with `prefers-reduced-motion:
    reduce` nothing moves but fades. *Judge:* each animation new on the "after" side is
    named in the change's written intent with the question it answers (where did it go,
    what opened from where, what changed); one with no purpose is a finding.
11. **Palettes from a few tokens.** *Script:* the palette is derived in one place from the
    site's base tokens (the site names how many, a handful); every colour drawn on a page
    (text, background, border, fill, stroke; images aside) is one of the derived values. A
    colour set by hand anywhere else fails.
12. **A millisecond budget per key interaction.** *Script:* each key interaction on the
    site's list runs five times in the check's browser (the phone at 4x CPU slowdown); the
    time from input to the next paint (Event Timing) stays within its budget in four of
    five. Default 100 ms for an interaction local data can answer. The list splits each
    budget by step, so a miss names its step.
13. **No spinner where local data can answer.** *Script:* during an interaction marked
    local, no busy state shows (`aria-busy`, a `progressbar` with no value, an endless
    rotation, a skeleton) and the result paints before any network answer.
14. **Text fields sized for the answer wanted.** *Script:* a table of every field: label,
    placeholder, `maxlength`, and the size it shows (characters a line, lines). *Judge:* each
    size fits the answer its label asks for: a small box for a quick note, a large one where
    a long answer is wanted, never the other way round.

## Proving it

On the site's merged script, as for the check itself ([how](visual-check-build.md)): one
pass on a build of the live code, and one fail per script item on a deliberately broken local
copy (never committed or uploaded), with the evidence in the project's evidence folder. The
project's `CLAUDE.md` records the layer with the rest of the check.
