// Tests for the CLIProxyAPI launcher's pure parts: the login flag, the config template, the
// proxy's environment and the one-launcher lock. The proxy itself is not started here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLACEHOLDER, fillTemplate, providerFlag, proxyEnv, releaseLock, removeConfig, takeLock, writeConfig } from "../plugins/cookbook/skills/cookbook/scripts/cliproxyapi.mjs";

const KEY = "a".repeat(43);

test("providerFlag: a plain lower-case name becomes the proxy's login flag", () => {
  assert.equal(providerFlag("claude"), "-claude-login");
  assert.equal(providerFlag("codex-device"), "-codex-device-login");
});

test("providerFlag: anything else is refused", () => {
  for (const bad of [undefined, "", "Claude", "-claude", "claude-", "claude login", "claude;rm", "../x", "config=x", "a--b"]) {
    assert.equal(providerFlag(bad), null, String(bad));
  }
});

test("fillTemplate: puts the key where the placeholder is", () => {
  assert.equal(fillTemplate(`api-keys:\n  - "${PLACEHOLDER}"\n`, KEY), `api-keys:\n  - "${KEY}"\n`);
});

test("fillTemplate: a template without the placeholder, or a key that is not a plain token, throws", () => {
  assert.throws(() => fillTemplate("api-keys: []\n", KEY), /placeholder|__CLIENT_KEY__/);
  assert.throws(() => fillTemplate(PLACEHOLDER, 'x"\nhost: 0.0.0.0'), /plain token/);
  assert.throws(() => fillTemplate(PLACEHOLDER, "short"), /plain token/);
});

test("proxyEnv: drops every variable the proxy acts on, in any case (it reads both), and adds the given ones", () => {
  const env = proxyEnv({ PATH: "x", management_password: "old", PgStore_Dsn: "y", HOME_JWT: "z", writable_path: "w" }, { MANAGEMENT_PASSWORD: "new" });
  assert.deepEqual(env, { PATH: "x", MANAGEMENT_PASSWORD: "new" });
  const acted = ["MANAGEMENT_PASSWORD", "MANAGEMENT_STATIC_PATH", "WRITABLE_PATH", "HOME_JWT", "DEPLOY", "GITHUB_TOKEN", "CLIPROXY_PLUGIN_DLOPEN_PROBE", "CLIPROXY_PLUGIN_DLOPEN_PROBE_STATUS",
    "PGSTORE_DSN", "PGSTORE_SCHEMA", "PGSTORE_LOCAL_PATH", "GITSTORE_GIT_URL", "GITSTORE_GIT_TOKEN", "GITSTORE_GIT_USERNAME", "GITSTORE_GIT_BRANCH", "GITSTORE_LOCAL_PATH",
    "OBJECTSTORE_ENDPOINT", "OBJECTSTORE_ACCESS_KEY", "OBJECTSTORE_SECRET_KEY", "OBJECTSTORE_BUCKET", "OBJECTSTORE_LOCAL_PATH"];
  for (const name of acted) for (const spelled of [name, name.toLowerCase()]) assert.deepEqual(proxyEnv({ [spelled]: "v", HOME: "/h" }), { HOME: "/h" }, spelled);
});

test("proxyEnv: a name that only begins or ends like one of them stays", () => {
  const kept = { HOME: "/h", DEPLOYMENT: "a", MY_GITHUB_TOKEN: "b", GITHUB_TOKEN_FILE: "c", XDG_RUNTIME_DIR: "d", PGSTORE: "e", WAYLAND_DISPLAY: "f" };
  assert.deepEqual(proxyEnv(kept), kept);
});

test("fillTemplate: a template with the placeholder twice throws (the second would stay a valid key)", () => {
  assert.throws(() => fillTemplate(`api-keys:\n  - "${PLACEHOLDER}"\n  - "${PLACEHOLDER}"\n`, KEY), /exactly once/);
});

test("fillTemplate: the key is put in as it is, whatever it holds for String.replace", () => {
  assert.equal(fillTemplate(PLACEHOLDER, "a".repeat(20) + "_-"), "a".repeat(20) + "_-");
});

test("takeLock: the first launcher takes it, a live second one is told who holds it", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cpa-lock-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const lock = join(dir, "launcher.lock");
  assert.equal(takeLock(lock, 100, () => true), null);
  assert.equal(takeLock(lock, 200, () => true), 100);
  releaseLock(lock, 200); // not the holder: the lock stays
  assert.equal(readFileSync(lock, "utf8"), "100");
  releaseLock(lock, 100);
  assert.equal(existsSync(lock), false);
});

