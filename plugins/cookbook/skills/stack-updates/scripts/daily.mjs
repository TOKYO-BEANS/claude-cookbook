#!/usr/bin/env node
// The launcher the Windows task "stack-updates-daily" runs. No model takes part.
//
// A copy of this file lives at ~/.local/bin/stack-updates-daily.mjs, a path that does
// not change when the plugin updates. It imports nothing from the plugin: it finds the
// Cookbook plugin installed for this user, refuses a folder outside ~/.claude/plugins,
// and runs that copy's `updates.mjs run --unattended`. It writes daily.json (when it
// ran and how it ended) and daily.log (the error lines of the last run) in the state
// folder. The report stays in runs/<date>/; the session-start notice announces it.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const PLUGIN_ID = "cookbook@claude-cookbook";
export const RUN_TIMEOUT_MS = 90 * 60_000; // a backstop: every call the check makes has its own, shorter limit
const LOG_LIMIT = 200_000;

const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The installed plugin's updates.mjs. Throws when the plugin is missing, or when its folder or the script itself (through a link) is not inside ~/.claude/plugins. */
export function resolveScript(home) {
  const base = join(home, ".claude", "plugins");
  const registry = JSON.parse(readFileSync(join(base, "installed_plugins.json"), "utf8"));
  const entries = registry?.plugins?.[PLUGIN_ID];
  const entry = Array.isArray(entries) ? entries.find((e) => e && e.scope === "user") : null;
  if (!entry || typeof entry.installPath !== "string" || !entry.installPath) throw new Error(`${PLUGIN_ID} is not installed for this user`);
  const root = realpathSync(base);
  const inside = (p) => {
    const rel = relative(root, p);
    return Boolean(rel) && !rel.startsWith("..") && !isAbsolute(rel);
  };
  const folder = realpathSync(entry.installPath);
  if (!inside(folder)) throw new Error(`the folder of ${PLUGIN_ID} is outside ${root}`);
  // The script and its lib folder, after every link on the way is resolved.
  const scripts = realpathSync(join(folder, "skills", "stack-updates", "scripts"));
  const script = realpathSync(join(scripts, "updates.mjs"));
  const lib = realpathSync(join(scripts, "lib"));
  if (![scripts, script, lib].every(inside)) throw new Error(`the update check of ${PLUGIN_ID} is outside ${root}`);
  return script;
}

// Stops a process and everything it started. On Windows a plain kill ends only the
// process itself and leaves its children (gh, claude -p) running.
function stopTree(child) {
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else child.kill("SIGKILL");
}

/**
 * Runs one command and waits for it: `{ status, stderr, pid, timedOut, error }`.
 * Only stderr is kept. After `timeoutMs` the whole process tree is stopped.
 */
export function runChild(command, args, { cwd, timeoutMs }) {
  return new Promise((done) => {
    let child, stderr = "", timedOut = false, settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done({ stderr, pid: child?.pid ?? null, timedOut, ...r });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        stopTree(child);
      } catch {
        // the close event still ends the wait
      }
    }, timeoutMs);
    try {
      child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    } catch (e) {
      finish({ status: null, error: e });
      return;
    }
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d) => {
      if (stderr.length < LOG_LIMIT) stderr += d;
    });
    child.on("error", (e) => finish({ status: null, error: e }));
    child.on("close", (code) => finish({ status: code }));
  });
}

/** Runs the check once. `deps` (for tests): `home`, `now`, `run` (runChild's shape). Returns the exit code. */
export async function daily(deps = {}) {
  const home = deps.home ?? homedir();
  const now = deps.now ?? new Date();
  const run = deps.run ?? runChild;
  const stateDir = join(home, ".local", "share", "stack-updates");
  let exit = 1, log = "";
  try {
    const script = resolveScript(home);
    const r = await run(process.execPath, [script, "run", "--unattended"], { cwd: home, timeoutMs: RUN_TIMEOUT_MS });
    if (r.error) log = `updates.mjs did not start: ${r.error.message}\n`;
    exit = Number.isInteger(r.status) ? r.status : 1;
    // Only the error lines are kept: what the run printed is the report, and that is in runs/<date>/.
    log += typeof r.stderr === "string" ? r.stderr : "";
    if (r.timedOut) {
      exit = exit === 0 ? 1 : exit;
      log += `updates.mjs was stopped after ${Math.round(RUN_TIMEOUT_MS / 60_000)} minutes\n`;
      // A stopped run cannot remove its own lock: remove it here, and only when it is that run's.
      try {
        const lock = join(stateDir, "run.lock");
        if (Number.isInteger(r.pid) && JSON.parse(readFileSync(lock, "utf8")).pid === r.pid) unlinkSync(lock);
      } catch {
        // no lock, or another run's
      }
    }
  } catch (e) {
    log = `${e instanceof Error ? e.message : String(e)}\n`;
  }
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, "daily.log"), log.slice(0, LOG_LIMIT));
    writeFileSync(join(stateDir, "daily.json"), `${JSON.stringify({ day: localDate(now), started: now.toISOString(), finished: new Date().toISOString(), exit })}\n`);
  } catch {
    // the exit code still says how the run ended
  }
  return exit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await daily();
