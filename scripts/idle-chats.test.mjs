// idle-chats.mjs (recipes/sandboxes-boat-chat.md): which T3 chat processes it ends, and the
// laptop-load note a chat hears at an owner's message (hooks/laptop-load-note.mjs).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chatProcesses, chatRuns, main, pickIdle } from "../plugins/cookbook/skills/cookbook/scripts/idle-chats/idle-chats.mjs";
import { noteDue, offloadNote } from "../plugins/cookbook/hooks/laptop-load-lib.mjs";

const NOW = Date.parse("2026-11-28T12:00:00Z");
const ago = (min) => new Date(NOW - min * 60000).toISOString();
const run = (thread, status, endedMinAgo) => ({ thread, status, requestedAt: ago(endedMinAgo + 5), completedAt: status === "running" ? null : ago(endedMinAgo) });

// A stand-in /proc: one folder per process, with the four files chatProcesses reads.
const fakeProc = (proc, pid, ppid, argv, env = [], rssKb = 0) => {
  mkdirSync(join(proc, String(pid)));
  writeFileSync(join(proc, String(pid), "cmdline"), `${argv.join("\0")}\0`);
  writeFileSync(join(proc, String(pid), "environ"), `${env.join("\0")}\0`);
  writeFileSync(join(proc, String(pid), "stat"), `${pid} (x y) S ${ppid} 1 1`);
  writeFileSync(join(proc, String(pid), "status"), `Name: x\nVmRSS:\t${rssKb} kB\n`);
};
const CHAT = ["/home/u/.local/bin/claude", "--output-format", "stream-json"];
const SHELL = ["/bin/bash", "-c", "source /home/u/.claude/shell-snapshots/snapshot-bash-1.sh && eval 'sleep 9'"];

// A stand-in T3 state with T3's own table definition (statev2.sqlite, read 28 November 2026).
const fakeState = (db, runs) => {
  const conn = new DatabaseSync(db);
  conn.exec(`CREATE TABLE IF NOT EXISTS orchestration_v2_projection_runs (
    run_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, ordinal INTEGER NOT NULL, provider TEXT NOT NULL,
    provider_thread_id TEXT, status TEXT NOT NULL, requested_at TEXT NOT NULL, completed_at TEXT,
    payload_json TEXT NOT NULL, provider_instance_id TEXT)`);
  const add = conn.prepare("INSERT INTO orchestration_v2_projection_runs (run_id, thread_id, ordinal, provider, status, requested_at, completed_at, payload_json) VALUES (?, ?, ?, 'claude', ?, ?, ?, '{}')");
  for (const r of runs) add.run(`${r.thread}-${Math.random()}`, r.thread, 1, r.status, r.requestedAt, r.completedAt);
  conn.close();
};

test("pickIdle ends only a chat whose runs all ended long enough ago, with no shell under it", () => {
  const procs = [
    { pid: 1, thread: "a", shell: false }, // idle 45 min: ended
    { pid: 2, thread: "b", shell: false }, // idle 10 min: kept
    { pid: 3, thread: "c", shell: false }, // a run still running: kept
    { pid: 4, thread: "d", shell: true }, // a background command under it: kept
    { pid: 5, thread: "e", shell: false }, // no runs read: kept
    { pid: 6, thread: null, shell: false }, // not a T3 chat: kept
    { pid: 7, thread: "g", shell: false }, // waiting on the owner's dialog: kept
  ];
  const runs = [run("a", "completed", 50), run("a", "completed", 45), run("b", "completed", 10), run("c", "completed", 90), run("c", "running", 0), run("d", "completed", 60), run("g", "waiting", 60)];
  const { end, keep } = pickIdle({ procs, runs, nowMs: NOW, idleMinutes: 30 });
  assert.deepEqual(end, [{ pid: 1, thread: "a", idleMin: 45 }]);
  assert.deepEqual(keep.map((k) => [k.pid, k.why]), [
    [2, "idle 10 min"],
    [3, "a run is not finished"],
    [4, "a shell runs under it"],
    [5, "no runs read"],
    [6, "no chat"],
    [7, "a run is not finished"],
  ]);
  // A queued or starting run is busy too; a run with no time at all keeps the process.
  assert.equal(pickIdle({ procs: [procs[0]], runs: [run("a", "completed", 45), run("a", "queued", 0)], nowMs: NOW }).end.length, 0);
  assert.equal(pickIdle({ procs: [procs[0]], runs: [{ thread: "a", status: "completed" }], nowMs: NOW }).keep[0].why, "no run time");
});

