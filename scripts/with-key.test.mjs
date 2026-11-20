// Tests of the key launcher, skills/cookbook/scripts/with-key.mjs. The key store is GNOME
// Keyring, read through secret-tool; every value here is synthetic and no test reaches the
// real keyring.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { SECRET_SERVICE, SECRET_TOOL_TIMEOUT_MS, exitCode, main, readKey, sessionBusEnv } from "../plugins/cookbook/skills/cookbook/scripts/with-key.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, "..", "plugins", "cookbook", "skills", "cookbook", "scripts");
const launcher = join(scripts, "with-key.mjs");

function home() {
  return mkdtempSync(join(tmpdir(), "with-key-test-"));
}
const notStarted = () => { throw new Error("the program must not be started"); };
// The launcher reads the desktop's keyring through secret-tool on PATH. A process started by
// these tests finds this stand-in first instead: it answers "no such item" (exit 1), so no
// test reaches the real keyring and CI without secret-tool behaves the same.
function noKeyring(dir, env) {
  const bin = join(dir, "test-bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "secret-tool"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  return { ...env, PATH: `${bin}${delimiter}${env.PATH ?? ""}` };
}
const noItem = () => { throw Object.assign(new Error("no such item"), { status: 1 }); };
const found = (key) => () => `${key}\n`;

test("a key name is lower-case letters, digits and hyphens, as in the store", async () => {
  const never = () => { throw new Error("secret-tool must not be started"); };
  for (const bad of ["", "Boat", "a/b", "..", "-x", "a b", "x".repeat(42), "a.b"]) await assert.rejects(readKey(bad, { platform: "linux", runSecretTool: never }), /lower-case letters, digits and hyphens/);
});

test("off Linux no key is read: the store is GNOME Keyring, and nothing else is tried", async () => {
  const never = () => { throw new Error("secret-tool must not be started"); };
  for (const platform of ["win32", "darwin"]) {
    const e = await readKey("boat", { platform, runSecretTool: never }).then(() => null, (x) => x);
    assert.ok(e, "the read fails");
    assert.equal(e.message, `the key store is read on Linux only (this is ${platform})`);
  }
  const started = [];
  const lines = [];
  await main(["boat", "SOME_KEY", "prog"], { platform: "win32", env: { PATH: "p", SOME_KEY: "stale" }, runSecretTool: never,
    say: (l) => lines.push(l), start: (program, args, env) => { started.push(env); return 0; } });
  assert.deepEqual(started, [{ PATH: "p" }]);
  assert.match(lines.join(""), /could not read key "boat" \(the key store is read on Linux only \(this is win32\)\); continuing without SOME_KEY/);
});

test("the launcher says so and starts the program without the variable when the key cannot be read", async () => {
  const lines = []; const started = [];
  const code = await main(["absent", "SOME_KEY", "prog", "a"], { platform: "linux", runSecretTool: noItem, env: { PATH: "p" },
    say: (l) => lines.push(l), start: (program, args, env) => { started.push([program, args, env]); return 0; } });
  assert.equal(code, 0);
  assert.deepEqual(started, [["prog", ["a"], { PATH: "p" }]]);
  assert.match(lines.join(""), /with-key: could not read key "absent" \(no key is saved as "absent"\); continuing without SOME_KEY/);
});

test("the launcher hands the key to the program in the named variable only", async () => {
  const started = [];
  await main(["k", "SOME_KEY", "prog"], { platform: "linux", runSecretTool: found("synthetic-key"), env: { PATH: "p" },
    say: () => {}, start: (program, args, env) => { started.push(env); return 0; } });
  assert.deepEqual(started, [{ PATH: "p", SOME_KEY: "synthetic-key" }]);
});

test("a value the caller already had under the variable's name is not passed on when the read fails", async () => {
  const started = [];
  await main(["absent", "SOME_KEY", "prog"], { platform: "linux", runSecretTool: noItem, env: { PATH: "p", SOME_KEY: "stale", some_key: "other" },
    say: () => {}, start: (program, args, env) => { started.push(env); return 0; } });
  // Variable names differ by letter case on Linux: `some_key` is not the launcher's to remove.
  assert.deepEqual(started, [{ PATH: "p", some_key: "other" }]);
});

test("a read that timed out is said on stderr, and the program still starts without the variable", async () => {
  const err = []; const started = [];
  const timedOut = () => { throw Object.assign(new Error("spawnSync secret-tool ETIMEDOUT"), { code: "ETIMEDOUT" }); };
  const code = await main(["k", "SOME_KEY", "prog"], { platform: "linux", runSecretTool: timedOut, env: {},
    say: (l) => err.push(l), start: (program, args, env) => { started.push(env); return 3; } });
  assert.equal(code, 3);
  assert.deepEqual(started, [{}]);
  assert.match(err.join(""), /with-key: could not read key "k" \(the key store did not answer in 15 seconds.*\); continuing without SOME_KEY/);
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

test("the launcher as a process ends with 143 when SIGTERM ends its child", () => {
  const dir = home();
  try {
    const run = spawnSync(process.execPath, [launcher, "absent", "SYN_KEY", process.execPath, "-e", "process.kill(process.pid, 'SIGTERM'); setTimeout(() => {}, 5000)"],
      { env: noKeyring(dir, { ...process.env, HOME: dir }), encoding: "utf8", timeout: 60000 });
    assert.equal(run.status, 143, run.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a program that cannot start ends the launcher with code 127 and one line, no stack trace", () => {
  const dir = home();
  try {
    const run = spawnSync(process.execPath, [launcher, "absent", "SYN_KEY", "no-such-program-for-with-key-test"], { env: noKeyring(dir, { ...process.env, HOME: dir }), encoding: "utf8", timeout: 60000 });
    assert.equal(run.status, 127, run.stderr);
    assert.match(run.stderr, /with-key: could not start no-such-program-for-with-key-test \(ENOENT\)\n$/);
    assert.doesNotMatch(run.stderr, /^\s+at /m);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("usage: too few arguments end with code 2", async () => {
  const lines = [];
  assert.equal(await main(["k", "SOME_KEY"], { say: (l) => lines.push(l), start: notStarted }), 2);
  assert.equal(await main(["--headers", "k"], { say: (l) => lines.push(l), start: notStarted }), 2, "no mode prints a key");
  assert.match(lines.join(""), /usage: node with-key\.mjs <key-name> <ENV_VAR> <program> \[args\.\.\.\]/);
});

test("Linux: the key comes from the Secret Service by its name", async () => {
  const seen = [];
    const got = await readKey("synthetic", { platform: "linux",
    runSecretTool: (args, ms) => { seen.push([args, ms]); return "synthetic-linux-key\n"; } });
  assert.deepEqual(got, { key: "synthetic-linux-key", route: "secret-tool" });
  assert.deepEqual(seen, [[["lookup", "service", SECRET_SERVICE, "name", "synthetic"], SECRET_TOOL_TIMEOUT_MS]]);
  assert.equal(SECRET_SERVICE, "claude-keys");
  assert.ok(SECRET_TOOL_TIMEOUT_MS <= 20000, "a locked keyring fails fast");
});

test("Linux: the name rule holds before secret-tool starts", async () => {
  const never = () => { throw new Error("secret-tool must not be started"); };
  for (const bad of ["", "Boat", "a b", "--all", "x".repeat(42)]) await assert.rejects(readKey(bad, { platform: "linux", runSecretTool: never }), /lower-case letters, digits and hyphens/);
});

test("Linux: each failure is named, and none repeats what secret-tool printed", async () => {
  const fail = (extra) => () => { throw Object.assign(new Error("Synthetic-Secret-Value"), extra); };
  for (const [run, want] of [
    [fail({ status: 1 }), /^no key is saved as "k"$/],
    [() => "", /^no key is saved as "k"$/],
    [fail({ code: "ENOENT" }), /secret-tool is not installed \(package libsecret-tools\)/],
    [fail({ code: "ETIMEDOUT" }), /did not answer in \d+ seconds/],
    [fail({ status: 2 }), /could not be read \(exit 2\)/],
    [fail({ status: 1, stderr: "Synthetic-Secret-Value: Cannot autolaunch D-Bus without X11 $DISPLAY\n" }), /could not be reached \(exit 1;/],
  ]) {
    const e = await readKey("k", { platform: "linux", runSecretTool: run }).then(() => null, (x) => x);
    assert.ok(e, "the read fails");
    assert.match(e.message, want);
    assert.doesNotMatch(e.message, /synthetic-secret/i);
  }
});

test("Linux: with no D-Bus address, the user's own session bus socket is used; anything else is left alone", () => {
  const socket = (uid) => () => ({ isSocket: () => true, uid });
  const seen = [];
  const stat = (path) => { seen.push(path); return { isSocket: () => true, uid: 1000 }; };
  assert.deepEqual(sessionBusEnv({ PATH: "p" }, { uid: 1000, stat }), { PATH: "p", DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus" });
  assert.deepEqual(seen, ["/run/user/1000/bus"]);
  const set = { PATH: "p", DBUS_SESSION_BUS_ADDRESS: "unix:path=/elsewhere" };
  assert.equal(sessionBusEnv(set, { uid: 1000, stat: socket(1000) }), set, "a set address is kept");
  const env = { PATH: "p" };
  assert.equal(sessionBusEnv(env, { uid: 1000, stat: () => { throw Object.assign(new Error("gone"), { code: "ENOENT" }); } }), env, "no socket");
  assert.equal(sessionBusEnv(env, { uid: 1000, stat: () => ({ isSocket: () => false, uid: 1000 }) }), env, "not a socket");
  assert.equal(sessionBusEnv(env, { uid: 1000, stat: socket(0) }), env, "another user's socket");
  assert.equal(sessionBusEnv(env, { uid: null, stat: socket(1000) }), env, "no user id (not POSIX)");
});

test("Linux: secret-tool is started with the session bus address when the caller's environment has none", async () => {
  const seen = [];
  const saved = process.env.DBUS_SESSION_BUS_ADDRESS;
  delete process.env.DBUS_SESSION_BUS_ADDRESS;
  try {
    await readKey("synthetic", { platform: "linux", sessionBus: { uid: 4242, stat: () => ({ isSocket: () => true, uid: 4242 }) },
      runSecretTool: (_args, _ms, options) => { seen.push(options.env.DBUS_SESSION_BUS_ADDRESS); return "synthetic-linux-key"; } });
  } finally { if (saved !== undefined) process.env.DBUS_SESSION_BUS_ADDRESS = saved; }
  assert.deepEqual(seen, ["unix:path=/run/user/4242/bus"]);
  assert.equal(process.env.DBUS_SESSION_BUS_ADDRESS, saved, "the process's own environment is not changed");
});

test("Linux: the launcher as a process, with a stand-in keyring, hands the key to its program only", { skip: process.platform !== "linux" && "needs Linux" }, () => {
  const dir = home();
  try {
    const bin = join(dir, "test-bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "secret-tool"), '#!/bin/sh\n[ "$*" = "lookup service claude-keys name synthetic" ] && printf %s synthetic-linux-value && exit 0\nexit 1\n', { mode: 0o755 });
    const env = { ...process.env, HOME: dir, PATH: `${bin}${delimiter}${process.env.PATH}` };
    const check = "process.exit(process.env.SYN_KEY === 'synthetic-linux-value' ? 5 : 9)";
    const run = spawnSync(process.execPath, [launcher, "synthetic", "SYN_KEY", process.execPath, "-e", check], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(run.status, 5, run.stderr);
    assert.equal(run.stdout, "");
    assert.doesNotMatch(run.stderr, /synthetic-linux-value/);
    const none = spawnSync(process.execPath, [launcher, "absent", "SYN_KEY", process.execPath, "-e", "process.exit(process.env.SYN_KEY === undefined ? 5 : 9)"], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(none.status, 5);
    assert.match(none.stderr, /could not read key "absent" \(no key is saved as "absent"\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
