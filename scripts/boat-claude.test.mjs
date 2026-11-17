// boat-claude.mjs: a Claude job in a boat sandbox through boat's AI credentials proxy
// (skills/cookbook/scripts). The caps are numbers in the script; the environment must pass
// nothing of the account but the proxied sign-in; the sandbox is always deleted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLAUDE, ENVIRONMENT, TASK_BYTES, checkBudget, checkEnvironment, failure, main, newArgv, newId, parseArgs, promptArgv, promptText, requestsOf, sandboxRun } from "../plugins/cookbook/skills/cookbook/scripts/boat-claude.mjs";
import { NOT_STARTED } from "../plugins/cookbook/skills/cookbook/scripts/boat-run.mjs";

const base = ["--model", "claude-sonnet-5-5", "--timeout", "1800", "--task", "t.md"];
const args = (...a) => parseArgs(a);

test("arguments: a full model id, a timeout and a task; caps inside the script's numbers", () => {
  assert.deepEqual(args(...base), { model: "claude-sonnet-5-5", effort: null, type: "small", timeout: 1800, task: "t.md", push: null, requests: CLAUDE.requests });
  for (const alias of ["haiku", "sonnet", "opus", "opus-5-5", "claude-3-haiku", ""]) assert.match(args("--model", alias, "--timeout", "60", "--task", "t").error, /--model/, alias);
  assert.match(args("--timeout", "60", "--task", "t").error, /--model/);
  assert.match(args("--model", "claude-haiku-5-5", "--task", "t").error, /--timeout/);
  assert.match(args("--model", "claude-haiku-5-5", "--timeout", "60").error, /--task/);
  assert.equal(args(...base, "--requests", String(CLAUDE.maxRequests)).requests, CLAUDE.maxRequests);
  for (const bad of [String(CLAUDE.maxRequests + 1), "0", "-1", "1.5", "lots"]) assert.match(args(...base, "--requests", bad).error, /--requests/, bad);
  assert.equal(args(...base, "--effort", "high").effort, "high");
  assert.match(args(...base, "--effort", "extreme").error, /--effort/);
  assert.match(args(...base, "--type", "xlarge").error, /--type/);
  // No way to keep a sandbox, pass a variable or pick another environment.
  for (const extra of ["--keep", "--env", "--environment", "--no-auto-stop"]) assert.match(args(...base, extra, "x").error, /not an option/, extra);
});

test("the plan's time counts the setup beside the agent's timeout", () => {
  assert.deepEqual(sandboxRun(args(...base)), { type: "small", timeout: 1800 + CLAUDE.setupSeconds });
});

const env = (over = {}) => ({ environments: [{ name: "base", safeForThirdParties: false, proxyAiCredentials: false }, { name: ENVIRONMENT, safeForThirdParties: true, proxyAiCredentials: true, ...over }] });

test("only the narrow environment: nothing of the account, the sign-in as a proxy placeholder", () => {
  assert.equal(checkEnvironment(env()), null);
  assert.match(checkEnvironment({ environments: [{ name: "base", safeForThirdParties: false }] }), /no environment "claude-proxy".*dashboard/);
  assert.match(checkEnvironment(env({ safeForThirdParties: false })), /safe for third parties/);
  assert.match(checkEnvironment(env({ proxyAiCredentials: false })), /proxy AI credentials/);
  for (const broken of [null, {}, { environments: "x" }]) assert.match(checkEnvironment(broken), /no result/);
});

const usage = (requests, day = "2026-11-17") => ({ usage: [{ day, requests }, { day: "2026-11-16", requests: 5000 }] });

test("the wallet and the day: a run's cap must fit both", () => {
  const run = args(...base, "--requests", "200");
  assert.equal(checkBudget(run, usage(1800), 29, "2026-11-17"), null);
  assert.match(checkBudget(run, usage(1801), 29, "2026-11-17"), /a day/);
  // Yesterday's requests do not count against today.
  assert.equal(checkBudget(run, usage(0), 29, "2026-11-17"), null);
  assert.equal(checkBudget(run, usage(0), CLAUDE.walletFloor + 0.2, "2026-11-17"), null);
  assert.match(checkBudget(run, usage(0), CLAUDE.walletFloor + 0.19, "2026-11-17"), /wallet/);
  for (const [u, w] of [[null, 29], [{}, 29], [usage(0), undefined], [usage(0), NaN]]) assert.match(checkBudget(run, u, w, "2026-11-17"), /no result/);
});

