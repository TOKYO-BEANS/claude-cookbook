// Tests of the key launcher, skills/cookbook/scripts/with-key.mjs. The parts that need
// Windows' DPAPI run on Windows only; every value in them is synthetic.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { POWERSHELL_TIMEOUT_MS, exitCode, keyPath, loadFfi, main, readKey, runPowerShell } from "../plugins/cookbook/skills/cookbook/scripts/with-key.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, "..", "plugins", "cookbook", "skills", "cookbook", "scripts");
const launcher = join(scripts, "with-key.mjs");
const store = join(scripts, "agent-key.ps1");
const windows = process.platform === "win32";
const ffi = windows ? await loadFfi().catch(() => null) : null;

function home(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "with-key-test-"));
  mkdirSync(join(dir, ".secrets"));
  // A PowerShell started with this folder as USERPROFILE keeps its module cache under
  // AppData\Local. Without that folder it writes the cache into the working directory:
  // a stray Microsoft/ folder in the checkout.
  mkdirSync(join(dir, "AppData", "Local"), { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, ".secrets", name), text);
  return dir;
}
const noPowerShell = () => { throw new Error("PowerShell must not be started"); };
const noFfi = async () => { throw Object.assign(new Error("No such built-in module: node:ffi"), { code: "ERR_UNKNOWN_BUILTIN_MODULE" }); };
const headers = (key) => JSON.stringify({ Authorization: `Bearer ${key}` });
const timedOut = () => { throw Object.assign(new Error("spawnSync powershell.exe ETIMEDOUT"), { code: "ETIMEDOUT" }); };

// A DPAPI blob in the store's format (hex, as ConvertFrom-SecureString writes it), made
// without PowerShell so these tests do not wait on a script scan.
function protect(text) {
  const system = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
  const crypt = ffi.dlopen(join(system, "crypt32.dll"), { CryptProtectData: { return: "int32", arguments: ["pointer", "pointer", "pointer", "pointer", "pointer", "uint32", "pointer"] } });
  const plain = Buffer.alloc(Buffer.byteLength(text, "utf16le"));
  plain.write(text, "utf16le");
  const input = Buffer.alloc(16); const output = Buffer.alloc(16);
  input.writeUInt32LE(plain.length, 0);
  input.writeBigUInt64LE(ffi.getRawPointer(plain), 8);
  assert.ok(crypt.functions.CryptProtectData(input, null, null, null, null, 1, output));
  return Buffer.from(ffi.toBuffer(output.readBigUInt64LE(8), output.readUInt32LE(0))).toString("hex");
}

test("a key name is lower-case letters, digits and hyphens, as in the store", () => {
  assert.equal(keyPath("boat", "/h"), join("/h", ".secrets", "boat.dpapi"));
  for (const bad of ["", "Boat", "a/b", "..", "-x", "a b", "x".repeat(42), "a.b"]) assert.throws(() => keyPath(bad, "/h"), /lower-case letters, digits and hyphens/);
});

