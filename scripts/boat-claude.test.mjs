// boat-claude.mjs: a Claude job in a boat sandbox through boat's AI credentials proxy
// (skills/cookbook/scripts). The caps are numbers in the script; the environment must pass
// nothing of the account but the proxied sign-in; the sandbox is always deleted.
import { test } from "node:test";
import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLAUDE, ENVIRONMENT, MISSED_READINGS, longest, runPrompt, TASK_BYTES, checkBudget, pickEnvironment, failure, main, newArgv, newId, parseArgs, promptArgv, promptText, requestsOf, sandboxRun } from "../plugins/cookbook/skills/cookbook/scripts/boat-claude.mjs";
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
  // The refusal names the most --timeout this script takes, not the sandbox's own limit.
  assert.equal(longest(args("--model", "claude-haiku-5-5", "--timeout", "6600", "--task", "t")), null);
  assert.match(longest(args("--model", "claude-haiku-5-5", "--timeout", "6601", "--task", "t")), /small: a --timeout of 6600 at most/);
  assert.match(longest(args("--model", "claude-haiku-5-5", "--type", "large", "--timeout", "1201", "--task", "t")), /large: a --timeout of 1200 at most/);
});

const env = (over = {}, base = {}) => ({ environments: [{ name: "base", isDefault: true, safeForThirdParties: false, proxyAiCredentials: false, ...base }, { name: ENVIRONMENT, safeForThirdParties: true, proxyAiCredentials: true, ...over }] });
const onlyBase = (over = {}) => ({ environments: [{ name: "base", isDefault: true, safeForThirdParties: true, proxyAiCredentials: true, ...over }, { name: "other", safeForThirdParties: true, proxyAiCredentials: true }] });

