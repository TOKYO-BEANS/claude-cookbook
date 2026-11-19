// Launcher behind the `parallel-cli` command: runs the pinned Parallel CLI with the key
// named "parallel" from the OS key store in its environment only (PARALLEL_API_KEY), with
// the same arguments. No OAuth login file is kept on disk. The key is read by with-key.mjs,
// in this process.
//
// The CLI is the pinned copy in ~/.local/share/parallel-cli (its lockfile is there). A copy
// of this file lives at ~/.local/bin/parallel-secure.mjs, beside with-key.mjs, which it
// imports; the `#!/bin/sh` launcher `parallel-cli` there calls it (recipes/keys.md).
import { homedir } from "node:os";
import { join } from "node:path";
import { main } from "./with-key.mjs";

// The package's install script unpacks parallel-cli.exe on Windows and parallel-cli elsewhere.
const EXE = join(homedir(), ".local", "share", "parallel-cli", "node_modules", "parallel-web-cli", "vendor", "parallel-cli", process.platform === "win32" ? "parallel-cli.exe" : "parallel-cli");

process.exit(await main(["parallel", "PARALLEL_API_KEY", EXE, ...process.argv.slice(2)]));
