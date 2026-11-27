// Tests of boat-chat.mjs and laptop-load-lib.mjs (recipes/sandboxes-boat-chat.md): the load
// limits, the argument rules, and the up and down sequences against a fake boat and t3.
import test from "node:test";
import assert from "node:assert/strict";
import { LIMITS, judgeLoad, laptopLoad, parseMeminfo, parsePressure } from "../plugins/cookbook/hooks/laptop-load-lib.mjs";
import { LOCAL_URL, SCAN_FOUND, before, firstId, lastJson, linkAt, main, parseArgs, repoName, stateKind, t3Version } from "../plugins/cookbook/skills/cookbook/scripts/boat-chat.mjs";

const GB = 1048576; // kB
const meminfo = ({ total = 14 * GB, avail = 7 * GB, swap = 4 * GB, swapFree = 4 * GB } = {}) =>
  `MemTotal:       ${total} kB\nMemFree:          1000 kB\nMemAvailable:   ${avail} kB\nSwapTotal:      ${swap} kB\nSwapFree:       ${swapFree} kB\n`;
const psi = (some, full = 0) => `some avg10=0.00 avg60=${some} avg300=0.00 total=1\nfull avg10=0.00 avg60=${full} avg300=0.00 total=1\n`;
const calm = { meminfo: meminfo(), memPsi: psi(0.1), cpuPsi: psi(2), loadavg: "3.00 2.00 1.00 2/900 1234\n", cpuCount: 12 };

test("the load readers parse Linux's own formats", () => {
  assert.deepEqual(parseMeminfo(meminfo({ avail: 5 })), { MemTotal: 14 * GB, MemFree: 1000, MemAvailable: 5, SwapTotal: 4 * GB, SwapFree: 4 * GB });
  assert.equal(parsePressure(psi(6.08, 0.19)), 6.08, "the some line's avg60, not the full line's");
  assert.equal(parsePressure(""), null);
});

test("a calm laptop is under every limit; each limit alone makes it near", () => {
  assert.deepEqual(judgeLoad(calm), { near: false, reasons: [], numbers: { availPct: 50, availGB: 7, swapUsedPct: 0, memPressure: 0.1, cpuPressure: 2, loadPerCpu: 0.25 } });
  const one = (over) => judgeLoad({ ...calm, ...over });
  assert.match(one({ meminfo: meminfo({ avail: 3 * GB }) }).reasons.join(), /^memory available 21.4% \(3 GB\), under 25%$/);
  assert.equal(one({ meminfo: meminfo({ avail: 4 * GB }) }).near, false, "28.6% with swap free is not near");
  assert.match(one({ meminfo: meminfo({ avail: 4 * GB, swapFree: 0 }) }).reasons.join(), /^swap 100% used and memory available 28.6%, under 35%$/);
  assert.equal(one({ meminfo: meminfo({ avail: 3 * GB, swapFree: 0 }) }).reasons.length, 1, "the memory line and the swap line never both count");
  assert.equal(one({ meminfo: meminfo({ avail: 6 * GB, swapFree: 0 }) }).near, false, "a full swap with memory to spare is not near");
  assert.equal(one({ memPsi: psi(LIMITS.memPressure) }).near, true);
  assert.equal(one({ cpuPsi: psi(LIMITS.cpuPressure - 0.01) }).near, false);
  assert.equal(one({ cpuPsi: psi(LIMITS.cpuPressure) }).near, true);
  assert.match(one({ loadavg: "12.00 1 1" }).reasons.join(), /^load 1 per CPU/);
});

