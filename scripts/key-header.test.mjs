// Tests of the header helper (skills/cookbook/scripts/key-header.mjs) and of the two
// launchers behind the `firecrawl` and `parallel-cli` commands. Every value is synthetic;
// the parts that need Windows' DPAPI run on Windows only.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { main as header } from "../plugins/cookbook/skills/cookbook/scripts/key-header.mjs";
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
  const code = await header(argv, { isTTY: false, write: (text) => out.push(text), say: (line) => err.push(line), ...deps });
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
    const got = await run(["absent"], { home: dir, loadFfi: noFfi, runPowerShell: noPowerShell });
    assert.deepEqual(got, { code: 1, out: "", err: "key-header: could not read key \"absent\" (no key is saved as \"absent\")\n" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
  const dir = home({ "synthetic.dpapi": protect(value) });
  try {
    const env = { ...process.env, USERPROFILE: dir };
    const got = spawnSync(process.execPath, [join(scripts, "key-header.mjs"), "synthetic"], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(got.status, 0, got.stderr);
    assert.deepEqual(JSON.parse(got.stdout), { Authorization: `Bearer ${value}` });
    assert.equal(got.stderr, "", "no warning about node:ffi on stderr");
    const none = spawnSync(process.execPath, [join(scripts, "key-header.mjs"), "absent"], { env, encoding: "utf8", timeout: 60000 });
    assert.equal(none.status, 1);
    assert.equal(none.stdout, "");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// The two launchers. Each test gives them a home folder with a stand-in for the pinned CLI.
const STUB = "process.stdout.write(JSON.stringify({ args: process.argv.slice(2), key: process.env.FIRECRAWL_API_KEY ?? null })); process.exit(4);";
function firecrawlHome(files) {
  const dir = home(files);
  const cli = join(dir, ".local", "share", "firecrawl-cli", "node_modules", "firecrawl-cli", "dist");
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, "index.js"), STUB);
  return dir;
}
function firecrawl(dir, extra, args = ["scrape", "https://example.test"]) {
  const env = { ...process.env, USERPROFILE: dir, HOME: dir, ...extra };
  for (const name of Object.keys(env)) if (/^firecrawl_/i.test(name) && !(name in extra)) delete env[name];
  return spawnSync(process.execPath, [join(scripts, "firecrawl-secure.mjs"), ...args], { env, encoding: "utf8", timeout: 60000 });
}

test("firecrawl launcher: no saved key means the CLI starts without one, and with its arguments and exit code", () => {
  const dir = firecrawlHome();
  try {
    const got = firecrawl(dir, { FIRECRAWL_API_KEY: "stale" });
    assert.equal(got.status, 4, got.stderr);
    assert.deepEqual(JSON.parse(got.stdout), { args: ["scrape", "https://example.test"], key: null });
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

test("Windows: the firecrawl launcher hands the stored key to the hosted API only", needsFfi, () => {
  const value = "synthetic-firecrawl-key";
  const dir = firecrawlHome({ "firecrawl.dpapi": protect(value) });
  try {
    for (const extra of [{}, { FIRECRAWL_API_URL: "https://api.firecrawl.dev/v2" }]) {
      const got = firecrawl(dir, extra);
      assert.equal(JSON.parse(got.stdout).key, value, got.stderr);
      assert.equal(got.stderr, "");
    }
    assert.equal(JSON.parse(firecrawl(dir, { FIRECRAWL_API_URL: "https://example.test/api.firecrawl.dev" }).stdout).key, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("parallel launcher: reads the key named parallel and starts the pinned CLI, which is absent here", () => {
  const dir = home();
  try {
    const got = spawnSync(process.execPath, [join(scripts, "parallel-secure.mjs"), "search", "x"], { env: { ...process.env, USERPROFILE: dir, HOME: dir }, encoding: "utf8", timeout: 60000 });
    assert.equal(got.status, 127, got.stderr);
    assert.match(got.stderr, /with-key: could not read key "parallel" \(no key is saved as "parallel"\); continuing without PARALLEL_API_KEY\n/);
    assert.match(got.stderr, /with-key: could not start .*parallel-cli\.exe \(ENOENT\)\n$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
