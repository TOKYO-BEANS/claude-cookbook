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

test("proxyEnv: drops the proxy's secret variables in any case on Windows and adds the given ones", () => {
  const env = proxyEnv({ Path: "x", management_password: "old", PgStore_Dsn: "y", HOME_JWT: "z", writable_path: "w" }, { MANAGEMENT_PASSWORD: "new" }, "win32");
  assert.deepEqual(env, { Path: "x", MANAGEMENT_PASSWORD: "new" });
});

test("proxyEnv: elsewhere only the exact names are dropped", () => {
  assert.deepEqual(proxyEnv({ management_password: "kept", MANAGEMENT_PASSWORD: "gone" }, {}, "linux"), { management_password: "kept" });
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
