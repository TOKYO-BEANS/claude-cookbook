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
- **What it shows.** That it is a real run; each file by name and folder; every Adobe tool
  the session may call (marked read-only or not); the yes as the child session will get it;
  the credits that yes states. Only ASCII, Latin letters and punctuation show as they are:
  any other character is written out as its code (`<U+202E>`), so text that does not show
  or that turns a line around cannot hide.
- **How it ends.** Only a click of the mouse on "Go ahead" starts the run: no key presses
  that button, and it is off for the first two seconds. "Stop" (it has the focus and takes
  Enter and Esc), a closed window, five minutes without a click, or no window at all (not
  Windows, no desktop, the window's file `adobe-window.ps1` missing or broken) ends the run
  with exit code 2: nothing is copied and no session starts.
- **Nothing skips it.** No flag and no environment variable; no file switches it off, and
  nothing is remembered: a click is for the one run that asked. A run that needs the
  window while nobody is at the screen therefore ends with exit code 2.
- **Before a run.** Tell the owner that the window is coming and what it will list, and
  give the command more time than five minutes plus the run's `--minutes`: a command that
  is ended while the window waits leaves a window whose click does nothing. `--dry-run`
  opens none and prints, under `window`, whether a real run would and the text it would
  show (it does not make the checks of the folders). `node <skill
  folder>/scripts/adobe-session.mjs window` shows the window alone, with sample text, and
  starts nothing; tell the owner first there too. Its button is "It works (trial)": "Go
  ahead" is on a real run's window only, so never ask the owner to click "Go ahead" as a
  test.
- **What it does not stop.** It is a second channel, independent of the text an agent
  writes, not a proof of who clicked. An agent that controls the desktop (computer use, a
  program that sends clicks to a window) can click it. An agent that can change the script
  or `adobe-window.ps1` can change what they do. An agent with a shell can start a session
  of its own without the script. And an agent can ask the owner to click. The gate stays
  the owner's yes in the chat ([photos.md](photos.md)): the window lets the owner see a
  yes they did not give.
