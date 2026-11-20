// Run a program with one API key from the key store placed in its environment only. The store
// is the desktop's Secret Service (GNOME Keyring), read with `secret-tool` (package
// libsecret-tools): the item with the attributes service=claude-keys and name=<key name>. It
// is read on Linux only; the Windows store and its PowerShell helper went on 20 November 2026.
// Stdio is inherited, so this works as an MCP stdio server launcher.
//   node with-key.mjs <key-name> <ENV_VAR> <program> [args...]
// It prints no key: the key goes to the program's environment and nowhere else. (The one
// helper that prints a key, for an MCP client's headers helper, is key-header.mjs.)
//
// The launcher ends with the program's own exit code; 128 plus the signal's number when a
// signal ended the program; 127 when the program could not be started; 2 for wrong usage.
// A key that cannot be read does not stop the program: it starts without the variable, and
// one line on stderr says why. That is on purpose: a server started this way has to start
// to be able to answer "no key" (the owner-questions broker does exactly that).
//
// A copy of this file lives at ~/.local/bin/with-key.mjs, the path every caller uses, and
// key-header.mjs, firecrawl-secure.mjs and parallel-secure.mjs beside it import it. Copy
// them again when one changes (recipes/keys.md).
import { execFileSync, spawn } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { constants } from "node:os";
import { fileURLToPath } from "node:url";

// The Secret Service attribute every key item carries, and how long a read may take
// (an unlocked keyring answers in milliseconds; a locked one waits on a prompt).
export const SECRET_SERVICE = "claude-keys";
export const SECRET_TOOL_TIMEOUT_MS = 15000;

const USAGE = "usage: node with-key.mjs <key-name> <ENV_VAR> <program> [args...]\n";

// A failure whose message is ours: it never holds a key or a program's output.
class KeyError extends Error {}

// A key name is lower-case letters, digits and hyphens; anything else is refused before a read.
export function checkName(name) {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(String(name))) throw new KeyError("a key name is lower-case letters, digits and hyphens");
}

