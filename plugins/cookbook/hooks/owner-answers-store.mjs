// Where the owner-answers hooks keep their list (recipes/parallel-chats.md): one folder on
// this PC, outside every repository and outside ~/.claude. The hook and the command share it.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WINDOW_MS, parseLedger, repoLabel } from "./owner-answers-lib.mjs";

const LEDGER_LIMIT = 1_000_000; // bytes; past it, entries older than the window are dropped

export function openStore(env = process.env) {
  const dir = env.OWNER_ANSWERS_DIR || join(homedir(), ".local", "share", "claude-cookbook", "owner-answers");
  const ledger = join(dir, "ledger.jsonl");
  const stateFile = (session) => join(dir, "sessions", `${createHash("sha256").update(session).digest("hex").slice(0, 24)}.json`);
  const read = (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch (e) {
      if (e?.code === "ENOENT") return "";
      throw e;
    }
  };
  return {
    dir,
    readLedger: () => read(ledger),
    append(entries) {
      mkdirSync(dir, { recursive: true });
      appendFileSync(ledger, entries.map((e) => `${JSON.stringify(e)}\n`).join(""));
      if (statSync(ledger).size > LEDGER_LIMIT) {
        const keep = parseLedger(read(ledger)).filter((e) => Date.now() - e.at <= WINDOW_MS);
        // A file of this process's own, then one rename. A line another chat appends in
        // between is lost: one answer shown a little less, never a broken file.
        const own = `${ledger}.${process.pid}.tmp`;
        writeFileSync(own, keep.map((e) => `${JSON.stringify(e)}\n`).join(""));
        renameSync(own, ledger);
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
      writeFileSync(stateFile(session), JSON.stringify(state));
    },
    // The repository a chat works in, from its checkout's remote; "" when there is none.
    repo(cwd) {
      if (!cwd) return "";
      const r = spawnSync("git", ["-C", cwd, "remote", "get-url", "origin"], { encoding: "utf8", timeout: 3000, windowsHide: true });
      return r.status === 0 ? repoLabel(r.stdout) : "";
    },
    log(line) {
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, "log.jsonl"), `${JSON.stringify(line)}\n`);
    },
  };
}
