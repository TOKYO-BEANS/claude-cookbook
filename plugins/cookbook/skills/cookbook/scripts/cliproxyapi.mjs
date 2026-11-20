#!/usr/bin/env node
// CLIProxyAPI launcher. Owner's exception of 18 November 2026: the proxy's config (client key)
// and its login token files live as plain files, but only in the owner-only folder
// ~/.local/share/cliproxyapi/private (mode 0700; every file in it 0600). Everything else
// follows the key rules:
// - the management secret is in the OS key store (cliproxyapi-management) and reaches the proxy
//   only as MANAGEMENT_PASSWORD in its own process;
// - the client key is new on every start, saved to the OS key store (cliproxyapi-client, through
//   `secret-tool store` with the value on stdin) for claude-pool, written into
//   private/config.yaml, and that file is deleted when the proxy stops (Ctrl+C, closing the
//   window) and before every start.
// One start or login at a time: private/launcher.lock holds the pid of the launcher that runs.
//
//   cliproxyapi start                 run the proxy in this window (Ctrl+C stops it)
//   cliproxyapi login <provider>      claude | codex | codex-device | ... (the proxy's -<x>-login)
//   cliproxyapi panel                 open the console in the browser. The management secret is
//                                     never put on the clipboard or shown here: the owner copies
//                                     it in Proton Pass and pastes it into the login box
//   cliproxyapi status                is it up, and how many models it serves
//   cliproxyapi cleanup               the user unit's ExecStopPost: config.yaml after a killed
//                                     launcher, unless a live launcher holds the lock
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SECRET_SERVICE, SECRET_TOOL_TIMEOUT_MS, exitCode, isMain, readKey } from "./with-key.mjs";

const HOME = homedir();
const BASE = join(HOME, ".local", "share", "cliproxyapi");
export const PATHS = Object.freeze({
  exe: join(BASE, "bin", "cli-proxy-api"),
  private: join(BASE, "private"),
  config: join(BASE, "private", "config.yaml"),
  lock: join(BASE, "private", "launcher.lock"),
  console: join(BASE, "private", "static", "management.html"),
  dotenv: join(BASE, "private", ".env"),
  template: join(BASE, "config.template.yaml"),
});
const URL_BASE = "http://127.0.0.1:8317";
const CLIENT_KEY_NAME = "cliproxyapi-client";
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
export const PLACEHOLDER = "__CLIENT_KEY__";

const say = (line) => process.stderr.write(`cliproxyapi: ${line}\n`);

// "-claude-login" for "claude"; null for anything that is not a plain lower-case name.
export function providerFlag(provider) {
  return typeof provider === "string" && /^[a-z]+(-[a-z]+)*$/.test(provider) ? `-${provider}-login` : null;
}

export function fillTemplate(template, clientKey) {
  if (template.split(PLACEHOLDER).length !== 2) throw new Error(`the template must hold ${PLACEHOLDER} exactly once (the proxy takes a second one as a key of its own)`);
  if (!/^[A-Za-z0-9_-]{20,}$/.test(clientKey)) throw new Error("the client key is not a plain token");
  return template.replace(PLACEHOLDER, () => clientKey);
}

// The proxy's environment: the parent's, without the variables the proxy acts on, plus `extra`.
// Read in 8.0.76's `cmd/server/main.go` and its helpers: each name is taken in upper and in
// lower case, so the match is without regard to case. They would give it a management secret,
// another folder for its files or its console, a remote store for its config and sign-ins, a
// GitHub token to send, or a library to load at start.
const PROXY_VARIABLES = /^(MANAGEMENT_PASSWORD|MANAGEMENT_STATIC_PATH|WRITABLE_PATH|HOME_JWT|DEPLOY|GITHUB_TOKEN|CLIPROXY_PLUGIN_DLOPEN_PROBE(_STATUS)?|(PGSTORE|GITSTORE|OBJECTSTORE)_.*)$/i;
export function proxyEnv(base, extra = {}) {
  const env = Object.fromEntries(Object.entries(base).filter(([name]) => !PROXY_VARIABLES.test(name)));
  return { ...env, ...extra };
}

// Why the proxy must not start now, or null. A `.env` in its working folder is loaded as its
// environment, for a sign-in too. Without the pinned console the server downloads one on the
// first visit, unchecked; a sign-in (`console: false`) serves none.
export function startProblem(paths = PATHS, { console: needsConsole = true } = {}) {
  if (needsConsole && !existsSync(paths.console)) return `the pinned console is missing (${paths.console}): the proxy would download one. Put the vetted copy back (recipes/subscription-proxy-setup.md)`;
  if (existsSync(paths.dotenv)) return `${paths.dotenv} exists: the proxy would load it as its environment. Remove it`;
  return null;
}

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
};