test("only a narrow environment: nothing of the account, the sign-in as a proxy placeholder", () => {
  assert.deepEqual(pickEnvironment(env()), { name: ENVIRONMENT });
  // With no "claude-proxy", the default environment, as the owner set it on 17 November 2026.
  assert.deepEqual(pickEnvironment(onlyBase()), { name: "base" });
  assert.match(pickEnvironment(onlyBase({ safeForThirdParties: false })).error, /"base" is not "safe for third parties"/);
  assert.match(pickEnvironment(onlyBase({ proxyAiCredentials: false })).error, /proxy AI credentials/);
  // "claude-proxy" wins over a narrow default, and is checked on its own settings.
  assert.match(pickEnvironment(env({ safeForThirdParties: false }, { safeForThirdParties: true, proxyAiCredentials: true })).error, /"claude-proxy" is not "safe/);
  assert.match(pickEnvironment(env({ proxyAiCredentials: false })).error, /proxy AI credentials/);
  assert.match(pickEnvironment({ environments: [{ name: "x" }] }).error, /no environment/);
  assert.match(pickEnvironment({ environments: [{ name: "bad name;rm", isDefault: true, safeForThirdParties: true, proxyAiCredentials: true }] }).error, /no environment/);
  for (const broken of [null, {}, { environments: "x" }]) assert.match(pickEnvironment(broken).error, /no result/);
});

const usage = (requests, day = "2026-11-17") => ({ usage: [{ day, requests }, { day: "2026-11-16", requests: 5000 }] });

test("the wallet and the day: a run's cap must fit both", () => {
  const run = args(...base, "--requests", "200");
  assert.equal(checkBudget(run, usage(1800), 29, "2026-11-17", 0), null);
  assert.match(checkBudget(run, usage(1801), 29, "2026-11-17", 0), /a day/);
  // Other Claude runs under way may each still use up to maxRequests: that much is kept.
  assert.equal(checkBudget(run, usage(1800 - CLAUDE.maxRequests), 29, "2026-11-17", 1), null);
  assert.match(checkBudget(run, usage(1801 - CLAUDE.maxRequests), 29, "2026-11-17", 1), /kept for 1 other run under way/);
  assert.match(checkBudget(run, usage(0), CLAUDE.walletFloor + 0.2 + 2 * CLAUDE.maxRequests * 0.001 - 0.01, "2026-11-17", 2), /wallet/);
  for (const bad of [undefined, -1, 1.5, "1"]) assert.match(checkBudget(run, usage(0), 29, "2026-11-17", bad), /no result/, String(bad));
  // Yesterday's requests do not count against today.
  assert.equal(checkBudget(run, usage(0), 29, "2026-11-17", 0), null);
  assert.equal(checkBudget(run, usage(0), CLAUDE.walletFloor + 0.2, "2026-11-17", 0), null);
  assert.match(checkBudget(run, usage(0), CLAUDE.walletFloor + 0.19, "2026-11-17", 0), /wallet/);
  // A day's figure that cannot be read is no result, never zero.
  for (const bad of [undefined, "12", NaN, -1]) assert.match(checkBudget(run, { usage: [{ day: "2026-11-17", requests: bad }] }, 29, "2026-11-17", 0), /no result/, String(bad));
  for (const [u, w] of [[null, 29], [{}, 29], [usage(0), undefined], [usage(0), NaN]]) assert.match(checkBudget(run, u, w, "2026-11-17", 0), /no result/);
});

test("the boat commands: the narrow environment, a TTL, the task as a file, a full model id", () => {
  const run = args(...base, "--effort", "high");
  assert.deepEqual(newArgv(run, "C:/t/task.md", ENVIRONMENT, "boat-claude-1a2b3c4d"), ["new", "--type", "small", "--environment", ENVIRONMENT, "--ttl", String(1800 + CLAUDE.setupSeconds), "--name", "boat-claude-1a2b3c4d", "--file", "TASK.md=C:/t/task.md", "--json"]);
  const p = promptArgv(run, "bx_abcd", "repo");
  assert.deepEqual(p.slice(0, 9), ["prompt", "bx_abcd", "--provider", "claude", "--model", "claude-sonnet-5-5", "--reasoning-effort", "high", "--json"]);
  assert.match(p[9], /TASK\.md.*\/home\/user\/repo.*RESULT\.md/);
  assert.doesNotMatch(promptText(null), /patch/);
  // boat names Opus by its own id; the others go as they are.
  const opus = promptArgv(args("--model", "claude-opus-5-5", "--timeout", "60", "--task", "t"), "bx_abcd", null);
  assert.equal(opus[opus.indexOf("--model") + 1], "opus-5-5");
  const haiku = promptArgv(args("--model", "claude-haiku-5-5", "--timeout", "60", "--task", "t"), "bx_abcd", null);
  assert.equal(haiku[haiku.indexOf("--model") + 1], "claude-haiku-5-5");
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
  const stopHandlers = [];
  const slot = (name) => ({ waiting: 0, others: 0, up: () => calls.push(`${name} up`), release: () => released.push(name) });
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
    runName: () => "boat-claude-test",
    findByName: (n) => {
      calls.push(`find ${n}`);
      return "bx_found1";
    },
    remove: (id) => {
      calls.push(`delete ${id}`);
      return true;
    },
    onStop: (clean) => {
      calls.push("onStop on");
      stopHandlers.push(clean);
      return () => calls.push("onStop off");
    },
    outDir: () => join(dir, "out"),
    today: () => "2026-11-17",
    say: (l) => said.push(l),
    ...over,
  };
  return { deps, dir, task, calls, said, released, stopHandlers, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
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
    // The stop handler is on while the sandbox exists, off after; called, it refuses the
    // placeholders, deletes the sandbox and removes the copies.
    assert.ok(f.calls.indexOf("onStop on") < f.calls.indexOf("onStop off"));
    assert.equal(f.stopHandlers.length, 1);
    f.calls.length = 0;
    f.stopHandlers[0]();
    assert.deepEqual(f.calls, ["ai block", "delete bx_abcd1234", "staged removed"]);
  } finally {
    f.cleanup();
  }
});

