// Run a program with one API key from the key store placed in its environment only. On Linux
// the store is the desktop's Secret Service (GNOME Keyring), read with `secret-tool` (package
// libsecret-tools): the item with the attributes service=claude-keys and name=<key name>. On
// Windows it is user-scoped encryption (the DPAPI store that agent-key.ps1 keeps in ~/.secrets).
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
//
// The key is read in this process: Node calls Windows' CryptUnprotectData itself, through
// node:ffi. No PowerShell starts. That matters on a PC whose security software scans every
// PowerShell script block: while many processes start, each scan can wait 30 seconds, and a
// read through agent-key.ps1 crosses several (measured 16 November 2026: 61 seconds against
// 1). PowerShell is the fallback only (node:ffi is missing, the direct read failed, or this is
// not 64-bit Windows), and it has a time limit.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { constants, homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A read through PowerShell takes about a second. One that has not answered after this
// long is waiting on a script scan: it is ended, and the launcher says so.
export const POWERSHELL_TIMEOUT_MS = 15000;

// Linux: the Secret Service attribute every key item carries, and how long a read may take
// (an unlocked keyring answers in milliseconds; a locked one waits on a prompt).
export const SECRET_SERVICE = "claude-keys";
export const SECRET_TOOL_TIMEOUT_MS = 15000;

const USAGE = "usage: node with-key.mjs <key-name> <ENV_VAR> <program> [args...]\n";

// A failure whose message is ours: it never holds a key or a program's output.
class KeyError extends Error {}

export function keyPath(name, home = homedir()) {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(String(name))) throw new KeyError("a key name is lower-case letters, digits and hyphens");
  return join(home, ".secrets", `${name}.dpapi`);
}

// node:ffi says on stderr, at each load, that it is experimental. That one line is dropped
// while the module loads; the process's warning handling is as it was afterwards.
export async function loadFfi() {
  const emit = process.emitWarning;
  process.emitWarning = function quiet(warning, ...rest) {
    const type = typeof rest[0] === "string" ? rest[0] : rest[0]?.type;
    if (type === "ExperimentalWarning" && /FFI/i.test(String(warning?.message ?? warning))) return;
    return emit.call(this, warning, ...rest);
  };
  try {
    return (await import("node:ffi")).default;
  } finally {
    process.emitWarning = emit;
  }
}

export function runPowerShell(args, timeoutMs, { exe = "powershell.exe", env = process.env } = {}) {
  return execFileSync(exe, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: timeoutMs, killSignal: "SIGKILL", env });
}

// The store's file is the hex of a DPAPI blob (ConvertFrom-SecureString); the plain text
// inside is UTF-16. DATA_BLOB on 64-bit Windows: DWORD cbData at 0, BYTE* pbData at 8.
function unprotect(ffi, hex) {
  if (hex.length < 32 || hex.length % 2 || /[^0-9a-f]/i.test(hex)) throw new KeyError("the credential file is not a DPAPI blob");
  const system = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
  const crypt = ffi.dlopen(join(system, "crypt32.dll"), { CryptUnprotectData: { return: "int32", arguments: ["pointer", "pointer", "pointer", "pointer", "pointer", "uint32", "pointer"] } });
  const kernel = ffi.dlopen(join(system, "kernel32.dll"), { LocalFree: { return: "pointer", arguments: ["pointer"] }, GetLastError: { return: "uint32", arguments: [] } });
  const blob = Buffer.alloc(hex.length / 2);
  blob.write(hex, "hex");
  const input = Buffer.alloc(16); const output = Buffer.alloc(16);
  input.writeUInt32LE(blob.length, 0);
  input.writeBigUInt64LE(ffi.getRawPointer(blob), 8);
  const ok = crypt.functions.CryptUnprotectData(input, null, null, null, null, 1 /* CRYPTPROTECT_UI_FORBIDDEN */, output);
  if (!ok) throw new KeyError(`CryptUnprotectData failed (Windows error ${kernel.functions.GetLastError()})`);
  const length = output.readUInt32LE(0); const pointer = output.readBigUInt64LE(8);
  try {
    const plain = Buffer.from(ffi.toBuffer(pointer, length));
    try { return plain.toString("utf16le"); } finally { plain.fill(0); }
  } finally {
    for (let i = 0; i < length; i += 1) ffi.setUint8(pointer, i, 0);
    kernel.functions.LocalFree(pointer);
  }
}