test("chatProcesses reads T3's chat id, the RSS and a Bash shell anywhere under the process, from a stand-in /proc", () => {
  const proc = mkdtempSync(join(tmpdir(), "idle-chats-proc-"));
  try {
    const p = (...a) => fakeProc(proc, ...a);
    p(10, 1, ["/home/u/.local/bin/claude", "--output-format", "stream-json"], ["T3CODE_THREAD_ID=t1"], 307200);
    p(11, 10, ["/bin/sh", "-c", "read -r _ <&4; claude --output-format stream-json"]);
    p(20, 1, ["/home/u/.local/bin/claude", "--output-format", "stream-json"], ["T3CODE_THREAD_ID=t2"], 102400);
    p(21, 20, ["/bin/bash", "-c", "source /home/u/.claude/shell-snapshots/snapshot-bash-1.sh && eval 'sleep 9'"]);
    p(22, 21, ["sleep", "9"]);
    p(30, 1, ["/home/u/.local/bin/claude", "-p", "hi"], []); // a scripted run, not T3's
    assert.deepEqual(chatProcesses(proc).sort((a, b) => a.pid - b.pid), [
      { pid: 10, thread: "t1", shell: false, mb: 300 },
      { pid: 20, thread: "t2", shell: true, mb: 100 },
    ]);
  } finally {
    rmSync(proc, { recursive: true, force: true });
  }
});

