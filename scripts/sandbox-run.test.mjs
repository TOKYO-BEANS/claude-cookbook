// sandbox-run.mjs: the one route to a cloud sandbox (a Depot sandbox) for a job
// (skills/cookbook/scripts). The limits are numbers in the script, not a model's judgement,
// an upload holds only committed files that passed a secret scan, and every sandbox is stopped.
// boat-run.mjs is its old name and must go on working.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { AS_CHECKOUT, CALL_SECONDS, DATA_SHAPED, INTERRUPTED, LIMITS, NOT_STARTED, RATE_USD, SIZES, TIMED_OUT, WORK, billed, client, commandArgs, dataFiles, envelope, frames, gate, listEntry, main, monthOf, normalKey, notStopped, onList, pack, parseArgs, repoKey, scan, spentIn, stage, takeSlot, unnamed } from "../plugins/cookbook/skills/cookbook/scripts/sandbox-run.mjs";

const args = (...a) => parseArgs(a);
// What the gate reads: nothing running, nothing under way, nothing spent this month.
const seen = (over = {}) => ({ running: 0, waiting: 0, reserved: 0, spent: 0, ...over });

test("arguments: a timeout and a command are required; default (4 vCPU) is the default size", async () => {
  assert.deepEqual(args("--timeout", "300", "--", "npm", "test"), { mode: "run", type: "default", timeout: 300, push: null, vet: null, command: ["npm", "test"] });
  assert.equal(args("--type", "large", "--timeout", "60", "--push", ".", "--", "make").type, "large");
  assert.match(args("--", "npm", "test").error, /--timeout/);
  assert.match(args("--timeout", "300").error, /command/);
  assert.match(args("--timeout", "300", "--").error, /command/);
  assert.deepEqual(SIZES, { small: { vcpus: 2, memoryMb: 4096 }, default: { vcpus: 4, memoryMb: 8192 }, large: { vcpus: 8, memoryMb: 16384 } });
});

test("arguments: only whole seconds, a known size and known options", async () => {
  for (const bad of ["0", "-5", "1.5", "abc", "", "1e3", " 30"]) assert.match(args("--timeout", bad, "--", "x").error, /--timeout/, bad);
  assert.match(args("--type", "xlarge", "--timeout", "60", "--", "x").error, /--type/);
  assert.match(args("--no-auto-stop", "--timeout", "60", "--", "x").error, /--no-auto-stop/);
  // A kept sandbox would run on outside the limits: the script has no way to keep one.
  assert.match(args("--keep", "--timeout", "60", "--", "x").error, /--keep/);
  assert.match(args("--env", "A=b", "--timeout", "60", "--", "x").error, /--env/);
  assert.match(args("--timeout", "60", "--push", "--", "x").error, /--push/);
  assert.match(args("--timeout", "60", "--push", ".", "--vet", "v", "--", "bash", "sandbox-probe.sh").error, /do not go together/);
});

test("--vet runs only the vetting probe", async () => {
  assert.equal(args("--timeout", "900", "--vet", "sandbox", "--", "bash", "sandbox-probe.sh", "left-pad").vet, "sandbox");
  for (const command of [["npm", "test"], ["bash", "-c", "x"], ["bash", "other.sh"], ["sh", "sandbox-probe.sh"]]) {
    assert.match(args("--timeout", "900", "--vet", "sandbox", "--", ...command).error, /only the vetting probe/, command.join(" "));
  }
});

test("--list and --stop are the only other forms; --stop takes one plain id", async () => {
  assert.deepEqual(args("--list"), { mode: "list" });
  assert.deepEqual(args("--stop", "xg463gql23vmc5g"), { mode: "stop", id: "xg463gql23vmc5g" });
  for (const bad of [["--stop"], ["--stop", "a b"], ["--stop", "../x"], ["--stop", "abc", "def"]]) assert.match(parseArgs(bad).error, /--stop/);
  assert.match(args("--list", "--timeout", "5", "--", "x").error, /--list/);
});

test("everything after -- is the command, also when it looks like an option", async () => {
  assert.deepEqual(args("--timeout", "60", "--", "node", "--vet", "--type", "large").command, ["node", "--vet", "--type", "large"]);
});

test("a run takes at most 14,400 vCPU-seconds: two hours small, one default, half an hour large", async () => {
  assert.equal(gate(args("--type", "small", "--timeout", "7200", "--", "x"), seen()), null);
  assert.match(gate(args("--type", "small", "--timeout", "7201", "--", "x"), seen()), /owner/);
  assert.equal(gate(args("--timeout", "3600", "--", "x"), seen()), null);
  assert.match(gate(args("--timeout", "3601", "--", "x"), seen()), /owner/);
  assert.equal(gate(args("--type", "large", "--timeout", "1800", "--", "x"), seen()), null);
  assert.match(gate(args("--type", "large", "--timeout", "1801", "--", "x"), seen()), /a timeout of 1800/);
});