test("nothing starts without the narrow environment, room in the budget, or a readable task", async () => {
  const cases = [
    [{ environments: () => ({ environments: [{ name: "base", isDefault: true }] }) }, /"base" is not "safe/],
    [{ usage: () => usage(1900) }, /a day/],
    [{ limits: () => ({}) }, /no result/],
    [{ claudeSlot: () => null }, /Claude runs from this PC/],
    [{ permit: () => ({ ok: false, key: "github.com/o/r" }) }, /upload list/],
    [{ scan: () => ({ ok: false, reason: "1 finding" }) }, /secret scan of the upload: 1 finding/],
    [{ dataFiles: () => ["dump.sql"] }, /data-shaped/],
    // The task file is scanned before it goes in.
    [{ scan: (d) => (d.endsWith("task") ? { ok: false, reason: "1 finding" } : { ok: true }) }, /secret scan of the task file: 1 finding/],
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
  // boat new that fails before naming a sandbox: one may exist, so not "not started".
  const g = fakes({ findByName: () => null, boat: (argv) => (argv[0] === "new" ? { status: null, error: { code: "ETIMEDOUT" }, stdout: "" } : { status: 0, stdout: "" }) });
  try {
    assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", g.task], g.deps), 1);
    assert.match(g.said.join(" | "), /may still exist: run 'boat list'/);
  } finally {
    g.cleanup();
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

// A fake `boat prompt` process: it runs until killed.
function child() {
  const c = new EventEmitter();
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  c.kill = () => setImmediate(() => c.emit("close", null));
  return c;
}

function prompted(run, readings) {
  const dir = mkdtempSync(join(tmpdir(), "boat-claude-prompt-"));
  const asked = [];
  let i = 0;
  const io = {
    start: () => child(),
    ask: (argv) => {
      asked.push(argv.join(" "));
      return { status: 0 };
    },
    usageOf: () => {
      const r = readings[Math.min(i, readings.length - 1)];
      i += 1;
      if (r instanceof Error) throw r;
      return r;
    },
    pollMs: 5,
    killMs: 1,
  };
  return { io, asked, events: join(dir, "events.jsonl"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("the spend guard: the request cap stops the run, refusing the placeholders and interrupting the agent", async () => {
  const run = { model: "claude-haiku-5-5", requests: 5, timeout: 600 };
  const t = prompted(run, [{ totals: { requests: 2 } }, { totals: { requests: 7 } }]);
  try {
    const r = await runPrompt(run, "bx_abcd", null, t.events, t.io);
    assert.match(r.stopped, /request cap \(7 of 5\)/);
    assert.deepEqual(t.asked, ["ai block bx_abcd", "interrupt bx_abcd"]);
  } finally {
    t.cleanup();
  }
});

test("the spend guard fails closed: readings that fail in a row stop the run; one miss does not", async () => {
  const run = { model: "claude-haiku-5-5", requests: 500, timeout: 600 };
  const t = prompted(run, [new Error("boat ai usage failed"), {}, new Error("x"), new Error("y")]);
  try {
    const r = await runPrompt(run, "bx_abcd", null, t.events, t.io);
    assert.match(r.stopped, new RegExp(`${MISSED_READINGS} readings of the request count in a row failed`));
    assert.ok(t.asked.includes("ai block bx_abcd"));
  } finally {
    t.cleanup();
  }
  const u = prompted(run, [new Error("one miss"), { totals: { requests: 1 } }, new Error("a"), { totals: { requests: 2 } }, { totals: { requests: 600 } }]);
  try {
    assert.match((await runPrompt(run, "bx_abcd", null, u.events, u.io)).stopped, /request cap \(600 of 500\)/);
  } finally {
    u.cleanup();
  }
});

test("the spend guard: the timeout stops a run whose count stays low", async () => {
  const run = { model: "claude-haiku-5-5", requests: 500, timeout: 0.05 };
  const t = prompted(run, [{ totals: { requests: 1 } }]);
  try {
    const r = await runPrompt(run, "bx_abcd", null, t.events, t.io);
    assert.match(r.stopped, /the timeout/);
    assert.deepEqual(t.asked, ["ai block bx_abcd", "interrupt bx_abcd"]);
  } finally {
    t.cleanup();
  }
});

test("a failure line from boat prompt is reported, and every line is kept", async () => {
  const run = { model: "claude-haiku-5-5", requests: 500, timeout: 600 };
  const t = prompted(run, [{ totals: { requests: 1 } }]);
  t.io.start = () => {
    const c = child();
    setImmediate(() => {
      const lines = ['{"data":{"data":{"status":"running"}}}', '{"data":{"data":{"limitType":"auth_expiry","summary":"Claude login required"}}}', ""];
      c.stdout.emit("data", Buffer.from(lines.join(String.fromCharCode(10))));
      c.emit("close", 0);
    });
    return c;
  };
  try {
    const r = await runPrompt(run, "bx_abcd", null, t.events, t.io);
    assert.equal(r.stopped, null);
    assert.match(r.failed, /Claude login required/);
    assert.equal(readFileSync(t.events, "utf8").trim().split(/\r?\n/).length, 2);
  } finally {
    t.cleanup();
  }
});

test("the spend guard: a block boat does not confirm is asked twice and reported", async () => {
  const run = { model: "claude-haiku-5-5", requests: 5, timeout: 600 };
  const t = prompted(run, [{ totals: { requests: 9 } }]);
  t.io.ask = (argv) => {
    t.asked.push(argv.join(" "));
    return { status: argv[1] === "block" ? 1 : 0 };
  };
  try {
    const r = await runPrompt(run, "bx_abcd", null, t.events, t.io);
    assert.match(r.stopped, /request cap \(9 of 5\); boat did not confirm the block/);
    assert.deepEqual(t.asked, ["ai block bx_abcd", "ai block bx_abcd", "interrupt bx_abcd"]);
    // The interrupt was confirmed, so main may still fetch before it deletes.
    assert.equal(r.unconfirmed, false);
  } finally {
    t.cleanup();
  }
});

test("a halted run ends even when the killed process never closes, so the sandbox is deleted", async () => {
  const run = { model: "claude-haiku-5-5", requests: 5, timeout: 600 };
  const t = prompted(run, [{ totals: { requests: 9 } }]);
  t.io.start = () => {
    const c = child();
    c.kill = () => {}; // boat.exe under the launcher keeps the pipes: no "close"
    return c;
  };
  try {
    const r = await runPrompt(run, "bx_abcd", null, t.events, t.io);
    assert.match(r.stopped, /request cap/);
  } finally {
    t.cleanup();
  }
});

test("a halt that boat confirms neither way: the sandbox is deleted before anything is fetched", async () => {
  const run = { model: "claude-haiku-5-5", requests: 5, timeout: 600 };
  const t = prompted(run, [{ totals: { requests: 9 } }]);
  t.io.ask = (argv) => {
    t.asked.push(argv.join(" "));
    return { status: 1 };
  };
  try {
    assert.equal((await runPrompt(run, "bx_abcd", null, t.events, t.io)).unconfirmed, true);
  } finally {
    t.cleanup();
  }
  const f = fakes({ prompt: async () => ({ stopped: "the request cap (9 of 5); boat did not confirm the block", failed: null, unconfirmed: true }) });
  try {
    assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task, "--push", "."], f.deps), 1);
    assert.match(f.said.join(" | "), /deleted before anything was fetched/);
    assert.ok(!f.calls.includes("exec cat"), "nothing fetched");
    assert.equal(f.calls.filter((c) => c === "delete bx_abcd1234").length, 1, "deleted once, not again at the end");
  } finally {
    f.cleanup();
  }
});

test("a start that names no sandbox: the run's own name finds it, and it is blocked and deleted", async () => {
  let f;
  f = fakes({
    boat: (argv) => {
      f.calls.push(argv.slice(0, 2).join(" "));
      if (argv[0] === "new") {
        assert.deepEqual(argv.slice(argv.indexOf("--name"), argv.indexOf("--name") + 2), ["--name", "boat-claude-test"]);
        return { status: null, error: { code: "ETIMEDOUT" }, stdout: "" };
      }
      return { status: 0, stdout: "{}" };
    },
  });
  try {
    assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task], f.deps), 1);
    const at = f.calls.indexOf("find boat-claude-test");
    assert.ok(at > 0, f.calls.join(", "));
    assert.deepEqual(f.calls.slice(at), ["find boat-claude-test", "ai block", "delete bx_found1", "onStop off"]);
    assert.match(f.said.join(" | "), /its sandbox bx_found1, found by the run's name, is deleted/);
  } finally {
    f.cleanup();
  }
});

test("a delete that fails after an unconfirmed halt is said as it is, and tried once more", async () => {
  let removes = 0;
  const f = fakes({
    prompt: async () => ({ stopped: "the request cap (9 of 5); boat did not confirm the block", failed: null, unconfirmed: true }),
    remove: () => {
      removes += 1;
      return false;
    },
  });
  try {
    assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task], f.deps), 1);
    const said = f.said.join(" | ");
    assert.match(said, /nothing was fetched and the delete is tried once more/);
    assert.doesNotMatch(said, /was deleted before/);
    assert.match(said, /may still exist/);
    assert.equal(removes, 2);
  } finally {
    f.cleanup();
  }
});