test("the boat commands: the narrow environment, a TTL, the task as a file, a full model id", () => {
  const run = args(...base, "--effort", "high");
  assert.deepEqual(newArgv(run, "C:/t/task.md"), ["new", "--type", "small", "--environment", ENVIRONMENT, "--ttl", String(1800 + CLAUDE.setupSeconds), "--name", "boat-claude", "--file", "TASK.md=C:/t/task.md", "--json"]);
  const p = promptArgv(run, "bx_abcd", "repo");
  assert.deepEqual(p.slice(0, 9), ["prompt", "bx_abcd", "--provider", "claude", "--model", "claude-sonnet-5-5", "--reasoning-effort", "high", "--json"]);
  assert.match(p[9], /TASK\.md.*\/home\/user\/repo.*RESULT\.md/);
  assert.doesNotMatch(promptText(null), /patch/);
});

test("reading boat's answers", () => {
  const made = ['{"event":"created","id":"bx_abcd1234"}', '{"event":"state","id":"bx_abcd1234","state":"cloning"}', '{"event":"ready","id":"bx_abcd1234","state":"ready"}'].join("\n");
  assert.equal(newId(made), "bx_abcd1234");
  assert.equal(newId(made.split("\n").slice(0, 2).join("\n")), null);
  assert.equal(newId("not json"), null);
  // The line boat printed when a sandbox had no sign-in (17 November 2026).
  assert.match(failure('{"data":{"data":{"limitType":"auth_expiry","provider":"claude","resetAt":null,"summary":"Claude login required"}}}'), /Claude login required \(auth_expiry\)/);
  assert.match(failure('{"error":"no sandbox given","event":"error"}'), /no sandbox given/);
  assert.equal(failure('{"data":{"data":{"status":"running"}}}'), null);
  assert.equal(failure("plain text"), null);
  const u = { totals: { requests: 9 }, sandboxes: [{ sandboxId: "bx_other", totals: { requests: 7 } }, { sandboxId: "bx_abcd", totals: { requests: 3 } }] };
  assert.equal(requestsOf(u, "bx_abcd"), 3);
  assert.equal(requestsOf({ totals: { requests: 4 } }, "bx_abcd"), 4);
  assert.equal(requestsOf({}, "bx_abcd"), null);
});

// A fake boat and PC around main(): every call is recorded.
function fakes(over = {}) {
  const dir = mkdtempSync(join(tmpdir(), "boat-claude-test-"));
  const task = join(dir, "task.md");
  writeFileSync(task, "Do the thing.\n");
  const calls = [];
  const said = [];
  const released = [];
  const slot = (name) => ({ waiting: 0, up: () => calls.push(`${name} up`), release: () => released.push(name) });
  const deps = {
    limits: () => ({ activeSandboxes: 0, canStart: true, keepGoing: { enabled: false }, subscriptionQuotaSeconds: 2000000, subscriptionRemainingSeconds: 1999000, wallet: { balanceDollars: 29 }, nextStartDollars: 0, starts: { day: { remaining: 147 }, hour: { remaining: 58 }, minute: { remaining: 12 } } }),
    slot: () => slot("slot"),
    claudeSlot: () => slot("claude"),
    environments: () => env(),
    usage: () => usage(0),
    usageOf: () => ({ sandboxes: [{ sandboxId: "bx_abcd1234", totals: { requests: 42 } }] }),
    permit: () => ({ ok: true, key: "github.com/o/r", data: [] }),
    stage: () => ({ dir: join(dir, "repo"), tmp: dir, prefix: "", remove: () => calls.push("staged removed") }),
    dataFiles: () => [],
    scan: () => ({ ok: true }),
    boat: (argv) => {
      calls.push(argv.slice(0, 2).join(" "));
      if (argv[0] === "new") return { status: 0, stdout: '{"event":"created","id":"bx_abcd1234"}\n{"event":"ready","id":"bx_abcd1234"}\n' };
      return { status: 0, stdout: "{}" };
    },
    exec: (id, script) => {
      calls.push(`exec ${script.split(" ")[0]}`);
      if (script.startsWith("cat")) return { ok: true, stdout: "# Report\n" };
      if (script.includes("git diff")) return { ok: true, stdout: "diff --git a/x b/x\n" };
      return { ok: true, stdout: "" };
    },
    prompt: async () => ({ stopped: null, failed: null }),
    remove: (id) => {
      calls.push(`delete ${id}`);
      return true;
    },
    outDir: () => join(dir, "out"),
    today: () => "2026-11-17",
    say: (l) => said.push(l),
    ...over,
  };
  return { deps, dir, task, calls, said, released, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("a finished run: report and patch come back, the sandbox is deleted, both places released", async () => {
  const f = fakes();
  try {
    const code = await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task, "--push", "."], f.deps);
    assert.equal(code, 0, f.said.join("\n"));
    assert.equal(readFileSync(join(f.dir, "out", "RESULT.md"), "utf8"), "# Report\n");
    assert.match(readFileSync(join(f.dir, "out", "changes.patch"), "utf8"), /^diff --git/);
    assert.equal(readFileSync(join(f.dir, "out", "TASK.md"), "utf8"), "Do the thing.\n");
    assert.ok(f.calls.includes("push bx_abcd1234") && f.calls.includes("delete bx_abcd1234") && f.calls.includes("staged removed"));
    assert.deepEqual(f.released.sort(), ["claude", "slot"]);
    assert.ok(f.said.some((l) => /42 proxied requests/.test(l)));
  } finally {
    f.cleanup();
  }
});

