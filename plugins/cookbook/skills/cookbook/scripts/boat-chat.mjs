#!/usr/bin/env node
// Whole T3 chats on boat (recipes/sandboxes-boat-chat.md; owner, 27 November 2026: keep boat
// for chats that suit it, and offload before this laptop runs short).
//
//   node boat-chat.mjs where [--json]        local or boat, from this laptop's load now
//   node boat-chat.mjs status                the load, the sandbox, the proxy, the forward, the link
//   node boat-chat.mjs up <repository> [--hours <h>] [--type small|default] [--push]
//   node boat-chat.mjs pull <repository> [--apply]
//   node boat-chat.mjs down [--delete [--discard]]
//
// - `up` brings one sandbox up for chats: the AI credentials proxy on, the sandbox resumed
//   (or made: `claude-proxy` environment, `small`), the repository pushed to
//   /home/user/<repository>-<branch> when it is not there yet (or with --push) as sandbox-run uploads one:
//   on the upload list, the files git tracks with their edits, no unnamed data-shaped file,
//   Gitleaks clean (a finding goes to the owner), T3 Code at this laptop's
//   version, `t3 serve` on 127.0.0.1:3773 (restarted after a resume: the proxy's placeholder
//   changes), `boat forward` to 127.0.0.1:13773 here, and the link to this T3. It prints the
//   `environmentId` for `t3_thread_launch` and the repository's path for `t3_project_create`.
//   Run again for a second repository: the same sandbox holds several chats. A pushed copy
//   becomes a git repository with one base commit, so the chat can commit and `pull` can
//   tell what it changed. --push over a copy with changes stops: pull them first.
// - `pull` brings a chat's work back: everything changed since the last pull (or the base
//   commit), committed or not, as one patch in ~/.local/share/boat-chat/patches/<name>-<time>/. Gitleaks reads
//   it first (a finding: exit 4, nothing applied); `git apply --check` tries it on the
//   folder; --apply applies it to a folder with no changes of its own and only then marks
//   it pulled (refs/boat/pulled in the copy): a plain pull is a look. The sandbox has no GitHub login: the
//   pull request is opened from here.
// - `down` ends the forward (its `ssh` too), stops the sandbox (data kept 14 days; --delete
//   deletes it and unlinks it, only when no copy holds unpulled changes, or with --discard) and turns the proxy off when no sandbox of ours runs. Run it
//   when the last boat chat has settled.
// - The pairing credential goes from the sandbox's output to `t3 environment link` on stdin:
//   never on a command line, never printed. The `t3 serve` log is never read (pairing QR).
// - Money: the proxy is USD 1 a day while on plus USD 1 per 1,000 requests, inside the
//   owner's yes; a wallet under USD 5 is said aloud, a top-up is the owner's.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { laptopLoad } from "../../../hooks/laptop-load-lib.mjs";
import { UPLOAD_LIST, dataFiles, listEntry, repoKey, scan, stage, unnamed } from "./sandbox-run.mjs";

export const REMOTE_PORT = 3773;
export const LOCAL_PORT = 13773;
export const LOCAL_URL = `http://127.0.0.1:${LOCAL_PORT}`;
export const T3_BIN = "/home/user/t3cli/node_modules/.bin/t3";
export const ENVIRONMENT = "claude-proxy";
export const WALLET_WARN = 5;
export const HOME = join(homedir(), ".local", "share", "boat-chat");
export const STATE_FILE = join(HOME, "state.json");
export const SCAN_FOUND = 4;
const GIT_ID = "-c user.name='boat chat' -c user.email=boat-chat@localhost";
const ID = /^bx_[a-z0-9]{4,40}$/;
// boat's states: a stopped sandbox resumes; a deleted one is replaced; one that failed still
// exists and may hold unpulled work, so it stops `up` with its id; every other state
// (running, idle, ready, starting ...) is a sandbox that runs. `idle` runs: seen 27
// November 2026, where a first version made a second sandbox.
const STOPPED = new Set(["stopped", "stopping"]);
const GONE = new Set(["deleted", "deleting"]);
const FAILED = new Set(["error", "failed", "archived"]);
export const stateKind = (state) => (STOPPED.has(state) ? "stopped" : GONE.has(state) || !state ? "gone" : FAILED.has(state) ? "failed" : "running");
const NAME = /^[A-Za-z0-9._-]{1,80}$/;
const BASE_LINE = /^base: ([0-9a-f]{40}|unknown)( with uncommitted edits)?$/;
const T3_VERSION = /^t3 v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\s*$/m;

