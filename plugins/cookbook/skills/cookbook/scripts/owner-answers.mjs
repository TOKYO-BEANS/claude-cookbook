#!/usr/bin/env node
// The owner-answers list by hand (recipes/parallel-chats.md):
//   node owner-answers.mjs list [--hours <n>]     what chats asked the owner, and the answers
//   node owner-answers.mjs add --question <text> --answer <text>
//                                                 an answer the owner gave as a chat message
// The hooks write the answers of question dialogs themselves; `add` is for the rest.
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { formatList, parseLedger, redact } from "../../../hooks/owner-answers-lib.mjs";
import { openStore } from "../../../hooks/owner-answers-store.mjs";

const USAGE = "Usage: owner-answers.mjs list [--hours <n>] | add --question <text> --answer <text>";

function main(argv) {
  const [command, ...rest] = argv;
  const { values } = parseArgs({ args: rest, options: { hours: { type: "string" }, question: { type: "string" }, answer: { type: "string" } }, strict: true });
  const store = openStore(process.env);
  if (command === "list") {
    const hours = values.hours === undefined ? 72 : Number(values.hours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 90) throw new Error("--hours is a number from 1 to 2160");
    console.log(formatList(parseLedger(store.readLedger()), { now: Date.now(), hours }));
    return;
  }
  if (command === "add") {
    const question = redact(values.question ?? ""), answer = redact(values.answer ?? "");
    if (!question || !answer) throw new Error("add needs --question and --answer");
    const thread = process.env.T3CODE_THREAD_ID ?? "";
    const session = `by-hand:${thread || process.ppid}`;
    const id = createHash("sha256").update(`${session}\n${question}`).digest("hex").slice(0, 16);
    store.append([{ id, at: Date.now(), state: "answered", session, thread, repo: store.repo(process.cwd()), question, options: [], answer }]);
    console.log("Added.");
    return;
  }
  throw new Error(USAGE);
}

try {
  main(process.argv.slice(2));
} catch (e) {
  console.error(e?.message || USAGE);
  process.exitCode = 2;
}
