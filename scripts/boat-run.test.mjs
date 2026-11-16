// boat-run.mjs: the one route to a boat sandbox for a job (skills/cookbook/scripts).
// The limits are numbers in the script, not a model's judgement, and an upload holds
// only committed files that passed a secret scan.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { DATA_SHAPED, LIMITS, NOT_STARTED, boatArgv, dataFiles, gate, listEntry, main, normalKey, onList, parseArgs, repoKey, runEnd, scan, stage, takeSlot, unnamed } from "../plugins/cookbook/skills/cookbook/scripts/boat-run.mjs";

// The plan as `boat limits --json` printed it on 16 November 2026, without the unused keys.
const plan = (over = {}) => ({
  activeSandboxes: 0,
  canStart: true,
  keepGoing: { enabled: false },
  subscriptionQuotaSeconds: 2000000,
  subscriptionRemainingSeconds: 1999000,
  wallet: { balanceDollars: 0 },
  ...over,
});
const args = (...a) => parseArgs(a);

test("arguments: a timeout and a command are required; small is the default size", async () => {
  assert.deepEqual(args("--timeout", "300", "--", "npm", "test"), { type: "small", timeout: 300, push: null, command: ["npm", "test"] });
  assert.deepEqual(args("--type", "large", "--timeout", "60", "--push", ".", "--", "make").type, "large");
  assert.match(args("--", "npm", "test").error, /--timeout/);
  assert.match(args("--timeout", "300").error, /command/);
  assert.match(args("--timeout", "300", "--").error, /command/);
});

test("arguments: only whole seconds, a known size and known options", async () => {
  for (const bad of ["0", "-5", "1.5", "abc", "", "1e3", " 30"]) assert.match(args("--timeout", bad, "--", "x").error, /--timeout/, bad);
  assert.match(args("--type", "xlarge", "--timeout", "60", "--", "x").error, /--type/);
  assert.match(args("--no-auto-stop", "--timeout", "60", "--", "x").error, /--no-auto-stop/);
  // A kept sandbox would run on outside the limits: the script has no way to keep one.
  assert.match(args("--keep", "--timeout", "60", "--", "x").error, /--keep/);
  assert.match(args("--env", "A=b", "--timeout", "60", "--", "x").error, /--env/);
  assert.match(args("--timeout", "60", "--push", "--", "x").error, /--push/);
});

test("everything after -- is the command, also when it looks like an option", async () => {
  assert.deepEqual(args("--timeout", "60", "--", "boat", "--no-env", "--type", "large").command, ["boat", "--no-env", "--type", "large"]);
});

test("a run takes at most an hour of the plan's time: small counts half, large double", async () => {
  assert.equal(gate(args("--timeout", "7200", "--", "x"), plan()), null);
  assert.match(gate(args("--timeout", "7201", "--", "x"), plan()), /owner/);
  assert.equal(gate(args("--type", "default", "--timeout", "3600", "--", "x"), plan()), null);
  assert.match(gate(args("--type", "default", "--timeout", "3601", "--", "x"), plan()), /owner/);
  assert.equal(gate(args("--type", "large", "--timeout", "1800", "--", "x"), plan()), null);
  assert.match(gate(args("--type", "large", "--timeout", "1801", "--", "x"), plan()), /owner/);
});

test("at most ten sandboxes at once", async () => {
  assert.equal(LIMITS.active, 10);
  assert.equal(gate(args("--timeout", "60", "--", "x"), plan({ activeSandboxes: 9 })), null);
  assert.match(gate(args("--timeout", "60", "--", "x"), plan({ activeSandboxes: 10 })), /10 sandboxes/);
});

test("a fifth of the month's time is kept back for the vetting step, with the other nine places counted as full", async () => {
  const run = args("--type", "default", "--timeout", "1000", "--", "x");
  // 400,000 kept back, 1,000 for this run, 9 x 3,600 for runs that may be under way.
  assert.equal(gate(run, plan({ subscriptionRemainingSeconds: 433400 })), null);
  assert.match(gate(run, plan({ subscriptionRemainingSeconds: 433399 })), /kept back/);
});

