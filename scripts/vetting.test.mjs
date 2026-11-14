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
  assert.match(out, /^SANDBOX files the outside code wrote outside the project.*: 0$/m);
  assert.match(out, /^SANDBOX processes left running: 0$/m);
  assert.ok(!out.includes("install log, last lines"), "a passed install shows no log tail");
  assert.ok(!out.includes("dns capture failed"));
  // pinned-sandbox.sh reads this last line as "the probe finished".
  assert.match(out.trimEnd().split("\n").at(-1), /^SANDBOX start output: some-cli 1\.2\.3/);
});

test("a surprise shows: another host, a port, a program, a file, a process", { skip }, () => {
  const out = report({
    ...quiet,
    // 192.0.2.1 is the system's own resolver here, so its port 53 is not remote traffic.
    meta: `${meta({ dns_install: 2 })}resolvers=192.0.2.1\n`,
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
  // Loopback, the system's resolver on port 53 and port 0 are not remote traffic.
  assert.match(
    out,
    /^SANDBOX install: 3 remote addresses; not on port 443: 203\.0\.113\.9 port 8080;2606:4700::6810:122 port 22;$/m,
  );
  assert.match(out, /^SANDBOX install programs: curl x2, $/m, "a failed exec is not a program run");
  assert.match(out, /^SANDBOX files the outside code wrote outside the project.*: 2$/m);
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
  assert.ok(!out.includes("did not end in time"));
  // 124 and 137 are the time limit: the install started something that kept running.
  for (const ci of [124, 137])
    assert.match(report({ ...quiet, meta: meta({ ci }) }), /^SANDBOX the install did not end in time: /m);
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

test("a left-over process is found by its parents, not by its name", { skip }, () => {
  const dir = capture({
    // pid, parent, command line. 100 is the probe; 1 and 2 were there before it started.
    "ps.after": [
      "    1     0 /sbin/init",
      "    2     0 [kthreadd]",
      "   55     2 [kworker/0:1-events]",
      "  100    90 bash sandbox-probe.sh some-cli",
      "  140   100 ps -eo pid=,ppid=,args=",
      "  150     1 [kworker/0:1]",
      "  151     1 sed x",
      "  152   151 node /tmp/child.js",
      "  160   100 sleep 1",
      "",
    ].join("\n"),
    "ps.before": "1\n2\n90\n100\n",
  });
  const r = spawnSync(
    bash,
    [`${vetting}/sandbox-probe.sh`, "--left", `${dir}/ps.after`, `${dir}/ps.before`, "100"],
    { encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  // A process that only looks like a kernel thread, or is named like one of the probe's own
  // tools, is reported. A real kernel thread (parent 2) and the probe's own children are not.
  assert.deepEqual(r.stdout.trimEnd().split("\n"), ["[kworker/0:1]", "sed x", "node /tmp/child.js"]);
  const none = spawnSync(
    bash,
    [`${vetting}/sandbox-probe.sh`, "--left", `${dir}/ps.after`, `${dir}/ps.after.pids`, "100"],
    { encoding: "utf8" },
  );
  assert.notEqual(none.status, 0, "a missing list of earlier processes must not read as nothing left");
});

// pinned-install.sh and pinned-vet.sh, with stand-ins for npm, the scanners and boat.
function shareWith(files) {
  const root = mkdtempSync(path.join(tmpdir(), "vet-"));
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  mkdirSync(path.join(root, "stub"), { recursive: true });
  return root;
}

function stub(root, name, lines) {
  const file = path.join(root, "stub", name);
  writeFileSync(file, ["#!/usr/bin/env bash", ...lines, ""].join("\n"));
  chmodSync(file, 0o755);
}

function runIn(root, script, args, env = {}) {
  // node stays on the path (the scripts use it); the stand-ins come first.
  const r = spawnSync(
    bash,
    [
      "-c",
      'N="$(dirname "$(command -v node)")"; export STUB_ROOT="$PWD" VETTING_SHARE="$PWD/share" PATH="$PWD/stub:$N:/usr/bin:/bin"; exec bash "$@"',
      "run",
      `${vetting}/${script}`,
      ...args,
    ],
    { cwd: root, encoding: "utf8", env: { ...process.env, ...env } },
  );
  return { status: r.status, out: r.stdout + r.stderr };
}

const lock = (version) => `${JSON.stringify({ version })}\n`;

test("a second install run never overwrites the backup of the last good version", { skip }, () => {
  const root = shareWith({
    "share/tool/package.json": lock("1.0.0"),
    "share/tool/package-lock.json": lock("1.0.0"),
    "share/vetting/tool-2.0.0/lock/package.json": lock("2.0.0"),
    "share/vetting/tool-2.0.0/lock/package-lock.json": lock("2.0.0"),
    "share/vetting/tool-3.0.0/lock/package.json": lock("3.0.0"),
    "share/vetting/tool-3.0.0/lock/package-lock.json": lock("3.0.0"),
  });
  stub(root, "npm", ['exit "${STUB_NPM_EXIT:-0}"']);
  const at = (file) => readFileSync(path.join(root, "share", "tool", file), "utf8");

  // The install of 2.0.0 fails, is tried again, and then 3.0.0 is tried: 1.0.0 stays the backup.
  assert.equal(runIn(root, "pinned-install.sh", ["tool", "2.0.0"], { STUB_NPM_EXIT: "1" }).status, 1);
  assert.equal(at(".previous/package-lock.json"), lock("1.0.0"));
  assert.equal(runIn(root, "pinned-install.sh", ["tool", "2.0.0"], { STUB_NPM_EXIT: "1" }).status, 1);
  assert.equal(at(".previous/package-lock.json"), lock("1.0.0"), "a retry overwrote the backup");
  assert.equal(runIn(root, "pinned-install.sh", ["tool", "3.0.0"], { STUB_NPM_EXIT: "1" }).status, 1);
  assert.equal(at(".previous/package-lock.json"), lock("1.0.0"), "another version overwrote the backup");

  const back = runIn(root, "pinned-install.sh", ["tool", "--back"]);
  assert.equal(back.status, 0, back.out);
  assert.equal(at("package-lock.json"), lock("1.0.0"));

  // An install that worked becomes the backup of the next one.
  assert.equal(runIn(root, "pinned-install.sh", ["tool", "2.0.0"]).status, 0);
  assert.equal(at("package-lock.json"), lock("2.0.0"));
  assert.equal(runIn(root, "pinned-install.sh", ["tool", "3.0.0"]).status, 0);
  assert.equal(at(".previous/package-lock.json"), lock("2.0.0"));
  assert.equal(at("package-lock.json"), lock("3.0.0"));
});

function vetShare() {
  const root = shareWith({
    "share/tool/package.json": `${JSON.stringify({ dependencies: { "some-cli": "1.0.0" } })}\n`,
    // Left from an earlier vetting of the same version.
    "share/vetting/tool-2.0.0/copy/packages/stale/index.js": "old\n",
    "share/vetting/tool-2.0.0/lock/node_modules/stale/index.js": "old\n",
    "share/vetting/tool-2.0.0/lock/package-lock.json": "{}\n",
    "boat.log": finished,
  });
  stub(root, "npm", [
    'echo "npm $*" >> "$STUB_ROOT/calls.txt"',
    'if [ "$1" = "install" ]; then',
    '  [ -e package-lock.json ] && echo "an earlier lockfile was still there" >> "$STUB_ROOT/calls.txt"',
    `  printf '%s' '{"packages":{"":{},"node_modules/some-cli":{"version":"2.0.0","integrity":"sha512-x"}}}' > package-lock.json`,
    '  exit "${STUB_LOCK_EXIT:-0}"',
    "fi",
    'if [ "${STUB_CI_EXIT:-0}" != "0" ]; then exit "$STUB_CI_EXIT"; fi',
    "mkdir -p node_modules/some-cli && echo new > node_modules/some-cli/index.js",
  ]);
  // Each scanner stand-in writes an empty report where the real one does, unless told to
  // write nothing (STUB_SCAN_SILENT), as a scanner that is missing or crashes would.
  const said = (scanner) => `echo "${scanner}" >> "$STUB_ROOT/calls.txt"`;
  const quietScan = 'if [ -n "${STUB_SCAN_SILENT:-}" ]; then exit 127; fi';
  const fileAfter = (flag) =>
    `while [ $# -gt 0 ]; do if [ "$1" = "${flag}" ]; then out="$2"; fi; shift; done`;
  stub(root, "osv-scanner", [said("osv-scanner"), quietScan, '[ -n "${STUB_OSV_EMPTY:-}" ] || echo "found 1 package" >&2', `echo '{"results":[]}'`]);
  stub(root, "gitleaks", [said("gitleaks"), quietScan, fileAfter("--report-path"), 'echo "[]" > "$out"']);
  stub(root, "trivy", [said("trivy"), quietScan, fileAfter("--output"), `echo '{"Results":[]}' > "$out"`]);
  stub(root, "boat", ['echo "boat" >> "$STUB_ROOT/calls.txt"', 'cat "$STUB_ROOT/boat.log"', 'exit "${STUB_BOAT_EXIT:-0}"']);
  const calls = () => readFileSync(path.join(root, "calls.txt"), "utf8");
  return { root, calls, v: path.join(root, "share", "vetting", "tool-2.0.0") };
}

test("a vetting run scans what this run unpacked, not an earlier copy", { skip }, () => {
  const { root, calls, v } = vetShare();
  const r = runIn(root, "pinned-vet.sh", ["tool", "some-cli", "2.0.0"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(existsSync(path.join(v, "copy", "packages", "some-cli", "index.js")), r.out);
  assert.ok(!existsSync(path.join(v, "copy", "packages", "stale")), "the earlier copy was scanned");
  assert.match(r.out, /resolved some-cli@2\.0\.0 \| packages 1 /);
  assert.match(calls(), /osv-scanner\ngitleaks\ntrivy\nboat\n$/);
  assert.ok(!calls().includes("an earlier lockfile"), "the lockfile was not resolved afresh");
  assert.match(r.out, /^sandbox exit 0$/m);
});

test("a vetting run stops when the lockfile or the unpack fails", { skip }, () => {
  for (const [env, message] of [
    [{ STUB_CI_EXIT: "1" }, /VETTING: stopped, the packages did not unpack/],
    [{ STUB_LOCK_EXIT: "1" }, /VETTING: stopped, no lockfile was resolved/],
  ]) {
    const { root, calls, v } = vetShare();
    const r = runIn(root, "pinned-vet.sh", ["tool", "some-cli", "2.0.0"], env);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, message);
    assert.ok(!/osv-scanner|gitleaks|trivy|boat/.test(calls()), `a scanner ran after a failure:\n${calls()}`);
    assert.ok(!existsSync(path.join(v, "copy", "packages", "stale")), "the earlier copy was left in place");
  }
});

test("a scanner that wrote no report reads as no report, never as an earlier run's", { skip }, () => {
  const { root, v } = vetShare();
  mkdirSync(path.join(v, "out"), { recursive: true });
  // Left from an earlier run of the same version: two findings and one finding.
  writeFileSync(path.join(v, "out", "gitleaks.json"), '[{"RuleID":"old","File":"a"},{"RuleID":"old","File":"b"}]');
  writeFileSync(path.join(v, "out", "trivy.json"), '{"Results":[{"Secrets":[{}]}]}');
  const r = runIn(root, "pinned-vet.sh", ["tool", "some-cli", "2.0.0"], { STUB_SCAN_SILENT: "1" });
  assert.match(r.out, /^OSV: no report /m);
  assert.match(r.out, /^GITLEAKS: no report$/m);
  assert.match(r.out, /^TRIVY: no report$/m);
  assert.ok(!r.out.includes("2 findings"), r.out);
  assert.equal(r.status, 3, r.out);
});

test("a vetting run with no sandbox result does not exit 0", { skip }, () => {
  const { root } = vetShare();
  const r = runIn(root, "pinned-vet.sh", ["tool", "some-cli", "2.0.0"], { STUB_BOAT_EXIT: "1" });
  assert.match(r.out, /^GITLEAKS: 0 findings$/m);
  assert.match(r.out, /SANDBOX: no result \(exit 1\)/);
  assert.notEqual(r.status, 0, r.out);
});

test("DNS is not a blind spot: other query types and other servers are reported", { skip }, () => {
  const asked = (server, type, name) =>
    `12:00:01.000001 eth0  Out IP 10.0.0.5.41234 > ${server}.53: 1+ ${type}? ${name}. (36)\n`;
  const out = report({
    ...quiet,
    meta: `${meta({ dns_install: 3 })}resolvers=10.0.0.2\n`,
    "dns.txt":
      asked("10.0.0.2", "A", "registry.npmjs.org") +
      asked("10.0.0.2", "TXT", "c2VjcmV0.leak.example") +
      asked("203.0.113.53", "A", "registry.npmjs.org"),
    "install.trace": v4("104.16.1.34", 443) + v4("10.0.0.2", 53) + v4("203.0.113.53", 53),
  });
  assert.match(out, /^SANDBOX dns names during install: c2VjcmV0\.leak\.example \(TXT\) registry\.npmjs\.org $/m);
  assert.match(out, /^SANDBOX dns servers asked other than the system's: 203\.0\.113\.53 $/m);
  // The system resolver on port 53 is not remote traffic; another address on port 53 is.
  assert.match(out, /^SANDBOX install: 2 remote addresses; not on port 443: 203\.0\.113\.53 port 53;$/m);
  assert.match(report(quiet), /^SANDBOX dns servers asked other than the system's: $/m);
});

test("the sandbox's own lookups are marked as its own", { skip }, () => {
  const out = report({
    ...quiet,
    meta: meta({ dns_install: 3 }),
    "dns.txt": dns("registry.npmjs.org") + dns("ntp.ubuntu.com") + dns("ntp.ubuntu.com.evil.example"),
  });
  assert.match(
    out,
    /^SANDBOX dns names during install: ntp\.ubuntu\.com \(the sandbox itself\) ntp\.ubuntu\.com\.evil\.example registry\.npmjs\.org $/m,
  );
});

test("a program counts when strace split its start over two lines", { skip }, () => {
  const out = report({
    ...quiet,
    "install.trace": [
      '201 execve("/usr/bin/curl", ["curl", "http://x"], 0x7ffd /* 20 vars */ <unfinished ...>',
      '202 execve("/usr/bin/node", ["node"], 0x7ffd /* 20 vars */) = 0',
      "201 <... execve resumed>) = 0",
      '203 execve("/usr/bin/wget", ["wget"], 0x7ffd /* 20 vars */ <unfinished ...>',
      "203 <... execve resumed>) = -1 ENOENT (No such file or directory)",
      '204 execve("/usr/bin/ssh", ["ssh"], 0x7ffd /* 20 vars */ <unfinished ...>',
      "",
    ].join("\n"),
  });
  const line = out.split("\n").find((l) => l.startsWith("SANDBOX install programs:"));
  assert.match(line, /curl x1/, "a split start was not counted");
  assert.match(line, /node x1/);
  assert.match(line, /ssh x1/, "a start whose result never came is counted, to be safe");
  assert.ok(!line.includes("wget"), "a failed start was counted");
});

test("an OSV report that read no packages is no report", { skip }, () => {
  const { root } = vetShare();
  const r = runIn(root, "pinned-vet.sh", ["tool", "some-cli", "2.0.0"], { STUB_OSV_EMPTY: "1" });
  assert.match(r.out, /^OSV: no report /m);
  assert.match(r.out, /^GITLEAKS: 0 findings$/m);
  assert.equal(r.status, 3, r.out);
});

test("only boat's own last line says the sandbox was deleted", { skip }, () => {
  // The package prints the word; boat's own last line does not.
  const log = finished.replace("some-cli 1.0.0 ", "deleted ").replace(/exit 0 .* deleted\n$/, "exit 0\n");
  assert.match(step({ log }).out, /the sandbox may still exist/);
});

test("a run in which DNS was not watched is no result", { skip }, () => {
  const log = finished.replace(
    "SANDBOX processes left running: 0\n",
    "SANDBOX dns capture failed: tcpdump: permission denied\nSANDBOX processes left running: 0\n",
  );
  const r = step({ log });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /SANDBOX: no result \(DNS was not watched\)/);
});

test("an install whose vetted files cannot be copied in does not report an install", { skip }, () => {
  const root = shareWith({
    "share/tool/package.json": lock("1.0.0"),
    "share/tool/package-lock.json": lock("1.0.0"),
    // The vetted folder lacks its package.json.
    "share/vetting/tool-2.0.0/lock/package-lock.json": lock("2.0.0"),
  });
  stub(root, "npm", ['echo "npm ran" >> "$STUB_ROOT/calls.txt"']);
  const r = runIn(root, "pinned-install.sh", ["tool", "2.0.0"]);
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /nothing was installed/);
  // Nothing was touched: the old lockfile is still there, with no backup or marker made.
  assert.equal(readFileSync(path.join(root, "share", "tool", "package-lock.json"), "utf8"), lock("1.0.0"));
  assert.ok(!existsSync(path.join(root, "share", "tool", ".previous")));
  assert.ok(!existsSync(path.join(root, "calls.txt")), "npm ran on files that were not the vetted ones");
  assert.ok(!r.out.includes("npm ci exit 0"));
});

test("a long report is shown past 40 lines, and what is not shown is named", { skip }, () => {
  const many = (n) => Array.from({ length: n }, (_, i) => `  line ${i + 1}`).join("\n");
  const fits = step({ log: finished.replace("SANDBOX processes left", `${many(50)}\nSANDBOX processes left`) });
  assert.equal(fits.status, 0, fits.out);
  assert.match(fits.out, /^ {2}line 50$/m);
  assert.match(fits.out, /^SANDBOX start output: /m, "the last report line dropped out of sight");
  const over = step({ log: finished.replace("SANDBOX processes left", `${many(100)}\nSANDBOX processes left`) });
  assert.match(over.out, /SANDBOX: 23 more report lines are in /);
});

test("a value from outside code cannot add a key of its own to the probe's notes", { skip }, () => {
  // The value travels in the environment: on Windows a line break in an argument is cut off.
  const probe = (mode, ...rest) =>
    spawnSync(bash, ["-c", 'bash "$0" "$@" "$VALUE"', `${vetting}/sandbox-probe.sh`, mode, ...rest.slice(0, -1)], {
      encoding: "utf8",
      env: { ...process.env, VALUE: rest.at(-1) },
    });
  // A command name with a line break would otherwise add "resolvers=…" and hide a DNS server.
  const line = probe("--meta-line", "label", "x\nresolvers=10.0.0.2,203.0.113.53\r\n --version");
  assert.equal(line.stdout, "label=xresolvers=10.0.0.2,203.0.113.53 --version\n");
  assert.equal(probe("--safe-name", "some-cli").stdout, "some-cli");
  assert.equal(probe("--safe-name", "@scope_x.y+z").stdout, "@scope_x.y+z");
  for (const bad of ["x\nresolvers=1.2.3.4", "a b", "a;b", "$(id)", "../x", ""])
    assert.equal(probe("--safe-name", bad).stdout, "", `accepted ${JSON.stringify(bad)}`);
});

test("a copy that fails halfway puts the old files back, and says so when it cannot", { skip }, () => {
  const make = () => {
    const root = shareWith({
      "share/tool/package.json": lock("1.0.0"),
      "share/tool/package-lock.json": lock("1.0.0"),
      "share/vetting/tool-2.0.0/lock/package.json": lock("2.0.0"),
      "share/vetting/tool-2.0.0/lock/package-lock.json": lock("2.0.0"),
    });
    stub(root, "npm", ['echo "npm ran" >> "$STUB_ROOT/calls.txt"']);
    // The stand-in for cp counts its calls. A call named in STUB_CP_FAIL copies the lockfile
    // only (its second argument) and then fails, as a copy that breaks off halfway would.
    stub(root, "cp", [
      'n=$(($(cat "$STUB_ROOT/cp.count" 2>/dev/null || echo 0) + 1)); echo "$n" > "$STUB_ROOT/cp.count"',
      'case ",${STUB_CP_FAIL:-}," in *",$n,"*) command -p cp "$2" "${@: -1}"; exit 1 ;; esac',
      'command -p cp "$@"',
    ]);
    return root;
  };
  const at = (root, file) => readFileSync(path.join(root, "share", "tool", file), "utf8");

  // Call 1 is the backup, call 2 the vetted files, call 3 putting the old ones back.
  const restored = make();
  const a = runIn(restored, "pinned-install.sh", ["tool", "2.0.0"], { STUB_CP_FAIL: "2" });
  assert.equal(a.status, 1, a.out);
  assert.match(a.out, /the old files were put back and nothing was installed/);
  assert.equal(at(restored, "package-lock.json"), lock("1.0.0"));
  assert.equal(at(restored, "package.json"), lock("1.0.0"));
  assert.ok(!existsSync(path.join(restored, "calls.txt")), "npm ran after a failed copy");

  const stuck = make();
  const b = runIn(stuck, "pinned-install.sh", ["tool", "2.0.0"], { STUB_CP_FAIL: "2,3" });
  assert.equal(b.status, 1, b.out);
  assert.match(b.out, /the old files could not be put back: run pinned-install\.sh tool --back/);
  assert.ok(!b.out.includes("were put back and"));
  assert.ok(!existsSync(path.join(stuck, "calls.txt")), "npm ran after a failed copy");
});
