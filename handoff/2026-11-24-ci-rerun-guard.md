# 24 November 2026: a CI re-run reads the branch first

**Why.** The owner asked that three failures of one release become laws for every chat. One of them was a
`depot ci rerun` typed by hand for a commit of a default branch seconds after the branch had moved, while the new
head's CI run was in progress. The CI workflow cancels a branch's run in progress, so one of the two could have been
cancelled and another chat's merge check would have read cancelled. One incident, promoted on the owner's word.

**What changed.** The law itself is a script in `TOKYO-BEANS/release-maintenance` (its pull request #69):
`claude/rerun-ci.mjs <Repo> <sha>` re-runs a commit's Depot CI and refuses, with the next step, while another run of
the same branch is in progress. Here, the line where the agent reads before acting: `recipes/ci-releases.md` names the
script and says never a bare `depot ci rerun` (the page had 57 bytes left, so the line is short), and
`recipes/fast-merges.md`, under "Merges queue up", says when it is needed (a release check that prints
`stale checks only`) and what it refuses. The other two laws of that pull request need no recipe line: the release
check prints them itself (the stale-checks line with its next step; a collector lock that is waited for longer and
cleared when its process has ended).

**Verification.** `node scripts/check.mjs --room`: `ci-releases.md` 3997 of 4000, `fast-merges.md` 3980 of 4000,
"Cookbook check passed". The suite on boat for the head. The script the lines name is installed and was run for real
before this merged (release-maintenance `handoff/2026-11-24-release-safety-guards.md`).

**Outstanding.** `ci-releases.md` has 3 bytes left and `fast-merges.md` 20: the next rule for either page needs a
page of its own. Owner: Claude, at that change.

**Dead ends.** A shell-guard rule that denies a typed `depot ci rerun` was weighed and not built: the command's text
shows neither the branch nor the workflow, and a re-run of another workflow or of a pull request's run is
legitimate.

**Evidence.** The laws ledger entry of 24 November 2026 (`~/.local/share/agent-log/laws.md`). The release check
writes `~/.local/share/release-maintenance/evidence/2026-11-24-cookbook-ci-rerun-guard/release-check.log`.
