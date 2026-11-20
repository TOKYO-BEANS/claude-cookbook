#!/usr/bin/env node
// Codex through the local CLIProxyAPI (the `cliproxyapi` user service keeps it up).
// The proxy's client key comes from the OS key store at run time, into one variable of the
// Codex process that a model provider's `env_key` names; it is never printed and is in no
// file. The provider is given as `-c` overrides, so `config.toml` is not changed and the plain
// `codex` keeps the owner's own sign-in. The Codex home is the caller's (CODEX_HOME, else
// ~/.codex), as with claude-pool: T3 Code threads switch only between instances with the same
// home, and the home holds the owner's MCP servers, hooks and AGENTS.md.
// Owner's choices of 18 and 20 November 2026; the account risk is the owner's.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { dropVariable, exitCode, isMain, readKey } from "./with-key.mjs";

export const KEY_VARIABLE = "CLIPROXYAPI_CLIENT_KEY";
export const PROVIDER = "cliproxyapi";
// Theo Browne's settings: the Responses wire API, over a websocket (proven through 8.0.76:
// `GET /v1/responses` 200; with it off, plain POSTs work as well).
export const OVERRIDES = [
  `model_provider="${PROVIDER}"`,
  `model_providers.${PROVIDER}.name="CLIProxyAPI"`,
  `model_providers.${PROVIDER}.base_url="http://127.0.0.1:8317/v1"`,
  `model_providers.${PROVIDER}.env_key="${KEY_VARIABLE}"`,
  `model_providers.${PROVIDER}.wire_api="responses"`,
  `model_providers.${PROVIDER}.supports_websockets=true`,
];
// Variables that would send Codex elsewhere or carry another key.
const DROPPED = ["OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL", KEY_VARIABLE];

// Codex's global options that take a value (`codex --help`, 0.170.0); `--opt=value` is one word.
const VALUE_OPTIONS = new Set(["-c", "--config", "--enable", "--disable", "--remote", "--remote-auth-token-env", "-i", "--image", "-m", "--model", "--local-provider", "-p", "--profile", "-s", "--sandbox", "-C", "--cd", "--add-dir", "-a", "--ask-for-approval"]);

// The subcommand: the first word that is neither an option nor an option's value.
export function subcommand(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") break; // what follows is the prompt
    if (!a.startsWith("-")) return { name: a, rest: args.slice(i + 1) };
    if (VALUE_OPTIONS.has(a)) i++;
  }
  return { name: undefined, rest: [] };
}

// `login` and `logout` act on the owner's own sign-in in the shared home: the plain `codex`
// does that, never the pooled one. `login status` only reads it.
export function refused(args) {
  const { name, rest } = subcommand(args);
  if (name === "logout") return true;
  return name === "login" && rest[0] !== "status";
}

export function codexArgs(args) {
  return [...OVERRIDES.flatMap((o) => ["-c", o]), ...args];
}

export function codexEnv(base, key, platform = process.platform) {
  const env = { ...base };
  for (const name of DROPPED) dropVariable(env, name, platform);
  env[KEY_VARIABLE] = key;
  return env;
}

async function main(args) {
  if (refused(args)) {
    process.stderr.write("codex-pool: sign-ins belong to the plain `codex` (or `cliproxyapi login codex` for the proxy)\n");
    process.exit(2);
  }
  let key;
  try { ({ key } = await readKey("cliproxyapi-client")); }
  catch (e) { process.stderr.write(`codex-pool: no client key (${e.message ?? e}); is the proxy running? \`systemctl --user status cliproxyapi\`\n`); process.exit(1); }
  const codex = join(homedir(), ".local", "bin", "codex");
  const child = spawn(codex, codexArgs(args), { stdio: "inherit", env: codexEnv(process.env, key) });
  process.on("SIGINT", () => {});
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("error", (e) => { process.stderr.write(`codex-pool: could not start Codex (${e.code ?? e})\n`); process.exit(127); });
  child.on("exit", (code, signal) => process.exit(exitCode(code, signal)));
}

if (isMain(import.meta.url)) await main(process.argv.slice(2));
