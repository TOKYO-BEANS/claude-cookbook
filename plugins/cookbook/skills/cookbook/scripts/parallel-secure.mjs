// Launcher behind the `parallel-cli` command: runs the pinned Parallel CLI with the key
// named "parallel" from the DPAPI store in its environment only (PARALLEL_API_KEY), with
// the same arguments. No OAuth login file is kept on disk. The key is read by with-key.mjs,
// in this process, with no PowerShell.
//
// The CLI is the pinned copy in ~/.local/share/parallel-cli (its lockfile is there):
// outside AppData, because the desktop app's container and other apps see different AppData
// folders. A copy of this file lives at ~/.local/bin/parallel-secure.mjs, beside
// with-key.mjs, which it imports; the shims `parallel-cli` and `parallel-cli.cmd` there
// call it (recipes/keys.md).
import { homedir } from "node:os";
import { join } from "node:path";
import { main } from "./with-key.mjs";

const EXE = join(homedir(), ".local", "share", "parallel-cli", "node_modules", "parallel-web-cli", "vendor", "parallel-cli", "parallel-cli.exe");

process.exit(await main(["parallel", "PARALLEL_API_KEY", EXE, ...process.argv.slice(2)]));