test("a counter that cannot be read is no reading, never near", () => {
  const r = laptopLoad({ read: () => { throw new Error("EACCES"); }, cpuCount: 4 });
  assert.deepEqual(r, { near: false, reasons: [], numbers: { availPct: null, availGB: null, swapUsedPct: null, memPressure: null, cpuPressure: null, loadPerCpu: null } });
  assert.equal(judgeLoad({ ...calm, cpuCount: 0, loadavg: "99 1 1" }).near, false);
  for (const r2 of judgeLoad({ ...calm, meminfo: meminfo({ avail: 1 }), memPsi: psi(50), cpuPsi: psi(90), loadavg: "80 1 1" }).reasons)
    assert.match(r2, /^[a-zA-Z ]+[\d.]+%?( \([\d.]+ GB\))?(,| \(one minute\),| per CPU \(one minute\),) [a-z ]+[\d.]+%?$/, "a reason holds fixed words and numbers only");
});

test("arguments: the commands, the limits on hours and size", () => {
  assert.deepEqual(parseArgs(["up", "repo", "--hours", "6", "--push"]), { command: "up", repo: "repo", hours: 6, type: "small", push: true, del: false, json: false, apply: false, discard: false });
  assert.equal(parseArgs(["down", "--delete"]).del, true);
  for (const bad of [[], ["go"], ["up"], ["up", "r", "--hours", "0"], ["up", "r", "--hours", "25"], ["up", "r", "--type", "large"], ["down", "--force"], ["pull"]])
    assert.throws(() => parseArgs(bad), undefined, bad.join(" "));
});

test("the small parsers", () => {
  assert.equal(t3Version("t3 v0.1.13-nightly.20261125.5258\n"), "0.1.13-nightly.20261125.5258");
  assert.equal(t3Version("t3 v0.1.13; rm -rf ~"), null);
  assert.equal(repoName("https://github.com/OWNER/claude-cookbook.git\n"), "claude-cookbook");
  assert.equal(repoName("git@github.com:OWNER/site"), "site");
  assert.equal(firstId('{"event":"created","id":"bx_ysgd8e9f"}\n{"event":"state","id":"bx_ysgd8e9f"}'), "bx_ysgd8e9f");
  assert.equal(firstId('{"id":"bx_; rm"}'), null);
  assert.deepEqual(lastJson('noise\n{"a":1}\n'), { a: 1 });
  assert.equal(linkAt([{ environmentId: "e1", urls: ["http://127.0.0.1:9"] }, { environmentId: "e2", urls: [LOCAL_URL] }]).environmentId, "e2");
  assert.equal(before(Date.parse("2026-11-27T12:00:00Z")), "2026-11-26T12:00:00.000Z");
});

const CRED = "pairing-credential-0123456789abcdef";

