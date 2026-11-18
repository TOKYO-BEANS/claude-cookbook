#!/usr/bin/env node
// CLIProxyAPI launcher. Owner's exception of 18 November 2026: the proxy's config (client key)
// and its login token files live as plain files, but only in the owner-only folder
// ~/.local/share/cliproxyapi/private. Everything else follows the key rules:
// - the management secret is in the DPAPI store (cliproxyapi-management) and reaches the proxy
//   only as MANAGEMENT_PASSWORD in its own process;
// - the client key is new on every start, saved to the DPAPI store (cliproxyapi-client) for
//   claude-pool, written into private/config.yaml, and that file is deleted when the proxy stops.
//
//   cliproxyapi start                 run the proxy in this window (Ctrl+C stops it)
//   cliproxyapi login <provider>      claude | codex | codex-device | ... (the proxy's -<x>-login)
//   cliproxyapi panel                 open the console; the management secret goes to the clipboard
//   cliproxyapi status                is it up, and how many models it serves
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readKey } from "./with-key.mjs";

const HOME = homedir();
const BASE = join(HOME, ".local", "share", "cliproxyapi");
const EXE = join(BASE, "bin", "cli-proxy-api.exe");
const PRIVATE = join(BASE, "private");
const CONFIG = join(PRIVATE, "config.yaml");
const TEMPLATE = join(BASE, "config.template.yaml");
const URL_BASE = "http://127.0.0.1:8317";
const AGENT_KEY = join(HOME, ".local", "bin", "agent-key.ps1");
const PLACEHOLDER = "__CLIENT_KEY__";

const say = (line) => process.stderr.write(`cliproxyapi: ${line}\n`);

function writeConfig(clientKey) {
  const template = readFileSync(TEMPLATE, "utf8");
  if (!template.includes(PLACEHOLDER)) throw new Error(`the template has no ${PLACEHOLDER}`);
  writeFileSync(CONFIG, template.replace(PLACEHOLDER, clientKey), { encoding: "utf8" });
}

function removeConfig() {
  try { rmSync(CONFIG, { force: true }); } catch (e) { say(`could not delete ${CONFIG} (${e.code ?? e})`); }
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

function proxyEnv(extra = {}) {
  const env = { ...process.env, WRITABLE_PATH: PRIVATE, ...extra };
  for (const k of ["MANAGEMENT_PASSWORD", "PGSTORE_DSN", "HOME_JWT"]) if (!(k in extra)) delete env[k];
  return env;
}

async function isUp() {
  try { const r = await fetch(`${URL_BASE}/management.html`, { signal: AbortSignal.timeout(3000) }); return r.status > 0; }
  catch { return false; }
}

async function start() {
  if (await isUp()) { say(`already running at ${URL_BASE}`); return 0; }
  const { key: management } = await readKey("cliproxyapi-management");
  say("saving a new client key to the DPAPI store (PowerShell; can take up to a minute)...");
  writeConfig(rotateClientKey());
  say(`starting at ${URL_BASE} (console: cliproxyapi panel)`);
  const child = spawn(EXE, ["-config", CONFIG, "-local-model"], { cwd: PRIVATE, stdio: "inherit", env: proxyEnv({ MANAGEMENT_PASSWORD: management }) });
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  return await new Promise((resolve) => {
    child.on("error", (e) => { removeConfig(); say(`could not start (${e.code ?? e})`); resolve(127); });
    child.on("exit", (code, signal) => { removeConfig(); say(`stopped; ${CONFIG} deleted`); resolve(code ?? (signal ? 130 : 1)); });
  });
}

async function login(provider) {
  if (!/^[a-z-]+$/.test(provider ?? "")) { say("usage: cliproxyapi login <claude|codex|codex-device|...>"); return 2; }
  const made = !existsSync(CONFIG);
  // A login does not serve the API; a throwaway key fills the template while it runs.
  if (made) writeConfig(randomBytes(32).toString("base64url"));
  try {
    const r = spawnSync(EXE, ["-config", CONFIG, `-${provider}-login`], { cwd: PRIVATE, stdio: "inherit", env: proxyEnv() });
    return r.status ?? 1;
  } finally { if (made) removeConfig(); }
}

async function panel() {
  if (!(await isUp())) { say("not running: start it first with `cliproxyapi start`"); return 1; }
  const { key } = await readKey("cliproxyapi-management");
  const clip = spawnSync("clip.exe", [], { input: key, windowsHide: true });
  if (clip.status !== 0) { say("could not copy the management secret to the clipboard"); return 1; }
  spawnSync("cmd.exe", ["/c", "start", "", `${URL_BASE}/management.html`], { windowsHide: true });
  say("console opened; the management secret is on the clipboard (paste it into the login box)");
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

const [cmd, arg] = process.argv.slice(2);
const run = { start, login: () => login(arg), panel, status }[cmd];
if (!run) { say("usage: cliproxyapi start | login <provider> | panel | status"); process.exit(2); }
run().then((code) => process.exit(code), (e) => { say(String(e?.message ?? e)); process.exit(1); });
