#!/usr/bin/env node
// The old name of sandbox-run.mjs, kept so that commands written with it go on working: other
// repositories' instructions and older handoffs name it. The same options, output and exit
// codes; the run goes to a Depot sandbox (recipes/sandboxes.md). boat itself is retired.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { main } from "./sandbox-run.mjs";

export * from "./sandbox-run.mjs";

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  process.exitCode = await main(process.argv.slice(2));
}