// Takes the lock for this process. Returns null when taken, or the pid of a live holder.
// A stale lock (its launcher is gone) is moved aside in one rename, so of two launchers that
// both saw it stale only one moves it. A launcher that moved a lock other than the stale one it
// read (another launcher took over in between) puts it back and reads the new holder.
export function takeLock(path = PATHS.lock, pid = process.pid, isAlive = alive) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { writeFileSync(path, String(pid), { flag: "wx", mode: 0o600 }); return null; } catch (e) { if (e.code !== "EEXIST") throw e; }
    let seen;
    try { seen = readFileSync(path, "utf8"); } catch (e) { if (e.code === "ENOENT") continue; throw e; }
    const holder = Number.parseInt(seen, 10);
    if (Number.isInteger(holder) && holder > 0 && holder !== pid && isAlive(holder)) return holder;
    const aside = `${path}.${pid}.stale`;
    try { renameSync(path, aside); } catch (e) { if (e.code === "ENOENT") continue; throw e; }
    if (readFileSync(aside, "utf8") === seen) { rmSync(aside, { force: true }); continue; }
    try { renameSync(aside, path); } catch { rmSync(aside, { force: true }); }
  }
  throw new Error(`could not take ${path}`);
}

export function releaseLock(path = PATHS.lock, pid = process.pid) {
  try { if (Number.parseInt(readFileSync(path, "utf8"), 10) === pid) rmSync(path, { force: true }); } catch { /* gone */ }
}

// The private folder is the owner's alone, and so is everything made from here on: the mask
// also holds for the proxy this launcher starts (its sign-in files, its logs).
export function ownerOnly(paths = PATHS) {
  process.umask(0o077);
  mkdirSync(paths.private, { recursive: true, mode: 0o700 });
  chmodSync(paths.private, 0o700);
}

