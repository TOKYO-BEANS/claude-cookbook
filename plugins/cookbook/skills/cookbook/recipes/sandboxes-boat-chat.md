# Whole Claude chats on boat

A standing route since 27 November 2026: a trial that day, kept the same day (owner, question
dialog, "option 2"): "not all threads have to start there, some makes more sense than others
and sometimes it also makes sense if we are limited on compute and even before we get limited
on compute so the pc actually never has to throttle again". Why: a local chat takes 0.3 to
4 GB of this laptop with its children; a chat on boat takes one `ssh` forward here (6 MB).

- **What it is:** a T3 Code server in a boat sandbox, reached through `boat forward` and
  linked to this T3 as an environment. A thread launched there is a whole T3 chat: Claude
  Code runs in the sandbox on the owner's subscription through boat's AI credentials proxy,
  which gives the sandbox placeholder keys only; the plan token never enters it (unlike
  [Depot](sandboxes-claude.md)). Opus 5.5 at high effort.
- **Money:** boat's plan renews monthly (USD 20, next 16 December 2026); the proxy is USD 1
  a day while on (turning it on again the same day adds nothing, seen 27 November) plus USD 1
  per 1,000 requests, from the wallet. Both are inside the owner's yes. A top-up, a larger
  plan or a size above `default` stops for the owner; `up` says a wallet under USD 5 aloud.

## Which chats start on boat

- **Fits boat:** long, self-contained work in one of our own repositories (a build, a
  refactor, a test-and-fix loop, a review round) that needs nothing of this laptop: no key
  from the key store, no display or desktop app, no MCP server that only runs here, no
  sign-in of the owner's, no device. The sandbox has no GitHub login (giving it one is an
  access change): the chat commits there, `pull` brings the work back, and the pull request
  is opened here.
- **Stays here:** a chat that needs any of those; a short job (minutes); work on the owner's
  mail, photos or files; anything that sends, publishes or changes a live site; a customer's
  data; a chat the owner is steering turn by turn.
- **When:** a fitting chat starts on boat when it is long or when the laptop nears its limits;
  a short fitting chat stays here while the laptop has room.

## Offload before the laptop runs short

- `node <this skill's folder>/scripts/boat-chat.mjs where` prints `boat` or `local` and why,
  from Linux's own counters (`laptop-load-lib.mjs` in the plugin's hooks). The laptop is
  *near* at any one of: memory available under 25% of RAM (room for one more local chat);
  swap 90% used with memory available under 35%; memory pressure (some, one minute) 5% or
  more; CPU pressure 30% or more; load one per CPU or more.
- **The launch hook asks it for you.** Before `t3_thread_launch` or `create_threads` starts a
  chat here (no `environmentId`), the `owner-answers` hook reads the load; when near, it stops
  the call once (ten minutes) with the reasons: a fitting chat then goes to boat, the rest
  repeat the call. A launch that names an environment is not read.
- **A chat the owner started here** that fits boat, while the laptop is near: hand the job
  to a boat chat with a full brief (`up`, then `t3_thread_launch` there), give the owner its
  link, and settle this one.

## Bring a chat up, and down

- `node <this skill's folder>/scripts/boat-chat.mjs up <repository folder> [--hours 4]
  [--type small|default] [--push]` (about 10 s on a stopped sandbox, 30 s new): proxy on;
  the recorded sandbox resumed, or a new one (`small`, environment `claude-proxy`); T3 at
  this laptop's version (npm `--before` 24 hours ago) and `linkedEnvironmentsEnabled`; the
  repository pushed to `/home/user/<name>` when it is not there, as `sandbox-run.mjs` uploads
  one (on the upload list, the files git tracks with their edits, no unnamed data-shaped
  file, Gitleaks clean; a finding goes to the owner), as a git repository with one base
  commit (`--push` copies it again, only over a copy with nothing unpulled); `t3 serve` on 127.0.0.1:3773, restarted after a resume;
  `boat forward` to 127.0.0.1:13773; the link, kept or paired again. It prints the
  `environmentId` and the path. Then `t3_project_create` (that environment, that path; the
  default model is set afterwards with `t3_project_update`) and `t3_thread_launch` with
  model `claude-opus-5-5`, effort high. A second repository: `up` again; one sandbox holds
  several chats (a `small` one has 4 GB; one chat left 2.4 GB free).
- `boat-chat.mjs pull <repository folder> [--apply]`: everything the chat changed since the
  last pull (or the base commit), committed or not, as one patch in
  `~/.local/share/boat-chat/patches/`. Gitleaks reads it first (a finding: exit 4, nothing
  applied, the same changes come back next time, the owner decides); `git apply --check`
  tries it here; `--apply` applies it to a folder with no changes of its own.
  Then review, commit and ship from here as usual (a branch or worktree of the job's own).
- `boat-chat.mjs down [--delete]` when the last boat chat has settled and been pulled: the forward and its
  `ssh` ended, the sandbox stopped (data and memory kept 14 days; `up` resumes it), the proxy
  off when no `claude-proxy` sandbox runs. `--delete` deletes the sandbox and unlinks it, only
  when it runs and no copy holds unpulled changes (the work lives only there); `--discard`
  deletes anyway, and only on the owner's word for that work.
- `boat-chat.mjs status`: the load, the sandbox, the proxy, the forward, the link, the wallet.
  State: `~/.local/share/boat-chat/state.json` (the sandbox's id and repositories).
- The sandbox stops itself after `--hours`; a chat still working there stops with it and
  goes on after `up`. A long job: `up --hours 8`.

## What the script keeps right (the traps of 27 November)

- At resume the proxy's placeholder changes: `t3 serve` is restarted, or the chat gets 401
  ("This placeholder credential is not valid any more"). The thread keeps its context.
- `t3 serve` binds 127.0.0.1 (the sandbox's inbound is open) and its log is never read: it
  prints a pairing QR at start.
- The pairing credential (`t3 auth pairing create --ttl 5m`) goes to `t3 environment link
  --from -` on stdin, never on a command line or in output.
- Killing `boat forward` leaves its `ssh` child holding the port: both are ended.
- boat calls a running sandbox with nothing to do `idle`: it counts as running (a first
  version took it for gone and made a second sandbox).
- A T3 server refuses a link until `linkedEnvironmentsEnabled` is set. A new sandbox gets a
  new link; the old one at that address is unlinked first. A resumed one keeps its
  `environmentId`.
- By hand, when the script fails: its steps in order (`up` in `boat-chat.mjs`); `boat exec`
  ends at 30 s unless `--timeout`.

## Numbers (27 November 2026, `small`, the Cookbook)

- Six turns of real work and the full suite (797 passed): 23 proxied requests (USD 0.023),
  355 plan seconds (USD 0.0036 of the plan), the proxy's day USD 1. In the sandbox the T3
  server took 441 MB, Claude Code 253 MB; 2.4 GB of 4 GB stayed free.
- A chat hour: the machine is inside the plan (552 hours of `default` left that day, twice
  that of `small`); the proxy about 440 requests an hour of the model working (USD 0.44),
  nothing while the chat waits. A day with 3 hours of the model working: about USD 2.3.
  [The comparison](../options/sandboxes.md).
- Simpler shape, no T3: `boat prompt <id> --provider claude --model opus-5-5
  --reasoning-effort high "<prompt>"`, then `--resume <conversation>` (50 MB here).