test("no run while something could bill past the plan, or while the plan cannot be read", async () => {
  const run = args("--timeout", "60", "--", "x");
  assert.match(gate(run, plan({ keepGoing: { enabled: true } })), /extra starts/);
  assert.match(gate(run, plan({ wallet: { balanceDollars: 5 } })), /wallet/);
  assert.match(gate(run, plan({ canStart: false })), /cannot start/);
  for (const broken of [null, {}, "text", plan({ subscriptionQuotaSeconds: "many" }), plan({ activeSandboxes: undefined }), plan({ keepGoing: undefined }), plan({ wallet: undefined })]) {
    assert.match(gate(run, broken), /no result/);
  }
});

test("the boat command always has the size, --no-env and the timeout, and never more options", async () => {
  assert.deepEqual(boatArgv(args("--timeout", "300", "--", "npm", "test"), null), ["run", "--type", "small", "--no-env", "--timeout", "300", "--", "npm", "test"]);
  const sent = boatArgv(args("--type", "large", "--timeout", "60", "--push", ".", "--", "make", "-j8"), "/tmp/s/repo");
  assert.deepEqual(sent, ["run", "--type", "large", "--no-env", "--timeout", "60", "--push", "/tmp/s/repo", "--", "make", "-j8"]);
  assert.ok(!sent.slice(0, sent.indexOf("--")).includes("--keep"));
});

// A real repository in a temporary folder: git is on every machine that runs these tests.
function repo() {
  const root = mkdtempSync(join(tmpdir(), "boat-run-test-"));
  const dir = join(root, "shop");
  const git = (...a) => {
    const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "core.autocrlf=false", ...a], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  spawnSync("git", ["init", "-q", dir], { encoding: "utf8" });
  writeFileSync(join(dir, "app.js"), "one\n");
  writeFileSync(join(dir, ".gitignore"), "ignored.txt\n");
  git("add", "-A");
  git("commit", "-q", "-m", "first");
  return { root, dir, git };
}
const listed = (dir) => readdirSync(dir).sort();