export function writeConfig(clientKey, paths = PATHS) {
  const text = fillTemplate(readFileSync(paths.template, "utf8"), clientKey);
  rmSync(paths.config, { force: true }); // a new file, so the mode below is the mode it gets
  writeFileSync(paths.config, text, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

export function removeConfig(paths = PATHS) {
  try { rmSync(paths.config, { force: true }); } catch (e) { say(`could not delete ${paths.config} (${e.code ?? e})`); }
}

// After the service's launcher stopped (the unit's ExecStopPost): deletes a config.yaml it left,
// unless a live launcher holds the lock (a manual start or a login), whose config it is. Returns
// whether it deleted. A stale lock stays: takeLock takes it over.
export function cleanupAfterStop(paths = PATHS, isAlive = alive) {
  let holder = NaN;
  try { holder = Number.parseInt(readFileSync(paths.lock, "utf8"), 10); } catch { /* no lock */ }
  if (Number.isInteger(holder) && holder > 0 && isAlive(holder)) return false;
  removeConfig(paths);
  return true;
}

// How a login runs, by who holds the lock: "own" (this login holds it and fills the template with
// a throwaway key), "running" (the service or a manual start holds it and its proxy is up: the
// login uses that proxy's config, which it neither rewrites nor deletes), or "refuse" (a launcher
// holds it but no proxy answers yet).
export function loginRoute(holder, configExists, up) {
  if (!holder) return "own";
  return configExists && up ? "running" : "refuse";
}

// The arguments of `secret-tool store` for the client key: the item with-key.mjs reads back.
// The value is never one of them: it goes to secret-tool on stdin.
export const STORE_ARGS = Object.freeze(["store", "--label", `key/${CLIENT_KEY_NAME}`, "service", SECRET_SERVICE, "name", CLIENT_KEY_NAME]);

// Saves `key` in the OS key store and reads it back. Nothing secret-tool printed is repeated.
export async function storeClientKey(key, { run = spawnSync, read = readKey } = {}) {
  const r = run("secret-tool", STORE_ARGS, { input: key, encoding: "utf8", timeout: SECRET_TOOL_TIMEOUT_MS, stdio: ["pipe", "ignore", "ignore"] });
  if (r.status !== 0) throw new Error(`saving the client key failed (${r.error?.code ?? `exit ${r.status}`}); is the keyring unlocked and libsecret-tools installed?`);
  const { key: saved } = await read(CLIENT_KEY_NAME);
  if (saved !== key) throw new Error("the client key read back from the key store is not the one just saved");
}

// A new client key, kept in the OS key store for claude-pool. Never printed.
async function rotateClientKey() {
  const key = randomBytes(32).toString("base64url");
  await storeClientKey(key);
  return key;
}

async function isUp() {
  try { const r = await fetch(`${URL_BASE}/management.html`, { signal: AbortSignal.timeout(3000) }); return r.status > 0; }
  catch { return false; }
}

async function start() {
  ownerOnly();
  const holder = takeLock();
  if (holder) { say(`another launcher (pid ${holder}) is starting or running the proxy`); return 1; }
  if (await isUp()) { releaseLock(); say(`something already answers at ${URL_BASE}; not starting a second one`); return 1; }
  const problem = startProblem();
  if (problem) { releaseLock(); say(problem); return 1; }
  const done = () => { removeConfig(); releaseLock(); };
  process.on("exit", done);
  removeConfig(); // a file a crashed run left
  const { key: management } = await readKey("cliproxyapi-management");
  writeConfig(await rotateClientKey());
  say(`starting at ${URL_BASE} (console: cliproxyapi panel)`);
  const child = spawn(PATHS.exe, ["-config", PATHS.config, "-local-model"],
    { cwd: PATHS.private, stdio: "inherit", env: proxyEnv(process.env, { WRITABLE_PATH: PATHS.private, MANAGEMENT_PASSWORD: management }) });
  const stop = (signal) => () => { done(); child.kill(signal === "SIGINT" ? "SIGINT" : "SIGTERM"); };
  for (const signal of SIGNALS) process.on(signal, stop(signal));
  return await new Promise((resolve) => {
    child.on("error", (e) => { done(); say(`could not start (${e.code ?? e})`); resolve(127); });
    child.on("exit", (code, signal) => { done(); say(`stopped; ${PATHS.config} deleted`); resolve(exitCode(code, signal)); });
  });
}

async function login(provider) {
  const flag = providerFlag(provider);
  if (!flag) { say("usage: cliproxyapi login <claude|codex|codex-device|...>"); return 2; }
  const run = () => spawnSync(PATHS.exe, ["-config", PATHS.config, flag],
    { cwd: PATHS.private, stdio: "inherit", env: proxyEnv(process.env, { WRITABLE_PATH: PATHS.private }) }).status ?? 1;
  ownerOnly();
  const problem = startProblem(PATHS, { console: false });
  if (problem) { say(problem); return 1; }
  const holder = takeLock();
  if (holder) {
    if (loginRoute(holder, existsSync(PATHS.config), await isUp()) === "running") return run();
    say(`another launcher (pid ${holder}) is starting the proxy; try again when it is up`);
    return 1;
  }
  const done = () => { removeConfig(); releaseLock(); };
  process.on("exit", done);
  for (const signal of SIGNALS) process.on(signal, () => { done(); process.exit(exitCode(null, signal)); });
  // A login does not serve the API; a throwaway key fills the template while it runs.
  try { writeConfig(randomBytes(32).toString("base64url")); return run(); } finally { done(); }
}

// What `panel` says after it opened the console. No clipboard: nothing installed on this
// desktop marks a copy as one a clipboard manager must not keep, and the secret is never
// printed. Proton Pass holds the same secret and clears its own copy from the clipboard.
export const PANEL_NOTE = 'the management secret is not on the clipboard and is not shown here: copy it in Proton Pass (vault "Claude", item key/cliproxyapi-management) and paste it into the login box';

async function panel() {
  if (!(await isUp())) { say("not running: start it first with `cliproxyapi start`"); return 1; }
  const address = `${URL_BASE}/management.html`;
  const r = spawnSync("xdg-open", [address], { stdio: "ignore", timeout: 15_000 });
  say(r.status === 0 ? `console opened (${address})` : `could not open a browser (${r.error?.code ?? `exit ${r.status}`}); open ${address} yourself`);
  say(PANEL_NOTE);
  return r.status === 0 ? 0 : 1;
}

async function status() {
  if (!(await isUp())) { console.log("cliproxyapi: not running"); return 1; }
  const { key } = await readKey("cliproxyapi-client");
  const r = await fetch(`${URL_BASE}/v1/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
  let n = "?";
  try { n = (await r.json()).data?.length ?? "?"; } catch { /* not JSON */ }
  console.log(`cliproxyapi: running at ${URL_BASE}; /v1/models answered ${r.status} with ${n} models`);
  return r.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  const cleanup = async () => (cleanupAfterStop() ? 0 : (say("a live launcher holds the lock; its config.yaml stays"), 0));
  const run = { start, login: () => login(arg), panel, status, cleanup }[cmd];
  if (!run) { say("usage: cliproxyapi start | login <provider> | panel | status | cleanup"); process.exit(2); }
  run().then((code) => process.exit(code), (e) => { say(String(e?.message ?? e)); process.exit(1); });
}
