// Tests of the header helper (skills/cookbook/scripts/key-header.mjs) and of the two
// launchers behind the `firecrawl` and `parallel-cli` commands. Every value is synthetic, and
// a stand-in secret-tool keeps every test away from the real keyring.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { HEADER_KEYS, main as header } from "../plugins/cookbook/skills/cookbook/scripts/key-header.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, "..", "plugins", "cookbook", "skills", "cookbook", "scripts");
const windows = process.platform === "win32";
const onLinux = { skip: process.platform !== "linux" && "needs Linux" };

function home() {
  return mkdtempSync(join(tmpdir(), "key-header-test-"));
}
const notRead = () => { throw new Error("no key must be read"); };
// The launchers read the desktop's keyring through secret-tool on PATH. A process started by
// these tests finds this stand-in first instead. Without a value it answers "no such item"
// (exit 1); with one it prints that value for the one key name given, so no test reaches the
// real keyring and CI without secret-tool behaves the same.
function noKeyring(dir, env, saved = null) {
  const bin = join(dir, "test-bin");
  mkdirSync(bin, { recursive: true });
  const body = saved ? `[ "$*" = "lookup service claude-keys name ${saved.name}" ] && printf %s '${saved.value}' && exit 0\n` : "";
  writeFileSync(join(bin, "secret-tool"), `#!/bin/sh\n${body}exit 1\n`, { mode: 0o755 });
  return { ...env, PATH: `${bin}${delimiter}${env.PATH ?? ""}` };
}
const noItem = () => { throw Object.assign(new Error("no such item"), { status: 1 }); };

// Runs the helper in this process with a pipe for stdout, as an MCP client starts it.
async function run(argv, deps) {
  const out = []; const err = [];
  const code = await header(argv, { isTTY: false, allowed: new Set(["k", "absent"]), write: (text) => out.push(text), say: (line) => err.push(line), ...deps });
  return { code, out: out.join(""), err: err.join("") };
}

test("the helper prints one Authorization header", async () => {
  const got = await run(["k"], { platform: "linux", runSecretTool: () => "synthetic-key\n" });
  assert.deepEqual(got, { code: 0, out: "{\"Authorization\":\"Bearer synthetic-key\"}\n", err: "" });
});

test("a key that cannot be read prints nothing, says why on stderr and ends with code 1", async () => {
  const got = await run(["absent"], { platform: "linux", runSecretTool: noItem });
  assert.deepEqual(got, { code: 1, out: "", err: "key-header: could not read key \"absent\" (no key is saved as \"absent\")\n" });
  const off = await run(["k"], { platform: "win32", runSecretTool: notRead });
  assert.deepEqual(off, { code: 1, out: "", err: "key-header: could not read key \"k\" (the key store is read on Linux only (this is win32))\n" });
});

test("only a key the source lists for a header is printed: any other name is refused and not read", async () => {
  assert.deepEqual([...HEADER_KEYS], ["firecrawl"], "a new name here is a decision: the helper can print that key");
  const read = [];
  const readKey = async (name) => { read.push(name); return { key: "synthetic-key" }; };
  for (const name of ["parallel-api", "k", "FIRECRAWL", "firecrawl "]) {
    const got = await run([name], { allowed: undefined, readKey });
    assert.equal(got.code, 2, name);
    assert.equal(got.out, "");
    assert.match(got.err, /key-header: ".*" is not a key this helper prints \(it prints: firecrawl\)\n$/);
  }
  assert.deepEqual(read, []);
  assert.deepEqual(await run(["firecrawl"], { allowed: undefined, readKey }), { code: 0, out: "{\"Authorization\":\"Bearer synthetic-key\"}\n", err: "" });
});

test("the helper refuses to print to a terminal, and reads no key for it", async () => {
  const read = [];
  const got = await run(["k"], { isTTY: true, readKey: async (name) => { read.push(name); return { key: "synthetic-key" }; } });
  assert.equal(got.code, 2);
  assert.equal(got.out, "");
  assert.match(got.err, /key-header: stdout is a terminal/);
  assert.deepEqual(read, []);
});

test("usage: exactly one key name", async () => {
  for (const argv of [[], ["a", "b"], [""]]) {
    const got = await run(argv, { readKey: notRead });
    assert.equal(got.code, 2);
    assert.equal(got.out, "");
    assert.match(got.err, /usage: node key-header\.mjs <key-name>/);
  }
});