test("an upload holds the tracked files with their uncommitted edits, never an untracked file", async () => {
  const { root, dir, git } = repo();
  try {
    writeFileSync(join(dir, "app.js"), "two\n"); // an edit to a tracked file, not committed
    writeFileSync(join(dir, "customers.csv"), "a,b\n"); // untracked and not ignored
    writeFileSync(join(dir, "ignored.txt"), "x\n");
    const staged = stage(dir);
    try {
      assert.equal(basename(staged.dir), "shop");
      assert.deepEqual(listed(staged.dir), [".gitignore", "app.js"]);
      assert.equal(readFileSync(join(staged.dir, "app.js"), "utf8"), "two\n");
      assert.ok(!existsSync(join(staged.dir, ".git")));
      // The working folder is as it was: nothing stashed, nothing committed.
      assert.equal(readFileSync(join(dir, "app.js"), "utf8"), "two\n");
      assert.equal(git("stash", "list"), "");
      assert.ok(existsSync(join(dir, "customers.csv")));
    } finally {
      staged.remove();
    }
    assert.ok(!existsSync(staged.dir));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an upload of a clean repository is its last commit; a subfolder sends only itself", async () => {
  const { root, dir, git } = repo();
  try {
    spawnSync("git", ["-C", dir, "mv", "app.js", "moved.js"]);
    git("commit", "-q", "-m", "second");
    const whole = stage(dir);
    assert.deepEqual(listed(whole.dir), [".gitignore", "moved.js"]);
    assert.equal(whole.prefix, "");
    whole.remove();
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "inner.js"), "x\n");
    git("add", "-A");
    git("commit", "-q", "-m", "third");
    const part = stage(join(dir, "sub"));
    assert.equal(basename(part.dir), "sub");
    assert.equal(part.prefix, "sub/");
    assert.deepEqual(listed(part.dir), ["inner.js"]);
    part.remove();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a folder that is not in a git repository, or has no commit, is not uploaded", async () => {
  const plain = mkdtempSync(join(tmpdir(), "boat-run-plain-"));
  try {
    assert.throws(() => stage(plain), /git repository/);
    spawnSync("git", ["init", "-q", plain]);
    assert.throws(() => stage(plain), /commit/);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

test("a tracked symbolic link stops the upload: it could lead outside the copy", { skip: process.platform === "win32" }, async () => {
  const { root, dir, git } = repo();
  try {
    symlinkSync("/etc", join(dir, "way-out"));
    git("add", "-A");
    git("commit", "-q", "-m", "link");
    assert.throws(() => stage(dir), /symbolic link \(way-out\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const hasGitleaks = spawnSync("gitleaks", ["version"], { encoding: "utf8" }).status === 0;

test("the scan passes a plain copy and stops on a key, naming the rule and file and never the key", { skip: !hasGitleaks }, async () => {
  const tmp = mkdtempSync(join(tmpdir(), "boat-run-scan-"));
  try {
    const dir = join(tmp, "shop");
    mkdirSync(dir);
    writeFileSync(join(dir, "app.js"), "console.log(1);\n");
    assert.deepEqual(scan(dir, tmp), { ok: true });
    // Put together here, from made-up text, so that no scanner reads this test file as a leak.
    const body = "MIIEpAIBAAKCAQEA7bq98Q2n1x0Jw3kPz5m4Vt8sYcLr6uHdEoGf";
    const key = [["-----BEGIN", "RSA PRIVATE KEY-----"].join(" "), ...Array(6).fill(body), ["-----END", "RSA PRIVATE KEY-----"].join(" "), ""].join("\n");
    writeFileSync(join(dir, "deploy.pem"), key);
    const first = scan(dir, tmp);
    assert.equal(first.ok, false);
    // A repository's own ignore file does not quiet the scan: the finding's real fingerprint,
    // as Gitleaks reported it, is written there, and the scan still stops. The file goes up
    // with the copy as it was.
    const ignore = JSON.parse(readFileSync(join(tmp, "gitleaks.json"), "utf8")).map((f) => f.Fingerprint).join("\n") + "\n";
    assert.match(ignore, /private-key/);
    writeFileSync(join(dir, ".gitleaksignore"), ignore);
    const r = scan(dir, tmp);
    assert.equal(readFileSync(join(dir, ".gitleaksignore"), "utf8"), ignore);
    assert.equal(r.ok, false);
    assert.match(r.reason, /^1 finding \(private-key in shop\/deploy\.pem\): a security finding goes to the owner$/);
    assert.ok(!r.reason.includes(body));
    // Nor does a comment in the file that asks the scanner to look away.
    rmSync(join(dir, "deploy.pem"));
    const value = ["ABCDEFGHIJ0123456789", "abcdefghij0123456789"].join("");
    writeFileSync(join(dir, "config.js"), `const secret = "${value}"; // ${["gitleaks", "allow"].join(":")}\n`);
    const quiet = scan(dir, tmp);
    assert.equal(quiet.ok, false);
    assert.match(quiet.reason, /^1 finding \(generic-api-key in shop\/config\.js\)/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("without gitleaks the scan has no result", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "boat-run-scan-"));
  const path = process.env.PATH;
  try {
    process.env.PATH = tmp;
    assert.match(scan(tmp, tmp).reason, /^no result/);
  } finally {
    process.env.PATH = path;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("ten runs at once from this PC: the eleventh is refused; a dead run's place is free again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "boat-run-slots-"));
  try {
    const live = new Set();
    const take = (pid) => { live.add(pid); return takeSlot(dir, { pid, alive: (p) => live.has(p) }); };
    const held = [];
    for (let pid = 101; pid <= 110; pid += 1) held.push(take(pid));
    assert.ok(held.every(Boolean));
    assert.equal(take(111), null);
    assert.equal(readdirSync(dir).length, 10, "a refused run leaves no file");
    held[3].release();
    assert.ok(take(112));
    assert.equal(take(113), null);
    live.delete(105); // that run died without releasing
    assert.ok(take(114));
    assert.ok(!readdirSync(dir).some((n) => n.startsWith("run-105-")), "the dead run's file is cleared");
    // Files that are not a run's are neither counted nor removed.
    writeFileSync(join(dir, "notes.txt"), "x");
    writeFileSync(join(dir, "run-abc-1"), "x");
    assert.equal(take(115), null);
    assert.ok(existsSync(join(dir, "notes.txt")) && existsSync(join(dir, "run-abc-1")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("two runs that arrive together at the last place: never both pass", async () => {
  const dir = mkdtempSync(join(tmpdir(), "boat-run-slots-"));
  try {
    const alive = () => true;
    for (let pid = 201; pid <= 209; pid += 1) assert.ok(takeSlot(dir, { pid, alive }));
    // The other arrival has written its file and not yet counted: this one sees ten others.
    writeFileSync(join(dir, "run-210-other"), "");
    assert.equal(takeSlot(dir, { pid: 211, alive }), null);
    // And one process can hold several places: the file's name is its own each time.
    rmSync(join(dir, "run-210-other"));
    assert.ok(takeSlot(dir, { pid: 201, alive }));
    assert.equal(takeSlot(dir, { pid: 201, alive }), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the upload list names a repository by its origin, in one spelling", async () => {
  for (const url of ["https://github.com/Some-Org/Shop.git", "git@github.com:Some-Org/Shop.git", "ssh://git@github.com/some-org/shop", "https://user:pass@github.com/some-org/shop/", " github.com/some-org/shop "]) {
    assert.equal(normalKey(url), "github.com/some-org/shop", url);
  }
  assert.equal(normalKey("C:\\Users\\me\\Shop"), "c:/users/me/shop");
  assert.equal(normalKey("/home/me/shop/"), "/home/me/shop");
});

test("only a whole line of the list allows a repository: no patterns, no prefixes, comments ignored", async () => {
  const list = "# allowed for upload\r\ngithub.com/some-org/shop  # code only\n\nhttps://github.com/Some-Org/Tools.git\n";
  assert.ok(onList("github.com/some-org/shop", list));
  assert.ok(onList("github.com/some-org/tools", list));
  for (const no of ["github.com/some-org/shop-data", "github.com/some-org", "github.com/other/shop", "", null]) assert.ok(!onList(no, list), String(no));
  assert.ok(!onList("github.com/some-org/shop", ""));
  assert.ok(!onList("github.com/some-org/shop", "github.com/some-org/*\n*\n"));
});

test("a list line may name the data-shaped files that were looked at, by path or by folder", async () => {
  const list = "github.com/some-org/shop  data: fixtures/prices.csv db/migrations/ .\\docs\\export.xlsx  # looked at 16 Nov\ngithub.com/some-org/tools\ngithub.com/some-org/site data:\n";
  assert.deepEqual(listEntry("github.com/some-org/shop", list), { data: ["fixtures/prices.csv", "db/migrations/", "docs/export.xlsx"] });
  assert.deepEqual(listEntry("github.com/some-org/tools", list), { data: [] });
  assert.deepEqual(listEntry("github.com/some-org/site", list), { data: [] });
  assert.equal(listEntry("github.com/some-org/other", list), null);
  // "data:" is not part of a name, and a name that merely ends like one is another repository.
  assert.equal(listEntry("github.com/some-org/shop data: fixtures/prices.csv", list), null);
  assert.ok(!onList("github.com/some-org/shopdata:", list));
});

test("a named file is that file, a named folder is everything under it, and nothing else", async () => {
  const files = ["db/migrations/001.sql", "db/migrations/old/000.sql", "db/dump.sql", "fixtures/prices.csv", "fixtures/prices.csv.bak", "fixtures2/prices.csv"];
  assert.deepEqual(unnamed(files, ["fixtures/prices.csv", "db/migrations/"]), ["db/dump.sql", "fixtures/prices.csv.bak", "fixtures2/prices.csv"]);
  assert.deepEqual(unnamed(files, ["fixtures", "db"]), files, "a folder without its slash names nothing under it");
  assert.deepEqual(unnamed(files, []), files);
  assert.deepEqual(unnamed([], ["x/"]), []);
});

test("data-shaped files are found at any depth by their name, in any case; code and text are not", async () => {
  const dir = mkdtempSync(join(tmpdir(), "boat-run-data-"));
  try {
    mkdirSync(join(dir, "src", "deep"), { recursive: true });
    for (const f of ["app.js", "README.md", "package.json", "data.json", "src/list.txt", "src/Customers.CSV", "src/deep/orders.sqlite", "backup.tar.gz", "export.xlsx", "schema.sql"]) writeFileSync(join(dir, f), "x");
    assert.deepEqual(dataFiles(dir), ["backup.tar.gz", "export.xlsx", "schema.sql", "src/Customers.CSV", "src/deep/orders.sqlite"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  for (const yes of ["a.csv", "a.TSV", "a.xls", "a.parquet", "mail.pst", "people.vcf", "a.jsonl", "a.dump", "a.zip", "a.db"]) assert.ok(DATA_SHAPED.test(yes), yes);
  for (const no of ["a.js", "a.json", "a.yaml", "a.md", "csv.js", "a.csv.md", "sql", "a.svg", "a.png", "a.lock"]) assert.ok(!DATA_SHAPED.test(no), no);
});

test("a repository's name on the list: its origin, or its folder when it has none; none outside git", async () => {
  const { root, dir } = repo();
  try {
    assert.equal(repoKey(dir), normalKey(spawnSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout));
    spawnSync("git", ["-C", dir, "remote", "add", "origin", "git@github.com:Some-Org/Shop.git"]);
    assert.equal(repoKey(dir), "github.com/some-org/shop");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const plain = mkdtempSync(join(tmpdir(), "boat-run-plain-"));
  try {
    assert.equal(repoKey(plain), null);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

// main with every outside program replaced: what runs, in which order, and what stops it.
function world(over = {}) {
  const calls = [];
  const out = [];
  const removed = [];
  const released = [];
  const deps = {
    limits: () => plan(),
    slot: () => ({ release: () => released.push("slot") }),
    permit: (folder) => { calls.push(["permit", folder]); return { ok: true, key: "github.com/some-org/shop", list: "/state/upload-allowed.txt", data: ["fixtures/prices.csv"] }; },
    dataFiles: (dir) => { calls.push(["data", dir]); return ["fixtures/prices.csv"]; },
    stage: (folder) => { calls.push(["stage", folder]); return { dir: "/tmp/s/shop", remove: () => removed.push("/tmp/s/shop") }; },
    scan: (dir) => { calls.push(["scan", dir]); return { ok: true }; },
    boat: async (argv) => { calls.push(["boat", ...argv]); return { code: 0, id: "bx_1abcd", deleted: true }; },
    remove: (id) => { calls.push(["remove", id]); return true; },
    say: (line) => out.push(line),
    ...over,
  };
  return { calls, out, removed, released, deps };
}

test("a run without an upload: the gate, then boat, and the command's exit code comes back", async () => {
  const w = world({ boat: async (argv) => { w.calls.push(["boat", ...argv]); return { code: 7, id: "bx_1abcd", deleted: true }; } });
  assert.equal(await main(["--timeout", "120", "--", "node", "-v"], w.deps), 7);
  assert.deepEqual(w.calls, [["boat", "run", "--type", "small", "--no-env", "--timeout", "120", "--", "node", "-v"]]);
});

test("a run with an upload: staged, scanned, pushed from the staged copy, and the copy removed", async () => {
  const w = world();
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), 0);
  assert.deepEqual(w.calls.map((c) => c[0]), ["permit", "stage", "data", "scan", "boat"]);
  assert.deepEqual(w.calls[4].slice(1), ["run", "--type", "small", "--no-env", "--timeout", "120", "--push", "/tmp/s/shop", "--", "npm", "test"]);
  assert.deepEqual(w.removed, ["/tmp/s/shop"]);
});

test("a secret in the upload, or a scan with no result, stops the run before boat and removes the copy", async () => {
  for (const scan of [{ ok: false, reason: "2 findings" }, { ok: false, reason: "no result (gitleaks did not run)" }]) {
    const w = world({ scan: () => scan });
    assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), NOT_STARTED);
    assert.ok(!w.calls.some((c) => c[0] === "boat"));
    assert.deepEqual(w.removed, ["/tmp/s/shop"]);
    assert.match(w.out.join("\n"), /BOAT-RUN: not started: the secret scan of the upload/);
  }
});

test("a refused gate or bad arguments start nothing, and say why on one line", async () => {
  const full = world({ limits: () => plan({ activeSandboxes: 10 }) });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], full.deps), NOT_STARTED);
  assert.deepEqual(full.calls, []);
  assert.match(full.out.join("\n"), /^BOAT-RUN: not started: 10 sandboxes/);
  const bad = world();
  assert.equal(await main(["--", "npm", "test"], bad.deps), NOT_STARTED);
  assert.deepEqual(bad.calls, []);
  const unread = world({ limits: () => { throw new Error("boat limits answered 401"); } });
  assert.equal(await main(["--timeout", "120", "--", "x"], unread.deps), NOT_STARTED);
  assert.match(unread.out.join("\n"), /no result/);
});

test("the staged copy is removed and the slot released when boat itself fails to start", async () => {
  const w = world({ boat: () => { throw new Error("spawn failed"); } });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "x"], w.deps), NOT_STARTED);
  assert.deepEqual(w.removed, ["/tmp/s/shop"]);
  assert.deepEqual(w.released, ["slot"]);
});

test("a repository that is not on the upload list is not copied, scanned or sent", async () => {
  const w = world({ permit: () => ({ ok: false, key: "github.com/some-org/shop-data", list: "/state/upload-allowed.txt" }) });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), NOT_STARTED);
  assert.deepEqual(w.calls, []);
  assert.match(w.out.join("\n"), /^BOAT-RUN: not started: github\.com\/some-org\/shop-data is not on the upload list \(\/state\/upload-allowed\.txt\)/);
  assert.deepEqual(w.released, ["slot"]);
  // A run with no upload needs no place on the list.
  const none = world({ permit: () => { throw new Error("not asked"); } });
  assert.equal(await main(["--timeout", "120", "--", "node", "-v"], none.deps), 0);
});

test("a count of runs that cannot be kept starts nothing and says so, with the code of a run that did not start", async () => {
  const w = world({ slot: () => { throw Object.assign(new Error("EACCES: permission denied, open 'C:\\state\\slots\\run-1-x'"), { code: "EACCES" }); } });
  assert.equal(await main(["--timeout", "120", "--", "x"], w.deps), NOT_STARTED);
  assert.deepEqual(w.calls, []);
  assert.match(w.out.join("\n"), /^BOAT-RUN: not started: no result \(the count of runs under way could not be kept: EACCES\)$/);
});

test("a data-shaped file the list does not name stops the upload before the scan, and the copy is removed", async () => {
  const w = world({ dataFiles: () => ["fixtures/prices.csv", "exports/customers.xlsx", "db/dump.sql"] });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), NOT_STARTED);
  assert.ok(!w.calls.some((c) => c[0] === "scan" || c[0] === "boat"));
  assert.deepEqual(w.removed, ["/tmp/s/shop"]);
  assert.match(w.out.join("\n"), /^BOAT-RUN: not started: the upload holds 2 data-shaped files the upload list does not name \(exports\/customers\.xlsx; db\/dump\.sql\)/);
  // Six of them: five are shown and the rest is marked.
  const many = world({ dataFiles: () => ["a.csv", "b.csv", "c.csv", "d.csv", "e.csv", "f.csv"] });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "x"], many.deps), NOT_STARTED);
  assert.match(many.out.join("\n"), /holds 6 data-shaped files .*\(a\.csv; b\.csv; c\.csv; d\.csv; e\.csv; \.\.\.\)/);
});

test("an upload of a subfolder: its data-shaped files are named from the repository's top", async () => {
  const sub = { stage: () => ({ dir: "/tmp/s/src", prefix: "src/", remove: () => {} }), dataFiles: () => ["data/customers.csv"] };
  const list = (data) => ({ permit: () => ({ ok: true, key: "github.com/some-org/shop", list: "/state/upload-allowed.txt", data }) });
  // A folder "data/" at the top of the repository is another folder than "src/data/".
  const other = world({ ...sub, ...list(["data/"]) });
  assert.equal(await main(["--timeout", "120", "--push", "src", "--", "x"], other.deps), NOT_STARTED);
  assert.ok(!other.calls.some((c) => c[0] === "boat"));
  assert.match(other.out.join("\n"), /holds 1 data-shaped file the upload list does not name \(src\/data\/customers\.csv\)/);
  for (const named of [["src/data/"], ["src/data/customers.csv"], ["src/"]]) {
    const w = world({ ...sub, ...list(named) });
    assert.equal(await main(["--timeout", "120", "--push", "src", "--", "x"], w.deps), 0, named[0]);
  }
  // The same file with the whole repository uploaded.
  const top = world({ stage: () => ({ dir: "/tmp/s/shop", prefix: "", remove: () => {} }), dataFiles: () => ["src/data/customers.csv"], ...list(["src/data/"]) });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "x"], top.deps), 0);
});

test("a real subfolder with a data file: stopped under its real path, passed when that path is named", async () => {
  const { root, dir, git } = repo();
  try {
    mkdirSync(join(dir, "src", "data"), { recursive: true });
    mkdirSync(join(dir, "data"));
    writeFileSync(join(dir, "src", "data", "customers.csv"), "a,b\n");
    writeFileSync(join(dir, "data", "prices.csv"), "a,b\n");
    git("add", "-A");
    git("commit", "-q", "-m", "data");
    const run = async (data) => {
      const w = world({ stage, dataFiles, permit: () => ({ ok: true, key: "k", list: "/state/upload-allowed.txt", data }) });
      return { code: await main(["--timeout", "120", "--push", join(dir, "src"), "--", "x"], w.deps), w };
    };
    const stopped = await run(["data/"]);
    assert.equal(stopped.code, NOT_STARTED);
    assert.match(stopped.w.out.join("\n"), /\(src\/data\/customers\.csv\)/);
    assert.equal((await run(["src/data/"])).code, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a run that did not start has a code of its own, which a command's exit 2 is not", async () => {
  assert.equal(NOT_STARTED, 75);
  const ran = world({ boat: async () => ({ code: 2, id: "bx_1abcd", deleted: true }) });
  assert.equal(await main(["--timeout", "120", "--", "false"], ran.deps), 2);
  assert.deepEqual(ran.out, []);
});

test("boat's own first and last lines tell the sandbox and whether it was deleted", async () => {
  const head = "creating a small sandbox...\nbx_65a9cwb2 ready in 1.1s\n";
  assert.deepEqual(runEnd(head, "timed out: process 5800 stopped\nexit 124 \u00b7 8s \u00b7 small \u00b7 $0.0000 \u00b7 bx_65a9cwb2 deleted\n"), { id: "bx_65a9cwb2", deleted: true });
  assert.deepEqual(runEnd(head, "exit 0 \u00b7 13s \u00b7 small \u00b7 $0.0001 \u00b7 bx_65a9cwb2 deleted\r\n\n"), { id: "bx_65a9cwb2", deleted: true });
  // No last line from boat, a line about another sandbox, or text of the command's that only looks like it.
  assert.deepEqual(runEnd(head, "npm test output\n"), { id: "bx_65a9cwb2", deleted: false });
  assert.deepEqual(runEnd(head, "exit 0 \u00b7 bx_other999 deleted\n"), { id: "bx_65a9cwb2", deleted: false });
  assert.deepEqual(runEnd(head, "bx_65a9cwb2 deleted\nand then more text\n"), { id: "bx_65a9cwb2", deleted: false });
  assert.deepEqual(runEnd(head, ""), { id: "bx_65a9cwb2", deleted: false });
  // The id is boat's "ready" line only, never a later line that names another sandbox.
  assert.equal(runEnd("creating a small sandbox...\nerror: no machine\n", "error: no machine\n").id, null);
  assert.deepEqual(runEnd("", "exit 0 \u00b7 bx_65a9cwb2 deleted\n"), { id: null, deleted: true });
});

test("a run that ends without boat's 'deleted' line: its sandbox is deleted here, or the run says it may still exist", async () => {
  const left = world({ boat: async () => ({ code: 137, id: "bx_65a9cwb2", deleted: false }) });
  assert.equal(await main(["--timeout", "120", "--", "x"], left.deps), 137);
  assert.deepEqual(left.calls, [["remove", "bx_65a9cwb2"]]);
  assert.deepEqual(left.out, ["BOAT-RUN: boat did not say the sandbox was deleted: bx_65a9cwb2 is deleted now"]);
  const stuck = world({ boat: async () => ({ code: 1, id: "bx_65a9cwb2", deleted: false }), remove: () => false });
  assert.equal(await main(["--timeout", "120", "--", "x"], stuck.deps), 1);
  assert.deepEqual(stuck.out, ["BOAT-RUN: the sandbox bx_65a9cwb2 may still exist: run 'boat list' and delete what this run left"]);
  const unknown = world({ boat: async () => ({ code: 1, id: null, deleted: false }) });
  assert.equal(await main(["--timeout", "120", "--", "x"], unknown.deps), 1);
  assert.ok(!unknown.calls.some((c) => c[0] === "remove"));
  assert.deepEqual(unknown.out, ["BOAT-RUN: the sandbox may still exist: run 'boat list' and delete what this run left"]);
  // A run that ended as it should removes nothing.
  const fine = world();
  assert.equal(await main(["--timeout", "120", "--", "x"], fine.deps), 0);
  assert.ok(!fine.calls.some((c) => c[0] === "remove"));
});

test("no free slot starts nothing", async () => {
  const w = world({ slot: () => null });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "x"], w.deps), NOT_STARTED);
  assert.deepEqual(w.calls, []);
  assert.match(w.out.join("\n"), /10 runs from this PC/);
});
