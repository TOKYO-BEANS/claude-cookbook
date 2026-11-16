# Handoff

## 16 November 2026 (night): Codex is the second provider, and a consult has its page (0.32.0)

**Why.** The owner said on 16 November 2026: "we use codex now, to be able to do the consult
thing". Two options pages still said that only the Claude provider is on.

**What "the consult thing" is here.** Nothing on this PC is named "consult": tstack
(`t3dotgg/tstack`, still at `11e37a7`) is not installed, and none of its nine skills carries
the name. Its two skills that ask another provider's model are `sol-loop` (one GPT Sol
reviewer in a loop) and `council` (three providers). The Cookbook now defines a consult as
one read-only question to Codex through T3 `delegate_task`, as advice.

**What changed.**
- `recipes/consult.md` (new): when to consult and when not, the call
  (`providerInstanceId: "codex"`, model `gpt-6-astra`; from a Codex session, Claude), the
  brief, the three-round limit, what a consult does not replace (the `ai-review` job, the
  merge condition, a security finding, a stop), and the model and cost limits. There is no
  fallback: without a second provider, say that no second opinion was had.
- The map: a new row "A second opinion from another provider's model (a consult)"; the
  fallback of "One bounded side piece" now names Codex.
- `catalog.json`: a new tool, Codex (active, recipe: the consult page); T3 Code's purpose
  names both providers.
- `options/check.md` and `options/ship.md`: the two "only the Claude provider is on"
  sentences are corrected. `options/plan-and-build.md` has the consult's bullet.
  `recipes/dispatch.md` and `recipes/debugging.md` point to the consult page.
- Plugin 0.32.0.

