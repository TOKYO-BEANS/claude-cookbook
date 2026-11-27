// Where the owner-answers hooks keep their list (recipes/parallel-chats.md): one folder on
// this PC, outside every repository and outside ~/.claude. It holds notes that a dialog was
// shown (ids and times), never a question or an answer.
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, chmodSync, closeSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { laptopLoad } from "./laptop-load-lib.mjs";
import { CLOCK_SLACK_MS, WINDOW_MS, parseLedger, repoLabel } from "./owner-answers-lib.mjs";

const LEDGER_LIMIT = 1_000_000; // bytes
const KEEP_AT_MOST = 3000; // records
const LOCK_WAIT_MS = 1500; // how long a chat waits for another chat's turn at the list
const LOCK_STALE_MS = 10_000; // a lock this old was left by a hook that died
const STATE_KEEP_MS = 7 * 24 * 3_600_000;

// The two folders git keeps for the checkout a folder is in: `own` (this checkout's HEAD)
// and `shared` (the config and origin's refs; the same folder outside a worktree). They are
// found by reading files: no program is started, so it works with the short PATH a hook
// gets. A folder that does not exist yet counts as its parent's. null when there is none.
function gitFolders(cwd) {
  let dir = resolve(cwd);
  for (let i = 0; i < 64; i += 1) {
    const dot = join(dir, ".git");
    let kind = null;
    try {
      kind = statSync(dot);
    } catch {
      kind = null;
    }
    if (kind) {
      if (!kind.isFile()) return { own: dot, shared: dot };
      // A worktree: ".git" is a file that names its folder, which names the shared one.
      const named = /^gitdir:\s*(.+)$/m.exec(readFileSync(dot, "utf8").slice(0, 4000));
      if (!named) return null;
      const own = resolve(dir, named[1].trim());
      try {
        const common = readFileSync(join(own, "commondir"), "utf8").trim();
        if (common) return { own, shared: resolve(own, common) };
      } catch {
        // not a worktree folder: the named folder holds the config itself
      }
      return { own, shared: own };
    }
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return null;
}

// The URL of `origin` for the checkout a folder is in; "" when there is none.
export function originUrl(cwd) {
  try {
    const git = gitFolders(cwd);
    if (!git) return "";
    const lines = readFileSync(join(git.shared, "config"), "utf8").slice(0, 200_000).split(/\r?\n/);
    let inOrigin = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("[")) inOrigin = line === '[remote "origin"]';
      else if (inOrigin && line.startsWith("url")) {
        const at = line.indexOf("=");
        if (at > 0 && line.slice(0, at).trim() === "url") return line.slice(at + 1).trim();
      }
    }
  } catch {
    // unreadable: no repository
  }
  return "";
}

// Whether the checkout a folder is in has the default branch checked out: its HEAD against
// the branch origin's HEAD names, or against "main" and "master" where the clone holds no
// record of origin's. A detached HEAD is no branch. The answer is yes or no: a branch's
// name is text anyone can choose, and it goes no further than this function.
export function onDefaultBranch(cwd) {
  try {
    const git = gitFolders(cwd);
    if (!git) return false;
    const ref = (path, prefix) => {
      const line = readFileSync(path, "utf8").slice(0, 1000).split(/\r?\n/)[0];
      return line.startsWith(`ref: ${prefix}`) ? line.slice(`ref: ${prefix}`.length).trim() : "";
    };
    const branch = ref(join(git.own, "HEAD"), "refs/heads/");
    if (!branch) return false;
    let origin = "";
    try {
      origin = ref(join(git.shared, "refs", "remotes", "origin", "HEAD"), "refs/remotes/origin/");
    } catch {
      origin = "";
    }
    return origin ? branch === origin : branch === "main" || branch === "master";
  } catch {
    return false;
  }
}