test("at most ten sandboxes at once: Depot's running ones and this PC's runs with none yet, together", async () => {
  assert.equal(LIMITS.active, 10);
  const run = args("--timeout", "60", "--", "x");
  assert.equal(gate(run, seen({ running: 9 })), null);
  assert.match(gate(run, seen({ running: 10 })), /^10 sandboxes are running and 0 more are about to start/);
  assert.match(gate(run, seen({ running: 9, waiting: 1 })), /^9 sandboxes are running and 1 more is about to start from this PC: 10 at once is the most; more needs the owner's yes$/);
  assert.equal(gate(run, seen({ running: 4, waiting: 5 })), null);
  // A count that is not a count is no result, never "nobody else".
  for (const broken of [null, NaN, -1, "2", undefined]) {
    for (const field of ["running", "waiting", "reserved", "spent"]) assert.match(gate(run, seen({ [field]: broken })), /no result/, `${field} ${broken}`);
  }
  assert.match(gate(run, null), /no result/);
});

test("the month: USD 10 of vCPU-seconds from this PC, a fifth kept back for the vetting step", async () => {
  assert.equal(LIMITS.monthVcpuSeconds * RATE_USD, 10);
  const run = args("--timeout", "1000", "--", "x"); // at most 4,000
  // 160,000 may go to other runs: spent, under way and this one together.
  assert.equal(gate(run, seen({ spent: 150000, reserved: 6000 })), null);
  assert.match(gate(run, seen({ spent: 150000, reserved: 6001 })), /kept back for the vetting step/);
  const vet = args("--type", "small", "--timeout", "900", "--vet", "sandbox", "--", "bash", "sandbox-probe.sh", "x"); // 1,800
  assert.equal(gate(vet, seen({ spent: 198200 })), null);
  assert.match(gate(vet, seen({ spent: 198201 })), /month's allowance \(USD 10\.00\) would be passed/);
});

test("the ledger: this month's lines are summed; a broken line is no result, never nothing spent", async () => {
  const text = [
    JSON.stringify({ month: "2026-11", id: "a", vcpuSeconds: 63, usd: 0.0032, from: "depot" }),
    JSON.stringify({ month: "2026-10", id: "b", vcpuSeconds: 1000 }),
    "",
    JSON.stringify({ month: "2026-11", id: "c", vcpuSeconds: 4000, from: "most" }),
  ].join("\n");
  assert.equal(spentIn("2026-11", text), 4063);
  assert.equal(spentIn("2026-12", text), 0);
  assert.equal(spentIn("2026-11", ""), 0);
  assert.throws(() => spentIn("2026-11", "{not json"), /not JSON/);
  assert.throws(() => spentIn("2026-11", JSON.stringify({ month: "2026-11", id: "x" })), /without vCPU-seconds/);
  assert.equal(monthOf(Date.parse("2026-11-30T23:59:59Z")), "2026-11");
  assert.equal(monthOf(Date.parse("2026-12-01T00:00:00Z")), "2026-12");
});

test("what a sandbox took is Depot's record: created to stopped, times its vCPUs", async () => {
  const sb = { createdAt: "2026-11-26T09:50:08.830Z", stoppedAt: "2026-11-26T09:50:24.530Z", resources: { vcpus: 4 } };
  const b = billed(sb, 2);
  assert.ok(Math.abs(b.seconds - 15.7) < 1e-9);
  assert.equal(b.vcpuSeconds, 63);
  assert.ok(Math.abs(b.usd - 15.7 * 4 * RATE_USD) < 1e-12);
  assert.equal(billed({ ...sb, stoppedAt: undefined }, 4), null);
  assert.equal(billed({ ...sb, stoppedAt: "2026-11-26T09:00:00Z" }, 4), null);
  assert.equal(billed(null, 4), null);
  assert.deepEqual(notStopped({ sandboxes: [{ sandboxId: "a", status: "SANDBOX_STATUS_RUNNING" }, { sandboxId: "b", status: "SANDBOX_STATUS_FINISHED" }, { sandboxId: "c", status: "SANDBOX_STATUS_CANCELLED" }, { sandboxId: "d", status: "SANDBOX_STATUS_FAILED" }, { sandboxId: "e" }] }).map((s) => s.sandboxId), ["a", "e"]);
  assert.deepEqual(notStopped({}), []);
});

test("the command goes as its own arguments after a fixed script: Node 24 first, a checkout only for --push", async () => {
  const plain = commandArgs(args("--timeout", "60", "--", "npm", "test"));
  assert.deepEqual(plain.slice(2), ["sandbox-run", "npm", "test"]);
  assert.equal(plain[0], "-c");
  assert.match(plain[1], /hostedtoolcache\/node\/24\./);
  assert.ok(!plain[1].includes(AS_CHECKOUT));
  assert.match(plain[1], /exec "\$@"$/);
  const pushed = commandArgs(args("--timeout", "60", "--push", ".", "--", "make", "-j8"));
  assert.ok(pushed[1].includes(AS_CHECKOUT));
  assert.deepEqual(pushed.slice(2), ["sandbox-run", "make", "-j8"]);
  assert.equal(WORK, "/home/runner/work");
});

// A real repository in a temporary folder: git is on every machine that runs these tests.
function repo() {
  const root = mkdtempSync(join(tmpdir(), "sandbox-run-test-"));
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


// The sandbox is Linux: the step runs under bash there, as here.
test("a pushed copy is a git checkout before the command runs, and the command's arguments arrive as they were", { skip: process.platform === "win32" && "the sandbox's bash is Linux's" }, () => {
  const { root, dir } = repo();
  try {
    writeFileSync(join(dir, "ignored.txt"), "x\n");
    spawnSync("git", ["add", "--force", "ignored.txt"], { cwd: dir }); // tracked although ignored
    const staged = stage(dir);
    try {
      assert.ok(!existsSync(join(staged.dir, ".git")));
      const argv = commandArgs(args("--timeout", "60", "--push", ".", "--", "node", "-e", "console.log(process.argv.slice(1).join('|'))", "a b", "$HOME", "'q'"));
      // A machine's own git settings stay out: the sandbox has none of this PC's.
      const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
      const ran = spawnSync("bash", argv, { cwd: staged.dir, encoding: "utf8", env });
      assert.equal(ran.status, 0, ran.stderr);
      assert.equal(ran.stdout, "a b|$HOME|'q'\n");
      const git = (...a) => spawnSync("git", a, { cwd: staged.dir, encoding: "utf8", env }).stdout.trim();
      assert.deepEqual(git("ls-files").split("\n"), [".gitignore", "app.js", "ignored.txt"]);
      assert.equal(git("status", "--porcelain"), "");
      assert.match(git("rev-parse", "HEAD"), /^[0-9a-f]{40}$/);
      // A command that fails keeps its own exit code.
      rmSync(join(staged.dir, ".git"), { recursive: true, force: true });
      const r = spawnSync("bash", commandArgs(args("--timeout", "60", "--push", ".", "--", "node", "-e", "process.exit(7)")), { cwd: staged.dir, encoding: "utf8", env });
      assert.equal(r.status, 7, r.stderr);
    } finally {
      staged.remove();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an empty upload still gets a HEAD, and a git step that fails is exit 75 with the command never run", { skip: process.platform === "win32" && "the sandbox's bash is Linux's" }, () => {
  const root = mkdtempSync(join(tmpdir(), "sandbox-run-test-"));
  try {
    const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
    const wrapped = (command) => commandArgs(args("--timeout", "60", "--push", ".", "--", ...command));
    // A folder with no file: the commit is empty, the command runs and HEAD exists.
    const empty = join(root, "empty");
    mkdirSync(empty);
    const ran = spawnSync("bash", wrapped(["git", "rev-parse", "HEAD"]), { cwd: empty, encoding: "utf8", env });
    assert.equal(ran.status, 0, ran.stderr);
    assert.match(ran.stdout.trim(), /^[0-9a-f]{40}$/);
    // A git that fails: the command never runs and the exit is NOT_STARTED, with the reason.
    const bin = join(root, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "git"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const copy = join(root, "copy");
    mkdirSync(copy);
    const marker = join(root, "ran");
    const r = spawnSync("bash", wrapped(["node", "-e", `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "")`]), { cwd: copy, encoding: "utf8", env: { ...env, PATH: `${bin}:${process.env.PATH}` } });
    assert.equal(r.status, NOT_STARTED);
    assert.match(r.stderr, /SANDBOX-RUN: not started: the upload could not be made a git checkout/);
    assert.ok(!existsSync(marker), "the command did not run");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the upload is one gzip tar of the folder's contents, links kept as links", { skip: process.platform === "win32" }, () => {
  const root = mkdtempSync(join(tmpdir(), "sandbox-run-pack-"));
  try {
    const from = join(root, "from");
    mkdirSync(join(from, "sub"), { recursive: true });
    writeFileSync(join(from, "a.txt"), "a\n");
    writeFileSync(join(from, "sub", "b.txt"), "b\n");
    symlinkSync("/etc/hostname", join(from, "link"));
    const tgz = pack(from);
    assert.equal(tgz[0], 0x1f);
    assert.equal(tgz[1], 0x8b);
    const to = join(root, "to");
    mkdirSync(to);
    writeFileSync(join(root, "u.tgz"), tgz);
    assert.equal(spawnSync("tar", ["-xzf", join(root, "u.tgz"), "-C", to]).status, 0);
    assert.equal(readFileSync(join(to, "sub", "b.txt"), "utf8"), "b\n");
    assert.equal(spawnSync("readlink", [join(to, "link")], { encoding: "utf8" }).stdout.trim(), "/etc/hostname");
    assert.throws(() => pack(join(root, "missing")), /tar could not pack/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Git's settings for one call, as a machine's own configuration would give them: the
// environment form, which every git that `stage` starts reads.
function withGitConfig(pairs, run) {
  const names = ["GIT_CONFIG_COUNT", ...pairs.flatMap((_, i) => [`GIT_CONFIG_KEY_${i}`, `GIT_CONFIG_VALUE_${i}`])];
  const before = names.map((n) => process.env[n]);
  process.env.GIT_CONFIG_COUNT = String(pairs.length);
  pairs.forEach(([key, value], i) => Object.assign(process.env, { [`GIT_CONFIG_KEY_${i}`]: key, [`GIT_CONFIG_VALUE_${i}`]: value }));
  try {
    return run();
  } finally {
    names.forEach((n, i) => (before[i] === undefined ? delete process.env[n] : (process.env[n] = before[i])));
  }
}

// Git for Windows ships core.autocrlf=true, and `git archive` then writes CRLF (seen on the
// first Windows CI run). The copy goes to a Linux sandbox: it holds the repository's bytes.
test("the copy holds the repository's line endings, whatever this machine's Git converts on checkout", async () => {
  for (const [pairs, attributes] of [
    [[["core.autocrlf", "true"]], null],
    [[["core.autocrlf", "false"], ["core.eol", "crlf"]], "* text=auto\n"],
  ]) {
    const { root, dir, git } = repo();
    try {
      if (attributes) {
        writeFileSync(join(dir, ".gitattributes"), attributes);
        git("add", "-A");
        git("commit", "-q", "-m", "attributes");
      }
      const staged = withGitConfig(pairs, () => stage(dir));
      try {
        assert.equal(readFileSync(join(staged.dir, "app.js"), "utf8"), "one\n", JSON.stringify(pairs));
      } finally {
        staged.remove();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
  const plain = mkdtempSync(join(tmpdir(), "sandbox-run-plain-"));
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
  const tmp = mkdtempSync(join(tmpdir(), "sandbox-run-scan-"));
  try {
    const dir = join(tmp, "shop");
    mkdirSync(dir);
    writeFileSync(join(dir, "app.js"), "console.log(1);\n");
    assert.deepEqual(scan(dir, tmp), { ok: true });
    // A key made for this run and thrown away with the folder: the source holds none.
    const key = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
    const body = key.split("\n")[1];
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
    rmSync(join(dir, ".gitleaksignore"));
    writeFileSync(join(dir, "commented.pem"), key.trimEnd() + " # gitleaks:allow\n");
    const quiet = scan(dir, tmp);
    assert.equal(quiet.ok, false);
    assert.match(quiet.reason, /^1 finding \(private-key in shop\/commented\.pem\)/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("without gitleaks the scan has no result", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "sandbox-run-scan-"));
  const path = process.env.PATH;
  try {
    process.env.PATH = tmp;
    assert.match(scan(tmp, tmp).reason, /^no result/);
  } finally {
    process.env.PATH = path;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("the upload list, the ledger and the count of runs are in one fixed place: no environment variable moves them", async () => {
  const fresh = await import(`../plugins/cookbook/skills/cookbook/scripts/sandbox-run.mjs?state=${Date.now()}`);
  const state = join(homedir(), ".local", "share", "sandbox-run");
  assert.equal(fresh.STATE, state);
  assert.equal(fresh.UPLOAD_LIST, join(state, "upload-allowed.txt"));
  assert.equal(fresh.LEDGER, join(state, "ledger.jsonl"));
  const source = readFileSync(new URL("../plugins/cookbook/skills/cookbook/scripts/sandbox-run.mjs", import.meta.url), "utf8");
  assert.ok(!/process\.env\.[A-Z_]*(STATE|LIST|LEDGER|SANDBOX)/.test(source));
});

test("boat-run.mjs, the old name, is the same script: same exports, and run by its own path", async () => {
  const old = await import("../plugins/cookbook/skills/cookbook/scripts/boat-run.mjs");
  assert.equal(old.main, main);
  assert.equal(old.UPLOAD_LIST, (await import("../plugins/cookbook/skills/cookbook/scripts/sandbox-run.mjs")).UPLOAD_LIST);
  const script = new URL("../plugins/cookbook/skills/cookbook/scripts/boat-run.mjs", import.meta.url).pathname;
  const r = spawnSync(process.execPath, [script, "--", "npm", "test"], { encoding: "utf8" });
  assert.equal(r.status, NOT_STARTED);
  assert.match(r.stderr, /^SANDBOX-RUN: not started: --timeout <seconds> is required$/m);
});

test("ten runs at once from this PC: the eleventh is refused; a dead run's place is free again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sandbox-run-slots-"));
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

test("a place holds the most its run can take; the others' places add up to what is under way", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sandbox-run-slots-"));
  try {
    const alive = () => true;
    const a = takeSlot(dir, { pid: 501, alive, cost: 4000 });
    assert.equal(a.reserved, 0);
    const b = takeSlot(dir, { pid: 502, alive, cost: 1800 });
    assert.equal(b.reserved, 4000);
    // A place whose figure cannot be read counts as a full run: the safe side.
    writeFileSync(join(dir, "run-503-broken"), "lots");
    assert.equal(takeSlot(dir, { pid: 504, alive, cost: 10 }).reserved, 4000 + 1800 + LIMITS.runVcpuSeconds);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("two runs that arrive together at the last place: never both pass", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sandbox-run-slots-"));
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

test("a place tells how many other runs have no sandbox yet; one whose sandbox exists is in Depot's count", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sandbox-run-slots-"));
  try {
    const live = new Set([301, 302, 303, 304]);
    const take = (pid, max) => takeSlot(dir, { pid, alive: (p) => live.has(p), max });
    const a = take(301);
    assert.equal(a.waiting, 0);
    const b = take(302);
    assert.equal(b.waiting, 1);
    a.up();
    a.up(); // a second time changes nothing
    assert.equal(listed(dir).filter((n) => n.startsWith("run-301-")).length, 1);
    const c = take(303);
    assert.equal(c.waiting, 1, "only the run without a sandbox");
    // It still holds its place: the count of runs from this PC is unchanged.
    assert.equal(take(304, 3), null);
    a.release();
    assert.ok(!listed(dir).some((n) => n.startsWith("run-301-")), "released after its sandbox was ready");
    // A run that died with its sandbox ready leaves nothing behind either.
    b.up();
    live.delete(302);
    assert.equal(take(304).waiting, 1);
    assert.ok(!listed(dir).some((n) => n.startsWith("run-302-")));
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
  const dir = mkdtempSync(join(tmpdir(), "sandbox-run-data-"));
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
  const plain = mkdtempSync(join(tmpdir(), "sandbox-run-plain-"));
  try {
    assert.equal(repoKey(plain), null);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

// main with Depot and every outside program replaced: what runs, in which order, and what
// stops it. The fake API keeps the sandboxes it made, so a test sees one left running.
const ID = "xg463gql23vmc5g";
function world(over = {}, apiOver = {}) {
  const calls = [];
  const out = [];
  const removed = [];
  const released = [];
  const ledger = [];
  const sandboxes = new Map();
  let clock = Date.parse("2026-11-26T10:00:00Z");
  const api = {
    list: async () => { calls.push(["list"]); return { sandboxes: [...sandboxes.values()] }; },
    create: async (opts) => { calls.push(["create", opts]); sandboxes.set(ID, { sandboxId: ID, status: "SANDBOX_STATUS_RUNNING", createdAt: "2026-11-26T10:00:00.000Z", resources: { vcpus: opts.resources.vcpus } }); return { sandbox: { sandboxId: ID } }; },
    run: async (id, cmd, a, o = {}) => {
      if (cmd === "/bin/true") return { started: true, code: 0 };
      calls.push(["run", id, cmd, ...a.slice(0, 1), ...(o.cwd ? [o.cwd] : [])]);
      if (a[1]?.startsWith("mkdir")) return { started: true, code: 0 };
      o.out?.("stdout", Buffer.from("output\n"));
      return { started: true, code: 0 };
    },
    write: async (id, path, data) => { calls.push(["write", id, path, data.length]); },
    stop: async (id) => { calls.push(["stop", id]); const s = sandboxes.get(id); if (s) Object.assign(s, { status: "SANDBOX_STATUS_FINISHED", stoppedAt: "2026-11-26T10:00:15.700Z" }); return {}; },
    get: async (id) => { calls.push(["get", id]); return { sandbox: sandboxes.get(id) ?? null }; },
    ...apiOver,
  };
  const deps = {
    key: async () => "token-value",
    api: (token) => { calls.push(["api", token === "token-value"]); return api; },
    slot: (cost) => { calls.push(["slot", cost]); return { waiting: 0, reserved: 0, up: () => calls.push(["up"]), release: () => released.push("slot") }; },
    spent: () => 0,
    record: (entry) => ledger.push(entry),
    permit: (folder) => { calls.push(["permit", folder]); return { ok: true, key: "github.com/some-org/shop", list: "/state/upload-allowed.txt", data: ["fixtures/prices.csv"] }; },
    dataFiles: (dir) => { calls.push(["data", dir]); return ["fixtures/prices.csv"]; },
    stage: (folder) => { calls.push(["stage", folder]); return { dir: "/tmp/s/shop", tmp: "/tmp/s", prefix: "", remove: () => removed.push("/tmp/s/shop") }; },
    scan: (dir) => { calls.push(["scan", dir]); return { ok: true }; },
    pack: (dir) => { calls.push(["pack", dir]); return Buffer.from("tgz"); },
    vetFolder: (folder) => { calls.push(["vet", folder]); return "/v/sandbox"; },
    out: (stream, bytes) => out.push(`${stream}: ${bytes.toString().trim()}`),
    say: (line) => out.push(line),
    now: () => clock,
    wait: async () => { clock += 500; },
    onSignal: () => () => {},
    ...over,
  };
  return { calls, out, removed, released, ledger, sandboxes, api, deps };
}
const kinds = (w) => w.calls.map((c) => c[0]);

test("a run without an upload: the gate, one sandbox off the tailnet and Depot Cache, the command, the stop and the ledger", async () => {
  const w = world();
  assert.equal(await main(["--timeout", "120", "--", "node", "-v"], w.deps), 0);
  assert.deepEqual(kinds(w), ["api", "slot", "list", "create", "up", "run", "stop", "get", "list"]);
  assert.deepEqual(w.calls[0], ["api", true]);
  assert.deepEqual(w.calls[1], ["slot", 480]);
  const opts = w.calls[3][1];
  assert.match(opts.name, /^sandbox-run-\d+-[0-9a-f]{8}$/);
  assert.deepEqual({ ...opts, name: undefined }, { name: undefined, resources: { vcpus: 4, memoryMb: 8192 }, timeoutMinutes: 7, disableTailnet: true, disableDepotCache: true });
  assert.ok(!("env" in opts) && !("configuration" in opts), "no variable and no CI secret reaches the sandbox");
  assert.deepEqual(w.calls[5], ["run", ID, "/bin/bash", "-c", WORK]);
  assert.deepEqual(w.out, [`SANDBOX-RUN: ${ID} started (default, 4 vCPU)`, "stdout: output", `SANDBOX-RUN: ${ID} stopped; 15.7 s at 4 vCPU, USD 0.0031 by Depot's record`]);
  assert.deepEqual(w.ledger, [{ month: "2026-11", id: ID, vcpuSeconds: 63, usd: 0.0031, from: "depot" }]);
  assert.deepEqual(w.released, ["slot"]);
});

test("the command's own exit code comes back, a 2 included; 75 is only a run that did not start", async () => {
  assert.equal(NOT_STARTED, 75);
  for (const code of [2, 7, 137]) {
    const w = world({}, { run: async (id, cmd) => (cmd === "/bin/true" ? { started: true, code: 0 } : { started: true, code }) });
    assert.equal(await main(["--timeout", "120", "--", "false"], w.deps), code);
  }
  const silent = world({}, { run: async (id, cmd) => (cmd === "/bin/true" ? { started: true, code: 0 } : { started: true, code: null }) });
  assert.equal(await main(["--timeout", "120", "--", "x"], silent.deps), 1);
  assert.match(silent.out.join("\n"), /the command's end was not reported/);
  assert.ok(kinds(silent).includes("stop"));
});

test("a run with an upload: listed, staged, data-checked, scanned, packed, sent and unpacked, and the copy removed", async () => {
  const w = world();
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), 0);
  assert.deepEqual(kinds(w), ["api", "slot", "list", "permit", "stage", "data", "scan", "pack", "create", "up", "write", "run", "run", "stop", "get", "list"]);
  assert.deepEqual(w.calls[10], ["write", ID, "/tmp/sandbox-run-upload.tgz", 3]);
  assert.deepEqual(w.calls[11], ["run", ID, "/bin/bash", "-c"]);
  assert.deepEqual(w.calls[12], ["run", ID, "/bin/bash", "-c", `${WORK}/shop`]);
  assert.deepEqual(w.removed, ["/tmp/s/shop"]);
});

test("an upload that cannot be unpacked: the command never runs, exit 75, and the sandbox is stopped", async () => {
  const w = world({}, { run: async (id, cmd, a) => { if (cmd === "/bin/true") return { started: true, code: 0 }; w.calls.push(["run", a[1].slice(0, 5)]); return { started: true, code: 2 }; } });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), NOT_STARTED);
  assert.match(w.out.join("\n"), /not started: the upload could not be unpacked in the sandbox \(exit 2\)/);
  assert.deepEqual(w.calls.filter((c) => c[0] === "run").map((c) => c[1]), ["mkdir"]);
  assert.ok(kinds(w).includes("stop"));
});

test("--vet: the folder as it is, no list, no copy and no scan, and the probe runs in it", async () => {
  const w = world({ permit: () => { throw new Error("not asked"); }, stage: () => { throw new Error("not asked"); }, scan: () => { throw new Error("not asked"); } });
  assert.equal(await main(["--type", "small", "--timeout", "900", "--vet", "sandbox", "--", "bash", "sandbox-probe.sh", "left-pad"], w.deps), 0);
  assert.deepEqual(kinds(w), ["api", "slot", "list", "vet", "pack", "create", "up", "write", "run", "run", "stop", "get", "list"]);
  assert.deepEqual(w.calls[4], ["pack", "/v/sandbox"]);
  assert.equal(w.calls[5][1].resources.vcpus, 2);
  assert.deepEqual(w.calls[9], ["run", ID, "/bin/bash", "-c", `${WORK}/sandbox`]);
});

test("a secret in the upload, or a scan with no result, stops the run before Depot and removes the copy", async () => {
  for (const scanned of [{ ok: false, reason: "2 findings" }, { ok: false, reason: "no result (gitleaks did not run)" }]) {
    const w = world({ scan: () => scanned });
    assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), NOT_STARTED);
    assert.ok(!kinds(w).includes("create"));
    assert.deepEqual(w.removed, ["/tmp/s/shop"]);
    assert.match(w.out.join("\n"), /SANDBOX-RUN: not started: the secret scan of the upload/);
  }
});

test("a refused gate, bad arguments or a key that cannot be read start nothing, and say why on one line", async () => {
  const full = world();
  full.sandboxes.set("other", { sandboxId: "other", status: "SANDBOX_STATUS_RUNNING" });
  const run = ["--timeout", "120", "--push", ".", "--", "npm", "test"];
  for (let i = 0; i < 9; i += 1) full.sandboxes.set(`o${i}`, { sandboxId: `o${i}`, status: "SANDBOX_STATUS_STARTING" });
  assert.equal(await main(run, full.deps), NOT_STARTED);
  assert.deepEqual(kinds(full), ["api", "slot", "list"]);
  assert.match(full.out.join("\n"), /^SANDBOX-RUN: not started: 10 sandboxes are running/);
  assert.deepEqual(full.released, ["slot"]);
  const bad = world();
  assert.equal(await main(["--", "npm", "test"], bad.deps), NOT_STARTED);
  assert.deepEqual(bad.calls, []);
  assert.deepEqual(bad.released, [], "bad arguments take no place");
  const nokey = world({ key: async () => { throw new Error("the key store is locked"); } });
  assert.equal(await main(run, nokey.deps), NOT_STARTED);
  assert.deepEqual(nokey.out, ["SANDBOX-RUN: not started: no result (the key depot-org could not be read: the key store is locked)"]);
  assert.deepEqual(nokey.calls, []);
  const unread = world({}, { list: async () => { throw new Error("ListSandboxes: HTTP 401 unauthenticated"); } });
  assert.equal(await main(run, unread.deps), NOT_STARTED);
  assert.match(unread.out.join("\n"), /no result \(ListSandboxes: HTTP 401/);
  assert.deepEqual(unread.released, ["slot"]);
  const ledger = world({ spent: () => { throw new Error("the ledger has a line that is not JSON"); } });
  assert.equal(await main(run, ledger.deps), NOT_STARTED);
  assert.match(ledger.out.join("\n"), /no result \(the ledger has a line that is not JSON\)/);
  const month = world({ spent: () => 159600 });
  assert.equal(await main(run, month.deps), NOT_STARTED);
  assert.match(month.out.join("\n"), /kept back for the vetting step/);
});

test("the place is taken first and Depot is asked after: the others' figures go to the gate", async () => {
  const order = [];
  const w = world({ slot: () => { order.push("slot"); return { waiting: 3, reserved: 0, up: () => order.push("up"), release: () => order.push("release") }; } },
    { list: async () => { order.push("list"); return { sandboxes: Array.from({ length: 7 }, (_, i) => ({ sandboxId: `s${i}`, status: "SANDBOX_STATUS_RUNNING" })) }; } });
  assert.equal(await main(["--timeout", "120", "--", "x"], w.deps), NOT_STARTED);
  assert.deepEqual(order, ["slot", "list", "release"]);
  assert.deepEqual(w.out, ["SANDBOX-RUN: not started: 7 sandboxes are running and 3 more are about to start from this PC: 10 at once is the most; more needs the owner's yes"]);
  // With no place free, Depot is not asked at all.
  const none = world({ slot: () => null }, { list: async () => { throw new Error("not asked"); } });
  assert.equal(await main(["--timeout", "120", "--", "x"], none.deps), NOT_STARTED);
  assert.match(none.out.join("\n"), /10 runs from this PC/);
  // A place that cannot be kept starts nothing either.
  const broken = world({ slot: () => { throw Object.assign(new Error("EACCES: permission denied, open '/state/slots/run-1-x'"), { code: "EACCES" }); } });
  assert.equal(await main(["--timeout", "120", "--", "x"], broken.deps), NOT_STARTED);
  assert.match(broken.out.join("\n"), /^SANDBOX-RUN: not started: no result \(the count of runs under way could not be kept: EACCES\)$/);
});

test("nine sandboxes from elsewhere and two runs that arrive together: never both start", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sandbox-run-slots-"));
  try {
    const argv = ["--timeout", "120", "--", "x"];
    const started = [];
    // Nine from elsewhere, and Depot's count grows with each sandbox a run here makes.
    const made = [];
    const nine = () => ({ sandboxes: [...Array.from({ length: 9 }, (_, i) => ({ sandboxId: `s${i}`, status: "SANDBOX_STATUS_RUNNING" })), ...made] });
    const arrival = (pid, apiOver = {}) => {
      const w = world({ slot: (cost) => takeSlot(dir, { pid, alive: () => true, cost }) }, { list: async () => nine(), ...apiOver });
      const create = w.api.create;
      w.api.create = async (opts) => { started.push(pid); made.push({ sandboxId: `m${pid}`, status: "SANDBOX_STATUS_RUNNING" }); return create(opts); };
      return w;
    };
    // The second run arrives while the first is asking Depot: each has read "9" before
    // either has a sandbox.
    const second = arrival(402);
    let other;
    const first = arrival(401, { list: async () => { other ??= main(argv, second.deps); return nine(); } });
    const codes = [await main(argv, first.deps), await other];
    assert.deepEqual(started, [401]);
    assert.deepEqual(codes, [0, NOT_STARTED]);
    assert.equal(second.out.length, 1);
    assert.match(second.out[0], /^SANDBOX-RUN: not started: (9 sandboxes are running and 1 more is|10 sandboxes are running and 0 more are) about to start from this PC: 10 at once is the most; more needs the owner's yes$/);
    assert.deepEqual(readdirSync(dir), [], "both places are free again");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a timeout stops the command and the sandbox: exit 124", async () => {
  assert.equal(TIMED_OUT, 124);
  const w = world({}, {
    run: (id, cmd, a, o = {}) => (cmd === "/bin/true" ? Promise.resolve({ started: true, code: 0 }) : new Promise((_, failed) => o.signal.addEventListener("abort", () => failed(new Error("This operation was aborted"))))),
  });
  assert.equal(await main(["--timeout", "1", "--", "sleep", "100"], w.deps), TIMED_OUT);
  assert.match(w.out.join("\n"), /ran past its timeout of 1 seconds and was stopped/);
  assert.ok(kinds(w).includes("stop"));
  assert.equal(w.sandboxes.get(ID).status, "SANDBOX_STATUS_FINISHED");
  assert.deepEqual(w.released, ["slot"]);
});

test("Ctrl-C stops the sandbox: exit 130 once the command runs, 75 before it", async () => {
  assert.equal(INTERRUPTED, 130);
  let interrupt;
  const w = world({ onSignal: (end) => { interrupt = end; return () => {}; } }, {
    run: (id, cmd, a, o = {}) => (cmd === "/bin/true" ? Promise.resolve({ started: true, code: 0 }) : new Promise((_, failed) => { o.signal.addEventListener("abort", () => failed(new Error("aborted"))); setImmediate(() => interrupt("interrupted")); })),
  });
  assert.equal(await main(["--timeout", "120", "--", "sleep", "100"], w.deps), INTERRUPTED);
  assert.equal(w.sandboxes.get(ID).status, "SANDBOX_STATUS_FINISHED");
  const early = world({ onSignal: (end) => { interrupt = end; return () => {}; } }, { list: async () => { interrupt("interrupted"); return { sandboxes: [] }; } });
  assert.equal(await main(["--timeout", "120", "--", "x"], early.deps), NOT_STARTED);
  assert.ok(!kinds(early).includes("create"), "no sandbox is made after Ctrl-C");
});

test("Ctrl-C while the sandbox has not answered yet ends the wait: exit 75, the sandbox stopped and the ledger written", async () => {
  let interrupt;
  const w = world({ onSignal: (end) => { interrupt = end; return () => {}; } }, {
    run: (id, cmd, a, o = {}) => new Promise((_, failed) => {
      o.signal.addEventListener("abort", () => failed(new Error("aborted")));
      if (cmd === "/bin/true") setImmediate(() => interrupt("interrupted"));
    }),
  });
  assert.equal(await main(["--timeout", "120", "--", "x"], w.deps), NOT_STARTED);
  assert.match(w.out.join("\n"), /not started: interrupted/);
  assert.equal(w.sandboxes.get(ID).status, "SANDBOX_STATUS_FINISHED");
  assert.equal(w.ledger.length, 1);
  assert.deepEqual(w.released, ["slot"]);
});

test("a sandbox that does not answer, or a failed start, is stopped and the run did not start", async () => {
  const w = world({}, { run: async () => { throw new Error("RunCommand: HTTP 503"); } });
  assert.equal(await main(["--timeout", "120", "--", "x"], w.deps), NOT_STARTED);
  assert.match(w.out.join("\n"), /not started: the sandbox did not answer in 180 seconds/);
  assert.ok(kinds(w).includes("stop"));
  const noid = world({}, { create: async () => ({ sandbox: {} }) });
  assert.equal(await main(["--timeout", "120", "--", "x"], noid.deps), NOT_STARTED);
  assert.match(noid.out.join("\n"), /Depot gave no sandbox id/);
  assert.ok(!kinds(noid).includes("stop"));
  const failed = world({}, { create: async () => { throw new Error("CreateSandbox: HTTP 403"); } });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "x"], failed.deps), NOT_STARTED);
  assert.deepEqual(failed.removed, ["/tmp/s/shop"]);
  assert.deepEqual(failed.released, ["slot"]);
});

test("a stop that fails is tried again; a sandbox still running after that is named, never passed over", async () => {
  let stops = 0;
  const once = world({}, { stop: async (id) => { stops += 1; if (stops === 1) throw new Error("StopSandbox: HTTP 500"); once.sandboxes.get(id).status = "SANDBOX_STATUS_FINISHED"; return {}; } });
  assert.equal(await main(["--timeout", "120", "--", "x"], once.deps), 0);
  assert.equal(stops, 2);
  assert.match(once.out.at(-1), new RegExp(`^SANDBOX-RUN: ${ID} stopped; Depot's record could not be read`));
  assert.equal(once.ledger[0].from, "most");
  assert.equal(once.ledger[0].vcpuSeconds, (120 + 300) * 4);
  const stuck = world({}, { stop: async () => { throw new Error("StopSandbox: HTTP 500"); } });
  assert.equal(await main(["--timeout", "120", "--", "x"], stuck.deps), 0);
  assert.equal(stuck.out.at(-1), `SANDBOX-RUN: the sandbox ${ID} may still be running: node sandbox-run.mjs --list, then --stop ${ID}`);
  const blind = world({}, { stop: async () => { throw new Error("down"); }, get: async () => { throw new Error("down"); }, list: async () => { throw new Error("down"); } });
  let reads = 0; // the gate's read works, the ones after do not
  blind.api.list = async () => { reads += 1; if (reads > 1) throw new Error("down"); return { sandboxes: [] }; };
  assert.equal(await main(["--timeout", "120", "--", "x"], blind.deps), 0);
  assert.match(blind.out.at(-1), /may still be running/);
});

test("--list names the sandboxes not stopped; --stop stops one", async () => {
  const w = world();
  w.sandboxes.set("aaaaaa1", { sandboxId: "aaaaaa1", name: "sandbox-run-1", status: "SANDBOX_STATUS_RUNNING", createdAt: "2026-11-26T10:00:00Z", resources: { vcpus: 2 } });
  w.sandboxes.set("bbbbbb2", { sandboxId: "bbbbbb2", status: "SANDBOX_STATUS_FINISHED" });
  assert.equal(await main(["--list"], w.deps), 0);
  assert.deepEqual(w.out, ["aaaaaa1 sandbox-run-1 SANDBOX_STATUS_RUNNING 2026-11-26T10:00:00Z 2 vCPU", "SANDBOX-RUN: 1 sandbox not stopped"]);
  assert.equal(await main(["--stop", "aaaaaa1"], w.deps), 0);
  assert.equal(w.sandboxes.get("aaaaaa1").status, "SANDBOX_STATUS_FINISHED");
  const failing = world({}, { stop: async () => { throw new Error("StopSandbox: HTTP 404"); } });
  assert.equal(await main(["--stop", "aaaaaa1"], failing.deps), 1);
});

test("a repository that is not on the upload list is not copied, scanned or sent", async () => {
  const w = world({ permit: () => ({ ok: false, key: "github.com/some-org/shop-data", list: "/state/upload-allowed.txt" }) });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), NOT_STARTED);
  assert.deepEqual(kinds(w), ["api", "slot", "list"]);
  assert.match(w.out.join("\n"), /^SANDBOX-RUN: not started: github\.com\/some-org\/shop-data is not on the upload list \(\/state\/upload-allowed\.txt\)/);
  assert.deepEqual(w.released, ["slot"]);
  // A run with no upload needs no place on the list.
  const none = world({ permit: () => { throw new Error("not asked"); } });
  assert.equal(await main(["--timeout", "120", "--", "node", "-v"], none.deps), 0);
});

test("a data-shaped file the list does not name stops the upload before the scan, and the copy is removed", async () => {
  const w = world({ dataFiles: () => ["fixtures/prices.csv", "exports/customers.xlsx", "db/dump.sql"] });
  assert.equal(await main(["--timeout", "120", "--push", ".", "--", "npm", "test"], w.deps), NOT_STARTED);
  assert.ok(!kinds(w).some((k) => k === "scan" || k === "create"));
  assert.deepEqual(w.removed, ["/tmp/s/shop"]);
  assert.match(w.out.join("\n"), /^SANDBOX-RUN: not started: the upload holds 2 data-shaped files the upload list does not name \(exports\/customers\.xlsx; db\/dump\.sql\)/);
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
  assert.ok(!kinds(other).includes("create"));
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

// The Connect wire: what goes to Depot and how its answers are read, with fetch replaced.
test("the API client: the key only in the header, Connect frames in and out, an error frame is an error", async () => {
  assert.equal(CALL_SECONDS, 60);
  const sent = [];
  const frame = (obj, flag = 0) => { const e = envelope(obj); e[0] = flag; return e; };
  const answers = {
    ListSandboxes: () => new Response(JSON.stringify({ sandboxes: [] }), { status: 200 }),
    RunCommand: () => new Response(Buffer.concat([frame({ started: { cmdId: "c" } }), frame({ stdout: { data: Buffer.from("hi\n").toString("base64") } }), frame({ stderr: { data: Buffer.from("warn\n").toString("base64") } }), frame({ finished: {} }), frame({}, 2)]), { status: 200 }),
    WriteFile: () => new Response(frame({ error: { code: "permission_denied", message: "no" } }, 2), { status: 200 }),
    StopSandbox: () => new Response('{"code":"not_found","message":"no such sandbox"}', { status: 404 }),
  };
  const f = async (url, init) => { const method = url.slice(url.lastIndexOf("/") + 1); sent.push({ url, method, init }); return answers[method](); };
  const api = client("sekrit", f);
  assert.deepEqual(await api.list(), { sandboxes: [] });
  const got = [];
  assert.deepEqual(await api.run("abcdef1", "/bin/bash", ["-c", "x"], { cwd: "/w", out: (s, b) => got.push(`${s}:${b}`) }), { started: true, code: 0 });
  assert.deepEqual(got, ["stdout:hi\n", "stderr:warn\n"]);
  await assert.rejects(api.write("abcdef1", "/tmp/x", Buffer.alloc(3 << 20)), /WriteFile: permission_denied no/);
  await assert.rejects(api.stop("abcdef1"), /StopSandbox: HTTP 404/);
  for (const s of sent) {
    assert.equal(s.init.headers.Authorization, "Bearer sekrit");
    assert.ok(!String(s.init.body).includes("sekrit"), "the key is never in a body");
    assert.match(s.url, /^https:\/\/api\.depot\.dev\/depot\.sandbox\.v1\.SandboxService\//);
  }
  // The command's frame: id, program, arguments and folder, and nothing else.
  const body = sent.find((s) => s.method === "RunCommand").init.body;
  assert.deepEqual(frames()(body)[0].msg, { sandbox: { id: "abcdef1" }, cmd: "/bin/bash", args: ["-c", "x"], cwd: "/w" });
  // A 3 MiB upload goes as an init frame and three data frames of 1 MiB.
  const parts = frames()(sent.find((s) => s.method === "WriteFile").init.body);
  assert.deepEqual(parts[0].msg, { init: { sandbox: { id: "abcdef1" }, path: "/tmp/x", createDirectories: true } });
  assert.equal(parts.length, 4);
});

test("frames split anywhere are read whole", async () => {
  const bytes = Buffer.concat([envelope({ a: 1 }), envelope({ b: "two" })]);
  const read = frames();
  const got = [];
  for (const b of bytes) got.push(...read(Buffer.from([b])));
  assert.deepEqual(got.map((g) => g.msg), [{ a: 1 }, { b: "two" }]);
});
