#!/usr/bin/env node
// Stop hook of the Cookbook plugin: a closing message that leaves something with the owner
// is stopped once until the turn asks with AskUserQuestion or marks the thread, and a "done"
// closing in T3 is stopped once until the thread is settled. See recipes/owner-questions.md.
// Time limit: 12 s inside (hooks.json allows 20). It never fails a session: any error lets
// the stop go ahead and is written to the log.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { askBroker, pipeName } from "./owner-questions-broker.mjs";
import { run } from "./owner-questions-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const stateDir = join(homedir(), ".local", "share", "claude-cookbook", "owner-questions");
const withKey = join(homedir(), ".local", "bin", "with-key.mjs");
const JEV_KEY = "jev-compaction"; // the Cookbook's own Jev key, as in web-batch
const BUDGET_MS = 12_000;
const RESPAWN_GAP_MS = 2 * 60_000;

const log = (line) => {
  mkdirSync(stateDir, { recursive: true });
  appendFileSync(join(stateDir, "log.jsonl"), `${JSON.stringify(line)}\n`);
};

function startBroker(pipe) {
  const mark = join(stateDir, "broker-start.json");
  try {
    const last = JSON.parse(readFileSync(mark, "utf8")).at;
    if (Date.now() - last < RESPAWN_GAP_MS) return "starting";
  } catch {
    // no earlier start
  }
  if (!existsSync(withKey)) return "with-key.mjs not found";
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(mark, JSON.stringify({ at: Date.now() }));
  const child = spawn(process.execPath, [withKey, JEV_KEY, "TYPESAFE_API_KEY", process.execPath, join(here, "owner-questions-broker.mjs"), pipe], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => {});
  child.unref();
  return "started";
}

async function classify(text) {
  const deadline = Date.now() + BUDGET_MS;
  const pipe = pipeName(stateDir);
  let answer = await askBroker(text, { pipe, timeoutMs: 7000 });
  if (answer.ok || answer.error !== "no broker") return answer;
  const start = startBroker(pipe);
  // Only a start made now is waited for: a cold start reads the key (2 to 27 s). A start that
  // cannot happen, or one an earlier turn made, falls back at once.
  while (start === "started" && Date.now() < deadline - 500) {
    await new Promise((r) => setTimeout(r, 500));
    answer = await askBroker(text, { pipe, timeoutMs: Math.max(500, deadline - Date.now()) });
    if (answer.error !== "no broker") return answer;
  }
  return { ok: false, error: `no broker yet (${start})` };
}

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  raw = "";
}
let input = {};
try {
  input = JSON.parse(raw || "{}");
} catch {
  input = {};
}
const out = await run({ input, env: process.env, readFile: (p) => readFileSync(p, "utf8"), classify, log });
if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
process.exitCode = 0;