test("main keeps requests for the other Claude runs under way", async () => {
  const f = fakes({ claudeSlot: () => ({ waiting: 0, others: 2, up: () => {}, release: () => {} }), usage: () => usage(2000 - CLAUDE.requests - 2 * CLAUDE.maxRequests + 1) });
  try {
    assert.equal(await main(["--model", "claude-haiku-5-5", "--timeout", "600", "--task", f.task], f.deps), NOT_STARTED);
    assert.match(f.said.join(" | "), /kept for 2 other runs under way/);
  } finally {
    f.cleanup();
  }
});

test("stdout and stderr keep their own partial lines", async () => {
  const run = { model: "claude-haiku-5-5", requests: 500, timeout: 600 };
  const t = prompted(run, [{ totals: { requests: 1 } }]);
  t.io.start = () => {
    const c = child();
    setImmediate(() => {
      c.stdout.emit("data", Buffer.from('{"data":{"data":{"limitType":"auth_'));
      c.stderr.emit("data", Buffer.from("a warning on stderr" + String.fromCharCode(10)));
      c.stdout.emit("data", Buffer.from('expiry","summary":"Claude login required"}}}' + String.fromCharCode(10)));
      c.emit("close", 0);
    });
    return c;
  };
  try {
    const r = await runPrompt(run, "bx_abcd", null, t.events, t.io);
    assert.match(r.failed, /Claude login required/);
    const lines = readFileSync(t.events, "utf8").trim().split(/\r?\n/);
    assert.deepEqual(lines.sort(), ["a warning on stderr", '{"data":{"data":{"limitType":"auth_expiry","summary":"Claude login required"}}}'].sort());
  } finally {
    t.cleanup();
  }
});
