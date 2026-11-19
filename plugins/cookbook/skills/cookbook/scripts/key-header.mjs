// Print one key from the key store (with-key.mjs: GNOME Keyring on Linux, DPAPI on Windows) as an HTTP header, for an MCP client's headers helper
// (Claude Code's `headersHelper`, Codex's `http_headers_helper`):
//   node key-header.mjs <key-name>     prints  {"Authorization":"Bearer <key>"}
//
// This is the one helper that prints a key. A headers helper has no other way to hand it
// over: the client reads the helper's stdout and sends the header itself. So: never run it
// in a shell whose output is shown, and never from a script that keeps what it printed.
// It refuses a terminal, which catches a console window only: an agent's shell is a pipe,
// as a client is, and the helper cannot tell them apart. That rule is the caller's to keep.
// It prints only the keys listed below. Everything else gets a key through with-key.mjs,
// which prints none.
//
// The key is read as with-key.mjs reads it: in this process, with no PowerShell (a script
// scan by the security software can hold a PowerShell read for 30 seconds and more, longer
// than a client waits for its headers). A copy of this file lives at
// ~/.local/bin/key-header.mjs, beside with-key.mjs, which it imports (recipes/keys.md).
import { isMain, readKey as readStored, reason } from "./with-key.mjs";

// The keys this helper may print: the ones an MCP client sends as a header, and no other
// key in the store. The list is here, in the source, so that neither an argument nor the
// environment can widen it: a new name is a reviewed change to this file.
export const HEADER_KEYS = new Set(["firecrawl"]);

const USAGE = "usage: node key-header.mjs <key-name>\n";

// Ends with 0 and the header on stdout; 1 and nothing on stdout when the key cannot be
// read; 2 for wrong usage, a key that is not listed or a terminal. A failure's line holds
// no key.
export async function main(argv, deps = {}) {
  const { say = (line) => process.stderr.write(line), write = (text) => process.stdout.write(text), isTTY = process.stdout.isTTY, readKey = readStored, allowed = HEADER_KEYS } = deps;
  if (argv.length !== 1 || !argv[0]) { say(USAGE); return 2; }
  if (!allowed.has(argv[0])) { say(`key-header: ${JSON.stringify(argv[0])} is not a key this helper prints (it prints: ${[...allowed].join(", ")})\n`); return 2; }
  if (isTTY) { say("key-header: stdout is a terminal; this helper is for an MCP client that reads its output\n"); return 2; }
  let key;
  try { key = (await readKey(argv[0], deps)).key; } catch (e) {
    say(`key-header: could not read key "${argv[0]}" (${reason(e)})\n`);
    return 1;
  }
  write(`${JSON.stringify({ Authorization: `Bearer ${key}` })}\n`);
  return 0;
}

// The exit code is set, not forced: the process ends when stdout has taken the header.
if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
