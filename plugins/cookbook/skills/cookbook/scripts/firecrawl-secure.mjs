// Launcher behind the `firecrawl` command: runs the pinned Firecrawl CLI with the key named
// "firecrawl" from the DPAPI store in its environment only (FIRECRAWL_API_KEY), with the
// same arguments. The key is read by with-key.mjs, in this process, with no PowerShell.
//
// The CLI is the pinned copy in ~/.local/share/firecrawl-cli (its lockfile is there):
// outside AppData, because the desktop app's container and other apps see different AppData
// folders. A copy of this file lives at ~/.local/bin/firecrawl-secure.mjs, beside
// with-key.mjs, which it imports; the shims `firecrawl` and `firecrawl.cmd` there call it
// (recipes/keys.md).
import { homedir } from "node:os";
import { join } from "node:path";
import { main, startProgram } from "./with-key.mjs";

const CLI = join(homedir(), ".local", "share", "firecrawl-cli", "node_modules", "firecrawl-cli", "dist", "index.js");

// The stored key is for Firecrawl's own API, over HTTPS, and for no other host. The CLI
// takes its address from FIRECRAWL_API_URL and from an `--api-url` argument, so both are
// read here: with another address in either (a self-hosted server), no key is read, and
// the CLI starts with the caller's environment as it is.
function hosted(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname === "api.firecrawl.dev";
  } catch { return false; }
}
function addresses(env, argv) {
  const list = env.FIRECRAWL_API_URL ? [env.FIRECRAWL_API_URL] : [];
  argv.forEach((arg, i) => {
    if (arg === "--api-url") list.push(argv[i + 1] ?? "");
    else if (arg.startsWith("--api-url=")) list.push(arg.slice("--api-url=".length));
  });
  return list;
}

// The CLI's command: its first argument that is neither an option nor an option's value
// (`-k`, `--api-key` and `--api-url` are the options before a command that take one).
const VALUE_OPTIONS = new Set(["-k", "--api-key", "--api-url"]);
function command(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (VALUE_OPTIONS.has(argv[i])) i += 1;
    else if (!argv[i].startsWith("-")) return argv[i];
  }
  return "";
}
// Commands that set up credentials or integrations, or write the key to a file (`env`
// puts it in a .env file). On this PC the store and this launcher are the setup, and a key
// is never written in plain text: these start without the stored key.
const SETUP_COMMANDS = new Set(["env", "init", "setup", "make", "config", "login"]);

const own = process.argv.slice(2);
const keyed = addresses(process.env, own).every(hosted) && !SETUP_COMMANDS.has(command(own));
const args = [CLI, ...own];
process.exit(keyed
  ? await main(["firecrawl", "FIRECRAWL_API_KEY", process.execPath, ...args])
  : await startProgram(process.execPath, args, process.env));