test("Linux: the helper as a process prints the header from the keyring", onLinux, () => {
  const value = "synthetic-header-key";
  const dir = home(); const empty = home();
  try {
    const env = noKeyring(dir, { ...process.env, HOME: dir }, { name: "firecrawl", value });
    const got = spawnSync(process.execPath, [join(scripts, "key-header.mjs"), "firecrawl"], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(got.status, 0, got.stderr);
    assert.deepEqual(JSON.parse(got.stdout), { Authorization: `Bearer ${value}` });
    assert.equal(got.stderr, "");
    const none = spawnSync(process.execPath, [join(scripts, "key-header.mjs"), "firecrawl"], { env: noKeyring(empty, { ...process.env, HOME: empty }), encoding: "utf8", timeout: 60000 });
    assert.equal(none.status, 1);
    assert.equal(none.stdout, "");
    const other = spawnSync(process.execPath, [join(scripts, "key-header.mjs"), "synthetic"], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(other.status, 2);
    assert.equal(other.stdout, "");
  } finally { for (const d of [dir, empty]) rmSync(d, { recursive: true, force: true }); }
});

// The two launchers. Each test gives them a home folder with a stand-in for the pinned CLI.
const STUB = "process.stdout.write(JSON.stringify({ args: process.argv.slice(2), key: process.env.FIRECRAWL_API_KEY ?? null, url: process.env.FIRECRAWL_API_URL ?? null, updates: [process.env.FIRECRAWL_NO_AUTO_UPDATE ?? null, process.env.FIRECRAWL_NO_UPDATE_CHECK ?? null] })); process.exit(4);";
const HOSTED = "https://api.firecrawl.dev";
// The pinned CLI never updates itself: both of its switches are set on every start.
const OFF = ["1", "1"];
const READ_TRIED = /with-key: could not read key "firecrawl" \(no key is saved as "firecrawl"\)/;
function firecrawlHome() {
  const dir = home();
  const cli = join(dir, ".local", "share", "firecrawl-cli", "node_modules", "firecrawl-cli", "dist");
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, "index.js"), STUB);
  return dir;
}
function firecrawl(dir, extra, args = ["scrape", "https://example.test"], saved = null) {
  const env = noKeyring(dir, { ...process.env, HOME: dir, ...extra }, saved);
  for (const name of Object.keys(env)) if (/^firecrawl_/i.test(name) && !(name in extra)) delete env[name];
  return spawnSync(process.execPath, [join(scripts, "firecrawl-secure.mjs"), ...args], { env, encoding: "utf8", timeout: 60000 });
}

