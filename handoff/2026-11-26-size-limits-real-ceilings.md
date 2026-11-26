# 26 November 2026: the size limits check.mjs prints are the ones the suite holds

**Why.** The weekly fixer's run (one repeated workaround becomes a fix). The repeat: an edit to
`SKILL.md` or `recipes/boat.md` passed `node scripts/check.mjs` and then failed `npm test` on boat
or in CI, and the agent cut words in a second and third commit. Recorded on 16 November (#75,
`boat.md`), 20 November (#209, #213 and the CodeQL entry's two pushes, `SKILL.md`; the boat-run
entry, `boat.md`) and kept alive by two memory notes ("the real ceiling is 13,956", "boat.md
needs 51 bytes of room"). `check.mjs --room` (22 November) printed room that was not there:
"SKILL.md: 51 left" when 7 were.

**What changed.** `scripts/check.test.mjs` only. Five assertions add a line to the real
`SKILL.md` or the real `recipes/boat.md` and expect no error at all, so each needed spare room in
the real file: 44 bytes in `SKILL.md` (a map row), 51 in `boat.md` (a link line). They are not
about size. They now read the file filled to its limit (`fullSkill`, `fullPage`) and leave size
errors out (`besidesSize`), so they pass whatever room the real file has. The size test gained
three assertions that pin the stated limits as the real ceilings: both files filled to the limit
pass, one byte more fails with the exact message. `check.mjs`, `SKILL_LIMIT` (14,000) and
`PAGE_READ_LIMIT` (4,000) are unchanged: the limits are the ones the owner set, and the number
`check.mjs --room` prints is now the number the suite holds.

**Verification.** Red then green on the one test file: with the filled files and no size filter
3 of 43 tests fail, each on the size message alone (`SKILL.md is 14036 bytes, over 14000`,
`SKILL.md is 14035 bytes, over 14000`, `recipes/boat.md: 4051 bytes as a Read result, over 4000`);
with the filter 43 of 43 pass. The full suite on boat for the head before the push.

**Outstanding.** The limits themselves stay tight: 35 pages are within 150 bytes of 4,000 and
three have 3 bytes or fewer. Whether `PAGE_READ_LIMIT` follows context-mode's cut from 4,096 to
8,192 bytes is the owner's call (asked in the fixer's chat on 26 November 2026). The next two
candidates of the fixer: `merge-when-green.sh` checks by itself that its installed copy is
current (today a by-hand step before each merge; the release-maintenance repository), and the
Stagehand setup page names two files that are not on the Linux laptop. Owner: Claude, the next
weekly run.

**Dead ends.** Reserving the tests' bytes inside `check.mjs` (a limit of 13,956 in the script):
it would have made the script agree with the suite by writing an accident into the rule. Giving
the five tests a made-up small `SKILL.md`: they would no longer prove that the real map accepts
a new row.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-26-size-limits/` (`red.txt`,
`green.txt`, the test file before and after). The merge run writes `release-merge.log` there.
