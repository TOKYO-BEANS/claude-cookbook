#!/usr/bin/env node
// PreToolUse hook of the Cookbook plugin: the boat route (boat-route-lib.mjs, recipes/boat.md).
// A local test run or Semgrep scan in a repository on boat-run's upload list is denied, with
// the boat-run.mjs command to use instead. It is a route, not a security gate: whatever goes
// wrong here lets the call run.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const windows = process.platform === "win32";
// The desktop app starts hooks with a short PATH: Git for Windows' own place first.
const GIT = windows && existsSync("C:/Program Files/Git/cmd/git.exe") ? "C:/Program Files/Git/cmd/git.exe" : "git";

const text = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

let out = null;
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const { decide, HINT } = await import("./boat-route-lib.mjs");
  // Most commands name no test runner: they leave before git or the upload list is read.
  const command = input?.tool_input?.command;
  out = typeof command !== "string" || !HINT.test(command) ? null : decide({
    input,
    deps: {
      cwd: (i) => (typeof i?.cwd === "string" && i.cwd ? i.cwd : process.cwd()),
      home: homedir().replace(/\\/g, "/"),
      windows,
      script: resolve(here, "../skills/cookbook/scripts/boat-run.mjs").replace(/\\/g, "/"),
      repo: await repoReader(),
    },
  });
} catch {
  out = null;
}
if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
process.exitCode = 0;

async function repoReader() {
  const { listEntry, normalKey, UPLOAD_LIST } = await import("../skills/cookbook/scripts/boat-run.mjs");
  const list = text(UPLOAD_LIST) ?? "";
  const seen = new Map();
  return (dir) => {
    if (seen.has(dir)) return seen.get(dir);
    let repo = null;
    if (existsSync(dir)) {
      const git = (...a) => spawnSync(GIT, ["-C", dir, ...a], { encoding: "utf8", timeout: 5000 });
      const where = git("rev-parse", "--show-toplevel", "--show-prefix");
      if (where.status === 0) {
        const [top, prefix = ""] = where.stdout.split(/\r?\n/);
        const origin = git("config", "--get", "remote.origin.url");
        const key = normalKey(origin.status === 0 && origin.stdout.trim() ? origin.stdout.trim() : top);
        const pkg = JSON.parse(text(join(top, prefix, "package.json")) ?? "{}");
        const pin = /^semgrep==([0-9][0-9A-Za-z.]*)\s*$/m.exec(text(join(top, ".depot", "semgrep-requirements.txt")) ?? "");
        repo = {
          listed: listEntry(key, list) !== null,
          key,
          top: top.replace(/\\/g, "/"),
          prefix,
          deps: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0,
          lock: existsSync(join(top, prefix, "package-lock.json")),
          requirements: existsSync(join(top, prefix, "requirements.txt")),
          semgrep: pin ? pin[1] : null,
        };
      }
    }
    seen.set(dir, repo);
    return repo;
  };
}
