import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  buildRun, CONNECTOR, initErrors, OTHER_CONNECTORS, parseArgs, READ_ONLY, rulePath, summarize, TOOL_PREFIX, WAIT,
} from "../plugins/cookbook/skills/cookbook/scripts/adobe-session.mjs";

const run = (...extra) => parseArgs(["run", "--brief", "b.md", "--out", "out", ...extra]);
const after = (argv, flag) => argv[argv.indexOf(flag) + 1];

test("a run names its Adobe tools: none by default, no wildcard", () => {
  assert.throws(() => run(), /--allow needs at least one tool/);
  assert.throws(() => run("--allow", "*"), /no wildcard/);
  assert.throws(() => run("--allow", "image_*"), /no wildcard/);
  assert.throws(() => run("--allow", "font_search) Bash(rm"), /no wildcard/);
  assert.deepEqual(run("--allow", `font_search, ${TOOL_PREFIX}get_account_type,font_search`).allow, ["font_search", "get_account_type"]);
});

test("a tool that is not read-only needs the owner's yes", () => {
  for (const name of ["image_select_subject", "asset_initialize_file_upload", "font_create_kit", "get_fontkit_embed_url", "boards_create_new_board", "some_new_tool"]) {
    assert.throws(() => run("--allow", name), /--owner-yes/, name);
    assert.throws(() => run("--allow", `font_search,${name}`), /--owner-yes/, name);
    assert.equal(run("--allow", name, "--owner-yes", "Yes, upload 1598.jpg").ownerYes, "Yes, upload 1598.jpg");
  }
  assert.throws(() => run("--allow", "image_select_subject", "--owner-yes", " "), /--owner-yes/);
  for (const name of READ_ONLY) assert.equal(run("--allow", name).ownerYes, undefined);
  // The read-only list holds no tool that sends a file or makes something in the account.
  assert.ok(!READ_ONLY.some((n) => /^asset_|upload|create|kit|embed|boards_|activate|license|expand|apply|remove|select|export|import|share|invite/.test(n)));
});

test("arguments are checked before anything runs", () => {
  assert.throws(() => parseArgs(["go"]), /"run" or "tools"/);
  assert.throws(() => parseArgs(["run", "--out", "o", "--allow", "font_search"]), /--brief/);
  assert.throws(() => parseArgs(["run", "--brief", "b", "--allow", "font_search"]), /--out/);
  assert.throws(() => run("--allow", "font_search", "--model", "gpt"), /--model/);
  assert.throws(() => run("--allow", "font_search", "--budget", "50"), /--budget/);
  assert.throws(() => run("--allow", "font_search", "--budget", "x"), /--budget/);
  assert.throws(() => run("--allow", "font_search", "--minutes", "0"), /--minutes/);
  assert.throws(() => run("--allow", "font_search", "--nope", "1"), /unknown option/);
  assert.throws(() => run("--allow"), /needs a value/);
  for (const rule of ["curl * ; rm -rf x", "curl *) Bash(*", "curl $(x)", "a && b", "x | y", "`x`", ""]) {
    assert.throws(() => run("--allow", "font_search", "--bash", rule), /--bash|needs a value/, rule);
  }
  assert.deepEqual(run("--allow", "font_search", "--bash", "curl *").bash, ["curl *"]);
  assert.throws(() => parseArgs(["tools", "--out", "o", "--allow", "font_search"]), /"tools" takes/);
  assert.throws(() => parseArgs(["tools", "--out", "o", "--bash", "curl *"]), /"tools" takes/);
});