// A fake boat and t3: `sandbox` is the sandbox's state, null for none.
function world({ sandbox = "stopped", proxy = false, linked = true, reachable = true, copy = "clean", serving = false, answers = false, wallet = 28.9, dirty = false, applies = true, found = null, size = 748, upload = { ok: true } } = {}) {
  const w = { calls: [], bg: [], out: [], state: sandbox ? { id: "bx_old1234", repos: ["claude-cookbook"] } : {}, answers, linked, sandbox, proxy, applied: false, scanned: [], removed: 0, marked: null };
  const ok = (stdout = "") => ({ code: 0, stdout, stderr: "" });
  const exec = (stdout, extra = {}) => ok(`${JSON.stringify({ exitCode: 0, stdout, ...extra })}\n`);
  w.io = {
    run(cmd, args, opts = {}) {
      w.calls.push({ cmd, args, input: opts.input });
      const a = args.join(" ");
      if (cmd === "git") {
        const g = args.slice(2).join(" ");
        if (g === "remote get-url origin") return ok("https://github.com/OWNER/claude-cookbook.git\n");
        if (g === "rev-parse HEAD") return ok(`${"a".repeat(40)}\n`);
        if (g === "status --porcelain") return ok(dirty ? " M file\n" : "");
        if (args[2] === "apply" && args[3] === "--check") return { code: applies ? 0 : 1, stdout: "", stderr: "" };
        if (args[2] === "apply") { w.applied = true; return ok(); }
      }
      if (cmd === "pkill") return { code: 1, stdout: "", stderr: "" };
      if (cmd === "t3") {
        if (a === "--version") return ok("t3 v0.1.13-nightly.20261125.5258\n");
        if (a === "environment list --json") return ok(JSON.stringify(w.linked ? [{ environmentId: "env-1", urls: [LOCAL_URL], status: reachable ? "reachable" : "unreachable" }] : []));
        if (a.startsWith("environment unlink")) { w.linked = false; return ok(); }
        if (a.startsWith("environment link")) { w.linked = true; return ok(`${LOCAL_URL}: linked\n`); }
      }
      if (cmd === "boat") {
        if (a === "ai proxy --json") return ok(JSON.stringify({ enabled: w.proxy }));
        if (a === "ai proxy on --json") { w.proxy = true; return ok("{}"); }
        if (a === "ai proxy off --json") { w.proxy = false; return ok("{}"); }
        if (a.startsWith("info ")) return w.sandbox && !w.infoDown ? ok(JSON.stringify({ id: args[1], state: w.sandbox })) : { code: 1, stdout: "", stderr: "not found" };
        if (a === "list --all --json") return w.listDown ? { code: 1, stdout: "", stderr: "network" } : ok(JSON.stringify({ sandboxes: w.sandbox ? [{ id: "bx_old1234", state: w.sandbox }] : [] }));
        if (a.startsWith("resume ")) { w.sandbox = "running"; return ok(); }
        if (a.startsWith("new ")) { w.sandbox = "running"; return ok('{"event":"created","id":"bx_new5678"}\n{"event":"ready","id":"bx_new5678"}\n'); }
        if (a.startsWith("stop ")) { w.sandbox = "stopping"; return ok(); }
        if (a.startsWith("delete ")) { w.sandbox = null; return ok(); }
        if (a.startsWith("extend ") || a.startsWith("push ") || a.startsWith("scp ")) return ok();
        if (a === "list --json") return ok(JSON.stringify({ sandboxes: w.sandbox === "running" ? [{ id: "bx_old1234", environment: "claude-proxy" }] : [] }));
        if (a === "billing --json") return ok(JSON.stringify({ walletStatus: { balanceDollars: wallet } }));
        if (a.includes("--detach")) return exec("", { pid: 42 });
        if (a.startsWith("exec ")) {
          const script = args.at(-1);
          if (script.includes("echo none")) return exec(`${copy}\n`);
          if (script.includes("commit-tree")) return exec(`base: aaaa\n${"c".repeat(40)}\n`);
          if (script.includes("update-ref refs/boat/pulled")) { w.marked = script.split(" ").at(-1); return exec(""); }
          if (script.includes("pgrep")) return exec(serving ? "yes\n" : "no\n");
          if (script.includes("auth pairing create")) return exec(JSON.stringify({ credential: CRED }));
          if (script.includes("npm install")) return exec("t3 v0.1.13-nightly.20261125.5258\n");
          return exec("");
        }
      }
      throw new Error(`unexpected: ${cmd} ${a}`);
    },
    background(cmd, args) {
      w.bg.push([cmd, ...args].join(" "));
      w.answers = true;
    },
    answers: async () => w.answers,
    pause: async () => {},
    readState: () => w.state,
    writeState: (s) => { w.state = s; },
    load: () => ({ near: false, reasons: [], numbers: {} }),
    mkdir: () => {},
    scan: (dir) => { w.scanned.push(dir); return found ? { ok: false, reason: found } : { ok: true }; },
    size: () => size,
    prepare: () => (upload.ok ? { ok: true, dir: "/tmp/staged/claude-cookbook", remove: () => { w.removed += 1; } } : upload),
    home: "/fake/boat-chat",
    now: () => Date.parse("2026-11-27T12:00:00Z"),
    out: (l) => w.out.push(l),
  };
  w.boat = () => w.calls.filter((c) => c.cmd === "boat").map((c) => c.args.join(" "));
  return w;
}

