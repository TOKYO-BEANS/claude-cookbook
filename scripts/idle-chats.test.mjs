// idle-chats.mjs (recipes/sandboxes-boat-chat.md): which T3 chat processes it ends, and the
// laptop-load note a chat hears at an owner's message (hooks/laptop-load-note.mjs).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chatProcesses, pickIdle } from "../plugins/cookbook/skills/cookbook/scripts/idle-chats/idle-chats.mjs";
import { noteDue, offloadNote } from "../plugins/cookbook/hooks/laptop-load-lib.mjs";

const NOW = Date.parse("2026-11-28T12:00:00Z");
const ago = (min) => new Date(NOW - min * 60000).toISOString();
const run = (thread, status, endedMinAgo) => ({ thread, status, requestedAt: ago(endedMinAgo + 5), completedAt: status === "running" ? null : ago(endedMinAgo) });

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
    const p = (pid, ppid, argv, env = [], rssKb = 0) => {
      mkdirSync(join(proc, String(pid)));
      writeFileSync(join(proc, String(pid), "cmdline"), `${argv.join("\0")}\0`);
      writeFileSync(join(proc, String(pid), "environ"), `${env.join("\0")}\0`);
      writeFileSync(join(proc, String(pid), "stat"), `${pid} (x y) S ${ppid} 1 1`);
      writeFileSync(join(proc, String(pid), "status"), `Name: x\nVmRSS:\t${rssKb} kB\n`);
    };
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