test("chatRuns reads T3's runs table read-only and maps its fields", async () => {
  const dir = mkdtempSync(join(tmpdir(), "idle-chats-db-"));
  try {
    const db = join(dir, "statev2.sqlite");
    fakeState(db, [run("t1", "completed", 50), run("t1", "running", 0), run("t2", "waiting", 5), run("t3", "completed", 60)]);
    const got = await chatRuns(["t1", "t2"], db);
    const order = (a, b) => `${a.thread}${a.status}`.localeCompare(`${b.thread}${b.status}`);
    assert.deepEqual(got.sort(order), [run("t1", "completed", 50), run("t1", "running", 0), run("t2", "waiting", 5)].sort(order));
    // No chats: nothing opened. A missing state throws and is not created (a read-only open).
    const missing = join(dir, "none.sqlite");
    assert.deepEqual(await chatRuns([], missing), []);
    await assert.rejects(chatRuns(["t1"], missing));
    assert.equal(existsSync(missing), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("main ends an idle chat, and looks again before each kill: a run or a shell that started in the gap keeps the process", async () => {
  const dir = mkdtempSync(join(tmpdir(), "idle-chats-main-"));
  try {
    const proc = join(dir, "proc");
    mkdirSync(proc);
    const db = join(dir, "statev2.sqlite");
    const logDir = join(dir, "log");
    for (const [pid, thread] of [[10, "t1"], [20, "t2"], [30, "t3"], [40, "t4"]]) fakeProc(proc, pid, 1, CHAT, [`T3CODE_THREAD_ID=${thread}`], 307200);
    fakeState(db, [run("t1", "completed", 45), run("t2", "completed", 45), run("t3", "completed", 45), run("t4", "completed", 5)]);
    const go = async (args, kill) => {
      const lines = [];
      const code = await main(args, { proc, db, nowMs: NOW, kill, logDir, log: (l) => lines.push(l), warn: (l) => lines.push(l) });
      return { code, lines };
    };

    // A dry run ends nothing and names the three idle chats.
    const dry = await go(["--dry-run"], () => assert.fail("a dry run killed"));
    assert.equal(dry.code, 0);
    assert.deepEqual(dry.lines.filter((l) => l.startsWith("would end")).map((l) => l.split(":")[0]), ["would end 10", "would end 20", "would end 30"]);

    // The first kill is the gap: while it happens, chat t2 starts a run and a shell starts under t3.
    const killed = [];
    const real = await go([], (pid, sig) => {
      killed.push([pid, sig]);
      if (pid === 10) {
        fakeState(db, [run("t2", "running", 0)]);
        fakeProc(proc, 31, 30, SHELL);
      }
    });
    assert.equal(real.code, 0);
    assert.deepEqual(killed, [[10, "SIGTERM"]]);
    assert.ok(real.lines.includes("keep 40: idle 5 min"), real.lines.join("\n"));
    assert.ok(real.lines.includes("keep 20: its runs changed"), real.lines.join("\n"));
    assert.ok(real.lines.includes("keep 30: a shell runs under it now"), real.lines.join("\n"));
    const logged = readFileSync(join(logDir, "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.deepEqual(logged, [{ at: new Date(NOW).toISOString(), pid: 10, thread: "t1", idleMin: 45, mb: 300 }]);

    // --thread limits it to one chat; a state it cannot read ends nothing; a bad --idle is refused.
    assert.deepEqual((await go(["--dry-run", "--thread", "t4"])).lines, ["keep 40: idle 5 min"]);
    const unread = await main([], { proc, db: join(dir, "none.sqlite"), nowMs: NOW, kill: () => assert.fail("killed"), logDir, log: () => {}, warn: () => {} });
    assert.equal(unread, 0);
    assert.equal((await go(["--idle", "0"])).code, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the unit files run the installed script every 10 minutes", () => {
  const dir = new URL("../plugins/cookbook/skills/cookbook/scripts/idle-chats/", import.meta.url);
  const service = readFileSync(new URL("idle-chats.service", dir), "utf8");
  const timer = readFileSync(new URL("idle-chats.timer", dir), "utf8");
  assert.match(service, /^ExecStart=\/usr\/bin\/node %h\/\.local\/bin\/idle-chats\.mjs$/m);
  assert.match(service, /^ConditionPathExists=%h\/\.local\/bin\/idle-chats\.mjs$/m);
  assert.match(timer, /^OnUnitActiveSec=10min$/m);
});

test("the offload note: boat for a chat that fits, cloud only for a job with no input, once an hour", () => {
  const note = offloadNote(["memory available 9% (1.3 GB), under 25%"], "/p/boat-chat.mjs");
  assert.match(note, /^Laptop load \(the Cookbook, recipes\/sandboxes-boat-chat\.md\): memory available 9% \(1\.3 GB\), under 25%\./);
  assert.match(note, /node "\/p\/boat-chat\.mjs" up <repository path>/);
  assert.match(note, /It asks the owner there, in T3\./);
  assert.match(note, /needs no input from the owner at all .* cloud session/);
  assert.match(note, /Anything else stays here/);
  const near = { near: true, reasons: ["x"] };
  assert.equal(noteDue(near, NaN, NOW), true);
  assert.equal(noteDue(near, NOW - 59 * 60000, NOW), false);
  assert.equal(noteDue(near, NOW - 61 * 60000, NOW), true);
  assert.equal(noteDue({ near: false, reasons: [] }, NaN, NOW), false);
});

test("the note hook as a process: only a T3 chat on a laptop with boat-chat set up, while near, once", () => {
  const home = mkdtempSync(join(tmpdir(), "laptop-load-note-"));
  try {
    const proc = join(home, "proc");
    mkdirSync(join(proc, "pressure"), { recursive: true });
    const meminfo = (availKb) => writeFileSync(join(proc, "meminfo"), `MemTotal: 16000000 kB\nMemAvailable: ${availKb} kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n`);
    const hook = fileURLToPath(new URL("../plugins/cookbook/hooks/laptop-load-note.mjs", import.meta.url));
    const say = (env = {}, input = { hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: "go" }) =>
      spawnSync(process.execPath, [hook], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, COOKBOOK_HOME: home, COOKBOOK_LAPTOP_PROC: proc, T3CODE_THREAD_ID: "t1", ...env } });
    meminfo(1000000);
    assert.equal(say().stdout, "", "no boat-chat state: silent");
    mkdirSync(join(home, ".local", "share", "boat-chat"), { recursive: true });
    writeFileSync(join(home, ".local", "share", "boat-chat", "state.json"), "{}");
    assert.equal(say({ T3CODE_THREAD_ID: "" }).stdout, "", "not a T3 chat: silent");
    const first = say();
    assert.equal(first.status, 0);
    const out = JSON.parse(first.stdout).hookSpecificOutput;
    assert.equal(out.hookEventName, "UserPromptSubmit");
    assert.match(out.additionalContext, /memory available 6\.3% \(1 GB\), under 25%/);
    assert.equal(say().stdout, "", "within the hour: silent");
    assert.match(say({}, { hook_event_name: "UserPromptSubmit", session_id: "s2", prompt: "go" }).stdout, /Laptop load/);
    meminfo(8000000);
    assert.equal(say({}, { hook_event_name: "UserPromptSubmit", session_id: "s3", prompt: "go" }).stdout, "", "plenty of memory: silent");
    assert.equal(say({}, { hook_event_name: "UserPromptSubmit", session_id: "s4", agent_id: "x" }).stdout, "", "a subagent: silent");
    assert.equal(spawnSync(process.execPath, [hook], { input: "not json", encoding: "utf8" }).status, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