// The last JSON value of a JSONL output, or null.
export function lastJson(text) {
  const lines = String(text ?? "").trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      // not JSON: an earlier line may be
    }
  }
  return null;
}

// The first `id` that looks like a sandbox's in a JSONL output.
export function firstId(text) {
  for (const line of String(text ?? "").split("\n")) {
    try {
      const v = JSON.parse(line);
      if (ID.test(v?.id ?? "")) return v.id;
    } catch {
      // next line
    }
  }
  return null;
}

export function parseArgs(argv) {
  const [command = "", ...rest] = argv;
  const o = { command, repo: "", hours: 4, type: "small", push: false, del: false, json: false, apply: false, discard: false };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === "--hours") o.hours = Number(rest[++i]);
    else if (a === "--type") o.type = rest[++i];
    else if (a === "--push") o.push = true;
    else if (a === "--delete") o.del = true;
    else if (a === "--json") o.json = true;
    else if (a === "--apply") o.apply = true;
    else if (a === "--discard") o.discard = true;
    else if (!a.startsWith("-") && !o.repo) o.repo = a;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!["where", "status", "up", "pull", "down"].includes(o.command)) throw new Error("command: where, status, up, pull or down");
  if ((o.command === "up" || o.command === "pull") && !o.repo) throw new Error(`${o.command} needs a repository folder`);
  if (!(Number.isInteger(o.hours) && o.hours >= 1 && o.hours <= 24)) throw new Error("--hours: 1 to 24");
  if (o.discard && !o.del) throw new Error("--discard goes with down --delete");
  if (!["small", "default"].includes(o.type)) throw new Error("--type: small or default (a larger size is the owner's)");
  return o;
}

// A repository's name from its origin URL ("claude-cookbook"), so a worktree's folder name
// never names the folder in the sandbox; "" when there is none.
export const repoName = (url) => /([A-Za-z0-9._-]+?)(?:\.git)?\/?\s*$/.exec(String(url ?? "").trim())?.[1] ?? "";

// The version this laptop's T3 runs, for the same version in the sandbox.
export const t3Version = (text) => T3_VERSION.exec(String(text ?? ""))?.[1] ?? null;

// npm's --before: 24 hours ago (the age rule), as an ISO time.
export const before = (now) => new Date(now - 24 * 3_600_000).toISOString();

// The linked environment that answers at LOCAL_URL, or null.
export const linkAt = (list) => (Array.isArray(list) ? list.find((e) => Array.isArray(e?.urls) && e.urls.includes(LOCAL_URL)) ?? null : null);

// What `boat exec --json` printed: { code, stdout }.
const execResult = (r) => {
  const j = lastJson(r.stdout);
  return { code: r.code === 0 && j ? Number(j.exitCode ?? 0) : r.code || 1, stdout: String(j?.stdout ?? ""), pid: j?.pid ?? null };
};

const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

export function readState(read = readFileSync, file = STATE_FILE) {
  try {
    const s = JSON.parse(read(file, "utf8"));
    return ID.test(s?.id ?? "") ? s : {};
  } catch {
    return {};
  }
}

