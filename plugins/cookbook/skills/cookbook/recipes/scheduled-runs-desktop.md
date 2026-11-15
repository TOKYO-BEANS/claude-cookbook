# Scheduled runs: Claude Desktop tasks

Desktop scheduled tasks (probed 2 November 2026 on desktop 4.4212, Claude Code 2.1.309):

- A task's model is the `model:` line in its `~/.claude/scheduled-tasks/<task>/SKILL.md` frontmatter,
  although the docs say the model is not in that file. A full ID such as `claude-sonnet-5-5` works,
  and the line survives `update_scheduled_task`. The project `model` setting does not reach the run.
- Effort cannot be set per task: frontmatter `effort` and `effortLevel` are ignored. A run takes
  `effortLevel` from its folder's settings, else the model's default (Opus 5.5 `xhigh`, Sonnet 5.5 and
  Haiku 5.5 `medium`). Tasks that share a folder share that setting. The run transcript's
  `api-request` entry shows the model and effort actually sent.
- Every `update_scheduled_task` passes `cronExpression` explicitly; re-read the task list afterwards.
- A task whose folder is not trusted never starts and leaves no run, while its `lastRunAt` still
  advances. Compare `lastRunAt` with the newest run in `list_task_runs`.
