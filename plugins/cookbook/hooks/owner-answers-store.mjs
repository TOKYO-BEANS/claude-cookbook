// Where the owner-answers hooks keep their list (recipes/parallel-chats.md): one folder on
// this PC, outside every repository and outside ~/.claude. The hook and the command share it.
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { WINDOW_MS, parseLedger, repoLabel } from "./owner-answers-lib.mjs";

const LEDGER_LIMIT = 1_000_000; // bytes
const KEEP_AT_MOST = 3000; // records
const LOCK_WAIT_MS = 1500; // how long a chat waits for another chat's turn at the list
const LOCK_STALE_MS = 10_000; // a lock this old was left by a hook that died

// The URL of `origin` for the checkout a folder is in, read from the files git keeps: no
// program is started, so it works with the short PATH a hook gets. "" when there is none.
export function originUrl(cwd) {
  try {
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
        let gitDir = dot;
        if (kind.isFile()) {
          // A worktree: ".git" is a file that names its folder, which names the shared one.
          const named = /^gitdir:\s*(.+)$/m.exec(readFileSync(dot, "utf8").slice(0, 4000));
          if (!named) return "";
          gitDir = resolve(dir, named[1].trim());
          try {
            const common = readFileSync(join(gitDir, "commondir"), "utf8").trim();
            if (common) gitDir = resolve(gitDir, common);
          } catch {
            // not a worktree folder: the named folder holds the config itself
          }
        }
        const lines = readFileSync(join(gitDir, "config"), "utf8").slice(0, 200_000).split(/\r?\n/);
        let inOrigin = false;
        for (const raw of lines) {
          const line = raw.trim();
          if (line.startsWith("[")) inOrigin = line === '[remote "origin"]';
          else if (inOrigin && line.startsWith("url")) {
            const at = line.indexOf("=");
            if (at > 0 && line.slice(0, at).trim() === "url") return line.slice(at + 1).trim();
          }
        }
        return "";
      }
      const up = dirname(dir);
      if (up === dir) return "";
      dir = up;
    }
  } catch {
    // unreadable: no repository
  }
  return "";
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
    writeFileSync(own, text);
    renameSync(own, path);
  };
  return {
    dir,
    // One chat at a time reads the list, decides and writes: two chats that ask in the same
    // moment then see each other. A chat never waits long and never fails for the lock: when
    // it cannot have it, it goes ahead without, and leaves the file's upkeep to the next one.
    locked(fn) {
      mkdirSync(dir, { recursive: true });
      const until = Date.now() + lockWaitMs;
      let fd = null;
      while (fd === null) {
        try {
          fd = openSync(lock, "wx");
        } catch (e) {
          if (e?.code !== "EEXIST") break;
          try {
            if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) unlinkSync(lock);
          } catch {
            // gone in the meantime: try again
          }
          if (Date.now() >= until) break;
          pause(25);
        }
      }
      held = fd !== null;
      try {
        return fn();
      } finally {
        if (fd !== null) {
          held = false;
          closeSync(fd);
          try {
            unlinkSync(lock);
          } catch {
            // already removed as stale
          }
        }
      }
    },
    readLedger: () => read(ledger),
    append(entries) {
      mkdirSync(dir, { recursive: true });
      appendFileSync(ledger, entries.map((e) => `${JSON.stringify(e)}\n`).join(""));
      if (!held) return; // the file is rewritten only by the chat that holds the lock
      // A record leaves the file when it is past the window: the first line is the oldest,
      // so one look at it says whether anything is due.
      const text = read(ledger);
      let oldest = 0; // a first line that cannot be read is dropped by the rewrite
      try {
        oldest = Number(JSON.parse(text.slice(0, text.indexOf("\n"))).at) || 0;
      } catch {
        oldest = 0;
      }
      if (Date.now() - oldest > WINDOW_MS || text.length > LEDGER_LIMIT) {
        const keep = parseLedger(text).filter((e) => Date.now() - e.at <= WINDOW_MS).sort((a, b) => a.at - b.at).slice(-KEEP_AT_MOST);
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
      mkdirSync(join(dir, "sessions"), { recursive: true });
      replace(stateFile(session), JSON.stringify(state));
    },
    // The repository a chat works in, from its checkout's remote; "" when there is none.
    repo: (cwd) => (cwd ? repoLabel(originUrl(cwd)) : ""),
    log(line) {
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, "log.jsonl"), `${JSON.stringify(line)}\n`);
    },
  };
}