function writeState(state, file = STATE_FILE) {
  mkdirSync(join(file, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(`${file}.tmp`, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}

// The real world: commands, the forward, the state file, the clock. Tests pass their own.
export function realIo() {
  return {
    run(cmd, args, { input, timeout = 120_000 } = {}) {
      const r = spawnSync(cmd, args, { input, encoding: "utf8", timeout, maxBuffer: 32 * 1024 * 1024 });
      return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
    },
    background(cmd, args) {
      const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
      child.unref();
    },
    async answers() {
      try {
        const r = await fetch(`${LOCAL_URL}/`, { signal: AbortSignal.timeout(3000) });
        return r.status === 200;
      } catch {
        return false;
      }
    },
    pause: (ms) => new Promise((r) => setTimeout(r, ms)),
    readState: () => readState(),
    writeState: (s) => writeState(s),
    load: () => laptopLoad(),
    mkdir: (dir) => mkdirSync(dir, { recursive: true, mode: 0o700 }),
    scan: (dir) => {
      const tmp = mkdtempSync(join(tmpdir(), "boat-chat-scan-"));
      try {
        return scan(dir, tmp);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
    size: (file) => statSync(file).size,
    // The upload as sandbox-run makes one: { ok, dir, remove } or { ok: false, reason }.
    prepare: (folder) => {
      const key = repoKey(folder);
      let list = "";
      try {
        list = readFileSync(UPLOAD_LIST, "utf8");
      } catch {
        // no list yet: nothing is allowed
      }
      const entry = listEntry(key, list);
      if (!entry) return { ok: false, reason: `${key ?? "this folder"} is not on the upload list (${UPLOAD_LIST}): recipes/sandboxes-setup.md says when one is added` };
      const staged = stage(folder);
      const data = unnamed(dataFiles(staged.dir).map((f) => `${staged.prefix || ""}${f}`), entry.data);
      if (data.length > 0) {
        staged.remove();
        return { ok: false, reason: `the upload holds ${data.length} data-shaped file(s) the upload list does not name (${data.slice(0, 5).join("; ")}): look at each; one with customer data goes to the owner` };
      }
      const found = scan(staged.dir, staged.tmp);
      if (!found.ok) {
        staged.remove();
        return { ok: false, reason: `the secret scan of the upload: ${found.reason}` };
      }
      return { ok: true, dir: staged.dir, remove: staged.remove };
    },
    now: () => Date.now(),
    out: (line) => process.stdout.write(`${line}\n`),
  };
}

const boat = (io, args, opts) => io.run("boat", args, opts);
const t3 = (io, args, opts) => io.run("t3", args, opts);
const inBox = (io, id, script, timeout = 30) => execResult(boat(io, ["exec", id, "--json", "--timeout", String(timeout), "--", "bash", "-lc", script], { timeout: (timeout + 30) * 1000 }));

async function waitFor(io, check, tries = 30) {
  for (let i = 0; i < tries; i += 1) {
    if (await check()) return true;
    await io.pause(2000);
  }
  return false;
}

function where(io, o) {
  const load = io.load();
  const verdict = load.near ? "boat" : "local";
  if (o.json) io.out(JSON.stringify({ where: verdict, ...load }));
  else {
    io.out(`${verdict}: ${load.near ? load.reasons.join("; ") : "under every limit"}`);
    io.out(`numbers: ${JSON.stringify(load.numbers)}`);
  }
  return 0;
}

// The recorded sandbox, or null only when boat's full list confirms it is gone. A failed
// read (network, auth, an outage) stops the command: the sandbox may hold unpulled work,
// and a new one must never replace it in the record unseen.
function sandboxInfo(io, id) {
  if (!id) return null;
  const r = boat(io, ["info", id, "--json"]);
  const j = r.code === 0 ? lastJson(r.stdout) : null;
  const s = j?.sandbox ?? j;
  if (s?.id === id) return s;
  const list = lastJson(boat(io, ["list", "--all", "--json"]).stdout);
  if (!Array.isArray(list?.sandboxes)) throw new Error(`could not read sandbox ${id} from boat; nothing changed`);
  const found = list.sandboxes.find((x) => x?.id === id);
  if (found) return found;
  return null;
}

// A failed sandbox still exists and may hold unpulled work: recovered first, or deleted on
// the owner's word for that work.
const failedSandbox = (info) => `sandbox ${info.id} is ${info.state}: boat recover ${info.id} first, or down --delete --discard`;

// true, false, or null when boat could not say: an unknown is never read as off.
function proxyOn(io) {
  const v = lastJson(boat(io, ["ai", "proxy", "--json"]).stdout)?.enabled;
  return typeof v === "boolean" ? v : null;
}

// Adds copies to the record, read again just before the write: two `up` runs at once add
// to it, never replace each other's names. A new sandbox starts a new record.
function record(io, id, names) {
  const now = io.readState();
  const kept = now.id === id && Array.isArray(now.repos) ? now.repos : [];
  io.writeState({ id, repos: [...new Set([...kept, ...names])] });
}

function walletLine(io) {
  const b = lastJson(boat(io, ["billing", "--json"]).stdout)?.walletStatus?.balanceDollars;
  if (typeof b !== "number") return "wallet: unknown";
  return b < WALLET_WARN ? `wallet: USD ${b}, under USD ${WALLET_WARN}: a top-up is the owner's; tell the owner` : `wallet: USD ${b}`;
}

async function status(io) {
  where(io, {});
  const s = io.readState();
  const info = sandboxInfo(io, s.id);
  io.out(`sandbox: ${s.id ? `${s.id} ${info?.state ?? "gone"}` : "none recorded"}${s.repos?.length ? `, repositories ${s.repos.join(", ")}` : ""}`);
  const p = proxyOn(io);
  io.out(`proxy: ${p === null ? "unknown (boat did not say)" : p ? "on (USD 1 a day while on)" : "off"}`);
  io.out(`forward ${LOCAL_URL}: ${(await io.answers()) ? "answers" : "does not answer"}`);
  const link = linkAt(lastJson(t3(io, ["environment", "list", "--json"], { timeout: 30_000 }).stdout));
  io.out(`link: ${link ? `${link.environmentId} ${link.status}` : "none"}`);
  io.out(walletLine(io));
  return 0;
}

const stopForward = (io) => {
  // No shell runs these, so the patterns cannot match a shell of this command.
  io.run("pkill", ["-f", `[b]oat forward .*--local ${LOCAL_PORT}`]);
  io.run("pkill", ["-f", `[s]sh.*${LOCAL_PORT}`]);
};

// The copy's name in the sandbox: the repository, the checkout's branch and a short hash of
// the branch's own name, so two worktrees of one repository never share a copy, a base or a
// pull mark, even when their names read alike ("feat/x" and "feat-x").
export const copyName = (repo, branch) => {
  const raw = String(branch ?? "");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 8);
  const readable = `${repo}-${raw.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")}`.slice(0, 71).replace(/-+$/, "");
  return `${readable}-${hash}`;
};

function repoAndName(io, folder) {
  const repo = resolve(folder);
  const base = repoName(io.run("git", ["-C", repo, "remote", "get-url", "origin"]).stdout) || basename(repo);
  let branch = io.run("git", ["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (!branch || branch === "HEAD") branch = io.run("git", ["-C", repo, "rev-parse", "--short", "HEAD"]).stdout.trim();
  const name = copyName(base, branch);
  if (!NAME.test(name) || !branch) throw new Error(`the copy's name is not a plain name: ${name}`);
  return { repo, name };
}

// The copy's files now, committed or not, as a tree, without touching the chat's index.
const TREE_NOW = `export GIT_INDEX_FILE=$(mktemp -u); git read-tree HEAD; git add -A; now=$(git write-tree); rm -f "$GIT_INDEX_FILE"; unset GIT_INDEX_FILE`;
// The commit the next pull starts from: the last one pulled, else the base commit.
const FROM = `from=$(git rev-parse -q --verify refs/boat/pulled || git rev-list --max-parents=0 HEAD | tail -1)`;

// The copy's state in the sandbox: "none", "clean" (its files are those of the last pull or
// the base) or "changed".
function copyState(io, id, name) {
  const r = inBox(io, id, `cd /home/user/${name} 2>/dev/null || { echo none; exit 0; }; [ -d .git ] || { echo changed; exit 0; }; ${TREE_NOW}; ${FROM}; [ "$now" = "$(git rev-parse "$from^{tree}")" ] && echo clean || echo changed`);
  return ["none", "clean", "changed"].includes(r.stdout.trim()) ? r.stdout.trim() : "changed";
}

async function up(io, o) {
  const { repo, name } = repoAndName(io, o.repo);
  const ver = t3Version(t3(io, ["--version"]).stdout);
  if (!ver) throw new Error("could not read this laptop's t3 version");

  // Everything that needs no sandbox and costs nothing comes before the proxy.
  const state = io.readState();
  const info = sandboxInfo(io, state.id);
  if (info && stateKind(info.state) === "failed") throw new Error(`${failedSandbox(info)} once its work is safe; no new one replaces it`);
  const was = proxyOn(io);
  if (was === null) throw new Error("could not read the proxy's state from boat; nothing changed");
  const turnedOn = was === false;
  if (turnedOn && boat(io, ["ai", "proxy", "on", "--json"]).code !== 0) throw new Error("boat ai proxy on failed");
  io.out("proxy: on");
  try {
    return await bringUp(io, o, { repo, name, ver, state, info });
  } catch (e) {
    // A failed up never leaves a proxy on that it turned on: it is paid by the day.
    if (turnedOn) io.out(boat(io, ["ai", "proxy", "off", "--json"]).code === 0 ? "proxy: off again (this up turned it on)" : "proxy: still on, turning it off failed: run down");
    throw e;
  }
}

async function bringUp(io, o, { repo, name, ver, state, info }) {
  let id = info?.id ?? null;
  let fresh = false, restart = false;
  const kind = info ? stateKind(info.state) : "gone";
  if (kind === "stopped") {
    if (boat(io, ["resume", id, "--json"], { timeout: 300_000 }).code !== 0) throw new Error(`boat resume ${id} failed`);
    restart = true;
    io.out(`sandbox: ${id} resumed`);
  } else if (kind === "gone") {
    const r = boat(io, ["new", "--type", o.type, "--environment", ENVIRONMENT, "--name", `chats-${new Date(io.now()).toISOString().slice(0, 10)}`, "--json"], { timeout: 600_000 });
    id = firstId(r.stdout);
    if (r.code !== 0 || !id) throw new Error("boat new failed");
    fresh = restart = true;
    io.out(`sandbox: ${id} new (${o.type})`);
  } else io.out(`sandbox: ${id} running`);
  if (boat(io, ["extend", id, "--hours", String(o.hours), "--json"]).code !== 0) throw new Error(`boat extend ${id} failed`);
  if (fresh) io.writeState({ id, repos: [] });
  else record(io, id, []);

  // T3 at this laptop's version, checked on every up: a failed install or a laptop update is
  // repaired here, never left for `t3 serve` to fail on.
  const have = t3Version(inBox(io, id, `${T3_BIN} --version 2>/dev/null || true`).stdout);
  if (have !== ver) {
    const setup = [
      "set -e",
      `mkdir -p ~/t3cli && cd ~/t3cli && [ -f package.json ] || npm init -y >/dev/null`,
      `npm install --no-fund --no-audit --before=${sq(before(io.now()))} ${sq(`t3@${ver}`)} >/dev/null 2>&1`,
      `python3 -c ${sq(`import json,os\nf=os.path.expanduser("~/.t3/userdata/settings.json")\nos.makedirs(os.path.dirname(f),exist_ok=True)\nd=json.load(open(f)) if os.path.exists(f) else {}\nd["linkedEnvironmentsEnabled"]=True\njson.dump(d,open(f,"w"),indent=2)`)}`,
      `${T3_BIN} --version`,
    ].join("\n");
    const r = inBox(io, id, setup, 600);
    if (r.code !== 0 || t3Version(r.stdout) !== ver) throw new Error(`T3 ${ver} did not install in the sandbox (npm's --before keeps a release under 24 hours out)`);
    io.out(`t3: ${ver} in the sandbox${have ? ` (was ${have})` : ""}`);
    restart = true;
  }

  const copy = copyState(io, id, name);
  if (copy === "none" || o.push) {
    if (copy === "changed") throw new Error(`/home/user/${name} has changes since its base: pull them first`);
    const head = io.run("git", ["-C", repo, "rev-parse", "HEAD"]).stdout.trim();
    const dirty = io.run("git", ["-C", repo, "status", "--porcelain"]).stdout.trim() !== "";
    const upload = io.prepare(repo);
    if (!upload.ok) throw new Error(`not pushed: ${upload.reason}`);
    try {
      if (boat(io, ["push", id, upload.dir, "--to", `/home/user/${name}`, "--json"], { timeout: 600_000 }).code !== 0) throw new Error("boat push failed");
    } finally {
      upload.remove();
    }
    const base = `base: ${/^[0-9a-f]{40}$/.test(head) ? head : "unknown"}${dirty ? " with uncommitted edits" : ""}`;
    const r = inBox(io, id, `set -e; cd /home/user/${name}; rm -rf .git; git init -q -b boat; git add -A; git ${GIT_ID} commit -q -m ${sq(base)}; git config user.name 'boat chat'; git config user.email boat-chat@localhost`, 120);
    if (r.code !== 0) throw new Error("the base commit failed");
    io.out(`pushed: ${repo} → /home/user/${name} (${base})`);
  } else io.out(`repository: /home/user/${name} is there (${copy}; --push copies it again when clean)`);
  record(io, id, [name]);

  const serving = inBox(io, id, `pgrep -f '[t]3cli/.*t3 serve' >/dev/null && echo yes || echo no`).stdout.trim() === "yes";
  if (restart || !serving) {
    inBox(io, id, "pkill -f '[t]3cli/.*t3 serve'; true");
    const r = boat(io, ["exec", id, "--detach", "--json", "--", "bash", "-lc", `cd /home/user && exec ${T3_BIN} serve --host 127.0.0.1 --port ${REMOTE_PORT} /home/user/${name} >/dev/null 2>&1`]);
    if (r.code !== 0) throw new Error("t3 serve did not start");
    io.out("t3 serve: started on 127.0.0.1 in the sandbox");
  }

  if (restart) stopForward(io);
  if (!(await io.answers())) {
    stopForward(io);
    io.background("boat", ["forward", id, "--remote", String(REMOTE_PORT), "--local", String(LOCAL_PORT), "--bind", "127.0.0.1"]);
  }
  if (!(await waitFor(io, () => io.answers()))) throw new Error(`${LOCAL_URL} does not answer`);
  io.out(`forward: ${LOCAL_URL} answers`);

  let link = linkAt(lastJson(t3(io, ["environment", "list", "--json"], { timeout: 30_000 }).stdout));
  if (link && (fresh || link.status !== "reachable")) {
    if (fresh || !(await waitFor(io, () => linkAt(lastJson(t3(io, ["environment", "list", "--json"], { timeout: 30_000 }).stdout))?.status === "reachable", 5))) {
      t3(io, ["environment", "unlink", link.environmentId], { timeout: 30_000 });
      link = null;
    }
  }
  if (!link) {
    const r = inBox(io, id, `${T3_BIN} auth pairing create --json --ttl 5m --label laptop-link 2>/dev/null`);
    let credential = "";
    try {
      credential = String(JSON.parse(r.stdout).credential ?? "");
    } catch {
      credential = "";
    }
    if (!credential) throw new Error("no pairing credential came back");
    const l = t3(io, ["environment", "link", "--from", "-", "--access", "full-access"], { input: `${LOCAL_URL} ${credential}\n`, timeout: 60_000 });
    credential = "";
    if (l.code !== 0) throw new Error("t3 environment link failed");
    link = linkAt(lastJson(t3(io, ["environment", "list", "--json"], { timeout: 30_000 }).stdout));
    if (!link) throw new Error("linked, but the environment is not listed");
  }
  io.out(walletLine(io));
  io.out(`environmentId: ${link.environmentId}`);
  io.out(`repository path: /home/user/${name}`);
  io.out("next: t3_project_create (that environmentId, that path), then t3_thread_launch with model claude-opus-5-5, effort high");
  return 0;
}

// The sandbox recorded and running, or an error that says to run up.
function runningSandbox(io) {
  const info = sandboxInfo(io, io.readState().id);
  if (info && stateKind(info.state) === "failed") throw new Error(failedSandbox(info));
  if (!info || stateKind(info.state) !== "running") throw new Error("no running sandbox: run up first");
  return info.id;
}

function pull(io, o) {
  const { repo, name } = repoAndName(io, o.repo);
  const id = runningSandbox(io);
  const remote = `/tmp/boat-chat-${name}.patch`;
  const r = inBox(io, id, `set -e; cd /home/user/${name}; ${TREE_NOW}; ${FROM}; mark=$(git ${GIT_ID} commit-tree "$now" -p HEAD -m pulled); git diff --binary "$from" "$mark" > ${remote}; git log -1 --format=%s "$(git rev-list --max-parents=0 HEAD | tail -1)"; echo "$mark"`, 120);
  const lines = r.stdout.trim().split("\n");
  const mark = lines.at(-1);
  if (r.code !== 0 || !/^[0-9a-f]{40}$/.test(mark ?? "")) throw new Error(`no patch from /home/user/${name}`);
  const stamp = new Date(io.now()).toISOString().replace(/[:.]/g, "-");
  const dir = join(io.home ?? HOME, "patches", `${name}-${stamp}`);
  io.mkdir(dir);
  const file = join(dir, "changes.patch");
  if (boat(io, ["scp", `${id}:${remote}`, file], { timeout: 300_000 }).code !== 0) throw new Error("boat scp failed");
  const found = io.scan(dir);
  if (!found.ok) {
    io.out(`gitleaks: ${found.reason ?? "a finding"}; nothing applied. A finding goes to the owner.`);
    io.out(`patch: ${file}`);
    return SCAN_FOUND;
  }
  // Only work that reached this folder counts as pulled: a plain pull is a look, and the
  // copy stays "changed" (no --push over it, no delete without --discard) until --apply.
  const markPull = () => {
    if (inBox(io, id, `cd /home/user/${name} && git update-ref refs/boat/pulled ${mark}`).code !== 0) throw new Error("could not mark the pull in the sandbox");
  };
  const size = io.size(file);
  // Text from the sandbox is data: only a base line of the script's own shape is shown.
  const baseLine = BASE_LINE.test(lines.at(-2) ?? "") ? lines.at(-2) : "base unknown";
  io.out(`patch: ${file} (${size} bytes; ${baseLine})`);
  if (size === 0) {
    io.out("no changes since the last pull");
    return 0;
  }
  const check = io.run("git", ["-C", repo, "apply", "--check", file]);
  io.out(`git apply --check: ${check.code === 0 ? "applies" : "does not apply"}`);
  if (o.apply) {
    if (check.code !== 0) throw new Error("not applied: the patch does not apply here");
    if (io.run("git", ["-C", repo, "status", "--porcelain"]).stdout.trim() !== "") throw new Error("not applied: the folder has changes of its own");
    if (io.run("git", ["-C", repo, "apply", file]).code !== 0) throw new Error("git apply failed");
    markPull();
    io.out(`applied to ${repo}: review, commit and open the pull request from here`);
  }
  return 0;
}

function down(io, o) {
  const state = io.readState();
  const info = sandboxInfo(io, state.id);
  // A chat's work lives only in the sandbox until it is pulled: never delete it unseen.
  if (info && o.del && !o.discard) {
    if (stateKind(info.state) === "failed") throw new Error(`not deleted: ${failedSandbox(info)}`);
    if (stateKind(info.state) !== "running") throw new Error("not deleted: the sandbox is stopped, so its copies cannot be checked; run up, pull each repository, then down --delete (or add --discard)");
    // Every copy in the sandbox, not only the recorded ones: the record could miss one.
    const listed = inBox(io, info.id, `for d in /home/user/*/; do [ -d "$d.git" ] && basename "$d"; done; true`).stdout.split("\n").map((l) => l.trim());
    const names = [...new Set([...(state.repos ?? []), ...listed])].filter((n) => NAME.test(n));
    const changed = names.filter((n) => copyState(io, info.id, n) === "changed");
    if (changed.length > 0) throw new Error(`not deleted: unpulled changes in ${changed.map((n) => `/home/user/${n}`).join(", ")}; pull first (or add --discard)`);
  }
  stopForward(io);
  io.out("forward: ended");
  if (info) {
    if (o.del) {
      if (boat(io, ["delete", info.id, "--yes", "--json"], { timeout: 300_000 }).code !== 0) throw new Error(`boat delete ${info.id} failed`);
      const link = linkAt(lastJson(t3(io, ["environment", "list", "--json"], { timeout: 30_000 }).stdout));
      if (link) t3(io, ["environment", "unlink", link.environmentId], { timeout: 30_000 });
      io.writeState({});
      io.out(`sandbox: ${info.id} deleted, link removed`);
    } else if (stateKind(info.state) === "running") {
      // A failed stop is said, never thrown: the proxy check below still runs.
      if (boat(io, ["stop", info.id, "--json"], { timeout: 300_000 }).code !== 0) io.out(`sandbox: boat stop ${info.id} failed; status says what it is`);
      else io.out(`sandbox: ${info.id} stopped (kept 14 days; up resumes it)`);
    } else io.out(`sandbox: ${info.id} ${info.state}, nothing to stop`);
  } else io.out("sandbox: none recorded");
  const list = lastJson(boat(io, ["list", "--json"]).stdout);
  // An unread list is never "none run": other chats' sandboxes may need the proxy.
  if (!Array.isArray(list?.sandboxes)) {
    io.out("proxy: left as it is, boat list failed; run down again");
    return 1;
  }
  const running = list.sandboxes.filter((s) => s.environment === ENVIRONMENT);
  if (running.length === 0) {
    // Turned off when on or unknown: only a reading of "off" skips the call.
    if (proxyOn(io) !== false && boat(io, ["ai", "proxy", "off", "--json"]).code !== 0) throw new Error("boat ai proxy off failed");
    io.out("proxy: off");
  } else io.out(`proxy: left on, ${running.length} ${ENVIRONMENT} sandbox(es) still run`);
  return 0;
}

export async function main(argv, io = realIo()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    io.out(`boat-chat: ${e.message}`);
    io.out("usage: boat-chat.mjs where [--json] | status | up <repository> [--hours h] [--type small|default] [--push] | pull <repository> [--apply] | down [--delete [--discard]]");
    return 2;
  }
  try {
    if (o.command === "where") return where(io, o);
    if (o.command === "status") return await status(io);
    if (o.command === "up") return await up(io, o);
    if (o.command === "pull") return pull(io, o);
    return down(io, o);
  } catch (e) {
    io.out(`boat-chat: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  process.exitCode = await main(process.argv.slice(2));
}