**`sol-loop` and `council`: still not in use.** `sol-loop` names GPT Sol and forbids another
model, and the ChatGPT sign-in refused `gpt-6.1-sol` ("model is not supported when using
Codex with a ChatGPT account"); running it would take an API key or another plan, which is
spending and the owner's decision. `council` needs three providers and two are on. Neither
checks the merge condition in code, and the review of a pull request keeps its owner.

**What was found.**
- T3 Code's `orchestrator_capabilities` (16 November 2026): Claude and Codex can run a child
  task; every other provider is switched off. Codex CLI 0.169.0, "Logged in using ChatGPT",
  `model = "gpt-6-astra"` in its configuration.
- Cost: Codex is included in a ChatGPT plan and draws on its allowance; credits are a
  pay-as-you-go add-on that someone has to buy (chatgpt.com/codex/pricing and OpenAI's help
  pages, read on 16 November 2026). Nothing in this job spent money.
- The Codex part in the catalog has no update feed: the app updates itself, and its GitHub
  releases are tagged `rust-v<version>`, which `feeds.mjs` does not parse.

**Verification.**
- One real consult on this change, by the new page's rules: `delegate_task` to Codex
  (`gpt-6-astra`), read-only, completed. Verdict CHANGES with two findings, both agreed and
  fixed before the first commit: the page told an agent to try another model and to fall
  back to a subagent, which T3 Code's own rules forbid (now: stop and report, no fallback);
  and it sent every consult to Codex, also from a session that runs on Codex (now: the other
  provider). Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-16-codex-consult/`.
- `npm test` passed.
- AI review of the first commit (comment 6914545236 on #63): one medium and one low finding,
  both fixed in the second commit. Medium: "read-only" was a sentence in the brief and
  nothing in the call enforces it. The page now says so: read-only is asked for, not
  enforced; the checkout and the branch are compared before and after; committed work can go
  to the child in its own checkout (`isolation: "worktree"`). The map, the catalog and the
  options pages no longer call the route read-only as if it were a property. Low: the
  `ignored` note on `codex-chat-import` contradicted the new Codex tool. After the first
  consult the commit that followed held only this change's ten files.

**Outstanding.**
- `recipes/consult.md` is at its size limit (3,974 of 4,000 bytes as a Read result): a further
  rule goes on a `consult-<part>.md` page.
- A consult from a Codex session to Claude has not been run. Owner: Claude. Clears with the
  first real call from a Codex session; until then the page marks it as not proven.
- Stack-Atlas's `HANDOFF.md` (15 November 2026) still lists `sol-loop` as open until "the
  Codex provider is switched on". The provider is on and `sol-loop` still cannot run (GPT Sol
  is refused on the ChatGPT sign-in). Owner: Claude. Clears with a line in that repository's
  next pull request.

## 16 November 2026 (evening): Macroscope weighed and not added (0.31.5)

**Why.** The owner asked whether the hosted reviewer Macroscope should be part of the
standard, after installing its GitHub app on the organisation the same morning.

**What changed.**
- `options/check.md` names Macroscope among the hosted reviewers weighed for "review of
  every pull request", with the reasons. The owner of that job is unchanged: the
  `ai-review` job, with `sa-review` as the fallback. No tool was added.
- Plugin 0.31.5.

**What was found.** Usage-priced ($0.05 per KB of diff, $0.50 minimum per review, $0.05 per
commit for its Status reports); code goes to several model and inference providers; the
GitHub app held write access to contents, workflows, pull requests and issues on all
repositories. On a third-party snapshot of the Martian Code Review Bench (October 2026) it
was 7th of 14 (60.0% F1, 77.5% precision). The `ai-review` job has not been measured
against it.

**Done outside the repository, on the owner's word.** The app was uninstalled from the
organisation and its sign-in authorization revoked on the owner's GitHub account, both in
the built-in browser (GitHub has no API for an owner to uninstall an app; the owner
confirmed with GitHub Mobile). Verified: the organisation's installations no longer list it,
it had posted no comment and left no branch.

**Outstanding.** The Macroscope workspace itself could not be opened after the uninstall,
so it was not deleted there. Owner: the owner. Clears with a request to Macroscope's
support, if the owner wants the workspace and its data removed.

## 16 November 2026 (later): the owner clicks in a window before a gated Adobe run (0.31.4)

**Why.** GitHub's security review on the last commit of #57 (comment 4582851565) said that
the yes in `--owner-yes` is self-attested: an agent that runs `scripts/adobe-session.mjs`
can write a yes that passes, and nothing independent confirms that a person said it. It
proposed a `--confirm` code worked out from the inputs. That was not added: the script
would print the code, so the same agent could copy it. Put to the owner with the question
tool, four options. Answer: "Merge, window as next job (Recommended)". This pull request is
that window. Reply on #57:
https://github.com/TOKYO-BEANS/claude-cookbook/pull/57#discussion_r4582883218

**What changed.**
- A run with a `--send` file or a tool outside `READ_ONLY` opens a window on the owner's
  screen, after every existing check has passed and before anything is copied or started. It
  shows each file by name and folder, every Adobe tool in `--allow` (marked read-only or
  not), the yes as the child session will get it, and the credits that yes states. Only a
  click on "Go ahead" starts the run. "Stop", a closed window, five minutes without a click,
  or no window (not Windows, no desktop, the window's file missing, a window that broke)
  ends the run with exit code 2: nothing is copied and no session starts. A read-only run
  and `tools` open no window.
- The checks of `--owner-yes` are unchanged: the window is added and nothing is removed.
  `stageFiles` is split into its checks (`checkStage`, made before the window and again
  after the click) and the copy; what it accepts and refuses is the same.
- Nothing skips the window: no flag and no environment variable, no file switches it off,
  and a click is not remembered. The script's own text reads no environment variable
  (`claude` and `taskkill` are still found through `PATH`, and the temporary and home
  folders through the system's variables, as before; none of that decides about the
  window). The window's process is Windows PowerShell by its fixed path with a fixed
  environment (`SystemRoot` and nothing of the caller's); the text goes in on standard
  input, not on a command line. Its answer counts as a go-ahead only with a clean exit and
  a random mark made for that one run. The session checks the click again itself
  (`clickHeld`).
- The window is `scripts/adobe-window.ps1` beside the script: Windows Forms through Windows
  PowerShell 5.1, no dependency. Only the mouse presses "Go ahead": the button answers a
  left mouse button let go over it, has no place in the Tab order, and is off for the first
  two seconds. "Stop" has the focus and takes Enter and Esc. Only ASCII, Latin letters and
  punctuation show as they are; every other character is written out (`<U+202E>`).
- `--dry-run` opens no window and prints, under `window`, whether a real run would and the
  text it would show. A new command, `window`, shows the window alone with sample text and
  starts nothing: the trial below. Its button is "It works (trial)"; "Go ahead" is on a
  real run's window only, and that window's first line says that it is a real run.
- What the window does not stop is said in the script's header, on the setup page and on
  the new page: an agent that controls the desktop can click it, an agent that can change
  the script or the window's file can change what they do, an agent with a shell can start
  a session of its own without the script, and an agent can ask the owner to click. It is
  a second, independent channel, not a proof of identity.
- Pages. `recipes/photos-adobe-connector.md` and `recipes/photos-adobe-connector-setup.md`
  say that such a run waits for the click, and the setup page says what the window does not
  stop. Both were within 30 bytes of the 4,000 limit of `scripts/check.mjs` and the full
  text went about 500 over, so it has a page of its own, linked from both:
  `recipes/photos-adobe-connector-window.md`. Moved to it from the setup page: what the
  script reads in the yes. Cut to make room, each still recorded elsewhere: "(109 tool
  names: why it was switched off)" (`connector-register.md`), "its server is the direct
  one that Adobe refuses" (the dead-ends page), and "so ask with a yes that says all four"
  (now "refuses one that does not name all four").
- Tests: ten new ones in `scripts/adobe-session.test.mjs`: when a window is needed, what
  it is given to show, how each answer ends the run, the window's process and its file,
  that nothing skips it (flags, the script's own text, and `main` run in a temporary
  folder with a stand-in window and session), the dry run, and the checks without the copy.
- Plugin 0.31.4 (#59 took 0.31.3, below).

**Tried by hand, 16 November 2026**, with the owner told first each time (question tool,
"Open it now (Recommended)" three times). `node scripts/adobe-session.mjs window`:
- First try: no window appeared, and the command ended after five minutes with "timeout"
  and started nothing. Failure, found by a probe: the script starts the window's process
  with its console hidden (`windowsHide`), and Windows then hides the first showing of the
  process's window as well (no visible window handle; without `windowsHide` the window was
  there). Fix in `adobe-window.ps1`: the window is shown once, hidden, and shown again;
  the second showing is seen. A test holds that order in the file.
- Dead end: a blank first form to take the hidden showing. Reason: it had no title bar, and
  the real window stayed hidden. Owner: nobody; the fix above replaced it.
- Second try, after the fix: the window appeared, the owner clicked "Go ahead", and the
  command printed `window: shown, and it ended with "go". Nothing was started`, exit 0,
  five seconds after it started (the trial's button was still called "Go ahead" then).
- Third try, after the review's fixes (the mouse-only button, the trial's own button; the
  owner told first again, "Open it now (Recommended)"): the owner clicked with the mouse and
  the command printed `window: shown, and it ended with a click on "It works (trial)".
  Nothing was started`, exit 0, six seconds after it started.
- Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-16-adobe-owner-window/`
  (`window-trial.txt`, `window-trial-mouse.txt`, `window-hidden-probe.txt`,
  `mouse-probe.txt`, `dry-run-gated.json`).
- Not tried by hand: "Stop", the close button, a key on the window, and the window of a
  real run. The tests cover how the script reads each answer, the probe covers the keys,
  and the first try above showed the time limit ending a window nobody could click.

**From #59** (the entry below, the servers measured, from another chat). It merged as
`2ee5882` on 16 November 2026 while this pull request was open and took 0.31.3, so this one
is 0.31.4; this branch took `main` in by a merge commit (`HANDOFF.md` was the only
conflict). Its release check and install are that chat's to report: not known here.

**From #57** (two entries below), after it merged. This answers what the entry below says
is still owed for #57. #57 merged as `c004774` on 16 November
2026, by `gh pr merge --squash --match-head-commit a8e1b2c`, not through `sa-release`: its
run `cookbook-57-merge` had ended `failed` on the neutral `Graphify Formal Verification`
check, and the owner answered "Merge #57 once (Recommended)". On the merged head `a8e1b2c`
that check was again the only one not passing ("0/2 PR-changed function(s) verified · 2
not verified (1 vacuous, 1 unsupported)").
- Review round 2 of #57 (`6175fbc`): one low finding from the AI review (grouped numbers
  such as "1'000 credits" passed), fixed in `a8e1b2c`. The AI review of `a8e1b2c`: no
  findings. Two of the three rounds were used.
- GitHub's security review on `a8e1b2c`: the comment under **Why** above.
- Release check of `c004774`: `verified` and acknowledged (execution 1535). The `sa-release`
  run `cookbook-57-release` (kind `merge`) ended `unknown` for the skipped `ai-review` job,
  as on every merge commit. Both runs are recorded in
  `~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-yes-whole-words/release/`
  (`progress.md`, `summary-*.json`, `release-*.log`).
- Plugin 0.31.2 was installed on this PC (from 0.31.1) and proved from the installed path:
  `--dry-run` refused "credits are fine" and "the background is fine" for the cut-out
  (`proof-installed-0.31.2/dry-run-refusals.txt` in that evidence folder), and one real run
  with `--allow adobe_mandatory_init,get_account_type,font_search`, no `--send` and no yes,
  made those three calls, sent no file, was denied nothing and exited 0
  (`proof-installed-0.31.2/run-output.txt`, `out/`, `out.adobe-session/`). USD 0.18 of plan
  usage as Claude Code reports it; the connector's calls report no cost: unsettled.

**Reviewed before the first push** by a `cookbook:review` subagent that did not build it
and was told not to open the window. Nothing high. It found no way for a run started from
the command line to reach the session without a go-ahead, and the checks of the yes
unchanged. One medium, fixed: once "Go ahead" switched on, Tab or an arrow key could move
the focus to it and Enter or Space pressed it (the button answered `Click`); it answers the
mouse alone now, and a probe on an off-screen copy of the window showed `PerformClick`,
`Click`, a right button, a left button outside the button and a switched-off button all
leaving the answer at "closed", and a left button over it giving "go"
(`mouse-probe.txt` in the evidence folder). Four low, all taken: the wording on files and
environment variables claimed more than the code does (both above); the rule for
characters that do not show listed what may not show and missed fillers and
right-to-left letters, and now lists what may; the trial had the same "Go ahead" button as
a real run, so an owner could be asked to click it "as a test"; and the session's own
check of the click was tested by its text alone. Also taken from its notes: the page says
to give the command more time than the window's five minutes.

**Review rounds.** Three, set before the first push.

**Review round 1**, on `59e020a` (the commit that took `main` in). The AI review: one low
finding, fixed. The window showed the folder a `--send` file was given in; with a folder in
that path that is a link to another place, it showed the link's harmless name while the
copy came from the other place. It now shows the folder the file is really in, and the
given one beside it when they differ. Graphify's review: no issues by static checks, and
three notes on coupling (`parseArgs`, `windowText` and `main` call more functions than
before), which are not findings about behaviour and were left. GitHub's security review:
one comment (4583768687), fixed. `main` is exported with a window and a session that the
tests can replace, so a program that imported the script could give it a window of its
own that answers "go" and reach the real session. `main` now refuses a stand-in window
unless the session is a stand-in too (`realWindowOnly`): only the real window's go-ahead
starts the real session. `Graphify Formal Verification` on that commit: neutral ("0/3
PR-changed function(s) verified · 3 not verified (2 vacuous, 1 unsupported)").

**Review round 2**, on `93be055`. The AI review: one low finding, fixed. The folder a file
is really in was read when the window opened and not again in a way that held it: a link
in the path turned to another place during the five minutes would have been copied from
there. The real place is now read once before the window (`pinned`), shown, compared after
the click (a file that is somewhere else by then ends the run, nothing copied) and used
for the copy. GitHub's security review of that commit: no new comment.

**Review round 3**, the last, on `e2efa4a`. The AI review: one low finding, fixed. Only the
place of a file was held, not its content: a file written over in place while the window
was open would have been sent. `pinned` now also takes the SHA-256 of each file before the
window; after the copy a staged file with other content is taken out again, with every
other copy of that run, and the run ends. GitHub's security review of that commit: no new
comment. The three rounds are used: a low finding on the next commit goes into a
follow-up pull request; a high or medium one, or any security finding, still blocks the
merge and goes to the owner.

**Proved for this pull request.** `npm test` passes (373 tests with `main` taken in). `--dry-run` of a run with
a file and `image_select_subject` printed `"opens": true` and the window's text and made
no folder; a read-only one printed `"opens": false`. The trial above. No upload was made,
and no `--owner-yes` was passed to a real run.

**Outstanding.**
- The first photo run through the script: it needs the owner's yes and now the owner's
  click, and will show which asset tools an upload takes and which steps (a PUT to a
  presigned link, a download) the calling chat does itself, since the child has no shell.
- The Adobe plan started as a 7-day trial on 10 November 2026 and turns paid on day 7.
  Keeping or cancelling it is the owner's decision.
- The merge commit, the release check, the install and the proof run of this pull request
  go into the next Cookbook pull request.
- The merge gate and a `Graphify Formal Verification` that ran and ended neutral (two
  entries below): a Stack Atlas job, and the owner's yes, since it changes a check. That check
  arrives about four minutes after a push; #55 and #58 merged before it did.
- The window is Windows only. On another system a run that needs it ends with exit code 2;
  a window for another system is not built.
- The rest of the outstanding lists of the two entries below stands.

## 16 November 2026: each MCP server measured; Firecrawl deferred, OpenSEO in its projects only (0.31.3)

**Why.** After the Adobe connector came back "on demand only" (#55) the owner asked: "shouldnt
we do exactly that for all things? or is that too much?". The answer then: not for all, and
with a measurement per server first. This is that job.

**Measured** (Claude Code 2.1.325, Opus 5.5, the plan login, tool search on): the input tokens
of a new headless session's first request with the user's own settings, plugins and servers.
With all nine servers 67,356; with none 48,100. A server's cost is every server on minus that
one left out, two runs each (three for every server on); repeats agreed to within 10 tokens.

| Server | Tokens | Sessions that called it (of 557 in 30 days) | Calls |
| --- | --- | --- | --- |
| firecrawl | 11,407 | 35 | 204 |
| OpenSEO | 2,303 (2,339 with its skills) | 32 | 186 |
| parallel-search | 1,783 | 75 | 471 |
| Claude Docs | 1,656 | 5 | 54 |
| graphify | 965 | 78 | 478 |
| context-mode | 885 | 79 | 3,455 |
| cloudflare (plugin) | 91 (272 with its skills) | 10 | 23 |
| cloudflare-docs | 52 | 10 | 30 |
| stagehand | 39 | 1 | 3 |

- The servers cost 19,256 tokens together, not the 8,000 to 15,000 estimated on 15 November.
- Why two plain runs differed by thousands of tokens: a server reaches a session a moment
  after it starts, and a prompt sent at once is answered without the ones still connecting.
  The script holds the prompt back until the debug log shows each server connected.
- Tool search already keeps tool definitions out. Firecrawl was the exception: its author
  marks five tools to load in full. `"alwaysLoad": false` in the user's entry for the server
  overrules that (Claude Code's MCP docs, 2.1.287 or later): measured 57,325, so 10,031 saved,
  with all 33 tools still listed.
- T3 Code's own server is not in a headless run: not measured.

**Asked once** (question tool, 16 November 2026), each with the saving, the use and the cost
of the move. Firecrawl: "Defer (Recommended)". OpenSEO: "Only in its projects (Recommended)".
Claude Docs: "Leave as is (Recommended)". Cloudflare (both) and Stagehand: "Leave all three
(Recommended)".

**What changed on this PC.**
- `firecrawl` in `~/.claude.json` has `"alwaysLoad": false` (`claude mcp remove`, then
  `add-json`, user scope; the headers helper is unchanged).
- `openseo@openseo` is `false` in `~/.claude/settings.json` (`claude plugin disable`). It was
  already `true` in the `.claude/settings.local.json` of the two site projects that use it,
  which now decide. The register's note that it moved on 2 November had not held.
- Nothing else: no deny entry, no connector, no sign-in.

**What changed here.** `scripts/measure/servers.mjs` with `servers.json` (this PC's servers)
and `scripts/measure-servers.test.mjs`; a new page `recipes/connecting-load.md` (the table and
the three ways out of a session start), linked from `connecting.md`; one bullet each on
`firecrawl.md` (load the tool with `ToolSearch` first), `seo.md` (where OpenSEO loads) and
`scripted-runs.md` (hold the prompt back); the register's Firecrawl row and a new OpenSEO row.

**Verification.**
- After the moves a session start is 55,308 tokens (two runs, 55,307 and 55,309): 12,048 fewer.
- A new session found `firecrawl_scrape` through `ToolSearch` and called it: every tool
  result ok, no call denied.
- Start-up probes without a prompt (no cost): OpenSEO connects in both site folders and not
  in an empty one. In a child session (`--setting-sources "" --plugin-dir <cache folder>`) it
  connects with its stored sign-in.
- `npm test` passes (363 tests with `main` taken in, 17 of them in `scripts/measure-servers.test.mjs`).

**AI review round 1** (of three): three low findings, all fixed. A limit that was reached
ended the session again on every tick: it now runs once, and where a signal can be ignored a
SIGKILL follows after five seconds. The `defer` arm copied an entry unless it had `headers`
or a key-like `env` name, so a key in the URL or in the arguments would have gone into the
temporary file: it now copies only a remote entry with `type`, `url`, `headersHelper` and
`timeout`, whose URL has no user part, no query and no long path segment, and refuses
everything else (Stagehand's entry among them; Firecrawl's passes). A folder is checked
against the model that was asked for, not the one the session reports, so an alias in
`--model` no longer blocks the next run.

**Review round 2**, on `0818d74` (the commit that took `main` in). GitHub's security review:
the URL check of the `defer` arm still let a short path segment or a host name carry a key
into the temporary file. Its proposal (a root path only) would have refused Firecrawl's own
`/v2/mcp`, and no check of an entry's text can prove it holds no key. So the entry is now
pinned: `servers.json` records the SHA-256 fingerprint of the one entry a person has read
(`servers.mjs fingerprint --server firecrawl`), and any other entry is refused, also one
that passes every text check. The text checks stay and are stricter: a plain DNS host name,
no IP address, no port. Graphify: `run()` called 13 functions; one run is now its own
function. A second comment of the security review, on the debug log: the temporary folder
and its files are now made for this user only (modes 700 and 600 where the system has them),
the debug log exists before the session starts, deleting is tried again while a file is
held, and a folder that still cannot be deleted has its files emptied, is named without its
path and stops the batch with exit code 3. The AI review of `0818d74` (one low): a headers
helper is free text and was copied as it is. The fingerprint already refuses any helper but
the recorded one; a helper whose own text carries a header or a key (`echo "Authorization:
Bearer ..."`) is now refused as well, recorded or not. My reply to the first security comment
landed under the second by mistake; both threads were answered again in the right place.

**The final script was run once more** after these changes (`runs-after`, run 3): it ended
well and left no temporary folder. It measured 55,030 tokens, 278 fewer than the two runs
an hour before, with the same servers, tool, skill and plugin counts. The cause is not
known (the other chat had installed Cookbook 0.31.2 in between; a server may also have
changed its own text). So compare arms within one sitting only.

**Review round 3**, the last of the three. The AI review of `63d97dc`, one low: the script
said a run "can call nothing", but a run loads the user's own settings, and `dontAsk`
honours their allow rules (24 on this PC, for Bash and MCP tools). Every arm's settings now
add a PreToolUse hook that refuses every tool call, and a run in which the model tried a
tool is not counted. A deny rule or `--tools ""` was not used: either would change what is
measured. Proved with two capped runs (`checks/hook-blocks-tools.json`): with the hook a
Read of a file in the run's folder was refused, without it the Read worked. A measuring run
with the hook gave 55,035 tokens against 55,030 without, so the hook is not in the context.
None of the 32 measuring runs before it called a tool (each made one request). The rule is
on `recipes/scripted-runs-rules.md`.

**After round 3**, the AI review of `f3d0826`, one low: `recipes/seo.md` named the two site
projects, and this repository is public (the register says: no project names or paths). The
names are gone from the page and from this entry; they are in memory on this PC. They were
in three pushed commits of this pull request's branch (`78fa830` to `f3d0826`), which a
squash merge keeps out of `main`; the owner was told. A fourth push, for this alone.

**Spend.** USD 8.32 at list prices, on the plan login: 33 measuring runs (7.71, limit 15), the
hook proof (0.02) and
the Firecrawl call (0.59, and four Firecrawl credits).

**Not proved.** An OpenSEO call from a child session (it connected; no call was made, since
its calls spend credits). OpenSEO in a T3 worktree thread of its two projects: the local
settings file is not in git, so it will not load there; open SEO work in the project folder.

**Dead end.** The `claude-code-guide` agent had no web tool in this session and answered
nothing; the docs were read through Parallel instead.

**Evidence:** `~/.local/share/claude-cookbook/evidence/2026-11-15-mcp-on-demand/` (`RESULT.md`,
`runs/`, `runs-after/`, `checks/`, the census). Copies from before:
`~/.local/share/backups/mcp-on-demand-20261116/`.

**From #57** (the entry below, the Adobe follow-up, from another chat). It merged as `c004774`
on 16 November while this job ran and took 0.31.2; this branch took `main` in by a merge
commit, and the plugin here is 0.31.3. Its release check, install and proof run are that
chat's to report: not known here, so they are still owed to the next Cookbook pull request.

**From #58** (two entries below). It merged as `d951c09`. The release check of that commit is
`verified` and acknowledged (execution 1534; `sa-release` itself ended `unknown` for the
skipped `ai-review` job, as on every merge commit). No plugin file changed, so the installed
plugin stayed 0.31.1. Evidence: `~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`.

**Outstanding.**
- The merge commit, the release check and the install (0.31.3) of this pull request go into
  the next Cookbook pull request.
- Stagehand's review is on 28 November (the owner chose to keep it, do not ask again). It
  starts a process with the Browserbase key at every session start, for 39 tokens and one
  session in 557: a point for that review.
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- The older list in the entries below stands.

## 16 November 2026: the owner's yes is read by whole words and a number of credits (0.31.2)

**Why.** Two things #55 left open, both in how `scripts/adobe-session.mjs` reads the owner's
yes (`yesGaps`). This pull request closes them and removes no stop: a yes that passed before
and is refused now is the only change in behaviour.

**What changed.**
- An operation word is matched as a whole word, with the boundary rule that file names
  already had (`namedIn`; both now use one function). A plural still counts: "masks" names
  `mask`, "uploads" names `upload`. "unmasked", "cropped", "uploaded" and a file called
  `mask.jpg` do not. A tool's own name is matched whole as well, without a plural, and so
  is "Adobe" (a file called `adobe.jpg` named the account). A letter of any alphabet joins
  a word, also for file names. Words are read, not meanings: "no masks" names a mask.
- "background" is no longer a word for `image_remove_background`: "the background is fine"
  named the cut-out. "cut-out", "cutout", "cut out" and the tool's own name remain.
- The yes must state a number of credits in front of the word: "0 credits", "up to 300
  credits". The word "credits" alone, "no credits", "zero credits" and a number with a
  separator ("1,000") are refused. 0 is valid. The script checks that the number is there;
  it cannot measure what a run spends and holds no run to the number.
- The two pages that describe the yes check say so (`recipes/photos-adobe-connector.md`,
  `recipes/photos-adobe-connector-setup.md`). Tests: two new ones in
  `scripts/adobe-session.test.mjs`.

**The owner's decision on the credits.** GitHub's security review on the last commit of #55
asked for a numeric credit cap in code and for "0 credits" to be refused. Put to the owner
on 15 November 2026 with that comment, and with the reasoning that the connector's calls
have shown no charge and that the script cannot measure spend, so a cap in the script would
be a number it cannot hold a run to. Answer: "Merge now, rest in a follow-up (Recommended)".
The owner then set this follow-up's scope in its brief, 15 November 2026: "The yes must
state a number of credits, not only the word "credit" ("0 credits", "up to 300 credits"). 0
stays valid." This pull request does that and no more of the comment: no cap is held in
code.

**Round 4 of #55**, the push the owner allowed beyond the three rounds. The AI review of its
last commit (`a365479`): one low finding, that `yesGaps` matched operation words as plain
substrings; fixed here. GitHub's security review added two comments on that commit: the
credits number (above, taken into this pull request) and the brief again (it goes into the
prompt, fenced; the review proposed stripping instructions from it). The second is the
earlier finding on the brief with another proposed fix; the owner accepted it with the same
answer. That acceptance covers that comment and no other finding.

**From #55** (the Adobe connector on demand, 0.31.0, three entries below). It merged as
`e5a2527` on 15 November 2026. The release check of that commit is `verified` (execution
1532); the `sa-release` run `cookbook-55-merge` ended `unknown` because the `ai-review` job
is skipped on a merge commit, as on every one. Plugin 0.31.0 was then installed on this PC
and proved: a run from the installed path made three read-only Adobe calls
(`adobe_mandatory_init`, `get_account_type`, `font_search`) and exited 0. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-connector-on-demand/`
(`proof-installed-0.31.0/`, `release/`).

**From #56 and #58** (the two entries below), which merged while this pull request was
open. #56 took 0.31.1, so this one is 0.31.2; this branch took `main` in by a merge commit
(`HANDOFF.md` was the only conflict). #58 merged as `d951c09`; the release check of that
commit is `verified` and acknowledged (execution 1534; log `release-cookbook-58-merge.log`
in `~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`).

**The merge gate stopped this pull request, and the owner decided.** The `sa-release` run
`cookbook-57-merge` (15 November 2026, late) ended `failed` and merged nothing: the check
`Graphify Formal Verification` had run on the head commit (`0fed36e`) and ended neutral
("0/2 PR-changed function(s) verified · 2 not verified (1 vacuous, 1 unsupported)"). The
merge script sets that check aside only when its title says it did not run; a neutral one
that ran counts as not passed. It cannot pass here: it proves that old and new code behave
the same, and this change alters behaviour on purpose. Every other check had passed and
the AI review had no findings. Put to the owner with the question tool: merge #57 once as
an exception for this pull request only, change the gate first in Stack Atlas, or leave it
open? Answer: "Merge #57 once (Recommended)". That covers this pull request and no other;
the gate is unchanged. The run is recorded in
`~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-yes-whole-words/release/`.
- Dead end: getting that check to pass on a pull request that changes what a function does.
  Reason: above. Owner: the owner (a change to the gate loosens a check). Clears when the
  gate in Stack Atlas (`merge-when-green.sh`, `outsideGate`) has a rule for a run that
  found nothing different, or Graphify reports such a run as passed.
- Seen beside it: Graphify posts that check about four minutes after a push. #55 and #58
  merged before it arrived (on #58's head it ended neutral 102 seconds after the merge), so
  the gate never saw it there. Not changed here: it is Stack Atlas's script.

**Reviewed before the first push** by a `cookbook:review` subagent that did not build it:
nothing high; one medium (this entry did not show the owner's words on 0; they are quoted
above now) and five low, all taken: the credits pattern read "1 000" and a minus sign as
numbers, "Adobe" was still a plain substring, a letter outside a–z did not join a word, a
comment claimed more than the word list does, and three behaviours had no test.

**Review round 1** (of three), on `0fed36e`: the AI review had no findings, Graphify's
review none, and GitHub's security review did not comment.

**Review round 2**, on `6175fbc` (the commit that took `main` in). The AI review: one low
finding. The credits pattern listed the marks that may not stand before the number, so
"1  000 credits" (two spaces), a narrow no-break space and "1'000 credits" still passed on
their last digit group. The pattern now says what may come before the digits instead: the
start of the yes, an opening bracket, or white space that does not follow another digit.

**Proved for this pull request.** `npm test` passes (346 tests with `main` taken in).
`--dry-run` refuses a yes with the word
"credits" and no number, and one that says "the background is fine" for the cut-out, and
accepts "0 credits" with "masks". No upload was made and no `--owner-yes` was passed to a
real run.

**Outstanding.**
- The first photo run through the script: it needs the owner's yes, and will show which asset
  tools an upload takes and which steps (a PUT to a presigned link, a download) the calling
  chat does itself, since the child has no shell.
- The Adobe plan started as a 7-day trial on 10 November 2026 and turns paid on day 7. Keeping
  or cancelling it is the owner's decision.
- The merge commit, the release check, the install and the proof run of this pull request go
  into the next Cookbook pull request.
- The merge gate and a `Graphify Formal Verification` that ran and ended neutral (above):
  a Stack Atlas job, and the owner's yes, since it changes a check.
- The fixed set of tasks measured before and after is done (#56, two entries below); the
  rest of that entry's outstanding list stands: what was not measured, the unproven T3
  scheduled task, Stagehand's review date of 28 November (the owner chose to keep it: do
  not ask again), the Proton Pass CLI reported signed out on 15 November and not rechecked,
  the two register pages still read in ranges, the token counter not retried.
## 15 November 2026 (late night): the measuring script, two findings from the last review of #56

No plugin file changes, so the plugin stays 0.31.1.

**What changed** in `scripts/measure/measure.mjs`, both from the AI review of #56's head
commit (two low findings, left for this pull request because #56's three rounds were spent):
- `run` does not score a run that ended in an error (`is_error`, or a subtype other than
  `success`, such as a run cut off by the spend cap): it prints the subtype, stops the batch
  and keeps the run as a `discarded` row, so its cost counts against the batch limit (a run
  with no result at all is counted at the full cap) while the report leaves it out and names
  it. The AI review's first round (medium) asked for the cost to count: without it, a task
  that kept hitting the cap could have passed the limit across reruns. Round 2 (two low): a
  result that reports no cost is also counted at the cap, and a run that succeeds without a
  cost is not scored; `report` applies its check for another task set or model to every row,
  the discarded ones included. Scored, such a run would have counted as wrong answers. None of the
  48 runs of the first measurement was one (every row: exit 0, `isError` false, `success`).
- `--side` must be `before` or `after`; any other name stops the command before a run. A row
  under another name would have cost money and been left out of the report.

**Verification.** `npm test` passes (344 tests, 17 of them in `scripts/measure.test.mjs`).
No paid run was made for this pull request.

**From #56** (the entry below). It merged as `187cfc2`. The release check
of that commit is `verified` and acknowledged (execution 1533; `sa-release` itself ended
`unknown` for the skipped `ai-review` job, as on every merge commit; log
`release-cookbook-56-merge.log` in the evidence folder). Plugin 0.31.1 was installed the same
night (from 0.31.0, which the Adobe job had installed) and proved with a new headless
session that loaded it from `cookbook/0.31.1` (`newsession-0.31.1.jsonl`). Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`.

**Outstanding.** The list in the entry below stands, less its first item. The merge commit
and the release check of this pull request go into the next Cookbook pull request. The order
the owner set on 15 November 2026 is complete.

## 15 November 2026 (night): a fixed set of tasks, measured before and after (0.31.1)

The last step of the order the owner set on 15 November 2026 (the map #51, the removals #52,
the diet #53, the visual check's recipe #54, then this).

**What was compared.** "Before" is the global rules file as it was before the diet (36,078
bytes, from `~/.local/share/backups/claude-md-diet-20261115/CLAUDE.md`) with Cookbook 0.28.4
(`52aead6`, a 94,928-byte skill). "After" is today's file (8,411 bytes) with Cookbook 0.30.2
(`b75dbaf`, an 11,730-byte map and one page per recipe). The removed tools were not
reinstalled (an install needs the owner's yes), so the removal step (#52) is not in these
numbers; what is recorded for it is the tool count of a full session start, 205 before and
173 after (`evidence/2026-11-15-remove-jobless-tools/`).

**The task set**, chosen by the owner with the question tool ("12 tasks, twice
(Recommended)"), is in `scripts/measure/tasks.json`: six tool choices (who calls a function,
a JS-heavy page, merging a finished pull request, vetting outside code, a scripted
`claude -p` run, a live Wix change), four stops (a paid plan, dismissing a finding, merging
without waiting, publishing without a visual check) and two rule lookups (a new key,
force-push). Each task asks for the answer in named fields. The key (38 checks, each a
pattern on one field) was written before any run and holds only answers both rule sets give.

**How.** `scripts/measure/measure.mjs`: headless runs on the Claude plan login, Opus 5.5,
tools Skill, Read, Glob and Grep only, no MCP servers, no user settings or plugins, a cap of
USD 1 a run and a stop at USD 30 for the batch. Each side is a folder with that side's rules
file and plugin. 12 tasks, two sides, two repeats: 48 runs, none failed, no tool call denied.

**Results** (sums over the 24 runs of a side; the table per task is in the evidence folder).

| | Before | After | Change |
| --- | --- | --- | --- |
| Checks passed | 76 of 76 | 76 of 76 | none |
| Input tokens, all requests | 1,627,339 | 1,109,261 | 32% fewer |
| First request of a run (mean) | 22,254 | 12,459 | 44% smaller |
| Largest request of a run (mean) | 50,190 | 17,544 | 65% smaller |
| Output tokens | 10,615 | 10,635 | the same |
| Requests (turns) | 62 | 94 | 52% more |
| Seconds (as Claude Code reports them) | 140 | 152 | 9% more |
| Cost at list prices (plan usage, no invoice) | USD 7.75 | USD 2.46 | 68% lower |

- Nothing was lost and nothing was gained in correctness on this set: both sides passed every
  check, stops and rules that left the global file included. The set cannot show a gain: its
  key holds only answers both sides give.
- The saving is in size and cost, not in speed. After loads a short map and then reads the
  page of the job (19 page reads and 7 searches in 24 runs); before loaded the whole skill and
  read nothing else. That is why after needs more requests and a little more time.
- Two tasks cost after more input tokens than before, as means: merging without waiting
  (65,671 against 51,129) and force-push (64,879 against 51,090). In both, after took five
  requests to find the rule on a page, and one of before's two runs answered from the global
  file without loading the skill. Their cost was still lower (USD 0.12 against 0.24).
- Before was less steady: three of its second-repeat runs skipped the skill (22,000 tokens
  against 80,000 with it). After loaded the skill in 22 of 24 runs; the two without were the
  dismissal stop, which both sides answer from the global file.
- The first request shrank by 9,795 tokens, which matches the diet's own measurement (9,798).

**A flaw found before the batch, and fixed.** `--setting-sources project` does not keep the
user's `~/.claude/CLAUDE.md` out: a probe run named both rules files, so both sides had
today's file on top. The first trial run and two probes are void (kept in `void/`). The runs
now pass `--settings` with `claudeMdExcludes`; `measure.mjs probe` showed one rules file per
side before the batch. The rule is on `recipes/scripted-runs-rules.md`.

**Spend.** The batch: USD 10.21 at list prices, on the plan login (`apiKeySource` `none` in
every run). Outside it, the void trial, the probes and the scope proof: USD 0.87.

**To measure a later change:** build the two sides (`git archive <commit> plugins/cookbook`
into `<side>/plugin`, the rules file as `<side>/work/CLAUDE.md`), then `probe`, `run` and
`report`. Results compare within one task set only: a changed task or check takes a new
`set` name.

**Verification.** `npm test` passes (341 tests, 14 of them in `scripts/measure.test.mjs`; the run's allow list is one of the things they pin). The 48
stored answers were scored again from the raw streams after the last change to the parser:
152 of 152, none moved.

**Checks and review on the pull request (#56).** The first push failed `Depot CI / test`: a new
test assumed a Windows path; the Read rule and its test now hold on Linux too. CodeQL then
raised one high finding (`js/clear-text-logging`, alert 3): the probe printed the stream's
`apiKeySource` label. It is no key, but the finding was fixed, not answered: the runner records
only whether a run was on the plan login. AI review round 1 (of three), two low findings, both
fixed: a `--cap`, `--limit` or `--reps` that is no positive number stops the command (it would
have switched the batch stop off), as does a flag without a value; and `run` and `report`
refuse a folder that holds results of another task set or model. Round 2, from GitHub's
security review: a run wrote its whole stream to the output folder, and the model's text can
quote the rules file it was given. The stream, the run's stderr and the probe's stream are now
written only with `--transcripts yes`, and a search is recorded without its pattern; by
default the folder holds numbers, tool names and which checks passed. The first measurement
was made before this, so its folder holds every stream; it is on this PC only, in no
repository. Round 3, the last: requests are counted for the model the session reports, so an
alias in `--model` no longer leaves the request columns at 0, and a run with a result but no
counted request stops the batch; the header comment names both scripted-runs pages.

**After the third round, one more finding, about isolation, so it was fixed here and not in a
follow-up.** The runs allowed `Glob` and `Grep` without a path, so a run could have searched
any file the user can read, the user's own rules file included. None did: the 48 stored
streams hold 26 file-tool calls (19 Read, 7 Grep), every one inside the run's own side
folder, so the numbers above stand. The fix: only `Skill` and the one Read rule are allowed.
One capped run proved it (`checks/scope-probe-read-rule-only.jsonl` in the evidence
folder): Grep, Glob and Read worked inside the side folder and all three were refused
outside it. The rule is on `recipes/scripted-runs-rules.md`.

**And one from GitHub's security review on that commit:** `probe` printed the model's answer,
which holds the paths and first headings of the rules files. It now prints a verdict it
works out itself (clean or not, how many rules files, whether the side's own and the user's
own are among them) and ends with exit code 1 when a side is not clean; the answer is shown
only with `--transcripts yes`. The line `run` prints per run names the tools without their
arguments; the pages read stay in `summary.jsonl`.

**Evidence:** `~/.local/share/claude-cookbook/evidence/2026-11-15-before-after-tasks/`
(`RESULT.md`, `runs/report.md`, `runs/summary.jsonl`, one stream per run, both sides in
`arms/`, the void runs in `void/`).

**From #55** (the entry below, the Adobe connector on demand, 0.31.0). It merged as `e5a2527`
while this job ran; this branch took `main` in by a merge commit, and the plugin is 0.31.1.
The release check of `e5a2527` is `verified` and acknowledged (execution 1532; log in
`~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-connector-on-demand/release/`).
Plugin 0.31.0 was not installed on this PC when this was written. The measurement's "after"
side is 0.30.2, as stated: #55 added one map row and three pages after it.

**From #54.** It merged as `b75dbaf`; the release check of that commit is `verified` and
acknowledged (execution 1530; `sa-release` itself ended `unknown` for the skipped
`ai-review` job, as on every merge commit). Plugin 0.30.2 was installed the same evening and
proved with a new headless session. Evidence:
`~/.local/share/claude-cookbook/evidence/2026-11-15-visual-check-recipe/`.

**Outstanding.**
- The merge commit, the release check and the install of this pull request (0.31.1) go into
  the next Cookbook pull request.
- Not measured: the removal step by itself, and a session with every MCP server on (two such
  runs differ by thousands of tokens). A per-server measurement belongs to a job of its own
  (memory `whole-design-one-owner`).
- "Adobe for creativity" stays connected in claude.ai: #55 reversed the earlier request to
  disconnect it. Nothing waits on the owner there.
- Open from #55, the owner's: the yes for the first photo run through the script, and keeping
  or cancelling the Adobe plan (a 7-day trial from 10 November 2026 that turns paid on day 7).
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- Stagehand's review date is 28 November (`connector-register.md`); the owner chose to keep
  it, do not ask again.
- Still open from #54: the Proton Pass CLI was reported signed out on the morning of
  15 November and not rechecked; `dispatch-profiles.md` and `connector-register.md` are
  still read in ranges; the Claude API's token counter was not retried.

## 15 November 2026 (late evening): the Adobe connector is back, on demand only (0.31.0)

**Why.** #52 switched "Adobe for creativity" off because the map gave it no job and its page
said "connected but not yet used for a task". That was wrong: in a business-website project it
had made 26 masks under a colour fix on 14 photos, plus straighten, blur, expand and a cut-out
(10 November 2026). The owner, 15 November 2026: "it really helped alot with photos/images on
camilla site" and "can we make it so it is not auto loaded in evry session/chat but you can
grab it if you need it?". This pull request is that, and it removes no stop.

**What changed.**
- A map row ("Edit a real photo: masks, cut-out, straighten, colour by region"), the tool in
  `catalog.json`, a register row, and three pages: `recipes/photos-adobe-connector.md` (the use,
  the stops, what the first job taught), `recipes/photos-adobe-connector-setup.md` (the child
  session and its limits) and `recipes/photos-adobe-connector-dead-ends.md`.
- `scripts/adobe-session.mjs` in the skill's folder starts a child session that loads only this
  connector, in `dontAsk` mode and without a shell: it reads the files staged for it, writes
  in a folder made new for the run, and calls the Adobe tools named on its command line; tests
  in `scripts/adobe-session.test.mjs`. The only files of the owner's it can see are the ones
  named with `--send`, and each must be named in `--owner-yes` by its whole file name; a tool
  that is not read-only needs that yes too. The upload gate of
  `recipes/photos.md` is unchanged and is repeated on the new page.
- On this PC nothing in `~/.claude/settings.json` changed: `claude.ai Adobe` and the plugin's
  server stay denied and the plugin stays disabled, so an ordinary session loads no Adobe tool.
  The connector stays connected in claude.ai: the owner is asked **not** to disconnect it (the
  earlier entries asked for the opposite).

**Proved** (15 November 2026, Claude Code 2.1.325). One run of the script with three read-only
tools: `adobe_mandatory_init`, `get_account_type` and `font_search` answered; no file was sent
and nothing was created. Limits measured with the final script: allowed were a read of the
staged file and a write and a read in the run's own folder; denied were an Adobe tool not on
the list, an older file in the output folder, a Glob of it, the staged file's original, the
script's own files and a write anywhere but the run's folder; a shell command had no tool to
run in. A one-minute time
limit stopped a long run with exit code 3. An earlier version that could be given a shell rule
for curl also ran `whoami` and `node --version` (Claude Code runs commands it reads as
read-only once a shell is on), which is one reason the shell is gone. An ordinary headless
session on the same day listed no Adobe server, tool, skill or plugin.

**Reviewed before the first push** by a `cookbook:review` subagent that did not build it. Nine
findings, all fixed in the second commit. The main ones: the child could read every file the user can (the
user settings' deny rules for secrets do not reach it), it could overwrite the script's own
settings and log, the check for other servers never saw one (it now reads the debug log after
the run), any command was accepted as a shell rule (the shell is gone since), the output folder was
not checked, the yes sat in the same prompt as the brief (now in the system prompt), and the
child process was not ended cleanly.

**Review round 1** (of three). The AI review: a folder given for reading could contain the
script's own log folder. GitHub's security review: nothing in code tied the owner's yes to
the files that could be sent, and the log kept every event word for word. Fixed in the third
commit by taking away rather than adding: no extra folders and no shell at all, the files to
send are named with `--send` and must each be named in the yes, and the log keeps tool names,
denials and cost only. The session's debug log is deleted after it has been read.

**Review round 2.** The AI review: the child could read everything in an output folder that
already held files; the yes was matched as a piece of text, so `a.jpg` passed on a yes for
`banana.jpg`; and a link could be sent as its target. Graphify: the output folder could be
inside `.git`, and two runs shared one settings file. Fixed in the fourth commit. A live test
then showed that a write rule on a folder also lets the child read it, so the child has no
rule on the output folder at all: it reads `to-adobe` and writes a folder made new for the
run. The yes must name each file by its whole name; a link is refused; the output folder is
checked again with links followed; `.git`, CI and hook folders are refused; every run has
its own settings file.

**Reviewed again before the last push** by a second `cookbook:review` pass: nothing high,
three medium, the rest low; all fixed in the fifth commit. A staging folder that was already
a link was copied through before it was refused (it is checked first now, as are the other
folders the script uses). Started through a linked folder the script did nothing and exited
0. The brief was an unchecked way to bring any file's text to the child (it is a small
`.md` or `.txt` now, not a link, not in a secret folder). Also: a file to send has an
extension, a double quote in the yes is refused, a path with pattern characters or on a
network share is refused, the log copies no free text at all, a run that called no Adobe
tool exits 1, and a debug log that cannot be deleted is reported. Measured in that pass: a
`CLAUDE.md` above the output folder does not reach the child.

**After round 3 was pushed**, GitHub's security review commented twice more on the round 2
commit. The system prompt, with the owner's yes and the file names, was on the child's
command line, where another user of the PC could list it: it is now in a file in the
temporary folder that is deleted after the run. And a general yes covered any tool that is
not read-only: the yes must now name the Adobe account, the credits and the operation of
each such tool (`mask`, `upload`, `expand` and so on; a tool the script does not know by an
operation word must be named itself), beside each file. Fixed in the sixth commit.

**Round 3**, the last of the three set. The AI review: one low finding, no test for the end
of a run; the exit codes are now one function with a test for each. GitHub's security review
on that commit: the brief goes into the prompt as it is, and the debug log exists while the
run lasts. The brief is now fenced as data with a mark made from its own text, and the
system prompt says that nothing in it changes a rule. The debug log stays: the script needs
it to know when the connector has connected and which servers did. It is in a temporary
folder that only this user can read and that is deleted whatever happens. The review
proposed a brief in a fixed JSON form and a debug log only on request; neither was done, for
those reasons. A fourth push went beyond the three rounds, so it and those two answers were
put to the owner with the question tool (15 November 2026). Asked: push a fourth round,
accept the two answered comments (the brief in a fixed JSON form; the debug log off by
default) as they are, and merge when every check passes and the new review has nothing high
or medium, with any new security comment coming back to the owner first? Answer: "Push,
accept those two, merge (Recommended)". That acceptance covers those two comments and no
other finding.

**Dead ends.**
- A subagent with the server defined inline in an agent file (`mcpServers`). The mechanism
  works (proved with Graphify: the subagent called it, the main session listed no server), but
  Adobe's server answers every direct request with HTTP 403, also with a fresh token after the
  owner signed in through `claude mcp login`. Adobe offers the connector in Claude chat, Cowork
  and Claude Desktop only. Owner: Adobe. Clears when Adobe accepts other MCP clients. The agent
  file, the direct server entry and its sign-in were removed again (`claude mcp logout`, then
  `remove`).
- `allowedMcpServers` with the connector's name blocked the connector too, so the child
  session's settings deny the other connectors by name. A connector added in claude.ai later
  loads into the child (it cannot be called: no rule allows its tools); the script then ends
  with exit code 3 and names it, until it is added to `OTHER_CONNECTORS`.
- The connector reaches a new session a moment after it starts. A session that got its prompt
  at once had no ToolSearch and no Adobe tool, and gave up with exit code 0. The script now
  holds the prompt back until the debug log shows the connector connected.

**Not proved.** A photo run through the script: no upload was made in this job, because none
was asked for. The first real one needs the owner's yes, and will show which asset tools an
upload takes and which steps (a PUT to a presigned link, a download) the calling chat does
itself, since the child has no shell. The connector's calls still report no cost: unsettled.

**Evidence and copies.** `~/.local/share/claude-cookbook/evidence/2026-11-15-adobe-connector-on-demand/`
(the proof run, the limit runs, the three connection logs of the dead end, the tool names). The
removed agent file and sign-in folder, and a copy of the unchanged settings file:
`~/.local/share/backups/adobe-connector-20261115/`.

**From the entry below (#54).** It merged as `b75dbaf`; the release check of that commit is
`verified` (execution 1530).

**Outstanding.**
- The first photo run through the script: it needs the owner's yes, and will show which asset
  tools an upload takes and which steps the calling chat does itself.
- The Adobe plan started as a 7-day trial on 10 November 2026 and turns paid on day 7. Keeping
  or cancelling it is the owner's decision.
- The merge commit and the release check of this pull request go into the next Cookbook pull
  request.
- Next job, in its own chat: a fixed set of tasks measured before and after.
- Stagehand's review date is 28 November (`connector-register.md`): with calls from only one
  or two projects it moves to project scope.
- The Proton Pass CLI was reported signed out by the daily update check on the morning of
  15 November; not rechecked.
- `dispatch-profiles.md` and `connector-register.md` (about 10 KB each) are still read in
  ranges.
- Unproven: a T3 scheduled task bound to a thread with a cheaper model.
- Not retried: the Claude API's token counter for measuring what a file costs a session. It
  needs a workspace ID in the request (see the entry below).

## 15 November 2026 (evening): the visual check has its row and its pages (0.30.2)

**The map.** The row "Visual check of a live site before a customer-visible change" no longer
says "being built". Its owner is the site's own check script, in the site's repository; its
fallback is to ask the owner; its page is `recipes/visual-check.md` (when a pass lifts the
stop, how to use a check, what a pass never covers), with `recipes/visual-check-build.md`
(how a site gets one: the four layers, the capture traps, the proofs, the record). Both are
general. What is specific to wecarestudio.dk stays in that project (`CLAUDE.md`, section
"Visual check", and `jobs/25-visuelt-tjek/FINDINGS.md`), where the check was built and
proved on 15 November 2026.

**The stop is not loosened.** The page quotes the owner's global rule (15 November 2026,
"How we work", stop 3): "A change customers see on a live site (Wix, Shopify or any other
host), unless that change has passed the site's visual check: screenshots at desktop and
phone size, judged against the intended design by an agent that did not build the change.
Until a site's check is recorded in that project's `CLAUDE.md` and the owner has said yes to
it once, always ask." The page adds limits and takes none away: this page lifts no stop, a
check that merely exists lifts none, and a change to a check's thresholds, routes, judge or
pass rule needs the owner's yes. The ground rules in `SKILL.md` are unchanged.

**Two owner answers, asked with the question tool in this chat (15 November 2026).**
- Stagehand. Asked "Remove it?", with the finding that nothing uses it and the recommendation
  to remove it. Answer: "so i want to keep stagehand and use it instead of playwright, theot3
  also said it is faster and better." Asked again, with the correction that the other chat
  found Stagehand better than the `browse` CLI and not better than Playwright, and that for
  the visual check it cannot open a local build, ignored phone emulation and runs only
  inside a session: "So where should Stagehand be used?" Answer: "In-session browser work
  (Recommended)". So Stagehand stays installed (nothing was uninstalled) and has a job: the
  map row "Several steps on a public page inside a session", with the `browse` CLI as its
  fallback. `browse` keeps "A public page from a script, or one step". The visual check
  stays on the site repository's Playwright.
- The Wix page. `recipes/wix-ask-first.md` said to ask before every publish or release, which
  is stricter than the global rule and held beside it. Asked "May the Wix page name that one
  exception?" Answer: "Name the exception (Recommended)". The page now excepts a release of
  a code change that has passed the site's visual check, where the check and the owner's yes
  are recorded in the project's `CLAUDE.md`; publishing from the editor or the dashboard and
  creating a site still ask.
- The rollback after a failed check is not a new exception. It is the owner's global rule
  (15 November 2026, "How we work"), quoted: "A failed release check means: roll back to the
  last good version first, then fix through a new pull request." `recipes/ci-releases.md`
  already held it; the two pages now quote it and limit it to the version that was live
  before the release, with the owner told at once. (The AI review's first round asked for
  this.)

**What uses Stagehand, checked on this PC.** Only its own user-scope MCP entry. No hook,
script in `~/.local/bin`, scheduled task or project file names it. Its tools were called 18
times, all in the WeCare project on 14 and 15 November (the screenshot trial of job 25).

**Verification.** `npm test` passes. Three review rounds were set before the first push.
Before it, a `cookbook:review` subagent that did not write the change read the diff: no stop
loosened, three gaps closed (release exactly the build that was judged; a change to what the
capture hides or skips needs the owner's yes; `recipes/workflows.md` and
`recipes/cloudflare.md` now also name "recorded in the project's `CLAUDE.md` with the
owner's yes"). Evidence of the Stagehand check and the owner's answers:
`~/.local/share/claude-cookbook/evidence/2026-11-15-visual-check-recipe/`.

**Corrections to the entry below (#53).** It merged as `987bbea`; the release check of that
commit is `verified` (execution 1528; `sa-release` itself ended `unknown` for the skipped
`ai-review` job, as on every merge commit). Plugin 0.30.1 was installed the same evening.
Its numbers are now the final ones, and its "dead end" is corrected: a workspace ID for the
`anthropic-api` key can be read with `depot ci vars list --repo TOKYO-BEANS/WeCare-Wix`
(variable `ANTHROPIC_WORKSPACE_ID_REVIEW`), as the WeCare check does.

**Outstanding** is carried in the entry above.


## 15 November 2026 (later): the global rules file is cut to the hard rules (0.30.1)

**On this PC.** The owner's global `~/.claude/CLAUDE.md` now holds the machine's hard rules,
"How we work", the sign-in rule and one paragraph that points at the Cookbook. It went from
36,078 to 8,411 bytes (9,201 before the four rules below left it, once 0.30.1 was
installed). Measured in a new headless session with no tools and no MCP servers: the
session's input fell from 18,233 to 8,435 tokens, so 9,798 fewer at every session start. In
the measure the job was set in (about 4.24 bytes a token) that is about 8,500 to about
2,000; the model's own count is higher on both sides.

**Nothing was loosened.** Every stop and every "never" of the old file is listed with where it
lives now in `placement.md` (evidence folder below): kept in the global file, held by
`SKILL.md`, or held by a recipe page. The stops the old file had in three places (an access
change, an uninstall, an update that is not routine, a security finding, a first publication, a
message to other people) are now in its one stop list. The owner answered three questions
before the file was saved (15 November 2026):
- "May they leave the global file?" about the rules held only on a recipe page: "Yes, a page
  counts".
- "Update the installed plugin to the newest version after the pull request is merged and
  verified?": "Yes, update it".
- "Correct the page to match the global rule?" about `recipes/sign-ins.md`, which said Claude
  never adds a vault item, against the owner's global rule of 14 November 2026 ("Claude can
  add to the vault itself ... That covers a login for a user made for Claude. A login that is
  the owner's own ... is still added by the owner, never typed in chat."): "Yes, correct the
  page". The page now says that and no more: Claude still never edits or moves an item, and
  each new login needs the owner's yes to that login in the current chat (added after GitHub's
  security review asked for a gate at the moment of creation; the global rule already says a
  route is set up "on the yes").

**In this pull request.**
- Four rules that were in the global file and on no page are on their page: `firecrawl.md`
  (an agent run's `effort`, a monitor's schedule and monthly estimate), `code-navigation.md`
  (`set_workspace`, `remember`, private data), `research.md` (Parallel's keys, monitors and
  private uploads) and `judgement.md` (community demos, literal fallbacks). Each adds a limit.
- The map row "From a finished change to a merged pull request" is decided: `sa-release` with
  `merge: true`. The comparison with tstack's `full-send` (Stack-Atlas's `HANDOFF.md`,
  15 November 2026) is summed up in `options/ship.md`; what it taught is in
  `recipes/ci-releases.md`: three review rounds set up front, a pull request the AI review can
  read whole, and one reviewer that did not build a large change.

**Proved with a new session** (headless, the Skill tool only): it listed the five headings of
the new global file, quoted the credential and Sophos rules, counted seven stops, and loaded
the `cookbook` skill from the installed 0.30.0. The installed plugin was 0.29.0 when this job
started and 0.30.0 when that session ran: the chat that merged #52 installed it on the owner's
yes.

**Memory indexes.** Stack-Atlas's went from 18,165 to 5,635 bytes and Probiz's from 16,117 to
4,624: one short line per memory. Where a long line named something its memory file did not,
the line's text was added to that file (13 files). Removed, because wrong or about something
that is gone: `jev-router-setup`, `claude-code-addons`, `claude-compaction-plugins` (it said
Jev compaction runs in Stack-Atlas only), `deploy-approval-timing`, `fixer-paid-checks` and
`autonomous-queue-oct21` in Stack-Atlas's memory, and `control-room-handoff-pause-gate` (Magic
Workflow). Three indexes that held prose and no memory are empty.

**Evidence and copies.** `~/.local/share/claude-cookbook/evidence/2026-11-15-global-claude-md-diet/`
(`placement.md`, the new file, the four measurement runs and the proof session's answer). A
copy of the old global file, every memory folder as it was and the removed memories:
`~/.local/share/backups/claude-md-diet-20261115/`.

**Done after the merge.** Once 0.30.1 was installed, the last section of the global file
("Job rules the Cookbook does not hold yet", four lines) was deleted, because the pages hold
them. The token counter of the Claude API was not used for the measurement: the
`anthropic-api` key needs a workspace ID on every request (how to read one is in the entry
above).

**Outstanding** is carried in the entry above.

## 15 November 2026: the tools without a job are removed (0.30.0)

**Merged and verified.** Pull request #52, merge commit `8f464e0`. The release check of that
commit is `verified` (execution 1512).

**The owner's decision this follows.** After the map was merged, the owner was asked one
question that listed every installed tool the map gives no job, with a recommendation per
tool. The owner answered "All as recommended" (15 November 2026). That answer is the yes for
the uninstalls below and for nothing else. An uninstall is one of the stops in the ground
rules; it was asked and answered, and no stop is changed here.

**Removed from this PC and from the Cookbook** (catalog, map, pages, the update check's
tables and the tests that named them):
- Jev Router: the plugin `jev-turn-router` and the `jev-claude` terminal proxy with its shims
  and checkouts. The DPAPI key `jev-compaction` stays: Jev compaction uses it.
- savvy-flow and savvy-progress; be-ambitious and gauntlet-loop; skill-creator-plus;
  claude-reflect and its stray rule file; self-compact-claude; cache-tax and prompt-band.
- The Adobe for creativity connector and plugin: switched off on this PC. The connector
  itself is disconnected in claude.ai's settings, which only the owner can do.
- Files left from tools retired earlier, in `~/.local/bin`, and two marketplaces left
  registered from tools retired earlier.

Kept, and not part of the answer: Stagehand (it waited for the visual check), Adobe Firefly
(the photo route), doctor-plus, and everything else.

**How it was done.** Each item was checked first: no hook, MCP entry, scheduled task, other
plugin, vetting script or update script used it. A copy of every removed file and folder is in
`~/.local/share/backups/cleanup-20261115/`. Gitleaks scanned it: 29 matches, every one in a
test file of two public upstream clones (caveman, claude-reflect), none in a file of the
owner's; the two retired `.exe` files were too large to scan.

**One thing did depend on a removed tool.** The daily update check proved that Jev answers by
reading the Jev Router's decision log. It now reads the Jev compaction plugin's log
(`jev-compaction-decisions.jsonl`): a `kind: "compact"` row with the outcome `jev` inside 48
hours is the proof. Without one, Jev is reported "unchecked", never "working", as before.
The check is not looser: the old log had held no answer since 9 November, because the router
skipped every T3 Code session. A trial run (`updates.mjs run --state`, 15 November) reports
Jev as working again and nothing new as missing or unlisted.

**Checked afterwards.** `claude plugin list` shows none of the removed plugins; a new session's
tool, skill and command lists name none of them; that session wrote a Jev compaction `load`
line and `ctx_resume` answered in it; `npm test` passes.

**Pages.** `recipes/add-ons.md` keeps doctor-plus and the rule against blast-radius;
`add-ons-mods.md`, `jev-router.md`, `jev-router-terminal.md` and `photos-adobe-connector.md`
are deleted. The map row "The model for a session or a piece" has no fallback and no page.

**Outstanding** is carried in the newest entry. Still true from this entry: "Adobe for
creativity" is blocked in terminal and T3 Code sessions only (`claude.ai Adobe` is in
`deniedMcpServers` in `~/.claude/settings.json` and the synced plugin is disabled; a new
headless `claude -p` session on 15 November listed it as blocked). The desktop app ignores
`deniedMcpServers` for the connectors it delivers, so a desktop session still loads its
tools. The upload gate in `recipes/photos.md` covers them: no photo goes to Adobe by any
route without the owner's yes.

## 15 November 2026: the map and the recipe split (0.29.0)

**Merged and verified.** Pull request #51, merge commit `74f676c`. The release check of that
commit is `verified` (execution 1509). The owner gave two answers that day: merge #51 without
the release-notes filter, and "All as recommended" on the tools without a job (the entry
above).

**What changed.** The `cookbook` skill's `SKILL.md` went from 94,928 to about 11,000 bytes. It
now holds the map (every job, one owner, one fallback, the recipe page) and the ground rules.
Each recipe is a page in `plugins/cookbook/skills/cookbook/recipes/`, read when its
job comes up; `options/` (5 pages) holds why each owner was chosen and what else was weighed.
`scripts/check.mjs` checks the map, every link, that no page is orphaned, and that a page fits
one `Read`. The update reader (`updates.mjs`) takes a tool's recipe from the pages
(`recipeText`): only the recipe's main page goes into the read request, fenced as data with a
hash of its own; setup and evidence pages (this PC's paths and key names) stay out.

**Why pages are small.** context-mode cuts any tool result over 4,096 bytes (measured: 4,105
was cut). A page is limited to 4,000 bytes as a `Read` result; a recipe's further pages are
named `<recipe>-<part>.md`. The Skill tool is not cut, which is why `SKILL.md` loads whole.

**Checked on this PC, and written into the map.**
- Compaction: Jev compaction (`fast-jev-compaction-atlas`) compacts, in T3 Code too: 40
  compactions from 7 to 14 November, 32 by Jev and 8 by the built-in compactor (6 errors, 2
  below the minimum). Log: `~/.claude/vendor/compaction/state/jev-compaction-decisions.jsonl`.
- Schedulers: Windows Task Scheduler runs plain scripts (`stack-updates-daily`); T3 Code
  scheduled tasks own agent runs (a `once` probe ran in its own thread and answered in 25
  seconds; the task, its worktree and branch are removed); three Claude Desktop tasks still
  run there and move when next touched.
- tstack against the `sa-*` route: the comparison is not in Stack-Atlas's `HANDOFF.md`, so the
  map row says "decided after the comparison"; `sa-release` owns the step until then.

**The owner's decision this follows** (15 November 2026, the owner's global rules, section
"How we work: the owner sets the outcome, Claude ships it", quoted): "Do not ask for approval
of a spec, a plan, a design option, a merge or a deploy. Ask a question only when the outcome
itself is unclear." and "Where a project file still asks for a yes before a spec, plan, design
choice, merge or deploy, this rule wins; correct that file in the next pull request to that
repository." This pull request is that correction for the Cookbook. The live-site stop is
worded wider than before (any host, not only Wix and Shopify).

**Aligned with "How we work" (owner, 15 November 2026).** The ground rules, the workflow
stops, the Cloudflare deploy line and the design-approval lines now say what the global rules
say: no approval for a spec, plan, design, merge or deploy; the stops stay. A security finding
is fixed or goes to the owner; "answered" never clears one.