test("takeLock: a lock whose launcher is gone, or that holds no pid, is taken over", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cpa-lock-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const lock = join(dir, "launcher.lock");
  writeFileSync(lock, "100");
  assert.equal(takeLock(lock, 200, () => false), null);
  assert.equal(readFileSync(lock, "utf8"), "200");
  writeFileSync(lock, "not a pid");
  assert.equal(takeLock(lock, 300, () => true), null);
  assert.equal(readFileSync(lock, "utf8"), "300");
});

test("takeLock: of two launchers that both saw a stale lock, only one takes it", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cpa-lock-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const lock = join(dir, "launcher.lock");
  writeFileSync(lock, "100");
  // Launcher 300 reads the stale "100"; while it checks that pid, launcher 200 takes the lock over.
  const held = takeLock(lock, 300, (pid) => {
    if (pid === 100) { assert.equal(takeLock(lock, 200, (p) => p !== 100), null); return false; }
    return pid === 200;
  });
  assert.equal(held, 200);
  assert.equal(readFileSync(lock, "utf8"), "200");
  assert.deepEqual(readdirSync(dir), ["launcher.lock"]);
});

test("writeConfig and removeConfig: the config is written from the template and deleted", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cpa-config-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const paths = { template: join(dir, "config.template.yaml"), config: join(dir, "config.yaml") };
  writeFileSync(paths.template, `host: "127.0.0.1"\naccess:\n  api-keys:\n    - "${PLACEHOLDER}"\n`);
  writeConfig(KEY, paths);
  assert.match(readFileSync(paths.config, "utf8"), new RegExp(`- "${KEY}"`));
  removeConfig(paths);
  assert.equal(existsSync(paths.config), false);
  removeConfig(paths); // already gone: no error
});

// ---- Linux: the key store, the owner-only folder, the console ------------------

import { spawnSync } from "node:child_process";
import { mkdirSync, statSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PANEL_NOTE, PATHS, STORE_ARGS, ownerOnly, startProblem, storeClientKey } from "../plugins/cookbook/skills/cookbook/scripts/cliproxyapi.mjs";

const SCRIPTS = fileURLToPath(new URL("../plugins/cookbook/skills/cookbook/scripts/", import.meta.url));
const notLinux = process.platform !== "linux" && "needs Linux";
const mode = (path) => statSync(path).mode & 0o777;

test("the proxy binary is the Linux one, and the launchers name nothing of Windows", () => {
  assert.ok(PATHS.exe.replaceAll("\\", "/").endsWith("/.local/share/cliproxyapi/bin/cli-proxy-api"));
  for (const file of ["cliproxyapi.mjs", "claude-pool.mjs", "codex-pool.mjs"]) {
    // `PATHS.exe` is the launcher's own name for the binary's path, not a file name.
    assert.doesNotMatch(readFileSync(join(SCRIPTS, file), "utf8").replaceAll("PATHS.exe", ""), /powershell|agent-key|\.exe\b|DPAPI|SIGBREAK/i, file);
  }
});

test("storeClientKey: the value goes to secret-tool on stdin, never as an argument or a variable, and is read back", async () => {
  const calls = [];
  const run = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0 }; };
  await storeClientKey(KEY, { run, read: async (name) => ({ key: name === "cliproxyapi-client" ? KEY : "other" }) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "secret-tool");
  assert.deepEqual(calls[0].args, ["store", "--label", "key/cliproxyapi-client", "service", "claude-keys", "name", "cliproxyapi-client"]);
  assert.equal(calls[0].args, STORE_ARGS);
  assert.equal(calls[0].opts.input, KEY);
  assert.equal(calls[0].opts.env, undefined, "no environment of its own: the value is in no variable");
  assert.ok(!JSON.stringify(calls[0].args).includes(KEY));
  assert.ok(calls[0].opts.timeout > 0);
});

test("storeClientKey: a failed save or a different value read back throws, and repeats nothing secret-tool said", async () => {
  const failed = () => ({ status: 1, stderr: "secret-tool: SECRET-DETAIL" });
  await assert.rejects(storeClientKey(KEY, { run: failed, read: async () => ({ key: KEY }) }), (e) => /saving the client key failed \(exit 1\)/.test(e.message) && !e.message.includes("SECRET-DETAIL") && !e.message.includes(KEY));
  const missing = () => ({ status: null, error: { code: "ENOENT" } });
  await assert.rejects(storeClientKey(KEY, { run: missing, read: async () => ({ key: KEY }) }), /saving the client key failed \(ENOENT\)/);
  await assert.rejects(storeClientKey(KEY, { run: () => ({ status: 0 }), read: async () => ({ key: "b".repeat(43) }) }), (e) => /read back .* is not the one just saved/.test(e.message) && !e.message.includes(KEY));
});

