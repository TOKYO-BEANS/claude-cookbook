# Daily update check: routine updates and the catalog

- **Routine updates are installed without asking** (owner, 14 November 2026); every other update
  needs the owner's yes, one tool at a time. The script decides which are routine, by fixed rules
  (`scripts/lib/apply.mjs`): a plugin, a pinned copy or a listed pinned binary (a skill copy and a
  local port always need a yes); a version step that can be read, with no major version; notes
  read in full with no warning word (break, deprecate, remove, dropped support, "no longer",
  incompatible, migration); with no notes, a patch release only; a 0.y.z version read one step up;
  seen for 3 days; no failed attempt at that version; at most 5 a day. Whatever cannot be read
  counts against the update. An interactive session installs them by each tool's recipe after
  giving the owner the report, then runs `updates.mjs verify <part>`: the script refuses a part it
  did not list, and counts an install only when its own read of the disk shows exactly the listed
  version and the service's check passes. An update made on the owner's yes is verified with
  `--owner-yes <version>`, the version the owner agreed to. The 07:00 task and unattended sessions install nothing, and a release note never
  decides an update. The skill has the steps.
- **The catalog side:** each tool's `parts` name how the installed version is read (`installed`)
  and where releases appear (`feed`). An npm feed carries no release notes: they come from the
  part's `notes` (a GitHub repository whose releases carry its versions), else the tool's
  `repository`; with neither, a change says "No release notes found." Commands live only in the fixed tables of
  `skills/stack-updates/scripts/lib/tables.mjs`, and a `changelog` page's host must be on the allow
  list there. A `changelog` feed follows only a hosted (or not installed) part: a page hash cannot
  say an installed version is behind. Something on the PC that the catalog does not name shows under "Not in the Cookbook"
  until it is added to the catalog or to `ignored`.
- Proven on 13 and 14 November 2026 on a trial state: 79 parts checked in about 45 s, 48 with a
  readable version, none unreadable, 15 already behind; one real read (GitHub CLI 2.104.0: 3,488 input and 238 output tokens, no
  tools, on the plan). A Windows task on this PC sees Node, a signed-in `gh`, `claude`, the DPAPI
  key store and no API key in its environment (probe task, 14 November 2026).