test("up on a stopped sandbox: proxy on, resume, restart t3 serve, a new forward, the link kept", async () => {
  const w = world();
  assert.equal(await main(["up", "."], w.io), 0, w.out.join("\n"));
  const b = w.boat();
  assert.ok(b.indexOf("ai proxy on --json") < b.indexOf("resume bx_old1234 --json"), "the proxy is on before the sandbox runs");
  assert.ok(b.some((c) => c.startsWith("exec bx_old1234 --json --timeout 30 -- bash -lc pkill -f '[t]3cli/")), "the old t3 serve is ended after a resume");
  const serve = b.find((c) => c.includes("--detach"));
  assert.match(serve, /t3 serve --host 127\.0\.0\.1 --port 3773 \/home\/user\/claude-cookbook >\/dev\/null 2>&1$/, "bound to loopback, its log never read");
  assert.deepEqual(w.bg, ["boat forward bx_old1234 --remote 3773 --local 13773 --bind 127.0.0.1"]);
  assert.ok(!b.some((c) => c.startsWith("push ") || c.startsWith("new ")), "the repository is there: no push, no new sandbox");
  assert.ok(!w.calls.some((c) => c.cmd === "t3" && c.args[1] === "link"), "a reachable link is kept");
  assert.ok(w.out.includes("environmentId: env-1") && w.out.includes("repository path: /home/user/claude-cookbook"));
  assert.deepEqual(w.state, { id: "bx_old1234", repos: ["claude-cookbook"] });
});

test("up with no sandbox: a new one, T3 installed under the age rule, pushed, linked; the credential only on stdin", async () => {
  const w = world({ sandbox: null, copy: "none" });
  assert.equal(await main(["up", ".", "--type", "default"], w.io), 0, w.out.join("\n"));
  const b = w.boat();
  assert.ok(b.some((c) => c.startsWith("new --type default --environment claude-proxy --name chats-2026-11-27 --json")));
  const setup = b.find((c) => c.includes("npm install"));
  assert.match(setup, /--before='2026-11-26T12:00:00\.000Z' 't3@0\.1\.13-nightly\.20261125\.5258'/);
  assert.match(setup, /linkedEnvironmentsEnabled/);
  assert.ok(b.includes("push bx_new5678 /tmp/staged/claude-cookbook --to /home/user/claude-cookbook --json"), "the scanned copy is pushed, not the folder");
  assert.equal(w.removed, 1, "the staged copy is removed after the push");
  const base = b.find((c) => c.includes("git init -q -b boat"));
  assert.match(base, /commit -q -m 'base: a{40}'/, "the base commit names the laptop's commit");
  assert.ok(w.calls.some((c) => c.cmd === "t3" && c.args.join(" ") === "environment unlink env-1"), "a fresh sandbox replaces the old link");
  const link = w.calls.find((c) => c.cmd === "t3" && c.args[1] === "link");
  assert.equal(link.input, `${LOCAL_URL} ${CRED}\n`);
  assert.ok(!w.calls.some((c) => c.args.join(" ").includes(CRED)), "never on a command line");
  assert.ok(!w.out.join("\n").includes(CRED), "never printed");
  assert.deepEqual(w.state, { id: "bx_new5678", repos: ["claude-cookbook"] });
});

test("up on a running sandbox with a live forward changes nothing it need not", async () => {
  const w = world({ sandbox: "running", proxy: true, serving: true, answers: true });
  assert.equal(await main(["up", "."], w.io), 0, w.out.join("\n"));
  const b = w.boat();
  assert.ok(!b.some((c) => /^(ai proxy on|resume|new|push)/.test(c) || c.includes("--detach") || c.includes("pkill")), b.join("\n"));
  assert.deepEqual(w.bg, []);
  assert.ok(b.includes("extend bx_old1234 --hours 4 --json"));
});

