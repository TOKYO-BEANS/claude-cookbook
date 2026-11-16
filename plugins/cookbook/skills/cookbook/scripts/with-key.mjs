// Run a program with one API key from Windows user-scoped encryption (the DPAPI store that
// agent-key.ps1 keeps in ~/.secrets) placed in its environment only. Stdio is inherited, so
// this works as an MCP stdio server launcher.
//   node with-key.mjs <key-name> <ENV_VAR> <program> [args...]
// It prints no key: the key goes to the program's environment and nowhere else.
//
// A copy of this file lives at ~/.local/bin/with-key.mjs, the path every caller uses. Copy
// it again when this file changes (recipes/keys.md).
//
// The key is read in this process: Node calls Windows' CryptUnprotectData itself, through
// node:ffi. No PowerShell starts. That matters on a PC whose security software scans every
// PowerShell script block: while many processes start, each scan can wait 30 seconds, and a
// read through agent-key.ps1 crosses several (measured 16 November 2026: 61 seconds against
// 1). PowerShell is the fallback only, where node:ffi is missing, and it has a time limit.
import { execFileSync, spawn } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A read through PowerShell takes about a second. One that has not answered after this
// long is waiting on a script scan: it is ended, and the launcher says so.
export const POWERSHELL_TIMEOUT_MS = 15000;

const USAGE = "usage: node with-key.mjs <key-name> <ENV_VAR> <program> [args...]\n";

// A failure whose message is ours: it never holds a key or a program's output.
class KeyError extends Error {}

export function keyPath(name, home = homedir()) {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(String(name))) throw new KeyError("a key name is lower-case letters, digits and hyphens");
  return join(home, ".secrets", `${name}.dpapi`);
}

// node:ffi says on stderr, at each load, that it is experimental. That line is dropped;
// every other warning still prints.
export async function loadFfi() {
  const printers = process.listeners("warning");
  process.removeAllListeners("warning");
  process.on("warning", (w) => {
    if (w?.name === "ExperimentalWarning" && /FFI/i.test(String(w.message))) return;
    for (const print of printers) print(w);
  });
  return (await import("node:ffi")).default;
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

// What may be said about a failure: our own message, or else only the error's code or name.
const reason = (e) => (e instanceof KeyError ? e.message : String(e?.code ?? e?.name ?? "error"));

// Reads one key. Returns { key, route } and, after a fallback, a note saying why the
// direct route was not used. Throws a KeyError that holds no key.
export async function readKey(name, deps = {}) {
  const { home = homedir(), platform = process.platform, arch = process.arch, loadFfi: load = loadFfi, runPowerShell: run = runPowerShell } = deps;
  const path = keyPath(name, home);
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
      : `the PowerShell route failed (${String(e?.code ?? (typeof e?.status === "number" ? `exit ${e.status}` : "error"))})`;
    throw new KeyError(`${what}; direct route: ${note}`);
  }
  let key;
  try { key = JSON.parse(out).Authorization.replace(/^Bearer /, ""); } catch { key = ""; }
  if (!key) throw new KeyError(`the PowerShell route failed (no key in its answer); direct route: ${note}`);
  return { key, route: "powershell", note };
}

function startProgram(program, args, env) {
  const child = spawn(program, args, { env, stdio: "inherit", windowsHide: true });
  const stop = () => { if (child.exitCode === null) child.kill(); };
  process.on("exit", stop);
  process.on("SIGINT", () => process.exit(130));
  process.on("SIGTERM", () => process.exit(143));
  return new Promise((done) => { child.on("exit", (code, signal) => done(code ?? (signal ? 1 : 0))); });
}

export async function main(argv, deps = {}) {
  const { say = (line) => process.stderr.write(line), start = startProgram, env: base = process.env } = deps;
  const [name, envVar, program, ...args] = argv;
  if (!name || !envVar || !program) { say(USAGE); return 2; }
  const env = { ...base };
  try {
    env[envVar] = (await readKey(name, deps)).key;
  } catch (e) {
    say(`with-key: could not read key "${name}" (${reason(e)}); continuing without ${envVar}\n`);
  }
  return start(program, args, env);
}

// Run only as a program, not when a test imports this file. Node gives the script's full
// path in argv[1]; Windows paths differ in case and in links, so both sides are resolved.
function isMain() {
  try {
    return realpathSync(process.argv[1]).toLowerCase() === realpathSync(fileURLToPath(import.meta.url)).toLowerCase();
  } catch { return false; }
}
if (isMain()) process.exit(await main(process.argv.slice(2)));