test("ownerOnly, writeConfig and takeLock: the private folder is 0700 and its files 0600, whatever was there", { skip: notLinux }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cpa-private-"));
  const before = process.umask();
  t.after(() => { process.umask(before); rmSync(dir, { recursive: true, force: true }); });
  const paths = { private: join(dir, "private"), template: join(dir, "config.template.yaml"), config: join(dir, "private", "config.yaml"), lock: join(dir, "private", "launcher.lock") };
  mkdirSync(paths.private, { mode: 0o755 });
  chmodSync(paths.private, 0o755);
  writeFileSync(paths.template, `api-keys:\n  - "${PLACEHOLDER}"\n`);
  process.umask(0o022);
  ownerOnly(paths);
  assert.equal(mode(paths.private), 0o700);
  assert.equal(process.umask(), 0o077, "the mask the proxy inherits");
  process.umask(0o022); // the modes below are asked for, not left to the mask
  writeFileSync(paths.config, "old", { mode: 0o644 });
  writeConfig(KEY, paths);
  assert.equal(mode(paths.config), 0o600);
  assert.equal(readFileSync(paths.config, "utf8"), `api-keys:\n  - "${KEY}"\n`);
  assert.equal(takeLock(paths.lock, 100, () => true), null);
  assert.equal(mode(paths.lock), 0o600);
});

test("panel's note names where the secret is and no clipboard", () => {
  assert.match(PANEL_NOTE, /not on the clipboard/);
  assert.match(PANEL_NOTE, /Proton Pass \(vault "Claude", item key\/cliproxyapi-management\)/);
});