// Runs secret-tool (found on PATH) and returns what it printed. Its stderr is captured, never
// shown: only whether it said anything is used, to tell "no such item" from "no keyring".
export function runSecretTool(args, timeoutMs, { env = process.env } = {}) {
  return execFileSync("secret-tool", args, { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"], env });
}

// secret-tool finds the keyring through DBUS_SESSION_BUS_ADDRESS. A client that starts its
// helper with a cleared environment (Codex's http_headers_helper does: PATH, HOME and a few
// more, no D-Bus) leaves it unset, and every read fails. The user's session bus has a fixed
// place under systemd, /run/user/<uid>/bus: when the variable is unset and that path is a
// socket owned by this user, secret-tool is pointed at it. A set variable is left as it is.
export function sessionBusEnv(env, { uid = process.getuid?.(), stat = lstatSync } = {}) {
  if (env.DBUS_SESSION_BUS_ADDRESS || !Number.isInteger(uid)) return env;
  const path = `/run/user/${uid}/bus`;
  let found;
  try { found = stat(path); } catch { return env; }
  if (!found.isSocket() || found.uid !== uid) return env;
  return { ...env, DBUS_SESSION_BUS_ADDRESS: `unix:path=${path}` };
}

// One key from the Secret Service. secret-tool ends with 1 and prints nothing when no
// item matches; it also ends with 1 when it cannot reach a keyring (no D-Bus session, no
// Secret Service, a refused unlock), and then says so on stderr.
function readSecretService(name, run, env) {
  let out;
  try { out = run(["lookup", "service", SECRET_SERVICE, "name", name], SECRET_TOOL_TIMEOUT_MS, { env }); } catch (e) {
    if (e?.code === "ENOENT") throw new KeyError("secret-tool is not installed (package libsecret-tools)");
    if (e?.code === "ETIMEDOUT") throw new KeyError(`the key store did not answer in ${SECRET_TOOL_TIMEOUT_MS / 1000} seconds (a locked keyring waits on a prompt)`);
    if (e?.status === 1 && !String(e?.stderr ?? "").trim()) throw new KeyError(`no key is saved as "${name}"`);
    if (e?.status === 1) throw new KeyError("the key store could not be reached (exit 1; no D-Bus session or no unlocked keyring)");
    throw new KeyError(`the key store could not be read (${String(e?.code ?? (typeof e?.status === "number" ? `exit ${e.status}` : "error"))})`);
  }
  const key = String(out).replace(/\r?\n$/, "");
  if (!key) throw new KeyError(`no key is saved as "${name}"`);
  return { key, route: "secret-tool" };
}

// What may be said about a failure: our own message, or else only the error's code or name.
export const reason = (e) => (e instanceof KeyError ? e.message : String(e?.code ?? e?.name ?? "error"));

// Reads one key. Returns { key, route }. Throws a KeyError that holds no key.
export async function readKey(name, deps = {}) {
  const { platform = process.platform } = deps;
  checkName(name);
  if (platform !== "linux") throw new KeyError(`the key store is read on Linux only (this is ${platform})`);
  return readSecretService(name, deps.runSecretTool ?? runSecretTool, sessionBusEnv(process.env, deps.sessionBus));
}

// A program that cannot be started (not found, not allowed) ends the launcher with this
// code and one line on stderr, not with a stack trace.
export const NOT_STARTED = 127;

// The launcher's exit code for the way its program ended. A signal gives 128 plus its
// number, as a shell reports it (SIGTERM: 143), so a caller can tell it from a failure.
export function exitCode(code, signal) {
  if (code !== null && code !== undefined) return code;
  if (!signal) return 0;
  const number = constants.signals[signal];
  return number ? 128 + number : 1;
}

export function startProgram(program, args, env) {
  const failed = (e) => { process.stderr.write(`with-key: could not start ${program} (${String(e?.code ?? "error")})\n`); return NOT_STARTED; };
  let child;
  // a launcher: starts the program its local user names, no shell (owner's dismissal 18 Nov 2026)
  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
  try { child = spawn(program, args, { env, stdio: "inherit", windowsHide: true }); } catch (e) { return failed(e); }
  const stop = () => { if (child.exitCode === null) child.kill(); };
  process.on("exit", stop);
  process.on("SIGINT", () => process.exit(130));
  process.on("SIGTERM", () => process.exit(143));
  return new Promise((done) => {
    child.on("error", (e) => done(failed(e)));
    child.on("exit", (code, signal) => done(exitCode(code, signal)));
  });
}

// Takes a variable out of an environment. Windows reads a variable's name without regard
// to letter case, so there `some_key` is SOME_KEY and every spelling goes.
export function dropVariable(env, name, platform) {
  const wanted = platform === "win32" ? name.toUpperCase() : name;
  for (const key of Object.keys(env)) if ((platform === "win32" ? key.toUpperCase() : key) === wanted) delete env[key];
}

export async function main(argv, deps = {}) {
  const { say = (line) => process.stderr.write(line), start = startProgram, env: base = process.env, platform = process.platform } = deps;
  const [name, envVar, program, ...args] = argv;
  if (!name || !envVar || !program) { say(USAGE); return 2; }
  const env = { ...base };
  // A value the caller already had under this name goes first, in every case: a stale or
  // foreign one is never passed on as if it were the stored key, read or not.
  dropVariable(env, envVar, platform);
  try {
    env[envVar] = (await readKey(name, deps)).key;
  } catch (e) {
    say(`with-key: could not read key "${name}" (${reason(e)}); continuing without ${envVar}\n`);
  }
  return start(program, args, env);
}

// Run only as a program, not when a test imports this file. Node gives the script's full
// path in argv[1]; Windows paths differ in case and in links, so both sides are resolved.
export function isMain(url = import.meta.url) {
  try {
    return realpathSync(process.argv[1]).toLowerCase() === realpathSync(fileURLToPath(url)).toLowerCase();
  } catch { return false; }
}
if (isMain()) process.exit(await main(process.argv.slice(2)));
