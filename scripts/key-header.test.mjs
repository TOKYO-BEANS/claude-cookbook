// Tests of the header helper (skills/cookbook/scripts/key-header.mjs) and of the two
// launchers behind the `firecrawl` and `parallel-cli` commands. Every value is synthetic;
// the parts that need Windows' DPAPI run on Windows only.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { HEADER_KEYS, main as header } from "../plugins/cookbook/skills/cookbook/scripts/key-header.mjs";
import { loadFfi } from "../plugins/cookbook/skills/cookbook/scripts/with-key.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, "..", "plugins", "cookbook", "skills", "cookbook", "scripts");
const windows = process.platform === "win32";
const ffi = windows ? await loadFfi().catch(() => null) : null;
const needsFfi = { skip: !ffi && "needs Windows and node:ffi" };

function home(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "key-header-test-"));
  mkdirSync(join(dir, ".secrets"));
  mkdirSync(join(dir, "AppData", "Local"), { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, ".secrets", name), text);
  return dir;
}
const noPowerShell = () => { throw new Error("PowerShell must not be started"); };
// On Linux the launcher reads the desktop's keyring through secret-tool on PATH. A process
// started by these tests finds this stand-in first instead: it answers "no such item" (exit 1),
// so no test reaches the real keyring and CI without secret-tool behaves the same.
function noKeyring(dir, env) {
  const bin = join(dir, "test-bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "secret-tool"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  return { ...env, PATH: `${bin}${delimiter}${env.PATH ?? ""}` };
}
const noFfi = async () => { throw Object.assign(new Error("No such built-in module: node:ffi"), { code: "ERR_UNKNOWN_BUILTIN_MODULE" }); };

// A DPAPI blob in the store's format, made without PowerShell.
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

// Runs the helper in this process with a pipe for stdout, as an MCP client starts it.
async function run(argv, deps) {
  const out = []; const err = [];
  const code = await header(argv, { isTTY: false, allowed: new Set(["k", "absent"]), write: (text) => out.push(text), say: (line) => err.push(line), ...deps });
  return { code, out: out.join(""), err: err.join("") };
}

test("the helper prints one Authorization header, in the form agent-key.ps1 prints", async () => {
  const dir = home({ "k.dpapi": "00" });
  try {
    const got = await run(["k"], { home: dir, platform: "win32", arch: "x64", loadFfi: noFfi, runPowerShell: () => JSON.stringify({ Authorization: "Bearer synthetic-key" }) });
    assert.deepEqual(got, { code: 0, out: "{\"Authorization\":\"Bearer synthetic-key\"}\n", err: "" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a key that cannot be read prints nothing, says why on stderr and ends with code 1", async () => {
  const dir = home();
  try {
    const got = await run(["absent"], { home: dir, platform: "win32", arch: "x64", loadFfi: noFfi, runPowerShell: noPowerShell });
    assert.deepEqual(got, { code: 1, out: "", err: "key-header: could not read key \"absent\" (no key is saved as \"absent\")\n" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("only a key the source lists for a header is printed: any other name is refused and not read", async () => {
  assert.deepEqual([...HEADER_KEYS], ["firecrawl"], "a new name here is a decision: the helper can print that key");
  const read = [];
  const readKey = async (name) => { read.push(name); return { key: "synthetic-key" }; };
  for (const name of ["anthropic-api", "k", "FIRECRAWL", "firecrawl "]) {
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
    const got = await run(argv, { readKey: noPowerShell });
    assert.equal(got.code, 2);
    assert.equal(got.out, "");
    assert.match(got.err, /usage: node key-header\.mjs <key-name>/);
  }
});

test("Windows: the helper as a process prints the header by the direct route", needsFfi, () => {
  const value = "synthetic-header-key-æøå";
  const dir = home({ "firecrawl.dpapi": protect(value) });
  const empty = home();
  try {
    const env = { ...process.env, USERPROFILE: dir };
    const got = spawnSync(process.execPath, [join(scripts, "key-header.mjs"), "firecrawl"], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(got.status, 0, got.stderr);
    assert.deepEqual(JSON.parse(got.stdout), { Authorization: `Bearer ${value}` });
    assert.equal(got.stderr, "", "no warning about node:ffi on stderr");
    const none = spawnSync(process.execPath, [join(scripts, "key-header.mjs"), "firecrawl"], { env: { ...env, USERPROFILE: empty }, encoding: "utf8", timeout: 60000 });
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
function firecrawlHome(files) {
  const dir = home(files);
  const cli = join(dir, ".local", "share", "firecrawl-cli", "node_modules", "firecrawl-cli", "dist");
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, "index.js"), STUB);
  return dir;
}
function firecrawl(dir, extra, args = ["scrape", "https://example.test"]) {
  const env = noKeyring(dir, { ...process.env, USERPROFILE: dir, HOME: dir, ...extra });
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

test("Windows: the firecrawl launcher hands the stored key to the hosted API only", needsFfi, () => {
  const value = "synthetic-firecrawl-key";
  const dir = firecrawlHome({ "firecrawl.dpapi": protect(value) });
  try {
    for (const [extra, args, url = HOSTED] of [[{}], [{ FIRECRAWL_API_URL: "https://api.firecrawl.dev/v2" }, undefined, "https://api.firecrawl.dev/v2"], [{}, ["scrape", "x", "--api-url", HOSTED]], [{}, ["search", "env"]], [{}, ["--status"]]]) {
      const got = firecrawl(dir, extra, args);
      assert.equal(JSON.parse(got.stdout).key, value, got.stderr);
      assert.equal(JSON.parse(got.stdout).url, url);
      assert.deepEqual(JSON.parse(got.stdout).updates, OFF);
      assert.equal(got.stderr, "");
    }
    for (const args of [["scrape", "x", "--api-url=https://example.test"], ["env"], ["launch", "claude"], ["--enable", "alexandria", "env"]]) assert.equal(JSON.parse(firecrawl(dir, {}, args).stdout).key, null, args.join(" "));
    assert.equal(JSON.parse(firecrawl(dir, { FIRECRAWL_API_URL: "https://example.test/api.firecrawl.dev" }).stdout).key, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("parallel launcher: reads the key named parallel and starts the pinned CLI, which is absent here", () => {
  const dir = home();
  try {
    const got = spawnSync(process.execPath, [join(scripts, "parallel-secure.mjs"), "search", "x"], { env: noKeyring(dir, { ...process.env, USERPROFILE: dir, HOME: dir }), encoding: "utf8", timeout: 60000 });
    assert.equal(got.status, 127, got.stderr);
    assert.match(got.stderr, /with-key: could not read key "parallel" \(no key is saved as "parallel"\); continuing without PARALLEL_API_KEY\n/);
    assert.match(got.stderr, windows ? /with-key: could not start .*parallel-cli\.exe \(ENOENT\)\n$/ : /with-key: could not start .*vendor[/\\]parallel-cli[/\\]parallel-cli \(ENOENT\)\n$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
