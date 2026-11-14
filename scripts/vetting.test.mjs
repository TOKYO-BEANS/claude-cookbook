// Tests of the vetting scripts beside the stack-updates skill (scripts/vetting). They run
// the real shell scripts: the probe's report on captured files, and the sandbox step
// against a stand-in for the `boat` command. No sandbox is started and nothing is installed.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const vetting = path
  .join(here, "..", "plugins", "cookbook", "skills", "stack-updates", "scripts", "vetting")
  .replaceAll("\\", "/");

// On Windows plain `bash` can be the WSL launcher, so use Git's own.
const gitBash = "C:/Program Files/Git/bin/bash.exe";
const bash = process.platform === "win32" ? (existsSync(gitBash) ? gitBash : null) : "bash";
const skip = bash ? false : "no Git Bash on this machine";

function capture(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "probe-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
  return dir.replaceAll("\\", "/");
}

function report(files) {
  const r = spawnSync(bash, [`${vetting}/sandbox-probe.sh`, "--report", capture(files)], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

const dns = (name) => `12:00:01.000001 lo    In  IP 127.0.0.1.41234 > 127.0.0.53.53: 1+ A? ${name}. (36)\n`;
const v4 = (ip, port) =>
  `101 connect(22, {sa_family=AF_INET, sin_port=htons(${port}), sin_addr=inet_addr("${ip}")}, 16) = -1 EINPROGRESS (Operation now in progress)\n`;
const v6 = (ip, port) =>
  `101 connect(23, {sa_family=AF_INET6, sin6_port=htons(${port}), sin6_flowinfo=htonl(0), inet_pton(AF_INET6, "${ip}", &sin6_addr), sin6_scope_id=0}, 28) = 0\n`;
const ran = (program) => `102 execve("${program}", ["x"], 0x7ffd /* 20 vars */) = 0\n`;
const notRun = (program) =>
  `102 execve("${program}", ["x"], 0x7ffd /* 20 vars */) = -1 ENOENT (No such file or directory)\n`;

const meta = (over = {}) =>
  `${Object.entries({
    pkg: "some-cli",
    os: "Ubuntu 24.04.4 LTS",
    node: "v24.22.1",
    ci: 0,
    start: 0,
    label: "some-cli --version",
    dns_install: 1,
    ...over,
  })
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")}\n`;

const quiet = {
  meta: meta(),
  "install.log": "added 3 packages in 2s\n",
  "start.log": "some-cli 1.2.3\n",
  "dns.txt": dns("registry.npmjs.org"),
  "install.trace": v4("104.16.1.34", 443) + ran("/usr/bin/node") + ran("/usr/bin/npm"),
  "start.trace": ran("/usr/bin/node"),
  "files.txt": "",
  "left.txt": "",
  "tcpdump.err": "tcpdump: listening on any\n",
};

test("a quiet run reports the registry only and nothing left behind", { skip }, () => {
  const out = report(quiet);
  assert.match(
    out,
    /^SANDBOX some-cli \| Ubuntu 24\.04\.4 LTS \| node v24\.22\.1 \| install exit 0 \| start exit 0 \(some-cli --version\)$/m,
  );
  assert.match(out, /^SANDBOX dns names during install: registry\.npmjs\.org $/m);
  assert.match(out, /^SANDBOX dns names during start: $/m);
  assert.match(out, /^SANDBOX install: 1 remote addresses; not on port 443: $/m);
  assert.match(out, /^SANDBOX install programs: (node x1, npm x1|npm x1, node x1), $/m);
  assert.match(out, /^SANDBOX files written outside the project.*: 0$/m);
  assert.match(out, /^SANDBOX processes left running: 0$/m);
  assert.ok(!out.includes("install log, last lines"), "a passed install shows no log tail");
  assert.ok(!out.includes("dns capture failed"));
  // pinned-sandbox.sh reads this last line as "the probe finished".
  assert.match(out.trimEnd().split("\n").at(-1), /^SANDBOX start output: some-cli 1\.2\.3/);
});

test("a surprise shows: another host, a port, a program, a file, a process", { skip }, () => {
  const out = report({
    ...quiet,
    meta: meta({ dns_install: 2 }),
    "install.log": "> evil@1.0.0 postinstall\n> node steal.js\nadded 1 package\n",
    "dns.txt": dns("registry.npmjs.org") + dns("collect.example") + dns("late.example"),
    "install.trace":
      v4("104.16.1.34", 443) +
      v4("203.0.113.9", 8080) +
      v6("2606:4700::6810:122", 22) +
      v4("127.0.0.1", 9000) +
      v4("192.0.2.1", 53) +
      v4("192.0.2.2", 0) +
      ran("/usr/bin/curl") +
      ran("/usr/bin/curl") +
      notRun("/usr/bin/wget"),
    "files.txt": "/home/user/.ssh/authorized_keys\n/etc/cron.d/job\n",
    "left.txt": "node /tmp/daemon.js\n",
  });
  assert.match(out, /^ {2}> evil@1\.0\.0 postinstall$/m);
  assert.match(out, /^ {2}> node steal\.js$/m);
  assert.match(out, /^SANDBOX dns names during install: collect\.example registry\.npmjs\.org $/m);
  assert.match(out, /^SANDBOX dns names during start: late\.example $/m);
  // Loopback, DNS (port 53) and port 0 are not remote traffic.
  assert.match(
    out,
    /^SANDBOX install: 3 remote addresses; not on port 443: 203\.0\.113\.9 port 8080;2606:4700::6810:122 port 22;$/m,
  );
  assert.match(out, /^SANDBOX install programs: curl x2, $/m, "a failed exec is not a program run");
  assert.match(out, /^SANDBOX files written outside the project.*: 2$/m);
  assert.match(out, /^ {2}\/home\/user\/\.ssh\/authorized_keys$/m);
  assert.match(out, /^SANDBOX processes left running: 1$/m);
  assert.match(out, /^ {2}node \/tmp\/daemon\.js$/m);
});

test("a failed install shows its last log lines and its exit code", { skip }, () => {
  const out = report({
    ...quiet,
    meta: meta({ ci: 1, start: "none", label: "no command" }),
    "install.log": "npm error code E404\nnpm error 404 Not Found\n",
  });
  assert.match(out, /install exit 1 \| start exit none \(no command\)/);
  assert.match(out, /^SANDBOX install log, last lines:\n {2}npm error code E404$/m);
});

test("what the package prints is cut and stripped of control characters", { skip }, () => {
  const out = report({
    ...quiet,
    "start.log": `\u001b[31mred\u001b[0m ${"x".repeat(400)}\n`,
    "tcpdump.err": "tcpdump: any: You don't have permission to capture on that device\n",
  });
  const line = out.split("\n").find((l) => l.startsWith("SANDBOX start output"));
  assert.ok(!line.includes("\u001b"), "an escape character got through");
  assert.ok(line.length <= 160, `the line is ${line.length} characters`);
  assert.match(out, /^SANDBOX dns capture failed: /m);
});

// The sandbox step, against a stand-in for `boat` that prints a prepared log.
function step({ log, exit = 0, lockfile = true, boat = true }) {
  const root = mkdtempSync(path.join(tmpdir(), "step-"));
  const v = path.join(root, "share", "vetting", "tool-1.0.0");
  mkdirSync(path.join(v, "lock"), { recursive: true });
  mkdirSync(path.join(root, "stub"));
  if (lockfile) {
    writeFileSync(path.join(v, "lock", "package.json"), "{}\n");
    writeFileSync(path.join(v, "lock", "package-lock.json"), "{}\n");
  }
  writeFileSync(path.join(root, "boat.log"), log ?? "");
  if (boat) {
    const stub = path.join(root, "stub", "boat");
    writeFileSync(
      stub,
      [
        "#!/usr/bin/env bash",
        `ls sandbox | sort | tr '\\n' ' ' > "$STUB_ROOT/pushed.txt"`,
        `echo "$*" > "$STUB_ROOT/args.txt"`,
        `cat "$STUB_ROOT/boat.log"`,
        `exit ${exit}`,
        "",
      ].join("\n"),
    );
    chmodSync(stub, 0o755);
  }
  // PATH and the share folder are set inside the shell, so they are POSIX paths on Windows too.
  const r = spawnSync(
    bash,
    [
      "-c",
      'export STUB_ROOT="$PWD" VETTING_SHARE="$PWD/share" PATH="$PWD/stub:/usr/bin:/bin"; exec bash "$@"',
      "step",
      `${vetting}/pinned-sandbox.sh`,
      "tool",
      "some-cli",
      "1.0.0",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const read = (name) => (existsSync(path.join(root, name)) ? readFileSync(path.join(root, name), "utf8") : null);
  return { status: r.status, out: r.stdout + r.stderr, pushed: read("pushed.txt"), args: read("args.txt"), v };
}

const finished = [
  "creating a small sandbox...",
  "SANDBOX some-cli | Ubuntu 24.04.4 LTS | node v24.22.1 | install exit 0 | start exit 0 (some-cli --version)",
  "SANDBOX processes left running: 0",
  "SANDBOX start output: some-cli 1.0.0 ",
  "exit 0 \u00b7 15s \u00b7 small \u00b7 $0.0001 \u00b7 bx_1 deleted",
  "",
].join("\n");

test("the step sends three files, without the account's secrets, and passes a finished run", { skip }, () => {
  const r = step({ log: finished });
  assert.equal(r.status, 0, r.out);
  assert.equal(r.pushed.trim(), "package-lock.json package.json sandbox-probe.sh");
  assert.match(r.args, /^run --type small --no-env --timeout 900 --push sandbox -- bash sandbox-probe\.sh some-cli$/m);
  assert.match(r.out, /^SANDBOX some-cli \| Ubuntu/m);
  assert.ok(!r.out.includes("no result"));
  assert.ok(!r.out.includes("may still exist"));
  assert.equal(readFileSync(path.join(r.v, "out", "sandbox.log"), "utf8"), finished);
});

test("a run that never starts is no result", { skip }, () => {
  const noBoat = step({ boat: false });
  assert.equal(noBoat.status, 2);
  assert.match(noBoat.out, /SANDBOX: no result \(boat is not on the path\)/);
  const noLock = step({ log: finished, lockfile: false });
  assert.equal(noLock.status, 2);
  assert.match(noLock.out, /SANDBOX: no result \(no lockfile in /);
  assert.equal(noLock.pushed, null, "boat was called without a lockfile");
  // boat itself refuses: no plan, an expired key.
  const refused = step({ log: "error: 401 unauthorized\n", exit: 1 });
  assert.equal(refused.status, 1);
  assert.match(refused.out, /SANDBOX: no result \(exit 1\)/);
});

test("a run that stops early is no result, even with exit code 0", { skip }, () => {
  const timedOut = step({ log: "SANDBOX some-cli | Ubuntu\n", exit: 124 });
  assert.equal(timedOut.status, 1);
  assert.match(timedOut.out, /SANDBOX: no result \(exit 124\)/);
  assert.match(timedOut.out, /the sandbox may still exist/);
  const cut = step({ log: "SANDBOX some-cli | Ubuntu\nexit 0 \u00b7 2s \u00b7 small \u00b7 bx_1 deleted\n", exit: 0 });
  assert.equal(cut.status, 1);
  assert.match(cut.out, /SANDBOX: no result \(exit 0\)/);
});
