# 19 November 2026: the sign-in and Google pages say how the two tools run on Linux

**Why.** `agent-browser` and `google` run on the Ubuntu laptop since sign-in-tools #18, #19
and #20 (19 November 2026). The pages still described the PC: a token "only this Windows user
can read", the agent `claude-pc`, a `google` tool "not in a repository yet", test counts of
the installed folders, and evidence lines from 13 and 14 November with no word on Linux.
#157 took the `pass-cli` bullet of `sign-ins-setup.md` and the key names in `google-setup.md`
and left the rest of both pages to this change.

**What changed.**
- `sign-ins-setup.md`: the daemon's port and token are in
  `~/.local/state/site-login/agent-browser.json` (`0600`, its folder and the profile `0700`);
  `install.mjs install` also writes the two commands in `~/.local/bin` and `check` compares
  them; the Chromium yes of 19 November 2026 covered revision 1255 for linux64 only; what was
  vetted and proven on the laptop, and what was not tried on Linux.
- `google-setup.md`: "On the laptop"; the code's source is `TOKYO-BEANS/sign-in-tools`; keys
  are saved and removed with `secret-tool`; `google adopt` beside the advice to run `google
  login` again; the Linux build of gws; what was proven on the laptop.
- `google.md`: a "new machine" bullet for `google adopt <account>`.
- `sign-ins.md`: the agent is `claude-linux`.
- `sign-ins-mail-and-access.md`: `access` and `mail-link` are not tried on Linux.
- No test count is named any more: `npm test` runs in the repository, and the number moves
  with every pull request there.

**What the page limit took.** A page's limit is its bytes plus 9 for each line, and
`sign-ins-setup.md` was 2 under it after #157. To make room, three things left the page: the
list of the code's files, the Proton AG signature of the PC's `pass-cli` copy, and the sandbox
details of the `playwright-core` 1.65.1 vetting. All three are in the sign-in-tools
repository (`README.md`, `HANDOFF.md`).

**Verification.** `npm test` on boat (local runs of this repository go there), on top of `main`
with #157 in it: 702 tests, 695 pass, 7 skipped, 0 fail. Each statement was read against the
sign-in-tools repository at `39c32cb` (`HANDOFF.md`, `README.md`, `google-auth/google.mjs`),
the two `PROVENANCE.txt` files of the pinned copies and that repository's evidence of 19
November.

**Outstanding.**
- Not tried on Linux: `agent-browser login` on a real site, `mail-link`, `access`, `google
  login` and `logout`. Owner: Claude, at the first real use. Clears: one real call each, then
  the "Proven" lines of the two setup pages.
- No scanner result is recorded for the Linux `pass-cli` and `gws` binaries: their checksums
  (and gws's attestation) were checked at install. Owner: Claude.
- Gitleaks marked two lines in `playwright-core` 1.65.1 as `generic-api-key` when it was
  vetted (sign-in-tools, 19 November; `pinned-vet.sh` reports such marks and does not judge
  them). Read again here in the installed copy: `lib/coreBundle.js` line 41033 holds the sample
  nonce of RFC 6455 after `Sec-WebSocket-Key:`, and line 5 of
  `lib/vite/traceViewer/assets/xtermModule-Cv6bi7od.js` holds xterm theme property names
  (`selectionBackgroundTransparent` and the like). Only Claude had read them, and a model's
  reading clears no finding. **Cleared:** the owner's yes of 19 November 2026 to the question
  "Do you accept the two marks?": "Accept both". It covers these two lines of 1.65.1; a mark
  in a later version is a new finding.
- The "On this PC" label of the `pass-cli` bullet in `sign-ins-setup.md`, and "on the owner's
  PC" in the catalog's `agent-browser` entry, are left: the first is #157's line, the second
  goes with the catalog's Linux pass.

**The review.** Three low findings on the first head, all fixed in the second commit: the
Gitleaks marks were listed under "Vetted" with no triage (now the item above), the "2
packages" read as `playwright-core` alone (they are the lockfile's two), and "On the PC" for
the unsigned gws binary left the Linux build unsaid.

**After the merge.** #161 merged as `3ebf377` (`merge-when-green.sh claude-cookbook 161
claude-cookbook 4 <head>`), every check passed and the review allowed it. The first run had
ended "NOT MERGED: a check did not pass" while Graphify's review check was still running.
The release check first read `unknown` (execution 1851): #160 merged a minute later and the
collector read that commit, whose CI was still running. `after-merge.sh` for `3ebf377`
itself read **verified** (execution 1852).

**The second review, and the follow-up.** One low finding on the merged head: the "Vetted
on 19 November" line of `sign-ins-setup.md` carried the scanners' attempt on the PC's
`pass-cli` copy (12 and 13 November) and did not say that no signature check and no scan is
recorded for the Linux one. The follow-up pull request says so and adds this section.

**Dead ends.** None.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-19-sign-in-pages-linux/`:
`npm-test.txt`, `npm-test-second-commit.txt`, `merge-when-green-161.txt`,
`merge-when-green-161-second.txt`, `after-merge-161.txt`.