test("firecrawl launcher: no saved key means the CLI starts without one, and with its arguments and exit code", () => {
  const dir = firecrawlHome();
  try {
    const got = firecrawl(dir, { FIRECRAWL_API_KEY: "stale" });
    assert.equal(got.status, 4, got.stderr);
    // The address is set on this path: one saved in the CLI's own credentials file ranks
    // below the environment, so it cannot send the stored key to another host.
    assert.deepEqual(JSON.parse(got.stdout), { args: ["scrape", "https://example.test"], key: null, url: HOSTED, updates: OFF });
    assert.match(got.stderr, /with-key: could not read key "firecrawl" \(no key is saved as "firecrawl"\); continuing without FIRECRAWL_API_KEY/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("firecrawl launcher: a self-hosted API gets no stored key and keeps the caller's own", () => {
  const dir = firecrawlHome();
  try {
    for (const url of ["http://localhost:3002", "http://api.firecrawl.dev", "https://example.test/api.firecrawl.dev", "https://api.firecrawl.dev.example.test", "not a url"]) {
      const got = firecrawl(dir, { FIRECRAWL_API_URL: url, FIRECRAWL_API_KEY: "own" });
      assert.equal(got.status, 4, got.stderr);
      assert.equal(JSON.parse(got.stdout).key, "own", url);
      assert.equal(got.stderr, "", `${url}: no key read is tried`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("firecrawl launcher: an --api-url argument for another host gets no stored key either", () => {
  const dir = firecrawlHome();
  try {
    for (const args of [["scrape", "https://example.test", "--api-url", "https://example.test"], ["--api-url=http://localhost:3002", "scrape", "x"], ["scrape", "x", "--api-url"],
      ["--api-url", "https://api.firecrawl.dev", "scrape", "x", "--api-url=https://example.test"]]) {
      const got = firecrawl(dir, { FIRECRAWL_API_KEY: "own" }, args);
      assert.equal(got.status, 4, got.stderr);
      assert.deepEqual(JSON.parse(got.stdout), { args, key: "own", url: null, updates: OFF });
      assert.equal(got.stderr, "", `${args.join(" ")}: no key read is tried`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("firecrawl launcher: only a listed command gets the stored key, and only known options may come before it", () => {
  const dir = firecrawlHome();
  try {
    // Setup commands, commands that start another program, an option's value that looks like a
    // command, an option this launcher does not know, a scrape option before the command.
    for (const args of [["env"], ["env", "--file", "x.env"], ["--api-url", HOSTED, "env"], ["-k", "scrape", "init"], ["setup"], ["make", "x"], ["config"], ["login"],
      ["launch", "claude", "--install"], ["launcher"], ["doctor"], ["view-config"], ["update"], ["--enable", "alexandria", "env"], ["--enable=alexandria", "env"],
      ["--some-new-option", "x", "scrape", "y"], ["-u", "https://example.test"],
      ["experimental", "download", "https://example.test"], ["x", "sql", "select 1"], ["sql", "select 1"], ["download", "https://example.test"], ["browser", "execute", "snapshot"], ["create", "agent"], ["logout"]]) {
      const got = firecrawl(dir, { FIRECRAWL_API_KEY: "own" }, args);
      assert.equal(got.status, 4, got.stderr);
      assert.deepEqual(JSON.parse(got.stdout), { args, key: "own", url: null, updates: OFF }, args.join(" "));
      assert.match(got.stderr, /^firecrawl-secure: no stored key for this call \([^)]+\)\n$/, args.join(" "));
    }
    // Nothing to call, nothing to say.
    for (const args of [[], ["--help"], ["-h"], ["--version"], ["-V"], ["help", "scrape"], ["version"]]) assert.equal(firecrawl(dir, {}, args).stderr, "", args.join(" "));
    // What the caller typed is not repeated when it is not a plain command name.
    for (const args of [["--token=synthetic-secret", "scrape"], ["Synthetic-Secret-Value"]]) assert.doesNotMatch(firecrawl(dir, {}, args).stderr, /synthetic-secret/i);
    // These get the key: here none is saved, so the read is tried and says so.
    for (const args of [["search", "env"], ["--status"], ["status"], ["https://example.test"], ["--enable", "alexandria", "scrape", "x"], ["--enable=alexandria", "scrape", "x"], ["-k", "own", "scrape", "x"], ["--api-url", HOSTED, "map", "x"],
      ["credit-usage", "--json"], ["credits"], ["list"], ["list-tools", "x"], ["research", "search-github", "x"], ["agent", "thread", "x"]]) {
      assert.match(firecrawl(dir, {}, args).stderr, READ_TRIED, args.join(" "));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("firecrawl launcher: the pinned CLI's self-update is off on both paths, whatever the caller had set", () => {
  const dir = firecrawlHome();
  try {
    // Another spelling of a name is the same variable on Windows, and another one elsewhere.
    for (const extra of [{ FIRECRAWL_NO_AUTO_UPDATE: "0", FIRECRAWL_NO_UPDATE_CHECK: "false" }, { firecrawl_no_auto_update: "0", Firecrawl_No_Update_Check: "" }]) {
      for (const args of [["scrape", "x"], ["--status"], ["env"], ["update"], ["--version"], []]) {
        const got = firecrawl(dir, extra, args);
        assert.equal(got.status, 4, got.stderr);
        assert.deepEqual(JSON.parse(got.stdout).updates, OFF, `${Object.keys(extra)[0]}: ${args.join(" ")}`);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test("Linux: the firecrawl launcher hands the stored key to the hosted API only", onLinux, () => {
  const value = "synthetic-firecrawl-key";
  const dir = firecrawlHome();
  const saved = { name: "firecrawl", value };
  try {
    for (const [extra, args, url = HOSTED] of [[{}], [{ FIRECRAWL_API_URL: "https://api.firecrawl.dev/v2" }, undefined, "https://api.firecrawl.dev/v2"], [{}, ["scrape", "x", "--api-url", HOSTED]], [{}, ["search", "env"]], [{}, ["--status"]]]) {
      const got = firecrawl(dir, extra, args, saved);
      assert.equal(JSON.parse(got.stdout).key, value, got.stderr);
      assert.equal(JSON.parse(got.stdout).url, url);
      assert.deepEqual(JSON.parse(got.stdout).updates, OFF);
      assert.equal(got.stderr, "");
    }
    for (const args of [["scrape", "x", "--api-url=https://example.test"], ["env"], ["launch", "claude"], ["--enable", "alexandria", "env"]]) assert.equal(JSON.parse(firecrawl(dir, {}, args, saved).stdout).key, null, args.join(" "));
    assert.equal(JSON.parse(firecrawl(dir, { FIRECRAWL_API_URL: "https://example.test/api.firecrawl.dev" }, undefined, saved).stdout).key, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("parallel launcher: reads the key named parallel and starts the pinned CLI, which is absent here", () => {
  const dir = home();
  try {
    const got = spawnSync(process.execPath, [join(scripts, "parallel-secure.mjs"), "search", "x"], { env: noKeyring(dir, { ...process.env, HOME: dir }), encoding: "utf8", timeout: 60000 });
    assert.equal(got.status, 127, got.stderr);
    assert.match(got.stderr, /with-key: could not read key "parallel" \(no key is saved as "parallel"\); continuing without PARALLEL_API_KEY\n/);
    assert.match(got.stderr, windows ? /with-key: could not start .*parallel-cli\.exe \(ENOENT\)\n$/ : /with-key: could not start .*vendor[/\\]parallel-cli[/\\]parallel-cli \(ENOENT\)\n$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
