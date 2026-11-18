#!/usr/bin/env node
// CLIProxyAPI launcher. Owner's exception of 18 November 2026: the proxy's config (client key)
// and its login token files live as plain files, but only in the owner-only folder
// ~/.local/share/cliproxyapi/private. Everything else follows the key rules:
// - the management secret is in the DPAPI store (cliproxyapi-management) and reaches the proxy
//   only as MANAGEMENT_PASSWORD in its own process;
// - the client key is new on every start, saved to the DPAPI store (cliproxyapi-client) for
//   claude-pool, written into private/config.yaml, and that file is deleted when the proxy stops
//   (Ctrl+C, Ctrl+Break, closing the window) and before every start.
// One start or login at a time: private/launcher.lock holds the pid of the launcher that runs.
//
//   cliproxyapi start                 run the proxy in this window (Ctrl+C stops it)
//   cliproxyapi login <provider>      claude | codex | codex-device | ... (the proxy's -<x>-login)
//   cliproxyapi panel                 open the console; the management secret goes to the
//                                     clipboard, kept out of clipboard history; this window
//                                     clears it after 45 s
//   cliproxyapi status                is it up, and how many models it serves
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { dropVariable, exitCode, isMain, readKey } from "./with-key.mjs";

const HOME = homedir();
const BASE = join(HOME, ".local", "share", "cliproxyapi");
export const PATHS = Object.freeze({
  exe: join(BASE, "bin", "cli-proxy-api.exe"),
  private: join(BASE, "private"),
  config: join(BASE, "private", "config.yaml"),
  lock: join(BASE, "private", "launcher.lock"),
  template: join(BASE, "config.template.yaml"),
});
const URL_BASE = "http://127.0.0.1:8317";
const AGENT_KEY = join(HOME, ".local", "bin", "agent-key.ps1");
export const PLACEHOLDER = "__CLIENT_KEY__";
const CLIPBOARD_SECONDS = 45;

const say = (line) => process.stderr.write(`cliproxyapi: ${line}\n`);

// "-claude-login" for "claude"; null for anything that is not a plain lower-case name.
export function providerFlag(provider) {
  return typeof provider === "string" && /^[a-z]+(-[a-z]+)*$/.test(provider) ? `-${provider}-login` : null;
}

export function fillTemplate(template, clientKey) {
  if (!template.includes(PLACEHOLDER)) throw new Error(`the template has no ${PLACEHOLDER}`);
  if (!/^[A-Za-z0-9_-]{20,}$/.test(clientKey)) throw new Error("the client key is not a plain token");
  return template.replace(PLACEHOLDER, clientKey);
}

// The proxy's environment: the parent's, without the secrets it reads, plus `extra`.
// Names are matched without regard to case on Windows, as Windows reads them.
export function proxyEnv(base, extra = {}, platform = process.platform) {
  const env = { ...base };
  for (const name of ["MANAGEMENT_PASSWORD", "PGSTORE_DSN", "HOME_JWT", "WRITABLE_PATH"]) dropVariable(env, name, platform);
  return { ...env, ...extra };
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
    try { writeFileSync(path, String(pid), { flag: "wx" }); return null; } catch (e) { if (e.code !== "EEXIST") throw e; }
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

export function writeConfig(clientKey, paths = PATHS) {
  writeFileSync(paths.config, fillTemplate(readFileSync(paths.template, "utf8"), clientKey), { encoding: "utf8" });
}

export function removeConfig(paths = PATHS) {
  try { rmSync(paths.config, { force: true }); } catch (e) { say(`could not delete ${paths.config} (${e.code ?? e})`); }
}

// A new client key, kept in the DPAPI store for claude-pool. Never printed.
function rotateClientKey() {
  const key = randomBytes(32).toString("base64url");
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", AGENT_KEY, "-Mode", "import", "-Name", "cliproxyapi-client", "-FromEnv", "CPA_GEN_KEY"],
    { env: { ...process.env, CPA_GEN_KEY: key }, encoding: "utf8", timeout: 90_000, windowsHide: true });
  if (r.status !== 0) throw new Error(`saving the client key failed (${r.error?.code ?? `exit ${r.status}`}): ${(r.stderr || r.stdout || "").trim().slice(0, 300)}`);
  return key;
}

async function isUp() {
  try { const r = await fetch(`${URL_BASE}/management.html`, { signal: AbortSignal.timeout(3000) }); return r.status > 0; }
  catch { return false; }
}

