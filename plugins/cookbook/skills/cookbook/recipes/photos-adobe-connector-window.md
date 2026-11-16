# Photos: the Adobe connector's owner window

What `scripts/adobe-session.mjs` asks the owner on screen, and what that is worth. Added on
16 November 2026: the yes in `--owner-yes` is text the calling agent writes, and nothing
independent of that agent showed that the owner said it
([setup](photos-adobe-connector-setup.md)).

- **What the script reads in the yes.** Every file by its whole name, the Adobe account, a
  number of credits (0 is one; the script cannot hold a run to it) and, as a whole word,
  the operation of each tool that is not read-only. It reads words: whether the owner gave
  the yes in this chat is the gate ([photos.md](photos.md)).
- **When.** A run with a `--send` file, or with a tool in `--allow` that is not in the
  script's `READ_ONLY` list. It opens after every other check has passed and before anything
  is copied or started. A read-only run and `tools` open no window.
- **What it shows.** Each file by name and folder, every Adobe tool the session may call
  (marked read-only or not), the yes as the child session will get it, and the credits that
  yes states. A character that does not show, or that turns text around, is written out.
- **How it ends.** Only a click on "Go ahead" starts the run. "Stop", a closed window, five
  minutes without a click, or no window at all (not Windows, no desktop, the window's file
  `adobe-window.ps1` missing) ends it with exit code 2: nothing is copied and no session
  starts. "Stop" has the focus and takes Enter and Esc; "Go ahead" is off for the first two
  seconds, so a key meant for another window starts nothing.
- **Nothing skips it.** No flag, no environment variable, no file. A click is for the one
  run that asked: nothing is remembered. A run that needs the window while nobody is at the
  screen therefore ends with exit code 2.
- **Before a run.** Tell the owner that the window is coming and what it will list.
  `--dry-run` opens none and prints, under `window`, whether a real run would and the text
  it would show. `node <skill folder>/scripts/adobe-session.mjs window` shows the window
  alone, with sample text, and starts nothing: tell the owner first there too.
- **What it does not stop.** It is a second channel, independent of the text an agent
  writes, not a proof of who clicked. An agent that controls the desktop (computer use, a
  program that sends clicks or keys to a window) can click it. An agent with a shell can
  start a session of its own without the script. The gate stays the owner's yes in the chat
  ([photos.md](photos.md)): the window lets the owner see a yes they did not give.
