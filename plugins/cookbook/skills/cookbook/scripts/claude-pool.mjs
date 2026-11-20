#!/usr/bin/env node
// Claude Code through the local CLIProxyAPI (the `cliproxyapi` user service keeps it up).
// The proxy's client key comes from the OS key store at run time and is never printed; the
// sign-in stored in the Claude home is not used while the key is set, and is not changed.
// The Claude home is the one the caller gives (CLAUDE_CONFIG_DIR, else ~/.claude): T3 Code reads
// a thread's history from the home it set for the instance, and threads switch only between
// instances with the same home, so a home of the launcher's own would break both.
// Owner's choices of 18 and 20 November 2026; the account ban risk is the owner's.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { dropVariable, exitCode, readKey } from "./with-key.mjs";

const HOME = homedir();
const CLAUDE = join(HOME, ".local", "bin", "claude");
const env = { ...process.env };
for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_BASE_URL"]) dropVariable(env, name, process.platform);

let key;
try { ({ key } = await readKey("cliproxyapi-client")); }
catch (e) { process.stderr.write(`claude-pool: no client key (${e.message ?? e}); is the proxy running? \`systemctl --user status cliproxyapi\`\n`); process.exit(1); }

Object.assign(env, { ANTHROPIC_BASE_URL: "http://127.0.0.1:8317", ANTHROPIC_AUTH_TOKEN: key });
const child = spawn(CLAUDE, process.argv.slice(2), { stdio: "inherit", env });
process.on("SIGINT", () => {});
child.on("error", (e) => { process.stderr.write(`claude-pool: could not start Claude Code (${e.code ?? e})\n`); process.exit(127); });
child.on("exit", (code, signal) => process.exit(exitCode(code, signal)));
