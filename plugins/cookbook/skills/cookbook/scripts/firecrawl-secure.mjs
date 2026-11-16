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

// The stored key is for Firecrawl's own API, over HTTPS, and for no other host. With
// another address in FIRECRAWL_API_URL (a self-hosted server) no key is read: the CLI
// starts with the caller's environment as it is.
function hosted(url) {
  if (!url) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname === "api.firecrawl.dev";
  } catch { return false; }
}

const args = [CLI, ...process.argv.slice(2)];
process.exit(hosted(process.env.FIRECRAWL_API_URL)
  ? await main(["firecrawl", "FIRECRAWL_API_KEY", process.execPath, ...args])
  : await startProgram(process.execPath, args, process.env));
