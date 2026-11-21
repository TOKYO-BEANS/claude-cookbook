#!/usr/bin/env node
// The launcher the systemd user timer "agent-log" runs each night (recipes/learning-loop.md).
// A copy lives at ~/.local/bin/agent-log-nightly.mjs, a path that does not change when the
// plugin updates: it finds the Cookbook plugin installed for this user, refuses a folder
// outside ~/.claude/plugins, and runs that copy's archive. It writes last-run.json (when it
// ran, how it ended, the counts) in the archive folder. No model takes part.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PLUGIN_ID = "cookbook@claude-cookbook";

export function resolveArchive(home = homedir()) {
  const base = join(home, ".claude", "plugins");
  const entries = JSON.parse(readFileSync(join(base, "installed_plugins.json"), "utf8"))?.plugins?.[PLUGIN_ID];
  const entry = Array.isArray(entries) ? entries.find((e) => e?.scope === "user") : null;
  if (!entry?.installPath) throw new Error(`${PLUGIN_ID} is not installed for this user`);
  const root = realpathSync(base);
  const script = realpathSync(join(entry.installPath, "skills", "cookbook", "scripts", "agent-log", "archive.mjs"));
  const rel = relative(root, script);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`the archive script of ${PLUGIN_ID} is outside ${root}`);
  return script;
}

const dest = join(homedir(), ".local", "share", "agent-log");
mkdirSync(dest, { recursive: true, mode: 0o700 });
const started = new Date().toISOString();
try {
  const { archiveAll } = await import(pathToFileURL(resolveArchive()).href);
  const r = archiveAll({ dest });
  writeFileSync(join(dest, "last-run.json"), JSON.stringify({ started, ended: new Date().toISOString(), ok: true, ...r }, null, 2), { mode: 0o600 });
  console.log(`agent-log: ${r.copied} copied, ${r.skipped} unchanged`);
} catch (e) {
  writeFileSync(join(dest, "last-run.json"), JSON.stringify({ started, ended: new Date().toISOString(), ok: false, error: String(e?.message ?? e) }, null, 2), { mode: 0o600 });
  console.error(`agent-log: ${e?.message ?? e}`);
  process.exitCode = 1;
}
