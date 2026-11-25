# 25 November 2026: a mail request leads to Bridge, and a draft lands in Proton's Drafts

**Why.** In a scratch chat the owner asked for a draft to a shop and pasted a `mail.proton.me` link to an order
mail. Claude treated it as a writing task, did not load the Cookbook, said it could not open the link and gave the
draft as chat text with placeholders. Only after the owner asked "don't see any drafts?" did it find
`proton-mail.py`, which had no draft command, so it wrote a one-off script to save the draft.

**What changed.**
- `scripts/proton-mail.py`: a `draft` command with the options of `send`. It finds the folder Bridge marks
  `\Drafts` (RFC 6154), APPENDs the mail there with `\Draft \Seen` and prints the new UID. Saving a draft sends
  nothing, so it needs no ask; sending to others still does. Tests: the `\Drafts` lookup and a dry run with no
  Bridge.
- `recipes/proton-mail.md`: the command, and a line saying any mail request is this job ("write a draft", "read this
  mail", a `mail.proton.me` link); a link cannot be fetched, so the mail is found with `search --folder "All Mail"`.
  The update and DNS bullets moved to the new `recipes/proton-mail-setup.md` to keep the page under 4,000 bytes
  (`cloudflare.md` and the catalog point there now).
- `SKILL.md`: the description names mail (drafts, `mail.proton.me` links), so the skill matches a mail request.
  "and use them the way that works" left the description and "the list of tools in the stack" became "the stack's
  tool list" to make room. A map row naming drafts and links did not
  fit: `check.test.mjs` adds 44 bytes to `SKILL.md` in one test, so `--room`'s "47 left" was really 3.

**Verification.** A real draft to `claude@nofix.dev` through the branch's script: `draft saved in Drafts as UID 4`,
`list --folder Drafts` showed it beside the owner's own draft, then the test draft alone was deleted (subject
checked, `UID EXPUNGE 4`) and the list showed only the owner's draft. `node --test scripts/proton-mail.test.mjs`:
9 pass. `node scripts/check.mjs --room`: passed. The suite on boat for the head. After the merge the script is
copied to `~/.local/bin` and proved with `list --folder Drafts`.

**Outstanding.** `SKILL.md` has 7 bytes of real room (`--room` shows 51): the next line there needs a cut first.

**Dead ends.** A line in the global `CLAUDE.md` was weighed: always in context, but the skill description is where
the choice to start the Cookbook is made, and the map row then names the recipe; one place is enough.

**Evidence.** This entry and the pull request. The release check writes
`~/.local/share/release-maintenance/evidence/2026-11-25-cookbook-proton-mail-drafts/release-check.log`.
