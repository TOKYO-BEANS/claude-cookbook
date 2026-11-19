# 18 November 2026: the 89 Semgrep code findings, triaged

**Why.** The 89 findings Semgrep's code rules raised on the eight default branches (measured
17 November, #126; `semgrep/head-findings-distinct.json`) were each to be fixed through a pull request
in their own repository or put to the owner as a dismissal question. CI runs Supply Chain only, so
nothing else tracks them. Owner: Claude; every dismissal is the owner's.

**Where they stand.** 65 are in code the repositories own, 24 in files the Stack Atlas standard writes.

| | Findings | Outcome |
| --- | --- | --- |
| Fixed and merged | 41 | first site 7 (2 by deleting an unused storefront component), the shop 8, this repository 17, release-maintenance 8, sign-in-tools 1 |
| Dismissed by the owner, reason at the line | 17 | first site 5, the business app 8, this repository 4: a reason line, then `// nosemgrep: <rule>` |
| In an open pull request | 7 | Stack Atlas's own code, Stack-Atlas #227 (standard v24) |
| Source fixed in #227, rollout pending | 24 | `.depot/ai-review/review.mjs` (16) and `.github/dependabot.yml` (8) in the eight repositories |

The business app's Python start was first dismissed, then fixed on the owner's word once a review
showed the bare name resolves from the working folder; its remaining rule hit was dismissed after.

**What changed.** Pull requests, each merged with a fallback review (the AI review had no API
credit) and a verified release check: first site #25, #26; the shop #46, #49; the business app
#169, #170, #171; this repository #134; release-maintenance #32, #33 (installed into `~/.codex`);
sign-in-tools #15. Beyond the 89: three more findings here (#134); the business app starts Python,
PowerShell, taskkill, rundll32 and curl only by checked absolute paths (#169 to #171);
release-maintenance's runners start only their listed programs, and the CodeQL alert that change
opened was fixed before the merge (#32, #33). The shop's `media.js` was pushed to the live theme on
the owner's yes after its merge. The first site and the business app needed no deploy: the built
site and the code the hosted app runs are unchanged.

**Verification.** A local Semgrep rescan of each changed file reports nothing (before and after
saved per repository). Each merge's release check read `verified` and was acknowledged. The
release-maintenance installs of `ab72bb5` and `418c945` ran their live tests and read current with
no drift. The shop's live `media.js` reads back equal to `main` (it was the stock copy before).
The first site's three builds differ only in Astro's per-build random key.

**Owner's answers, 18 November.** The shop's reference-theme copy fixed, not dismissed; the theme
push; the 17 dismissals; the Python start fixed instead; review rounds past three on four pull
requests; one Graphify neutral ("0/4 ... (3 vacuous, 1 unsupported)") merged once.

**Outstanding.**
- Stack-Atlas #227 merges after #224 (another chat, the same reviewer template and digest), then the
  v24 upgrade in each of the eight repositories clears the 24. Owner: Claude, a new chat.
- The business app: three launcher scripts build the PowerShell path from an unchecked
  `SystemRoot`/`WINDIR`, twelve `.cmd` launchers start programs by bare name, and setup accepts a
  per-user or a directly-under-`C:\` Git (recorded in #170 and #171). Owner: Claude, a new chat.
- The first site: its `CLAUDE.md` names `chromium-1254` for the visual check (now `-1255`), and its
  `.env.local` holds two secrets in plain text, against the key rule. Owner: Claude, a new chat.

**Failures and dead ends.**
- A `nosemgrep` on the line above a finding counts only when the comment starts with it: a reason
  first on that line suppressed nothing. Reason on its own line, then `// nosemgrep: <rule>`.
- Semgrep on this PC hit temp-file "Permission denied" and rule timeouts; files were rescanned one
  at a time, and one finding showed only with `--timeout 60`.
- `main` moved twice under a ready pull request (another chat on the shop) and took its decision
  number; the branch merged `main` and renumbered.
- A T3 restart cancelled every background agent once; each was resumed from its worktree.

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-18-semgrep-89/` (per repository:
Semgrep before and after, tests, review rounds; `release-*.log` and `result-*.json` per merge); the
theme push and the first site's build comparison are in those projects' own evidence folders.
