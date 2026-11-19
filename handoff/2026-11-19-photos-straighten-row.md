# 19 November 2026: straightening back on the map (follow-up to #148)

**Why.** The last AI review round of #148 (head `ecac683`) left one low finding: the new map
rows and the skill description no longer named straightening, so a straighten job matched no
row and the crop check in `recipes/photos.md` could go unread. Review budget: after the third
round, lows go to a follow-up pull request.

**What changed.** The "none: say so" row reads "Sharpen, cut out or straighten a photo"; the
skill description names photo masks, sharpening, cut-outs and straightening. To stay within
the 14,000-byte limit of `SKILL.md`, the masks row says "**LightCraft**, own photos" (SAM 3 is
on the recipe page) and the description no longer names LightCraft.

**Verification.** `node scripts/check.mjs` passes; `npm test` on boat: 708 tests, 701 pass, 0 fail, 7 skipped.

**Outstanding.** None.

**Dead ends.** None.

**Evidence.** The review comment on #148 for `ecac683`; #148's release check: execution 1860,
`~/.local/share/claude-cookbook/evidence/2026-11-19-release-cookbook-148/merge.log`.