test("claude-pool as a process: Claude Code gets the proxy's address, the stored client key and the caller's own home", { skip: notLinux }, (t) => {
  const home = mkdtempSync(join(tmpdir(), "cpa-pool-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const bin = join(home, ".local", "bin");
  const tools = join(home, "tools");
  mkdirSync(bin, { recursive: true });
  mkdirSync(tools);
  // A stand-in keyring that holds only the client key, and a stand-in Claude Code that prints what it got.
  writeFileSync(join(tools, "secret-tool"), '#!/bin/sh\n[ "$*" = "lookup service claude-keys name cliproxyapi-client" ] && printf %s synthetic-client-key && exit 0\nexit 1\n', { mode: 0o755 });
  writeFileSync(join(bin, "claude"), '#!/bin/sh\necho "url=$ANTHROPIC_BASE_URL token=$ANTHROPIC_AUTH_TOKEN home=$CLAUDE_CONFIG_DIR api=${ANTHROPIC_API_KEY:-none} oauth=${CLAUDE_CODE_OAUTH_TOKEN:-none} args=$*"\nexit 7\n', { mode: 0o755 });
  const env = { PATH: `${tools}:${process.env.PATH}`, HOME: home, ANTHROPIC_API_KEY: "must-not-pass", CLAUDE_CODE_OAUTH_TOKEN: "must-not-pass", ANTHROPIC_BASE_URL: "https://elsewhere.example", CLAUDE_CONFIG_DIR: "/elsewhere" };
  const r = spawnSync(process.execPath, [join(SCRIPTS, "claude-pool.mjs"), "-p", "hi"], { env, encoding: "utf8", timeout: 30_000 });
  assert.equal(r.stderr, "");
  // The home T3 Code set for the instance passes through: T3 reads the thread's history there.
  assert.equal(r.stdout, `url=http://127.0.0.1:8317 token=synthetic-client-key home=/elsewhere api=none oauth=none args=-p hi\n`);
  assert.equal(r.status, 7, "Claude Code's own exit code");
  // No home given: none is set, so Claude Code uses ~/.claude.
  const { CLAUDE_CONFIG_DIR: _, ...withoutHome } = env;
  const r2 = spawnSync(process.execPath, [join(SCRIPTS, "claude-pool.mjs")], { env: withoutHome, encoding: "utf8", timeout: 30_000 });
  assert.match(r2.stdout, / home= api=none /);
});

test("claude-pool as a process: without a stored client key it says so and starts nothing", { skip: notLinux }, (t) => {
  const home = mkdtempSync(join(tmpdir(), "cpa-pool-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const tools = join(home, "tools");
  mkdirSync(join(home, ".local", "bin"), { recursive: true });
  mkdirSync(tools);
  writeFileSync(join(tools, "secret-tool"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  writeFileSync(join(home, ".local", "bin", "claude"), "#!/bin/sh\necho started\n", { mode: 0o755 });
  const r = spawnSync(process.execPath, [join(SCRIPTS, "claude-pool.mjs")], { env: { PATH: `${tools}:${process.env.PATH}`, HOME: home }, encoding: "utf8", timeout: 30_000 });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^claude-pool: no client key \(no key is saved as "cliproxyapi-client"\); is the proxy running\? `systemctl --user status cliproxyapi`\n$/);
});

test("startProblem: no start without the pinned console, or with a .env the proxy would load", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cpa-start-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const paths = { console: join(dir, "static", "management.html"), dotenv: join(dir, ".env") };
  assert.match(startProblem(paths), /the pinned console is missing .*the proxy would download one/);
  assert.equal(startProblem(paths, { console: false }), null, "a sign-in serves no console");
  mkdirSync(join(dir, "static"));
  writeFileSync(paths.console, "<html></html>");
  assert.equal(startProblem(paths), null);
  writeFileSync(paths.dotenv, "MANAGEMENT_PASSWORD=x\n");
  assert.match(startProblem(paths), /\.env exists: the proxy would load it/);
  assert.match(startProblem(paths, { console: false }), /\.env exists/, "a sign-in loads it too");
});

// ---- The always-on user service --------------------------------------------------

import { homedir } from "node:os";
import { cleanupAfterStop, loginRoute } from "../plugins/cookbook/skills/cookbook/scripts/cliproxyapi.mjs";

test("cleanupAfterStop: deletes the config a stopped launcher left, but not one a live launcher holds the lock for", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "cpa-cleanup-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const paths = { config: join(dir, "config.yaml"), lock: join(dir, "launcher.lock") };
  // A live manual start or login holds the lock: its config stays.
  writeFileSync(paths.config, "x");
  writeFileSync(paths.lock, "4242");
  assert.equal(cleanupAfterStop(paths, (pid) => pid === 4242), false);
  assert.equal(existsSync(paths.config), true);
  // The lock's launcher is gone (the service's own, killed): the config goes; the stale lock stays for takeLock.
  assert.equal(cleanupAfterStop(paths, () => false), true);
  assert.equal(existsSync(paths.config), false);
  assert.equal(existsSync(paths.lock), true);
  // No lock, or one that holds no pid: the config goes.
  for (const lock of [null, "not a pid"]) {
    writeFileSync(paths.config, "x");
    if (lock === null) rmSync(paths.lock, { force: true }); else writeFileSync(paths.lock, lock);
    assert.equal(cleanupAfterStop(paths, () => true), true);
    assert.equal(existsSync(paths.config), false);
  }
});

test("loginRoute: a login beside the running service uses its proxy's config; alone it holds the lock itself", () => {
  assert.equal(loginRoute(null, false, false), "own");
  assert.equal(loginRoute(4242, true, true), "running", "the service holds the lock and its proxy is up");
  assert.equal(loginRoute(4242, false, true), "refuse", "no config: the holder is still starting");
  assert.equal(loginRoute(4242, true, false), "refuse", "nothing answers yet");
});

test("the user unit runs the installed launcher, cleans up through it, and keeps the hardening", () => {
  const unit = readFileSync(join(SCRIPTS, "cliproxyapi.service"), "utf8");
  const line = (key) => unit.split("\n").filter((l) => l.startsWith(`${key}=`)).map((l) => l.slice(key.length + 1));
  const launcher = "/usr/bin/node %h/.local/bin/cliproxyapi.mjs";
  assert.deepEqual(line("ExecStart"), [`${launcher} start`]);
  assert.deepEqual(line("ExecStopPost"), [`${launcher} cleanup`]);
  assert.deepEqual(line("UMask"), ["0077"]);
  assert.deepEqual(line("Restart"), ["always"]);
  assert.deepEqual(line("WantedBy"), ["graphical-session.target"]);
  // The launcher the unit names is the one whose PATHS point at the private folder in this home.
  assert.equal(PATHS.config, join(homedir(), ".local", "share", "cliproxyapi", "private", "config.yaml"));
});