async function start() {
  const holder = takeLock();
  if (holder) { say(`another launcher (pid ${holder}) is starting or running the proxy`); return 1; }
  if (await isUp()) { releaseLock(); say(`something already answers at ${URL_BASE}; not starting a second one`); return 1; }
  const done = () => { removeConfig(); releaseLock(); };
  process.on("exit", done);
  removeConfig(); // a file a crashed run left
  const { key: management } = await readKey("cliproxyapi-management");
  say("saving a new client key to the DPAPI store (PowerShell; can take up to a minute)...");
  writeConfig(rotateClientKey());
  say(`starting at ${URL_BASE} (console: cliproxyapi panel)`);
  const child = spawn(PATHS.exe, ["-config", PATHS.config, "-local-model"],
    { cwd: PATHS.private, stdio: "inherit", env: proxyEnv(process.env, { WRITABLE_PATH: PATHS.private, MANAGEMENT_PASSWORD: management }) });
  const stop = (signal) => () => { done(); child.kill(signal === "SIGINT" ? "SIGINT" : "SIGTERM"); };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(signal, stop(signal));
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
  const holder = takeLock();
  if (holder) {
    // A running proxy's own config serves the login; it is neither rewritten nor deleted.
    if (existsSync(PATHS.config) && await isUp()) return run();
    say(`another launcher (pid ${holder}) is starting the proxy; try again when it is up`);
    return 1;
  }
  const done = () => { removeConfig(); releaseLock(); };
  process.on("exit", done);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(signal, () => { done(); process.exit(exitCode(null, signal)); });
  // A login does not serve the API; a throwaway key fills the template while it runs.
  try { writeConfig(randomBytes(32).toString("base64url")); return run(); } finally { done(); }
}

// The secret goes on the clipboard marked to stay out of clipboard history and the cloud
// clipboard, and the same PowerShell clears it after CLIPBOARD_SECONDS if it is still there.
const CLIPBOARD_SCRIPT = [
  "Add-Type -AssemblyName System.Windows.Forms",
  "$s = $env:CPA_PANEL_SECRET; $env:CPA_PANEL_SECRET = $null",
  "$d = New-Object Windows.Forms.DataObject",
  "$d.SetData([Windows.Forms.DataFormats]::UnicodeText, $s)",
  "$zero = [BitConverter]::GetBytes([int]0)",
  "$d.SetData('ExcludeClipboardContentFromMonitorProcessing', (New-Object IO.MemoryStream (,$zero)))",
  "$d.SetData('CanIncludeInClipboardHistory', (New-Object IO.MemoryStream (,$zero)))",
  "$d.SetData('CanUploadToCloudClipboard', (New-Object IO.MemoryStream (,$zero)))",
  "[Windows.Forms.Clipboard]::SetDataObject($d, $true)",
  `Start-Sleep -Seconds ${CLIPBOARD_SECONDS}`,
  "if ([Windows.Forms.Clipboard]::GetText() -ceq $s) { [Windows.Forms.Clipboard]::Clear() }",
].join("; ");

async function panel() {
  if (!(await isUp())) { say("not running: start it first with `cliproxyapi start`"); return 1; }
  const { key } = await readKey("cliproxyapi-management");
  spawnSync("cmd.exe", ["/c", "start", "", `${URL_BASE}/management.html`], { windowsHide: true });
  say(`console opened; the management secret is on the clipboard for ${CLIPBOARD_SECONDS} seconds (paste it into the login box); this window clears it then`);
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", CLIPBOARD_SCRIPT],
    { env: { ...process.env, CPA_PANEL_SECRET: key }, stdio: ["ignore", "ignore", "pipe"], encoding: "utf8", windowsHide: true, timeout: (CLIPBOARD_SECONDS + 60) * 1000 });
  if (r.status !== 0) { say(`the clipboard step failed (${r.error?.code ?? `exit ${r.status}`}): ${(r.stderr ?? "").trim().slice(0, 300)}`); return 1; }
  say("clipboard cleared");
  return 0;
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
  const run = { start, login: () => login(arg), panel, status }[cmd];
  if (!run) { say("usage: cliproxyapi start | login <provider> | panel | status"); process.exit(2); }
  run().then((code) => process.exit(code), (e) => { say(String(e?.message ?? e)); process.exit(1); });
}
