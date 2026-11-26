#!/usr/bin/env node
// The old name of sandbox-run.mjs, kept so that commands written with it go on working: other
// repositories' instructions and older handoffs name it. The same options, output and exit
// codes; the run goes to a Depot sandbox (recipes/sandboxes.md). boat itself is retired.
// boat-run's size was `small` when none was given, and sandbox-run's is `default`: under this
// name a run with no --type stays `small`, so an old timeout up to 7200 still fits.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { main } from "./sandbox-run.mjs";

export const oldDefaults = (argv) => {
  const own = argv.includes("--") ? argv.slice(0, argv.indexOf("--")) : argv;
  return argv[0] === "--list" || argv[0] === "--stop" || own.includes("--type") ? argv : ["--type", "small", ...argv];
};

export * from "./sandbox-run.mjs";

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  process.exitCode = await main(oldDefaults(process.argv.slice(2)));
}