test("the child session is limited on its command line", () => {
  const o = run("--allow", "font_search,image_select_subject", "--owner-yes", "Yes, 1598.jpg to my account, masks, 0 credits", "--bash", "curl *", "--add-dir", "photos");
  const { argv, settings, prompt, out } = buildRun(o, "Make a subject mask of 1598.jpg.\n");
  assert.equal(argv[0], "-p");
  assert.equal(after(argv, "--setting-sources"), "");
  assert.equal(after(argv, "--permission-mode"), "dontAsk");
  assert.equal(after(argv, "--max-budget-usd"), "3");
  assert.ok(argv.includes("--no-session-persistence"));
  assert.equal(after(argv, "--tools"), "Read,Glob,Grep,ToolSearch,Write,Bash");
  const allowed = argv.slice(argv.indexOf("--allowedTools") + 1, argv.indexOf("--permission-mode"));
  assert.deepEqual(allowed, [
    "Read", "Glob", "Grep", "ToolSearch", `Edit(${rulePath(out)}/**)`,
    `${TOOL_PREFIX}font_search`, `${TOOL_PREFIX}image_select_subject`, "Bash(curl *)",
  ]);
  assert.equal(after(argv, "--add-dir"), resolve("photos"));
  for (const never of ["bypassPermissions", "--dangerously-skip-permissions", "acceptEdits"]) assert.ok(!argv.includes(never));
  assert.deepEqual(settings.deniedMcpServers.map((s) => s.serverName), [...OTHER_CONNECTORS]);
  assert.ok(!OTHER_CONNECTORS.includes(CONNECTOR));
  assert.match(prompt, /The owner's yes, quoted by the chat that started this run: "Yes, 1598\.jpg to my account, masks, 0 credits"/);
  assert.match(prompt, /Make a subject mask of 1598\.jpg\.$/);
});

test("without a shell rule the child has no shell, and without a yes the prompt says so", () => {
  const { argv, prompt } = buildRun(run("--allow", "font_search"), "Find Lato.");
  assert.equal(after(argv, "--tools"), "Read,Glob,Grep,ToolSearch,Write");
  assert.ok(!argv.some((a) => a.startsWith("Bash")));
  assert.match(prompt, /The owner has given no yes for this run: send no file to Adobe/);
  assert.ok(prompt.startsWith(WAIT), "every run waits for the connector first");
  assert.match(WAIT, /ToolSearch/);
});

test('"tools" lists the names and may call no Adobe tool', () => {
  const { argv, prompt } = buildRun(parseArgs(["tools", "--out", "out"]));
  assert.ok(!argv.some((a) => a.startsWith(TOOL_PREFIX)));
  assert.ok(prompt.startsWith(WAIT));
  assert.match(prompt, /Then call no Adobe tool\./);
});

test("a file rule path is in the form Claude Code matches on Windows", () => {
  assert.equal(rulePath("C:\\Users\\x\\out"), "//c/Users/x/out");
  assert.equal(rulePath("D:/a b/out"), "//d/a b/out");
});

test("the run stops when the session offers anything but the connector", () => {
  assert.deepEqual(initErrors({ mcp_servers: [{ name: CONNECTOR }], plugins: [{ name: "cc-plugin-privacy" }] }), []);
  assert.deepEqual(initErrors({ mcp_servers: [] }), []);
  assert.match(initErrors({ mcp_servers: [{ name: CONNECTOR }, { name: "claude.ai Notion" }] })[0], /another server: claude\.ai Notion/);
  assert.match(initErrors({ mcp_servers: [], plugins: [{ name: "superpowers" }] })[0], /user plugin/);
});

test("the summary reports calls, denials and failure as they are", () => {
  const events = [
    { type: "assistant", message: { content: [{ type: "tool_use", name: `${TOOL_PREFIX}font_search` }, { type: "tool_use", name: "Write" }] } },
    { type: "assistant", message: { content: [{ type: "tool_use", name: `${TOOL_PREFIX}font_search` }] } },
    { type: "result", subtype: "success", is_error: false, result: "done", total_cost_usd: 0.2, permission_denials: [{ tool_name: "Bash" }] },
  ];
  assert.deepEqual(summarize(events), { ok: true, text: "done", calls: ["adobe:font_search x2", "Write x1"], denied: ["Bash"], cost: 0.2 });
  assert.equal(summarize([]).ok, false);
  assert.equal(summarize([{ type: "result", subtype: "error_max_budget_usd", is_error: true }]).ok, false);
});