test("up says a low wallet aloud, and fails plainly when the forward never answers", async () => {
  const low = world({ wallet: 3.5 });
  await main(["up", "."], low.io);
  assert.ok(low.out.some((l) => /wallet: USD 3\.5, under USD 5: a top-up is the owner's/.test(l)));
  const dead = world();
  dead.io.background = () => {};
  assert.equal(await main(["up", "."], dead.io), 1);
  assert.match(dead.out.at(-1), /does not answer/);
});

test("down: the forward ended, the sandbox stopped, the proxy off when none of ours runs", async () => {
  const w = world({ sandbox: "running", proxy: true });
  assert.equal(await main(["down"], w.io), 0);
  const pk = w.calls.filter((c) => c.cmd === "pkill").map((c) => c.args[1]);
  assert.deepEqual(pk, ["[b]oat forward .*--local 13773", "[s]sh.*13773"]);
  assert.ok(w.boat().includes("stop bx_old1234 --json"));
  assert.equal(w.proxy, false);
  assert.ok(w.linked, "a stop keeps the link for the resume");
  const d = world({ sandbox: "running", proxy: true });
  assert.equal(await main(["down", "--delete"], d.io), 0, d.out.join("\n"));
  assert.ok(d.boat().includes("delete bx_old1234 --yes --json"));
  assert.equal(d.linked, false);
  assert.deepEqual(d.state, {});
});

test("where and usage", async () => {
  const w = world();
  w.io.load = () => ({ near: true, reasons: ["memory available 19% (2.7 GB), under 25%"], numbers: { availPct: 19 } });
  assert.equal(await main(["where"], w.io), 0);
  assert.equal(w.out[0], "boat: memory available 19% (2.7 GB), under 25%");
  const j = world();
  await main(["where", "--json"], j.io);
  assert.equal(JSON.parse(j.out[0]).where, "local");
  const bad = world();
  assert.equal(await main(["up"], bad.io), 2);
  assert.equal(bad.calls.length, 0);
});

test("boat's states: idle runs, stopped resumes, error is replaced", async () => {
  assert.deepEqual(["running", "idle", "ready", "starting", "stopped", "stopping", "error", "deleted", undefined].map(stateKind), ["running", "running", "running", "running", "stopped", "stopped", "gone", "gone", "gone"]);
  const w = world({ sandbox: "idle", serving: true, answers: true, proxy: true });
  assert.equal(await main(["up", "."], w.io), 0, w.out.join("\n"));
  assert.ok(!w.boat().some((c) => c.startsWith("new ") || c.startsWith("resume ")), "an idle sandbox is used as it is");
});

test("--push over a copy a chat changed stops: pull first", async () => {
  const w = world({ copy: "changed" });
  assert.equal(await main(["up", ".", "--push"], w.io), 1);
  assert.match(w.out.at(-1), /has changes since its base: pull them first/);
  assert.ok(!w.boat().some((c) => c.startsWith("push ")));
  const v = world({ copy: "clean" });
  assert.equal(await main(["up", ".", "--push"], v.io), 0);
  assert.ok(v.boat().some((c) => c.startsWith("push ")), "a clean copy is copied again");
});

test("pull: the patch is scanned before anything else reads it, and applied only to a clean folder", async () => {
  const w = world({ sandbox: "running" });
  assert.equal(await main(["pull", "."], w.io), 0, w.out.join("\n"));
  assert.ok(w.boat().includes("scp bx_old1234:/tmp/boat-chat-claude-cookbook.patch /fake/boat-chat/patches/claude-cookbook-2026-11-27T12-00-00-000Z/changes.patch"));
  assert.deepEqual(w.scanned, ["/fake/boat-chat/patches/claude-cookbook-2026-11-27T12-00-00-000Z"]);
  assert.ok(w.out.includes("git apply --check: applies"));
  assert.equal(w.marked, "c".repeat(40), "a clean scan marks what was pulled");
  assert.equal(w.applied, false, "without --apply nothing changes here");
  const a = world({ sandbox: "running" });
  assert.equal(await main(["pull", ".", "--apply"], a.io), 0);
  assert.equal(a.applied, true);
  assert.equal(a.marked, "c".repeat(40), "marked once applied");
  const d = world({ sandbox: "running", dirty: true });
  assert.equal(await main(["pull", ".", "--apply"], d.io), 1);
  assert.match(d.out.at(-1), /the folder has changes of its own/);
  assert.equal(d.applied, false);
  assert.equal(d.marked, null, "a refused --apply leaves the mark: the next pull returns the same changes");
  const n = world({ sandbox: "running", applies: false });
  assert.equal(await main(["pull", ".", "--apply"], n.io), 1);
  assert.equal(n.marked, null);
  const f = world({ sandbox: "running", found: "1 finding (generic-api-key in x/y): a security finding goes to the owner" });
  assert.equal(await main(["pull", ".", "--apply"], f.io), SCAN_FOUND);
  assert.ok(!f.calls.some((c) => c.cmd === "git" && c.args[2] === "apply"), "a finding: no git apply, not even --check");
  assert.equal(f.marked, null, "a finding leaves the mark where it was: the next pull returns the same changes");
  const e = world({ sandbox: "running", size: 0 });
  assert.equal(await main(["pull", ".", "--apply"], e.io), 0);
  assert.equal(e.out.at(-1), "no changes since the last pull");
  const s2 = world({ sandbox: "stopped" });
  assert.equal(await main(["pull", "."], s2.io), 1);
  assert.match(s2.out.at(-1), /run up first/);
});

test("an upload that fails the checks is never pushed", async () => {
  const w = world({ sandbox: null, copy: "none", upload: { ok: false, reason: "the secret scan of the upload: 1 finding (generic-api-key in a/.env): a security finding goes to the owner" } });
  assert.equal(await main(["up", "."], w.io), 1);
  assert.match(w.out.at(-1), /^boat-chat: not pushed: the secret scan of the upload: 1 finding/);
  assert.ok(!w.boat().some((c) => c.startsWith("push ")));
});

test("down --delete never deletes unpulled work unless told to discard it", async () => {
  const changed = world({ sandbox: "running", copy: "changed", proxy: true });
  assert.equal(await main(["down", "--delete"], changed.io), 1);
  assert.match(changed.out.at(-1), /not deleted: unpulled changes in \/home\/user\/claude-cookbook; pull first/);
  assert.ok(!changed.boat().some((c) => c.startsWith("delete ") || c.startsWith("stop ")), "nothing stopped or deleted");
  assert.ok(!changed.calls.some((c) => c.cmd === "pkill"), "the forward is left for the pull");
  const stopped = world({ sandbox: "stopped" });
  assert.equal(await main(["down", "--delete"], stopped.io), 1);
  assert.match(stopped.out.at(-1), /the sandbox is stopped, so its copies cannot be checked/);
  const discard = world({ sandbox: "stopped" });
  assert.equal(await main(["down", "--delete", "--discard"], discard.io), 0);
  assert.ok(discard.boat().includes("delete bx_old1234 --yes --json"));
  assert.throws(() => parseArgs(["down", "--discard"]), /--discard goes with down --delete/);
});

test("a sandbox boat cannot be asked about is never replaced", async () => {
  const w = world({ sandbox: "stopped" });
  w.infoDown = true;
  w.listDown = true;
  assert.equal(await main(["up", "."], w.io), 1);
  assert.match(w.out.at(-1), /could not read sandbox bx_old1234 from boat; nothing changed/);
  assert.ok(!w.boat().some((c) => c.startsWith("new ")), "no new sandbox");
  assert.deepEqual(w.state, { id: "bx_old1234", repos: ["claude-cookbook"] }, "the record keeps the old id");
  // info fails but the full list still shows it: used as it is.
  const v = world({ sandbox: "stopped" });
  v.infoDown = true;
  assert.equal(await main(["up", "."], v.io), 0, v.out.join("\n"));
  assert.ok(v.boat().includes("resume bx_old1234 --json"));
  // Gone from the full list: a new one.
  const g = world({ sandbox: null, copy: "none" });
  g.state = { id: "bx_old1234", repos: ["claude-cookbook"] };
  assert.equal(await main(["up", "."], g.io), 0, g.out.join("\n"));
  assert.ok(g.boat().some((c) => c.startsWith("new ")));
});