// Runs secret-tool (found on PATH) and returns what it printed. Its stderr is dropped: a
// failure is told by the exit status alone.
export function runSecretTool(args, timeoutMs, { env = process.env } = {}) {
  return execFileSync("secret-tool", args, { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "ignore"], env });
}

// Linux: one key from the Secret Service. secret-tool ends with 1 and prints nothing when no
// item matches.
function readSecretService(name, run) {
  let out;
  try { out = run(["lookup", "service", SECRET_SERVICE, "name", name], SECRET_TOOL_TIMEOUT_MS); } catch (e) {
    if (e?.code === "ENOENT") throw new KeyError("secret-tool is not installed (package libsecret-tools)");
    if (e?.code === "ETIMEDOUT") throw new KeyError(`the key store did not answer in ${SECRET_TOOL_TIMEOUT_MS / 1000} seconds (a locked keyring waits on a prompt)`);
    if (e?.status === 1) throw new KeyError(`no key is saved as "${name}"`);
    throw new KeyError(`the key store could not be read (${String(e?.code ?? (typeof e?.status === "number" ? `exit ${e.status}` : "error"))})`);
  }
  const key = String(out).replace(/\r?\n$/, "");
  if (!key) throw new KeyError(`no key is saved as "${name}"`);
  return { key, route: "secret-tool" };
}

// What may be said about a failure: our own message, or else only the error's code or name.
export const reason = (e) => (e instanceof KeyError ? e.message : String(e?.code ?? e?.name ?? "error"));

// Reads one key. Returns { key, route } and, after a fallback, a note saying why the
// direct route was not used. Throws a KeyError that holds no key.
export async function readKey(name, deps = {}) {
  const { home = homedir(), platform = process.platform, arch = process.arch, loadFfi: load = loadFfi, runPowerShell: run = runPowerShell } = deps;
  const path = keyPath(name, home);
  if (platform === "linux") return readSecretService(name, deps.runSecretTool ?? runSecretTool);
  let stat;
  try { stat = lstatSync(path); } catch (e) {
    throw new KeyError(e?.code === "ENOENT" ? `no key is saved as "${name}"` : `the credential file cannot be opened (${reason(e)})`);
  }
  if (stat.isSymbolicLink()) throw new KeyError("the credential file must not be a link");

  let note;
  if (platform === "win32" && (arch === "x64" || arch === "arm64")) {
    try {
      const ffi = await load();
      return { key: unprotect(ffi, readFileSync(path, "ascii").trim()), route: "dpapi" };
    } catch (e) { note = reason(e); }
  } else note = "not 64-bit Windows";

  const script = deps.script ?? join(home, ".local", "bin", "agent-key.ps1");
  let out;
  try {
    out = run(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Mode", "headers", "-Name", name], POWERSHELL_TIMEOUT_MS);
  } catch (e) {
    const what = e?.code === "ETIMEDOUT"
      ? `the PowerShell route did not answer in ${POWERSHELL_TIMEOUT_MS / 1000} seconds and was ended (a script scan by the security software stalls it while many processes start)`
      : !existsSync(script) ? `the PowerShell route failed (no agent-key.ps1 at ${script})`
      : `the PowerShell route failed (${String(e?.code ?? (typeof e?.status === "number" ? `exit ${e.status}` : "error"))})`;
    throw new KeyError(`${what}; direct route: ${note}`);
  }
  let key;
  try { key = JSON.parse(out).Authorization.replace(/^Bearer /, ""); } catch { key = ""; }
  if (!key) throw new KeyError(`the PowerShell route failed (no key in its answer); direct route: ${note}`);
  return { key, route: "powershell", note };
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
