#!/usr/bin/env node
// Claude Code through the local CLIProxyAPI (start it first: `cliproxyapi start`).
// A separate Claude Code home (CLAUDE_CONFIG_DIR), so the normal sign-in is never touched.
// The proxy's client key comes from the DPAPI store at run time and is never printed.
// Owner's choice of 18 November 2026; the account ban risk is the owner's.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { dropVariable, readKey } from "./with-key.mjs";

const HOME = homedir();
const CLAUDE = join(HOME, ".local", "bin", "claude.exe");
const env = { ...process.env };
// Matched without regard to case on Windows, as Windows reads them.
for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDE_CONFIG_DIR"]) dropVariable(env, name, process.platform);

let key;
try { ({ key } = await readKey("cliproxyapi-client")); }
catch (e) { process.stderr.write(`claude-pool: no client key (${e.message ?? e}); run \`cliproxyapi start\` first\n`); process.exit(1); }

Object.assign(env, {
  ANTHROPIC_BASE_URL: "http://127.0.0.1:8317",
  ANTHROPIC_AUTH_TOKEN: key,
  CLAUDE_CONFIG_DIR: join(HOME, ".local", "share", "cliproxyapi", "private", "claude-home"),
});
const child = spawn(CLAUDE, process.argv.slice(2), { stdio: "inherit", env });
process.on("SIGINT", () => {});
child.on("error", (e) => { process.stderr.write(`claude-pool: could not start Claude Code (${e.code ?? e})\n`); process.exit(127); });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 130 : 1)));
