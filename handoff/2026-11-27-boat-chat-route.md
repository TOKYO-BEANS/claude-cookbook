# 27 November 2026: whole Claude chats on boat, a standing route

**The owner's answer.** In the chat that ran the trial (#286, question dialog, 27 November
2026): keep boat past 16 December ("option 2"), with this note, verbatim: "not all threads
have to start there, some makes more sense than others and sometimes it also makes sense if we
are limited on compute and even before we get limited on compute so the pc actually never has
to throttle again and we can create and make better and faster work and I can still use the
laptop while all that happens." Done that day in that chat: the plan's renewal restored
(`POST https://boat.dev/api/boat/billing/resume-plan`; renews 16 December, USD 20), the 26
November wallet refund request withdrawn, the proxy off. This settles the #286 entry's
"Outstanding" decision and its refund line.

**What changed.**
- `recipes/sandboxes-boat-chat.md`: a standing route, no longer a trial. Which chats start on
  boat (long, self-contained, our own repositories, nothing of this laptop) and which stay;
  the load limits; the script; the traps it handles; how a chat's work comes back.
- `plugins/cookbook/hooks/laptop-load-lib.mjs`: the laptop's load from `/proc` (memory
  available under 25%; swap 90% used with available under 35%; memory pressure 5%; CPU
  pressure 30%; load one per CPU). The `owner-answers` launch hook reads it before a chat
  starts here (no `environmentId`) and, when near, stops the launch once in ten minutes with
  the reasons, so a fitting chat goes to boat before the laptop throttles.
- `scripts/boat-chat.mjs` (`where`, `status`, `up`, `pull`, `down`): one command up (proxy
  on, sandbox resumed or new, T3 at this laptop's version under the 24-hour rule, the
  repository pushed as a git copy with a base commit, `t3 serve` on loopback and restarted
  after a resume, the forward, the link) and one down (forward and its `ssh` ended, sandbox
  stopped, proxy off when none runs). `pull` returns the chat's changes as one patch,
  Gitleaks first; the sandbox has no GitHub login, so the pull request is opened here.
- `catalog.json`: boat `active`, purpose rewritten, date "boat plan renews (USD 20 a month)"
  on 16 December. SKILL.md: the "Where a session runs" row links the page (a few words cut
  elsewhere to fit 14,000 bytes). `recipes/sandboxes.md`, `sandboxes-claude.md`,
  `parallel-chats.md`, `options/sandboxes.md`, `hooks.json`'s description follow.
- Tests: `scripts/boat-chat.test.mjs` (17), two new tests in `scripts/owner-answers.test.mjs`.

**Verification (27 November 2026, this laptop and boat).** `up` on the stopped trial sandbox:
23 s, then a turn in the trial thread answered on Opus 5.5 (no 401 after the resume). `up`
with no sandbox: 28.6 s (new `small`, T3 0.1.13-nightly.20261125.5258 installed with
`--before`), a new project and thread there answered (check passed, 2.5 GB available). `down
--delete` removed that sandbox and its link; `up` on the trial sandbox linked it again under
its old `environmentId` (11 s). `pull`: a 748-byte patch of a commit plus an edit, Gitleaks
clean, `--check` applies, `--apply` refused a folder with changes, `up --push` refused over
an unpulled copy. `down`: 1 s, proxy off. Turning the proxy on three times that day charged
one day (USD 1.03 that day in all). The full suite: see the pull request.

**The AI review (head b1bd085): two medium findings and one low, all fixed.** `down --delete`
could delete a chat's unpulled work: it now refuses while any copy holds unpulled changes, or
while the sandbox is stopped, unless `--discard`. The upload was the working folder, not
scanned: it is now made as `sandbox-run.mjs` makes one (upload list, tracked files with their
edits, data-shaped files, Gitleaks). After a pull, `--push` stayed refused: a clean scan now
marks the pull (`refs/boat/pulled`), and each pull returns only what changed since the last.
Proven live the same evening: a commit, then an edit, came back as two patches (the second
held only the edit); `down --delete` refused over the old trial copy; an untracked file on the
laptop did not reach the sandbox.

**The second review (head 5488033): one medium, one low, both fixed.** A failed `boat info`
counted as a gone sandbox, so `up` could make a new one and drop the old one (with unpulled
work) from the record: now a sandbox is gone only when boat's full list says so, and a failed
read stops the command. `pull --apply` marked the pull before applying: with `--apply` the
mark now follows a successful apply.

**Dead ends.** A first `up` took boat's `idle` state for a gone sandbox and made a second
one (`bx_cmsekx43`, deleted the same minute); `idle` now counts as running. `boat push`
copies files without `.git`, so a chat could not commit until `up` made a base commit.

**Outstanding.**
- Chats the owner starts by hand in T3 start on this laptop; the hook only sees launches by a
  chat. Such a chat hands its job to a boat chat when it fits and the laptop is near (the
  page says how). No owner step.
- The renewal date in the catalog is the next one only; the update check warns before it and
  is silent after. Roll it forward when touching the boat entry.
- Left as they were: the trial sandbox `bx_22h8jbu4` (stopped; now the recorded sandbox in
  `~/.local/share/boat-chat/state.json`, data to about 11 December unless resumed) and its link
  `a6224335-…`. GPU rental for creative work was weighed apart (#287).

**Evidence.** `~/.local/share/claude-cookbook/evidence/2026-11-27-boat-chat-route/`. Release
log: this pull request's `sa-release` run.