test("a key that is not saved is said at once, and no PowerShell starts", async () => {
  const dir = home();
  try {
    await assert.rejects(readKey("absent", { home: dir, loadFfi: noFfi, runPowerShell: noPowerShell }), /no key is saved as "absent"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a credential file that is a link is refused", async (t) => {
  const dir = home({ "real.dpapi": "00" });
  try {
    try { symlinkSync(join(dir, ".secrets", "real.dpapi"), join(dir, ".secrets", "linked.dpapi")); } catch { return t.skip("this user cannot make a link"); }
    await assert.rejects(readKey("linked", { home: dir, loadFfi: noFfi, runPowerShell: noPowerShell }), /must not be a link/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("without node:ffi the key comes from PowerShell, with a time limit", async () => {
  const dir = home({ "k.dpapi": "00" });
  const seen = [];
  try {
    const got = await readKey("k", { home: dir, platform: "win32", arch: "x64", loadFfi: noFfi, script: "S:/agent-key.ps1",
      runPowerShell: (args, ms) => { seen.push([args, ms]); return headers("synthetic-key"); } });
    assert.equal(got.key, "synthetic-key");
    assert.equal(got.route, "powershell");
    assert.match(got.note, /ERR_UNKNOWN_BUILTIN_MODULE/);
    assert.deepEqual(seen, [[["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", "S:/agent-key.ps1", "-Mode", "headers", "-Name", "k"], POWERSHELL_TIMEOUT_MS]]);
    assert.ok(POWERSHELL_TIMEOUT_MS <= 20000, "the fallback fails fast");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("off 64-bit Windows the direct route is not tried", async () => {
  const dir = home({ "k.dpapi": "00" });
  try {
    const loud = async () => { throw new Error("node:ffi must not be loaded"); };
    for (const where of [{ platform: "linux", arch: "x64" }, { platform: "win32", arch: "ia32" }]) {
      const got = await readKey("k", { home: dir, ...where, loadFfi: loud, runPowerShell: () => headers("v") });
      assert.equal(got.route, "powershell");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a PowerShell read that does not answer in time fails, and says so", async () => {
  const dir = home({ "k.dpapi": "00" });
  try {
    await assert.rejects(readKey("k", { home: dir, platform: "win32", arch: "x64", loadFfi: noFfi, runPowerShell: timedOut }),
      (e) => /did not answer in 15 seconds/.test(e.message) && /script scan/.test(e.message) && /ERR_UNKNOWN_BUILTIN_MODULE/.test(e.message));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a failed read never repeats what PowerShell printed", async () => {
  const dir = home({ "k.dpapi": "00" });
  try {
    const leaky = () => { throw Object.assign(new Error('Command failed: {"Authorization":"Bearer synthetic-leak"}'), { status: 1, stdout: headers("synthetic-leak"), stderr: "synthetic-leak" }); };
    const broken = () => "not json synthetic-leak";
    for (const run of [leaky, broken]) {
      await assert.rejects(readKey("k", { home: dir, platform: "win32", arch: "x64", loadFfi: noFfi, runPowerShell: run }),
        (e) => /PowerShell/.test(e.message) && !/synthetic-leak/.test(e.message));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the real PowerShell runner ends a process that hangs", () => {
  const start = Date.now();
  assert.throws(() => runPowerShell(["-e", "setTimeout(() => {}, 30000)"], 400, { exe: process.execPath }), (e) => e.code === "ETIMEDOUT");
  assert.ok(Date.now() - start < 10000);
});

test("the launcher says so and starts the program without the variable when the key cannot be read", async () => {
  const dir = home();
  const lines = []; const started = [];
  try {
    const code = await main(["absent", "SOME_KEY", "prog", "a"], { home: dir, loadFfi: noFfi, runPowerShell: noPowerShell, env: { PATH: "p" },
      say: (l) => lines.push(l), start: (program, args, env) => { started.push([program, args, env]); return 0; } });
    assert.equal(code, 0);
    assert.deepEqual(started, [["prog", ["a"], { PATH: "p" }]]);
    assert.match(lines.join(""), /with-key: could not read key "absent" \(no key is saved as "absent"\); continuing without SOME_KEY/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the launcher hands the key to the program in the named variable only", async () => {
  const dir = home({ "k.dpapi": "00" });
  const started = [];
  try {
    await main(["k", "SOME_KEY", "prog"], { home: dir, platform: "win32", arch: "x64", loadFfi: noFfi, runPowerShell: () => headers("synthetic-key"), env: { PATH: "p" },
      say: () => {}, start: (program, args, env) => { started.push(env); return 0; } });
    assert.deepEqual(started, [{ PATH: "p", SOME_KEY: "synthetic-key" }]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a value the caller already had under the variable's name is not passed on when the read fails", async () => {
  const dir = home();
  const started = [];
  try {
    await main(["absent", "SOME_KEY", "prog"], { home: dir, loadFfi: noFfi, runPowerShell: noPowerShell, env: { PATH: "p", SOME_KEY: "stale" },
      say: () => {}, start: (program, args, env) => { started.push(env); return 0; } });
    assert.deepEqual(started, [{ PATH: "p" }]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("on Windows a value under the variable's name in another letter case goes too, read or not", async () => {
  const dir = home({ "k.dpapi": "00" });
  const run = async (name, platform, env, runPowerShell) => {
    const started = [];
    await main([name, "SOME_KEY", "prog"], { home: dir, platform, arch: "x64", loadFfi: noFfi, runPowerShell, env,
      say: () => {}, start: (program, args, childEnv) => { started.push(childEnv); return 0; } });
    return started[0];
  };
  try {
    // Windows reads variable names without regard to case: `some_key` is SOME_KEY there.
    assert.deepEqual(await run("absent", "win32", { PATH: "p", some_key: "stale", Some_Key: "stale" }, noPowerShell), { PATH: "p" });
    assert.deepEqual(await run("k", "win32", { PATH: "p", some_key: "stale" }, () => headers("synthetic-key")), { PATH: "p", SOME_KEY: "synthetic-key" });
    // Elsewhere they are different variables, and not the launcher's to remove.
    assert.deepEqual(await run("absent", "linux", { PATH: "p", some_key: "other", SOME_KEY: "stale" }, noPowerShell), { PATH: "p", some_key: "other" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a child ended by a signal gives 128 plus the signal's number, not 1", () => {
  assert.equal(exitCode(0, null), 0);
  assert.equal(exitCode(3, null), 3);
  assert.equal(exitCode(null, "SIGTERM"), 143);
  assert.equal(exitCode(null, "SIGKILL"), 137);
  assert.equal(exitCode(null, "SIGINT"), 130);
  assert.equal(exitCode(null, "SIGNOSUCH"), 1, "a signal with no number is still a failure");
  assert.equal(exitCode(null, null), 0);
});

test("the launcher as a process ends with 143 when SIGTERM ends its child", { skip: windows && "Windows has no signals: a killed child ends with a code" }, () => {
  const dir = home();
  try {
    const run = spawnSync(process.execPath, [launcher, "absent", "SYN_KEY", process.execPath, "-e", "process.kill(process.pid, 'SIGTERM'); setTimeout(() => {}, 5000)"],
      { env: { ...process.env, HOME: dir, USERPROFILE: dir }, encoding: "utf8", timeout: 60000 });
    assert.equal(run.status, 143, run.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a missing agent-key.ps1 is named, not reported as a PowerShell exit code", async () => {
  const dir = home({ "k.dpapi": "00" });
  try {
    await assert.rejects(readKey("k", { home: dir, platform: "win32", arch: "x64", loadFfi: noFfi, runPowerShell: () => { throw Object.assign(new Error("x"), { status: 1 }); } }),
      /the PowerShell route failed \(no agent-key\.ps1 at .*agent-key\.ps1\); direct route: ERR_UNKNOWN_BUILTIN_MODULE/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("loading node:ffi leaves the process's warning handling as it was", async () => {
  const emit = process.emitWarning; const listeners = process.listeners("warning");
  await loadFfi().catch(() => null);
  await loadFfi().catch(() => null);
  assert.equal(process.emitWarning, emit);
  assert.deepEqual(process.listeners("warning"), listeners);
});

test("a program that cannot start ends the launcher with code 127 and one line, no stack trace", () => {
  const dir = home();
  try {
    const run = spawnSync(process.execPath, [launcher, "absent", "SYN_KEY", "no-such-program-for-with-key-test"], { env: { ...process.env, USERPROFILE: dir, HOME: dir }, encoding: "utf8", timeout: 60000 });
    assert.equal(run.status, 127, run.stderr);
    assert.match(run.stderr, /with-key: could not start no-such-program-for-with-key-test \(ENOENT\)\n$/);
    assert.doesNotMatch(run.stderr, /^\s+at /m);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("usage: too few arguments end with code 2", async () => {
  const lines = [];
  assert.equal(await main(["k", "SOME_KEY"], { say: (l) => lines.push(l), start: noPowerShell }), 2);
  assert.equal(await main(["--headers", "k"], { say: (l) => lines.push(l), start: noPowerShell }), 2, "no mode prints a key");
  assert.match(lines.join(""), /usage: node with-key\.mjs <key-name> <ENV_VAR> <program> \[args\.\.\.\]/);
});

test("a read that timed out is said on stderr, and the program still starts without the variable", async () => {
  const dir = home({ "k.dpapi": "00" });
  try {
    const err = []; const started = [];
    const code = await main(["k", "SOME_KEY", "prog"], { home: dir, platform: "win32", arch: "x64", loadFfi: noFfi, runPowerShell: timedOut, env: {},
      say: (l) => err.push(l), start: (program, args, env) => { started.push(env); return 3; } });
    assert.equal(code, 3);
    assert.deepEqual(started, [{}]);
    assert.match(err.join(""), /with-key: could not read key "k" \(.*did not answer in 15 seconds.*\); continuing without SOME_KEY/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Windows: the direct route reads a DPAPI key and starts no PowerShell", { skip: !ffi && "needs Windows and node:ffi" }, async () => {
  const value = "synthetic-key-0123456789-æøå";
  const dir = home({ "synthetic.dpapi": `${protect(value)}\r\n` });
  try {
    const got = await readKey("synthetic", { home: dir, runPowerShell: noPowerShell });
    assert.deepEqual(got, { key: value, route: "dpapi" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Windows: a file that is not a DPAPI blob falls back, and the failure names both routes", { skip: !ffi && "needs Windows and node:ffi" }, async () => {
  const dir = home({ "junk.dpapi": "zz", "short.dpapi": "0102" });
  try {
    for (const name of ["junk", "short"]) {
      await assert.rejects(readKey(name, { home: dir, runPowerShell: () => { throw Object.assign(new Error("x"), { status: 1 }); } }),
        (e) => /direct route: .*(not a DPAPI blob|CryptUnprotectData failed)/.test(e.message) && /PowerShell route failed/.test(e.message));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Windows: the launcher as a process, by several spellings of its path", { skip: !ffi && "needs Windows and node:ffi" }, () => {
  const value = "synthetic-launcher-key";
  const dir = home({ "synthetic.dpapi": protect(value) });
  try {
    const env = { ...process.env, USERPROFILE: dir };
    const check = `process.exit(process.env.SYN_KEY === ${JSON.stringify(value)} ? 7 : 9)`;
    for (const path of [launcher, launcher.replaceAll("\\", "/"), launcher[0].toLowerCase() + launcher.slice(1), join(dirname(launcher).toUpperCase(), "with-key.mjs"), relative(process.cwd(), launcher)]) {
      const run = spawnSync(process.execPath, [path, "synthetic", "SYN_KEY", process.execPath, "-e", check], { env, encoding: "utf8", timeout: 60000 });
      assert.equal(run.status, 7, `${path}: ${run.stderr}`);
      assert.equal(run.stderr, "", "no warning about node:ffi on stderr");
    }
    const none = spawnSync(process.execPath, [launcher, "absent", "SYN_KEY", process.execPath, "-e", "process.exit(process.env.SYN_KEY === undefined ? 5 : 9)"], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(none.status, 5);
    assert.match(none.stderr, /continuing without SYN_KEY/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Windows: a key saved by agent-key.ps1 reads the same by both routes", { skip: !ffi && "needs Windows and node:ffi", timeout: 300000 }, () => {
  const value = "synthetic-store-key-42";
  const dir = home();
  try {
    const env = { ...process.env, USERPROFILE: dir, SYN_SOURCE: value };
    const ps = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", store];
    const saved = spawnSync("powershell.exe", [...ps, "-Mode", "import", "-Name", "synthetic", "-FromEnv", "SYN_SOURCE"], { env, encoding: "utf8", timeout: 140000 });
    assert.equal(saved.status, 0, saved.stderr);
    const check = `process.exit(process.env.SYN_KEY === ${JSON.stringify(value)} ? 7 : 9)`;
    const run = spawnSync(process.execPath, [launcher, "synthetic", "SYN_KEY", process.execPath, "-e", check], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(run.status, 7, run.stderr);
    const out = runPowerShell([...ps, "-Mode", "headers", "-Name", "synthetic"], 140000, { env });
    assert.equal(out, headers(value));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
