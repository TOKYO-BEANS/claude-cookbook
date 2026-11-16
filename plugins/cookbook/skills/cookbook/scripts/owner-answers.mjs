#!/usr/bin/env node
// The owner-answers list, read by hand (recipes/parallel-chats.md):
//   node owner-answers.mjs list [--hours <n>]
// Run it in a checkout: it prints the records of that repository only. There is no command
// that writes one: a record comes from a question dialog the owner answered, through the
// hook, so no chat can add an "owner's answer" of its own.
import { parseArgs } from "node:util";
import { formatList, parseLedger } from "../../../hooks/owner-answers-lib.mjs";
import { openStore } from "../../../hooks/owner-answers-store.mjs";

const USAGE = "Usage: owner-answers.mjs list [--hours <n>]";

function main(argv) {
  const [command, ...rest] = argv;
  if (command !== "list") throw new Error(USAGE);
  const { values } = parseArgs({ args: rest, options: { hours: { type: "string" } }, strict: true });
  const store = openStore(process.env);
  const repo = store.repo(process.cwd());
  if (!repo) throw new Error("Run it in a checkout of a GitHub repository: the list is kept per repository.");
  const hours = values.hours === undefined ? 72 : Number(values.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 72) throw new Error("--hours is a number from 1 to 72: a record is kept for 72 hours");
  console.log(formatList(parseLedger(store.readLedger()), { now: Date.now(), hours, repo }));
}

try {
  main(process.argv.slice(2));
} catch (e) {
  console.error(e?.message || USAGE);
  process.exitCode = 2;
}