// The folder and every file in it are the owner's alone, whatever the system's default is:
// the notes name repositories and chats. (Windows keeps its own access lists and ignores
// these modes; the folder there is inside the owner's profile.)
const OWNER_FOLDER = 0o700;
const OWNER_FILE = 0o600;
function ownFolder(path) {
  mkdirSync(path, { recursive: true, mode: OWNER_FOLDER });
  try {
    chmodSync(path, OWNER_FOLDER); // a folder that was already there keeps its old mode otherwise
  } catch {
    // not ours to change: the files inside are still created for the owner alone
  }
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function openStore(env = process.env, { lockWaitMs = LOCK_WAIT_MS } = {}) {
  const dir = env.OWNER_ANSWERS_DIR || join(homedir(), ".local", "share", "claude-cookbook", "owner-answers");
  const ledger = join(dir, "ledger.jsonl");
  const lock = join(dir, "ledger.lock");
  const stateFile = (session) => join(dir, "sessions", `${createHash("sha256").update(session).digest("hex").slice(0, 24)}.json`);
  let held = false;
  const read = (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch (e) {
      if (e?.code === "ENOENT") return "";
      throw e;
    }
  };
  // One file of this process's own, then one rename: a reader sees the old file or the new
  // one, never half of either.
  const replace = (path, text) => {
    const own = `${path}.${process.pid}.tmp`;
    writeFileSync(own, text, { mode: OWNER_FILE });
    renameSync(own, path);
  };
  return {
    dir,
    // One chat at a time reads the list, decides and writes: two chats that ask in the same
    // moment then see each other. A chat never waits long and never fails for the lock: when
    // it cannot have it, it goes ahead without, and leaves the file's upkeep to the next one.
    locked(fn) {
      ownFolder(dir);
      const until = Date.now() + lockWaitMs;
      // The lock holds a mark of its own, so a chat removes only the lock it took.
      const mark = `${process.pid}.${randomBytes(8).toString("hex")}`;
      let fd = null;
      while (fd === null) {
        try {
          fd = openSync(lock, "wx", OWNER_FILE);
        } catch (e) {
          if (e?.code !== "EEXIST") break;
          try {
            // A lock left by a hook that died is moved aside under a name of this chat's own,
            // then removed: of two chats that see it, one moves it and the other finds it gone.
            if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
              const aside = `${lock}.${mark}.stale`;
              renameSync(lock, aside);
              unlinkSync(aside);
            }
          } catch {
            // gone in the meantime: try again
          }
          if (Date.now() >= until) break;
          pause(25);
        }
      }
      // Each step of taking and giving back the lock stands alone: one that fails never
      // leaves a lock behind that this chat could have removed.
      const close = () => {
        try {
          closeSync(fd);
        } catch {
          // closed or unusable: the file is still removed below
        }
      };
      if (fd !== null) {
        try {
          writeSync(fd, mark);
        } catch {
          // A lock without its mark could never be given back: drop it and go ahead without.
          close();
          try {
            unlinkSync(lock);
          } catch {
            // already gone
          }
          fd = null;
        }
      }
      held = fd !== null;
      try {
        return fn();
      } finally {
        if (fd !== null) {
          held = false;
          close();
          try {
            if (readFileSync(lock, "utf8") === mark) unlinkSync(lock);
          } catch {
            // taken away as stale: the lock there now is another chat's
          }
        }
      }
    },
    readLedger: () => read(ledger),
    append(entries) {
      ownFolder(dir);
      appendFileSync(ledger, entries.map((e) => `${JSON.stringify(e)}\n`).join(""), { mode: OWNER_FILE });
      if (!held) return; // the file is rewritten only by the chat that holds the lock
      // A note leaves the file at the first write after it is past the window, and one dated
      // in the future with it. Every note is looked at, wherever it stands in the file, so no
      // line can hold the others back. The rewrite also drops every line that is no note.
      const text = read(ledger);
      const now = Date.now();
      const fresh = (e) => now - e.at <= WINDOW_MS && e.at <= now + CLOCK_SLACK_MS;
      const notes = parseLedger(text);
      if (notes.some((e) => !fresh(e)) || text.length > LEDGER_LIMIT) {
        const keep = notes.filter(fresh).sort((a, b) => a.at - b.at).slice(-KEEP_AT_MOST);
        replace(ledger, keep.map((e) => `${JSON.stringify(e)}\n`).join(""));
      }
    },
    readState(session) {
      const text = read(stateFile(session));
      try {
        const v = text ? JSON.parse(text) : {};
        return v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
      } catch {
        return {};
      }
    },
    writeState(session, state) {
      const folder = join(dir, "sessions");
      ownFolder(dir);
      ownFolder(folder);
      replace(stateFile(session), JSON.stringify(state));
      // A chat's state is of no use once its chat is long over: files untouched for a week go.
      try {
        for (const name of readdirSync(folder).slice(0, 5000)) {
          const file = join(folder, name);
          if (Date.now() - statSync(file).mtimeMs > STATE_KEEP_MS) unlinkSync(file);
        }
      } catch {
        // another chat removed it first, or it cannot be read: nothing depends on this
      }
    },
    // The repository a chat works in, from its checkout's remote; "" when there is none.
    repo: (cwd) => (cwd ? repoLabel(originUrl(cwd)) : ""),
    // The checkout a file is in (a path from `cwd` when it is not a whole one): its
    // repository, and whether the default branch is checked out there.
    checkout(cwd, file) {
      if (!file) return { repo: "", onDefault: false };
      const folder = dirname(resolve(cwd || ".", file));
      const repo = repoLabel(originUrl(folder));
      return { repo, onDefault: repo ? onDefaultBranch(folder) : false };
    },
    // How close this laptop is to its limits (laptop-load-lib.mjs); read before a launch here.
    laptopLoad: () => laptopLoad(),
    log(line) {
      ownFolder(dir);
      appendFileSync(join(dir, "log.jsonl"), `${JSON.stringify(line)}\n`, { mode: OWNER_FILE });
    },
  };
}
