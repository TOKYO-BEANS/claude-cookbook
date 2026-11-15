# Claude Code add-ons: mods

- **Save a correction as a rule (claude-reflect)**: the reflect-mod row above the prompt offers a
  rule it found. Press "Save to ./CLAUDE.md" only in a `.claude/worktrees` session, so the change
  goes through a pull request. Never press "Global instead": HOME is unset on this PC, so it writes
  `C:\.claude\CLAUDE.md`. `/reflect-pause` stops its model checks. It does the job auto-memory
  already does: its one save so far (14 November 2026) went to that file, which nothing reads.
- **Prompt cache (cache-tax)**: the guard is warn (set once with `/cache-tax guard warn`).
  `/keepwarm 90m` holds the cache through a break and `/keepwarm off` stops it. Never run
  `/keepwarm always`: it is global and warms every session, headless ones included. Warming
  spends tokens.
- **The band above the prompt (prompt-band)**: a limits row (7-day and 5-hour usage, cache warm or
  cold) and a session row (turn, speed, cost, context). Other mods' rows show beneath it.
  `/prompt-band hide`, `show` or `status`. Its cache-expiry notification stays off unless its
  `notify` option is set to `on`.
- Updates: cache-tax and prompt-band are pinned copies in the local `claude-local` marketplace
  (`~/.claude/vendor/compaction/local-marketplace`, each with a PROVENANCE.json). Refresh one only
  after reading the upstream diff. The skills are plain copies in `~/.claude/skills`. For the
  claude-reflect and claude-kit marketplaces, read the new commit before running
  `claude plugin update`.
- Do not install blast-radius (anthropics/claude-code-playground). On Windows it refuses every risky
  Bash command at once, because `sleep` and `du` are not on the PATH and `bash` is the WSL launcher.
  It also does not watch PowerShell; use permission deny rules for hard blocks. Do not install
  claude-reflect's Python hooks plugin either: its hooks call the `python3` Store stub, and its
  checks start `claude -p` children with every tool.
