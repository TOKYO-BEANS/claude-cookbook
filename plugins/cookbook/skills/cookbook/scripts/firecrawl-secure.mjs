// Launcher behind the `firecrawl` command: runs the pinned Firecrawl CLI with the key named
// "firecrawl" from the DPAPI store in its environment only (FIRECRAWL_API_KEY), with the
// same arguments. The key is read by with-key.mjs, in this process, with no PowerShell.
//
// The CLI is the pinned copy in ~/.local/share/firecrawl-cli (its lockfile is there):
// outside AppData, because the desktop app's container and other apps see different AppData
// folders. A copy of this file lives at ~/.local/bin/firecrawl-secure.mjs, beside
// with-key.mjs, which it imports; the shims `firecrawl` and `firecrawl.cmd` there call it
// (recipes/keys.md).
//
// Who gets the stored key is decided here, before the CLI runs, and narrowly: only a
// command on the list below, only with options this launcher knows before it, and only for
// Firecrawl's own API. Every other call starts with the caller's environment as it is.
// The lists are those of the pinned CLI (1.29.0): after an update of the pin, read its
// `--help` again. A command or option that is new there gets no key until it is listed.
import { homedir } from "node:os";
import { join } from "node:path";
import { dropVariable, main, startProgram } from "./with-key.mjs";

const CLI = join(homedir(), ".local", "share", "firecrawl-cli", "node_modules", "firecrawl-cli", "dist", "index.js");
const HOSTED = "https://api.firecrawl.dev";

// The stored key is for Firecrawl's own API, over HTTPS, and for no other host. The CLI
// takes its address from an `--api-url` argument, then from FIRECRAWL_API_URL, then from
// its own credentials file. The first two are read here: another address in either (a
// self-hosted server) means no stored key. The third is outranked: on the keyed path
// FIRECRAWL_API_URL is always set.
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

// The commands that call the API with the key and do nothing else with it. A subcommand
// goes with its command: `research search-github` and `agent thread` get the key.
// Every other name starts without the stored key. Those of the pinned CLI, and why:
// - `init`, `setup`, `make`, `config`, `login`, `logout`, `create`: credentials,
//   integrations and starter projects. On this PC the store and this launcher are the
//   setup. `env` writes the key to a file; `launch` starts a program that inherits it.
// - `doctor`, `view-config`, `update`, `version`: the install on this PC.
// - `experimental` (`x`), which holds `download` and `sql`, and the hidden `sql`: a
//   group gets new commands between versions, and each would get the key unread.
// - `browser` (hidden, deprecated for `interact`): its file holds a function that starts
//   a local shell with the whole environment. Nothing calls it in 1.29.0.
const KEYED_COMMANDS = new Set(["scrape", "crawl", "batch-scrape", "map", "parse", "monitor", "search", "find-tools", "find-skills", "read-skill",
  "create-skill", "update-skill", "list", "list-tools", "alexandria", "developer", "gov", "research", "feedback", "search-feedback", "agent", "interact",
  "status", "credit-usage", "credits"]);
// The options the CLI takes before a command. An option that is not one of these, before
// the command, means no stored key: its value could be read as the command.
const VALUE_OPTIONS = ["-k", "--api-key", "--api-url", "--enable"];
const QUIET_OPTIONS = new Set(["-h", "--help", "-V", "--version"]);

// The CLI is a pinned copy and never updates itself. Its update worker is a detached copy
// of the CLI that inherits the environment, the key included, and its update notice names
// an install this PC does not have. Both switches are set on every start, with the key or
// without, over whatever the caller had under those names.
const UPDATES_OFF = ["FIRECRAWL_NO_AUTO_UPDATE", "FIRECRAWL_NO_UPDATE_CHECK"];
function pinned(source) {
  const env = { ...source };
  for (const name of UPDATES_OFF) {
    dropVariable(env, name, process.platform);
    env[name] = "1";
  }
  return env;
}

// Whether this call gets the stored key: { keyed } and, when it is worth a line, why not.
// The line never repeats an option or an argument that is not a plain command name.
function decide(env, argv) {
  if (!addresses(env, argv).every(hosted)) return { keyed: false };
  let status = false;
  let i = 0;
  for (; i < argv.length; i += 1) {
    const arg = argv[i];
    if (VALUE_OPTIONS.includes(arg)) i += 1;
    else if (VALUE_OPTIONS.some((option) => option.startsWith("--") && arg.startsWith(`${option}=`))) continue;
    else if (arg === "--status") status = true;
    else if (QUIET_OPTIONS.has(arg)) return { keyed: false };
    else if (arg.startsWith("-")) return { keyed: false, why: "an option before the command is not one this launcher knows" };
    else break;
  }
  const first = argv[i];
  if (first === undefined) return { keyed: status };
  if (first === "help" || first === "version") return { keyed: false };
  // A web address in the command's place is the CLI's short form of `scrape`.
  if (KEYED_COMMANDS.has(first) || /^https?:\/\//i.test(first)) return { keyed: true };
  return { keyed: false, why: /^[a-z][a-z-]{0,30}$/.test(first) ? `the command ${first} is not one that gets the key` : "the first argument is not a command that gets the key" };
}

const own = process.argv.slice(2);
const args = [CLI, ...own];
const { keyed, why } = decide(process.env, own);
if (why) process.stderr.write(`firecrawl-secure: no stored key for this call (${why})\n`);
const env = pinned(process.env);
if (!keyed) process.exit(await startProgram(process.execPath, args, env));

const url = process.env.FIRECRAWL_API_URL || HOSTED;
dropVariable(env, "FIRECRAWL_API_URL", process.platform);
env.FIRECRAWL_API_URL = url;
process.exit(await main(["firecrawl", "FIRECRAWL_API_KEY", process.execPath, ...args], { env }));
