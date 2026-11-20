// Tests for codex-pool: Codex through the local CLIProxyAPI with the client key from the key
// store, given only as a variable that the model provider's `env_key` names.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { KEY_VARIABLE, OVERRIDES, codexArgs, codexEnv, refused } from "../plugins/cookbook/skills/cookbook/scripts/codex-pool.mjs";

const SCRIPT = fileURLToPath(new URL("../plugins/cookbook/skills/cookbook/scripts/codex-pool.mjs", import.meta.url));
const notLinux = process.platform !== "linux" && "needs Linux";

test("the provider points at the local proxy and names the key's variable, never a key", () => {
  assert.ok(OVERRIDES.includes('model_provider="cliproxyapi"'));
  assert.ok(OVERRIDES.includes('model_providers.cliproxyapi.base_url="http://127.0.0.1:8317/v1"'));
  assert.ok(OVERRIDES.includes(`model_providers.cliproxyapi.env_key="${KEY_VARIABLE}"`));
  assert.ok(OVERRIDES.includes('model_providers.cliproxyapi.wire_api="responses"'));
  assert.ok(!OVERRIDES.some((o) => /bearer|api_key|http_headers|auth/i.test(o.replace("env_key", ""))), "no key in an override");
});

test("codexArgs: the overrides go first, as -c pairs, then the caller's arguments unchanged", () => {
  const args = codexArgs(["app-server", "--listen", "stdio://"]);
  assert.deepEqual(args.slice(-3), ["app-server", "--listen", "stdio://"]);
  assert.deepEqual(args.slice(0, OVERRIDES.length * 2), OVERRIDES.flatMap((o) => ["-c", o]));
});

test("codexEnv: other keys and addresses go, the client key is in its one variable", () => {
  const env = codexEnv({ PATH: "/bin", OPENAI_API_KEY: "x", CODEX_API_KEY: "y", OPENAI_BASE_URL: "https://elsewhere.example", [KEY_VARIABLE]: "stale", CODEX_HOME: "/h" }, "k", "linux");
  assert.deepEqual(env, { PATH: "/bin", CODEX_HOME: "/h", [KEY_VARIABLE]: "k" });
});

test("refused: login and logout belong to the plain codex; login status only reads", () => {
  for (const args of [["logout"], ["login"], ["login", "--device-auth"], ["login", "--with-api-key"]]) assert.equal(refused(args), true, args.join(" "));
  for (const args of [[], ["login", "status"], ["exec", "login"], ["app-server"], ["--version"]]) assert.equal(refused(args), false, args.join(" "));
});

test("refused: global options and their values before the subcommand are skipped", () => {
  for (const args of [["-c", "foo=1", "logout"], ["--profile", "x", "login"], ["-m", "gpt", "--oss", "logout"], ["--config=foo=1", "login", "--device-auth"], ["-C", "/tmp", "-s", "read-only", "logout"]]) {
    assert.equal(refused(args), true, args.join(" "));
  }
  for (const args of [["-c", "foo=1", "login", "status"], ["-m", "logout", "exec", "hi"], ["--", "logout"], ["-c", "logout"]]) {
    assert.equal(refused(args), false, args.join(" "));
  }
});

function fakeHome(t, secretTool) {
  const home = mkdtempSync(join(tmpdir(), "codex-pool-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const bin = join(home, ".local", "bin");
  const tools = join(home, "tools");
  mkdirSync(bin, { recursive: true });
  mkdirSync(tools);
  writeFileSync(join(tools, "secret-tool"), secretTool, { mode: 0o755 });
  // A stand-in Codex that prints what it got.
  writeFileSync(join(bin, "codex"), `#!/bin/sh\necho "key=$${KEY_VARIABLE} openai=\${OPENAI_API_KEY:-none} home=\${CODEX_HOME:-none} args=$*"\nexit 7\n`, { mode: 0o755 });
  return { home, tools };
}

test("codex-pool as a process: Codex gets the overrides, the stored key in its variable and the caller's home", { skip: notLinux }, (t) => {
  const { home, tools } = fakeHome(t, '#!/bin/sh\n[ "$*" = "lookup service claude-keys name cliproxyapi-client" ] && printf %s synthetic-client-key && exit 0\nexit 1\n');
  const env = { PATH: `${tools}:${process.env.PATH}`, HOME: home, OPENAI_API_KEY: "must-not-pass", CODEX_HOME: "/elsewhere" };
  const r = spawnSync(process.execPath, [SCRIPT, "exec", "hi"], { env, encoding: "utf8", timeout: 30_000 });
  assert.equal(r.stderr, "");
  assert.equal(r.stdout, `key=synthetic-client-key openai=none home=/elsewhere args=${codexArgs(["exec", "hi"]).join(" ")}\n`);
  assert.equal(r.status, 7, "Codex's own exit code");
});

test("codex-pool as a process: without a stored client key it says so and starts nothing", { skip: notLinux }, (t) => {
  const { home, tools } = fakeHome(t, "#!/bin/sh\nexit 1\n");
  const r = spawnSync(process.execPath, [SCRIPT], { env: { PATH: `${tools}:${process.env.PATH}`, HOME: home }, encoding: "utf8", timeout: 30_000 });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^codex-pool: no client key \(no key is saved as "cliproxyapi-client"\); is the proxy running\? `systemctl --user status cliproxyapi`\n$/);
});

test("codex-pool as a process: a sign-in is refused before the key is read", { skip: notLinux }, (t) => {
  const { home, tools } = fakeHome(t, "#!/bin/sh\necho read >&2\nexit 1\n");
  const r = spawnSync(process.execPath, [SCRIPT, "logout"], { env: { PATH: `${tools}:${process.env.PATH}`, HOME: home }, encoding: "utf8", timeout: 30_000 });
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^codex-pool: sign-ins belong to the plain `codex`/);
});