test("nothing starts without the narrow environment, room in the budget, or a readable task", async () => {
  const cases = [
    [{ environments: () => ({ environments: [{ name: "base" }] }) }, /no environment/],
    [{ usage: () => usage(1900) }, /a day/],
    [{ limits: () => ({}) }, /no result/],
    [{ claudeSlot: () => null }, /Claude runs from this PC/],
    [{ permit: () => ({ ok: false, key: "github.com/o/r" }) }, /upload list/],
    [{ scan: () => ({ ok: false, reason: "1 finding" }) }, /secret scan of the upload: 1 finding/],
    [{ dataFiles: () => ["dump.sql"] }, /data-shaped/],
  ];
  for (const [over, why] of cases) {
    const f = fakes(over);
    try {
      assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task, "--push", "."], f.deps), NOT_STARTED);
      assert.match(f.said.join("\n"), why);
      assert.ok(!f.calls.some((c) => c.startsWith("new")), "no sandbox was made");
      if (over.claudeSlot) assert.deepEqual(f.released, ["slot"]);
      else assert.deepEqual(f.released.sort(), ["claude", "slot"]);
    } finally {
      f.cleanup();
    }
  }
  const f = fakes();
  try {
    assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", join(f.dir, "missing.md")], f.deps), NOT_STARTED);
    writeFileSync(f.task, "x".repeat(TASK_BYTES + 1));
    assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task], f.deps), NOT_STARTED);
    assert.match(f.said.join("\n"), /over 60000 bytes/);
  } finally {
    f.cleanup();
  }
});

test("a run stopped at a cap, a failed agent or a missing report exits 1, and the sandbox is still deleted", async () => {
  const cases = [
    [{ prompt: async () => ({ stopped: "the request cap (200 of 200)", failed: null }) }, /stopped at the request cap/],
    [{ prompt: async () => ({ stopped: null, failed: "Claude login required (auth_expiry)" }) }, /Claude login required/],
    [{ exec: (id, s) => (s.startsWith("cat") ? { ok: false, stdout: "", why: "exit 1" } : { ok: true, stdout: "" }) }, /no report/],
    [{ scan: (d) => (d.endsWith("out") ? { ok: false, reason: "1 finding" } : { ok: true }) }, /secret scan/],
    [{ boat: (argv) => (argv[0] === "new" ? { status: 0, stdout: '{"event":"created","id":"bx_abcd1234"}\n' } : { status: 0, stdout: "" }) }, /did not report a ready sandbox/],
  ];
  for (const [over, why] of cases) {
    const f = fakes(over);
    try {
      assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task], f.deps), 1, why.source);
      assert.match(f.said.join("\n"), why);
      assert.ok(f.calls.includes("delete bx_abcd1234"));
    } finally {
      f.cleanup();
    }
  }
  const f = fakes({ remove: () => false });
  try {
    await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task], f.deps);
    assert.match(f.said.join("\n"), /may still exist/);
    assert.ok(!existsSync(join(f.dir, "out", "changes.patch")), "no patch without an upload");
  } finally {
    f.cleanup();
  }
});
