// Run by `npm test` (node --test). The report (report.mjs) and the command
// (updates.mjs). `renderReport` and `quietLine` are pure and get hand-made
// Results. The command runs through `main` on the fixture profile under
// fixtures/stack-updates/home, a temporary state folder, and fakes for fetch,
// gh and every command, `claude` included: no network and no real CLI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inert, quietLine, renderReport, safeLink } from "../plugins/cookbook/skills/stack-updates/scripts/lib/report.mjs";
import { main, notesRepository, pruneRuns, recipeSection } from "../plugins/cookbook/skills/stack-updates/scripts/updates.mjs";
import { ALL_FEEDS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/compare.mjs";
import { READ_MODEL } from "../plugins/cookbook/skills/stack-updates/scripts/lib/read.mjs";

// ---- hand-made Results ---------------------------------------------------------

const NONE_HELD = { couldNotCheck: 0, stillBehind: 0, unlisted: 0, missing: 0 };
const base = (over = {}) => ({
  date: "2026-11-14", quiet: false, firstRun: false, stateReset: false,
  changes: [], stillBehind: [], broken: [], unchecked: [], dates: [], couldNotCheck: [], unlisted: [], missing: [],
  suppressed: { ...NONE_HELD }, weekly: null, names: {}, unreadableSources: [], working: [], paidChecks: [], reads: null,
  ...over,
});
const quiet = (over = {}) => base({ quiet: true, ...over });
const change = (over = {}) => ({
  key: "browserbase/cli", tool: "browserbase", part: "cli", kind: "new-release", from: "0.11.3", to: "0.11.4",
  installedKind: "pinned", risky: false, source: "https://www.npmjs.com/package/browse/v/0.11.4",
  textFile: "texts/browserbase-cli.txt",
  answers: { changed: "Adds a --quiet flag.", affects: "No: the recipe does not use it.", adopt: "Nothing new." },
  notRead: null, name: "Browserbase cli", watching: false,
  ...over,
});
const PINNED_UPDATE = '- To update: say "update Browserbase cli" (new lockfile in an empty folder, three scans, a clean install, one real call).';

test("quiet day: one line 'No changes, nothing broken.'", () => {
  assert.equal(quietLine(quiet()), "No changes, nothing broken.");
  assert.equal(renderReport(quiet()), "No changes, nothing broken.\n");
  // A service with no check is a standing fact: on a weekday it adds nothing.
  assert.equal(quietLine(quiet({ unchecked: ["Graphify"] })), "No changes, nothing broken.");
});

test("quiet day: what a rule held back is counted in one short sentence, and an unreadable source is named", () => {
  assert.equal(
    quietLine(quiet({ suppressed: { ...NONE_HELD, couldNotCheck: 3, stillBehind: 2 } })),
    "No changes, nothing broken. 3 parts could not be checked, 2 are still behind; each is shown again within a week.",
  );
  assert.equal(
    quietLine(quiet({ suppressed: { ...NONE_HELD, stillBehind: 1, unlisted: 2, missing: 1 } })),
    "No changes, nothing broken. 1 is still behind, 2 things are not in the Cookbook, 1 part is missing; details on Monday.",
  );
  assert.equal(
    quietLine(quiet({ unreadableSources: ["claude mcp list: timed out", "skills: EACCES <x>"] })),
    "No changes, nothing broken. Could not read: claude mcp list: timed out; skills: EACCES \\<x\\>.",
  );
});

test("quiet Monday: the line also counts the week ('7 runs, 2 changes reported')", () => {
  const monday = quiet({ date: "2026-11-16", weekly: { runs: 7, changes: 2, from: "2026-11-09" }, unchecked: ["Graphify", "Claude Design"] });
  assert.equal(quietLine(monday), "No changes, nothing broken. Last week: 7 runs, 2 changes reported. 2 services have no check.");
  assert.equal(
    quietLine(quiet({ weekly: { runs: 1, changes: 1, from: "2026-11-09" }, unchecked: ["Graphify"] })),
    "No changes, nothing broken. Last week: 1 run, 1 change reported. 1 service has no check.",
  );
  assert.equal(quietLine(quiet({ firstRun: true })), "No changes, nothing broken. First run: baseline recorded.");
  assert.equal(
    quietLine(quiet({ firstRun: true, stateReset: true })),
    "No changes, nothing broken. The state file could not be read, so this run is a new baseline.",
  );
});

test("one change and one date: the report matches the spec's example shape", () => {
  const result = base({ changes: [change()], dates: [{ label: "boat trial ends, then USD 20 a month", on: "2026-11-19", days: 5 }] });
  assert.equal(renderReport(result), [
    "Updates, 14 Nov: 1 change, 1 warning",
    "",
    "Browserbase cli 0.11.3 -> 0.11.4, pinned copy",
    "- Changed: Adds a --quiet flag.",
    "- Affects us: No: the recipe does not use it.",
    "- Worth adopting: Nothing new.",
    PINNED_UPDATE,
    "- Link: https://www.npmjs.com/package/browse/v/0.11.4",
    "",
    "Warning: boat trial ends, then USD 20 a month (19 Nov, in 5 days).",
    "",
  ].join("\n"));
});

test("sections appear only when they have content, in the order Changes, Still behind, Broken, Could not check, Not in the Cookbook, Missing, Unchecked, Warnings", () => {
  const full = base({
    names: { "firecrawl/cli": "Firecrawl cli", "firecrawl/plugin": "Firecrawl plugin", "boat/cli": "boat" },
    changes: [change()],
    stillBehind: [{ key: "firecrawl/cli", installed: "1.29.0", latest: "1.31.0", since: "2026-11-03" }],
    broken: [{ service: "GitHub", error: "exit 1, no error text" }],
    couldNotCheck: [{ key: "boat/cli", message: "fetch failed", since: "2026-11-13" }],
    unlisted: [{ kind: "bin", name: "odd-tool" }],
    missing: [{ key: "firecrawl/plugin" }],
    unchecked: ["Graphify", "Claude Design"],
    dates: [{ label: "boat trial ends", on: "2026-11-16", days: 2 }, { label: "token expires", on: "2026-11-14", days: 0 }],
  });
  const text = renderReport(full);
  const marks = ["\nBrowserbase cli 0.11.3", "\nStill behind\n", "\nBroken\n", "\nCould not check\n", "\nNot in the Cookbook\n", "\nMissing\n", "\nUnchecked", "\nWarning: "];
  const at = marks.map((m) => text.indexOf(m));
  assert.ok(at.every((i) => i > 0), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(text, /^Updates, 14 Nov: 1 change, 1 still behind, 1 broken, 1 could not be read, 1 not in the Cookbook, 1 missing, 2 warnings\n/);
  for (const line of [
    "- Firecrawl cli: 1.29.0 -> 1.31.0, behind since 3 Nov (11 days)",
    "- GitHub: exit 1, no error text",
    "- boat: fetch failed (since 13 Nov)",
    "- odd-tool (bin)",
    "- Firecrawl plugin",
    "- Graphify, Claude Design",
    "Warning: boat trial ends (16 Nov, in 2 days).",
    "Warning: token expires (14 Nov, today).",
  ]) assert.ok(text.includes(`\n${line}\n`), line);
  // One section alone: no other heading, no stray blank block.
  assert.equal(renderReport(base({ broken: [{ service: "GitHub", error: "exit 1" }] })), "Updates, 14 Nov: 1 broken\n\nBroken\n- GitHub: exit 1\n");
});

test("an unread change says why ('not read today' for the cap, the reason for a failure)", () => {
  const text = (over) => renderReport(base({ changes: [change({ answers: null, ...over })] }));
  assert.ok(text({ notRead: "cap" }).includes("\n- Not read today: more than 10 changes.\n"));
  assert.ok(text({ notRead: "failed: timed out after 120 s" }).includes("\n- Not read: failed: timed out after 120 s.\n"));
  assert.ok(text({ notRead: "read skipped" }).includes("\n- Not read: read skipped.\n"));
  assert.ok(text({ notRead: null }).includes("\n- Not read.\n"));
  const none = text({ notRead: "no release notes found" });
  assert.ok(none.includes("\n- No release notes found.\n"));
  assert.ok(none.includes("\n- Link: https://www.npmjs.com/package/browse/v/0.11.4\n"));
  assert.ok(!text({ notRead: "cap" }).includes("Changed:"));
});

test("the To update line follows the installed kind", () => {
  const lines = (over) => renderReport(base({ changes: [change(over)] })).split("\n");
  const update = (over) => lines(over).find((l) => l.startsWith("- To update:")) ?? null;
  assert.equal(update({ installedKind: "plugin", name: "Superpowers" }),
    '- To update: say "update Superpowers" (read the diff from the installed commit, then update the marketplace and the plugin).');
  assert.equal(update({}), PINNED_UPDATE);
  assert.equal(update({ installedKind: "command", name: "GitHub gh-cli" }),
    '- To update: say "update GitHub gh-cli" (a checked download or winget in your elevated shell, then a version check).');
  assert.equal(update({ installedKind: "skill", name: "stop-slop" }),
    '- To update: say "update stop-slop" (read the diff, copy the skill, record the commit).');
  assert.equal(update({ installedKind: "project", name: "ts-rust", repository: "o/app" }),
    '- To update: say "update ts-rust" (the version pull request in o/app, which Dependabot opens).');
  // The tool line names the kind.
  assert.equal(lines({ installedKind: "plugin", name: "Superpowers" })[2], "Superpowers 0.11.3 -> 0.11.4, plugin");
  assert.equal(lines({ installedKind: "command", name: "Git" })[2], "Git 0.11.3 -> 0.11.4, installed command");
  assert.equal(lines({ installedKind: "skill", name: "x" })[2], "x 0.11.3 -> 0.11.4, skill copy");
  assert.equal(lines({ installedKind: "project", name: "ts-rust", repository: "o/app" })[2], "ts-rust 0.11.3 -> 0.11.4, dependency in o/app");
  // A hosted part has nothing to install; a watching tool is not installed.
  assert.equal(update({ installedKind: "hosted" }), null);
  const watching = lines({ installedKind: "none", watching: true, name: "create-t3-app" });
  assert.equal(watching[2], "create-t3-app 0.11.3 -> 0.11.4, watching, not installed");
  assert.ok(!watching.some((l) => l.includes("To update")));
  // Commits are shortened; a changed changelog page is named as such.
  assert.equal(lines({ installedKind: "skill", name: "x", from: "a".repeat(40), to: "b".repeat(40) })[2], "x aaaaaaa -> bbbbbbb, skill copy");
  assert.equal(lines({ installedKind: "hosted", name: "Graphify", from: "c".repeat(64), to: "d".repeat(64) })[2], "Graphify changelog page changed, hosted");
  // A risky change says so on its tool line.
  assert.equal(lines({ risky: true })[2], "Browserbase cli 0.11.3 -> 0.11.4, pinned copy, may need a change (major version or breaking notes)");
});

test("a self-updated tool says 'already installed'", () => {
  const text = renderReport(base({
    changes: [change({
      key: "cc/cli", tool: "cc", kind: "installed-changed", installedKind: "command", name: "Claude Code", from: "2.1.0", to: "2.1.2",
      source: "https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.2",
    })],
  }));
  assert.ok(text.includes("\nClaude Code 2.1.0 -> 2.1.2, installed command, already installed\n"));
  assert.ok(!text.includes("To update"));
  assert.ok(text.includes("\n- Link: https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.2\n"));
  // An earlier version that is not known reads "unknown", never blank.
  const from = renderReport(base({ changes: [change({ kind: "installed-changed", from: null })] }));
  assert.ok(from.includes("\nBrowserbase cli unknown -> 0.11.4, pinned copy, already installed\n"));
});

test("answers are printed as text: backticks and angle brackets are escaped", () => {
  const answers = {
    changed: "Run `rm -rf /` <script>alert(1)</script> **now** [click](https://evil.example/x) | a |",
    affects: "# Heading? see https://evil.example and www.evil.example, mail ops@evil.example",
    adopt: "> quote _under_ ~~gone~~ \\ back",
  };
  const text = renderReport(base({ changes: [change({ answers })] }));
  const line = (prefix) => text.split("\n").find((l) => l.startsWith(prefix));
  assert.equal(line("- Changed: "),
    "- Changed: Run \\`rm -rf /\\` \\<script\\>alert(1)\\</script\\> \\*\\*now\\*\\* \\[click\\](https\\[://\\]evil.example/x) \\| a \\|");
  assert.equal(line("- Affects us: "),
    "- Affects us: \\# Heading? see https\\[://\\]evil.example and www\\[.\\]evil.example, mail ops\\[@\\]evil.example");
  assert.equal(line("- Worth adopting: "), "- Worth adopting: \\> quote \\_under\\_ \\~\\~gone\\~\\~ \\\\ back");
  assert.ok(!text.includes("```"));
  // Every other outside string too: versions, error texts, names of unlisted things.
  const other = renderReport(base({
    changes: [change({ from: "1.0.0<b>", to: "`2`" })],
    broken: [{ service: "X", error: "<img src=x onerror=alert(1)>" }],
    unlisted: [{ kind: "skill", name: "*bold*" }],
    couldNotCheck: [{ key: "a/b", message: "HTTP 500 [see](http://x.test)", since: "2026-11-14" }],
  }));
  for (const piece of [
    "1.0.0\\<b\\> -> \\`2\\`",
    "- X: \\<img src=x onerror=alert(1)\\>",
    "- \\*bold\\* (skill)",
    "- a/b: HTTP 500 \\[see\\](http\\[://\\]x.test) (since 14 Nov)",
  ]) assert.ok(other.includes(piece), piece);
  // inert: one line, and a leading heading, list or quote marker is escaped.
  assert.equal(inert("line one\nline two\u2028three"), "line one line two three");
  assert.equal(inert("- item"), "\\- item");
  assert.equal(inert("+ item"), "\\+ item");
  assert.equal(inert("## h"), "\\## h");
  assert.equal(inert(undefined), "");
});

test("every URL scheme is defanged and invisible characters are removed, in answers, versions, error texts and unlisted names", () => {
  // Built with String.fromCodePoint so no raw invisible character sits in this file.
  const RLO = String.fromCodePoint(0x202e), ZWSP = String.fromCodePoint(0x200b), PRIVATE = String.fromCodePoint(0xe000);
  assert.equal(inert("ftp://evil.example/x"), "ftp\\[://\\]evil.example/x");
  assert.equal(inert("file://host/share/run.exe"), "file\\[://\\]host/share/run.exe");
  assert.equal(inert("FTP://x and HTTPS://y and git+ssh://z"), "FTP\\[://\\]x and HTTPS\\[://\\]y and git+ssh\\[://\\]z");
  assert.equal(inert(`1.2${ZWSP}.3${RLO}exe.txt${PRIVATE}`), "1.2.3exe.txt");
  assert.equal(inert(`a${String.fromCodePoint(0xd800)}b`), `a${String.fromCodePoint(0xfffd)}b`); // a lone surrogate
  const text = renderReport(base({
    changes: [change({ from: `0.11.3${RLO}`, to: `0.11.4${ZWSP}`, answers: { changed: "see ftp://evil.example/x", affects: `file://host/share/run.exe${RLO}`, adopt: "FTP://x" } })],
    broken: [{ service: "X", error: `failed${ZWSP}: see ftp://evil.example${RLO}` }],
    unlisted: [{ kind: "bin", name: `odd${RLO}exe.cmd` }],
  }));
  for (const bad of [RLO, ZWSP, "ftp://", "file://", "FTP://"]) assert.ok(!text.includes(bad), JSON.stringify(bad));
  for (const piece of [
    "\nBrowserbase cli 0.11.3 -> 0.11.4, pinned copy\n",
    "\n- Changed: see ftp\\[://\\]evil.example/x\n",
    "\n- Affects us: file\\[://\\]host/share/run.exe\n",
    "\n- Worth adopting: FTP\\[://\\]x\n",
    "\n- X: failed: see ftp\\[://\\]evil.example\n",
    "\n- oddexe.cmd (bin)\n",
  ]) assert.ok(text.includes(piece), piece);
});

test("a count of days is printed only when it is a whole number", () => {
  const text = renderReport(base({
    date: "not a day",
    stillBehind: [{ key: "a/b", installed: "1.0.0", latest: "1.1.0", since: "2026-11-03" }],
    dates: [{ label: "x", on: "2026-11-16", days: Number.NaN }, { label: "y", on: "2026-11-17", days: 2.5 }, { label: "z", on: "2026-11-18", days: 1e300 }],
  }));
  assert.ok(text.includes("\n- a/b: 1.0.0 -> 1.1.0, behind since 3 Nov\n"), text);
  for (const w of ["Warning: x (16 Nov).", "Warning: y (17 Nov).", "Warning: z (18 Nov)."]) assert.ok(text.includes(`\n${w}\n`), w);
  assert.ok(!/NaN|Infinity|e\+/.test(text));
});

test("a release link is printed only on github.com, www.npmjs.com, nodejs.org or a changelog host; otherwise 'no link'", () => {
  for (const good of [
    "https://github.com/cli/cli/releases/tag/v2.83.0",
    "https://www.npmjs.com/package/@scope/x/v/1.0.0",
    "https://nodejs.org/en/blog/release/v24.1.0",
    "https://github.com/o/r/commit/" + "a".repeat(40),
  ]) assert.equal(safeLink(good), good);
  for (const bad of [
    "http://github.com/x", "https://github.com.evil.test/x", "https://evil.test/github.com/x", "https://user@github.com/x",
    "https://github.com:8443/x", "https://github.com/x?y=1", "https://github.com/x#y", "https://github.com/x)y",
    "https://github.com/x y", "javascript:alert(1)", "https://GITHUB.com/x", "https://docs.typesafe.ai/models.md", "", null, 5,
  ]) assert.equal(safeLink(bad), null, String(bad));
  assert.equal(safeLink("https://changelog.test/page", ["changelog.test"]), "https://changelog.test/page");
  assert.ok(renderReport(base({ changes: [change({ source: "https://evil.test/x" })] })).includes("\n- Link: no link\n"));
  assert.ok(renderReport(base({ changes: [change({ source: "" })] })).includes("\n- Link: no link\n"));
});

test("could not check: more than 3 entries with one message print as one line; all feeds and unreadable sources", () => {
  const many = ["a", "b", "c", "d"].map((k) => ({ key: `${k}/cli`, message: "gh api failed: HTTP 401", since: "2026-11-14" }));
  const text = renderReport(base({
    couldNotCheck: [...many, { key: "e/cli", message: "fetch failed", since: "2026-11-13" }],
    unreadableSources: ["claude mcp list: timed out"],
  }));
  assert.ok(text.includes("\nCould not check\n- 4 parts: gh api failed: HTTP 401\n- e/cli: fetch failed (since 13 Nov)\n- claude mcp list: timed out\n"), text);
  // The header counts the parts, the unreadable inventory sources and the notes that could not be fetched.
  assert.match(text, /^Updates, 14 Nov: 6 could not be read\n/);
  const three = renderReport(base({ couldNotCheck: many.slice(0, 3) }));
  assert.equal((three.match(/gh api failed/g) ?? []).length, 3);
  const all = renderReport(base({ couldNotCheck: [{ key: ALL_FEEDS, message: "all 25 feeds failed: fetch failed", since: "2026-11-14", count: 25 }] }));
  assert.ok(all.startsWith("Updates, 14 Nov: 25 could not be read\n"));
  const sources = renderReport(base({ broken: [{ service: "X", error: "y" }], unreadableSources: ["claude mcp list: timed out"] }));
  assert.ok(sources.startsWith("Updates, 14 Nov: 1 broken, 1 could not be read\n"), sources);
  const notes = renderReport(base({ changes: [change({ answers: null, notesError: "gh api failed: HTTP 502", notRead: "release notes could not be fetched (gh api failed: HTTP 502)" })] }));
  assert.ok(notes.startsWith("Updates, 14 Nov: 1 change, 1 could not be read\n"), notes);
  assert.ok(notes.includes("\n- Not read: release notes could not be fetched (gh api failed: HTTP 502).\n"));
  assert.ok(all.includes("\nCould not check\n- all 25 feeds failed: fetch failed\n"));
});

test("the report ends with the run's cost when a release note was read or the paid check ran", () => {
  const read = renderReport(base({ changes: [change()], reads: { count: 3, failed: 0, input: 4300, output: 610, missingUsage: 0 }, paidChecks: ["Parallel"] }));
  assert.ok(read.endsWith("\n\n3 release notes read on the Claude plan: 4,300 input and 610 output tokens; one paid Parallel check.\n"), read);
  const one = renderReport(base({ changes: [change()], reads: { count: 1, failed: 0, input: 10, output: 2, missingUsage: 1 } }));
  assert.ok(one.endsWith("\n\n1 release note read on the Claude plan: 10 input and 2 output tokens (1 without a token count).\n"), one);
  // Only reads that returned answers count as read; failed ones are named apart.
  const failed = renderReport(base({ changes: [change()], reads: { count: 2, failed: 1, input: 2648, output: 390, missingUsage: 0 } }));
  assert.ok(failed.endsWith("\n\nRelease notes on the Claude plan: 2 read, 1 failed; 2,648 input and 390 output tokens.\n"), failed);
  const allFailed = renderReport(base({ changes: [change()], reads: { count: 0, failed: 2, input: 0, output: 0, missingUsage: 0 } }));
  assert.ok(allFailed.endsWith("\n\nRelease notes on the Claude plan: 0 read, 2 failed.\n"), allFailed);
  const paid = renderReport(base({ broken: [{ service: "X", error: "y" }], paidChecks: ["Parallel"] }));
  assert.ok(paid.endsWith("\n\nOne paid Parallel check.\n"), paid);
  assert.ok(!/Claude plan|paid/.test(renderReport(base({ changes: [change()], reads: { count: 0, failed: 0, input: 0, output: 0, missingUsage: 0 } }))));
});

test("the full report says a first run, a reset state, what was held back and the week", () => {
  const behind = [{ key: "a/b", installed: "1.0.0", latest: "1.1.0", since: "2026-11-14" }];
  const first = renderReport(base({ firstRun: true, stillBehind: behind }));
  assert.ok(first.includes("\n\nFirst run: this run records the baseline and reports only what is already behind, unlisted, missing or broken.\n"), first);
  assert.ok(first.includes("\n- a/b: 1.0.0 -> 1.1.0, behind since today\n"));
  const reset = renderReport(base({ firstRun: true, stateReset: true, stillBehind: behind }));
  assert.ok(reset.includes("\n\nThe state file could not be read, so it was reset: this run is a new baseline and reports only what is already behind, unlisted, missing or broken.\n"));
  assert.ok(!reset.includes("First run:"));
  const held = renderReport(base({ changes: [change()], suppressed: { ...NONE_HELD, couldNotCheck: 2 }, weekly: { runs: 6, changes: 0, from: "2026-11-09" } }));
  assert.ok(held.includes("\n\nHeld back: 2 parts could not be checked; each is shown again within a week.\n"), held);
  assert.ok(held.includes("\n\nLast week: 6 runs, 0 changes reported.\n"));
});

// ---- the command, with fakes -----------------------------------------------------

const HOME = fileURLToPath(new URL("./fixtures/stack-updates/home", import.meta.url));
const NPM = "https://registry.npmjs.org/firecrawl-cli/latest";
const tool = (id, name, parts, extra = {}) => ({ id, name, lifecycle: "active", recipe: null, repository: "", uses: [], parts, ...extra });
const CAT = {
  version: 1,
  ignored: [{ name: "helper-key.ps1", reason: "fixture" }],
  tools: [
    // The real catalog's shape: no tool repository, the part names where its notes are.
    tool("firecrawl", "Firecrawl", [{
      name: "cli", installed: { kind: "pinned", folder: "firecrawl-cli", package: "firecrawl-cli" },
      feed: { kind: "npm", package: "firecrawl-cli" }, notes: { kind: "github", repository: "firecrawl/cli" },
    }], { recipe: "Firecrawl without surprises" }),
    tool("superpowers", "Superpowers", [{ name: "plugin", installed: { kind: "plugin", id: "superpowers@claude-plugins-official" }, feed: { kind: "github", repository: "obra/superpowers" } }],
      { recipe: "Building a change (Superpowers)", repository: "obra/superpowers" }),
    tool("github", "GitHub", [{ name: "gh-cli", installed: { kind: "command" }, feed: { kind: "github", repository: "cli/cli" } }], { recipe: "CI and releases" }),
    tool("parallel", "Parallel", [{ name: "cli", installed: { kind: "none" }, feed: { kind: "none", reason: "fixture" } }], { recipe: "Research" }),
    tool("boat", "boat", [{ name: "cli", installed: { kind: "none" }, feed: { kind: "none", reason: "fixture" } }],
      { lifecycle: "trial", dates: [{ label: "boat trial ends, then USD 20 a month", on: "2026-11-20" }] }),
  ],
};
// What the fixture profile holds that CAT does not name.
const UNLISTED = 7;
const GH_BASE = {
  "repos/obra/superpowers/releases/latest": { tag_name: "v7.0.2", draft: false, prerelease: false },
  "repos/cli/cli/releases/latest": { tag_name: "v2.83.0", draft: false, prerelease: false },
};

const ok = (stdout) => ({ code: 0, stdout, stderr: "" });
const ev = {
  init: () => ({ type: "system", subtype: "init", model: READ_MODEL, tools: [], mcp_servers: [], permissionMode: "dontAsk", apiKeySource: "none" }),
  text: (t) => ({ type: "assistant", message: { model: READ_MODEL, content: [{ type: "text", text: t }] } }),
  result: (t) => ({
    type: "result", subtype: "success", is_error: false, result: t, permission_denials: [],
    usage: { input_tokens: 2, cache_creation_input_tokens: 1322, cache_read_input_tokens: 0, output_tokens: 195 },
    modelUsage: { [READ_MODEL]: { inputTokens: 2, outputTokens: 195 } },
  }),
};
const stream = (answer) => [ev.init(), ev.text(answer), ev.result(answer)].map((e) => JSON.stringify(e)).join("\n") + "\n";
const ANSWER = { changed: "Adds a --json flag.", affects: "No: the recipe does not use it.", adopt: "The --json flag, for scripts." };
const RISKY_ANSWER = { changed: "Use `new-flow` <now>; the old flow is deprecated.", affects: "Yes: the recipe names the old flow.", adopt: "Nothing new." };

// One fake for every command: version commands, connection checks, `claude mcp list` and the read.
function fakeRun({ paidOk = true } = {}) {
  const calls = [];
  const run = async (argv, opts = {}) => {
    calls.push({ argv, opts });
    const line = argv.join(" ");
    if (argv[0] === "claude" && argv[1] === "-p") return ok(stream(JSON.stringify(/Tool: Superpowers/.test(opts.input) ? RISKY_ANSWER : ANSWER)));
    if (argv[0] === "claude" && argv[1] === "mcp") return ok("");
    if (line === "gh --version") return ok("gh version 2.83.0 (2026-10-30)\nhttps://github.com/cli/cli/releases/tag/v2.83.0\n");
    if (line === "gh api user --jq .login") return ok("octocat\n");
    if (line.includes("firecrawl.cmd")) return ok("Credits: 100 / 500\n");
    if (line.includes("boat.cmd")) return ok('{"billingStatus":"trial"}');
    if (line.includes("parallel-cli.cmd")) return paidOk ? ok('{"status": "ok"}') : { code: 1, stdout: "", stderr: "402 payment required" };
    return { code: 127, stdout: "", stderr: `no fake for ${argv[0]}` };
  };
  run.calls = calls;
  run.count = (pattern) => calls.filter((c) => pattern.test(c.argv.join(" "))).length;
  return run;
}
function fakeGh(table) {
  const calls = [];
  const gh = async (args) => {
    calls.push(args);
    return Object.hasOwn(table, args[1]) ? ok(JSON.stringify(table[args[1]])) : { code: 1, stdout: "", stderr: "HTTP 404: Not Found" };
  };
  gh.calls = calls;
  return gh;
}
function fakeFetch(table) {
  const fetcher = async (url) => (Object.hasOwn(table, url) ? new Response(JSON.stringify(table[url]), { status: 200 }) : new Response("missing", { status: 404 }));
  return fetcher;
}
const fakes = ({ npm = "1.31.0", gh = {}, paidOk = true } = {}) => ({
  fetcher: fakeFetch({ [NPM]: { version: npm } }),
  gh: fakeGh({ ...GH_BASE, ...gh }),
  run: fakeRun({ paidOk }),
});
// The real clock of a simulated day is 07:00 local time on its --today, unless a test passes `now`.
async function cli(args, deps, catalog = CAT) {
  let out = "", err = "";
  const day = args[args.indexOf("--today") + 1];
  const now = deps.now ?? (args.includes("--today") && /^\d{4}-\d{2}-\d{2}$/.test(day ?? "") ? new Date(`${day}T07:00:00`) : undefined);
  const code = await main(args, { ...(catalog ? { catalog } : {}), stdout: (s) => { out += s; }, stderr: (s) => { err += s; }, ...deps, ...(now ? { now } : {}) });
  return { code, out, err };
}
const tmp = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "stack-updates-run-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const at = (state, today, ...more) => ["--home", HOME, "--state", state, "--today", today, ...more];
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

test("run end to end on the fixture home with fake fetcher and run: writes the folder, the state, and is quiet on the second run", async (t) => {
  const state = tmp(t);
  const day1 = fakes();
  const one = await cli(["run", ...at(state, "2026-11-13")], day1);
  assert.equal(one.code, 0, one.err);
  assert.equal(one.err, "");
  const folder = join(state, "runs", "2026-11-13");
  assert.deepEqual(readdirSync(folder).sort(), ["inventory.json", "latest.json", "next-state.json", "report.md", "result.json"]);
  const report = readFileSync(join(folder, "report.md"), "utf8");
  assert.equal(one.out, `${join(folder, "report.md")}\n${report}`);
  assert.match(report, new RegExp(`^Updates, 13 Nov: 1 still behind, ${UNLISTED} not in the Cookbook, 1 warning\\n`));
  assert.ok(report.includes("\nFirst run: "));
  assert.ok(report.includes("\n- Firecrawl: 1.29.0 -> 1.31.0, behind since today\n"));
  assert.ok(report.includes("\nWarning: boat trial ends, then USD 20 a month (20 Nov, in 7 days).\n"));
  assert.ok(report.endsWith("\n\nOne paid Parallel check.\n"));
  const inventory = readJson(join(folder, "inventory.json"));
  assert.deepEqual(inventory.installed["firecrawl/cli"], { state: "read", version: "1.29.0" });
  assert.deepEqual(inventory.installed["github/gh-cli"], { state: "read", version: "2.83.0" });
  assert.equal(inventory.unlisted.items.length, UNLISTED);
  assert.equal(readJson(join(folder, "latest.json")).latest["firecrawl/cli"].version, "1.31.0");
  const result1 = readJson(join(folder, "result.json"));
  assert.deepEqual([...result1.working].sort(), ["Firecrawl", "GitHub", "Parallel", "boat"]);
  assert.deepEqual(result1.paidChecks, ["Parallel"]);
  assert.deepEqual(result1.stages, ["inventory", "compare", "connect", "read", "report"]);
  const saved = readJson(join(state, "state.json"));
  assert.equal(saved.lastRun, "2026-11-13");
  assert.deepEqual(readJson(join(state, "paid-check.json")), { on: "2026-11-13", results: { parallel: { service: "Parallel", outcome: "working" } } });
  assert.deepEqual(readdirSync(state).sort(), ["paid-check.json", "runs", "state.json"]); // the lock is gone
  assert.equal(day1.run.count(/parallel-cli/), 1);
  // No request reads anything on a day without changes.
  assert.equal(day1.run.count(/^claude -p/), 0);

  // The same day again: the paid check is not paid twice and its result is reused; the week is not doubled.
  const again = fakes();
  const two = await cli(["run", ...at(state, "2026-11-13")], again);
  assert.equal(two.code, 0, two.err);
  assert.equal(again.run.count(/parallel-cli/), 0);
  const result2 = readJson(join(folder, "result.json"));
  assert.ok(result2.working.includes("Parallel"));
  assert.deepEqual(result2.paidChecks, []);
  assert.match(two.out.split("\n")[1], /^Updates, 13 Nov: 1 warning$/);
  assert.equal(readJson(join(state, "state.json")).week.runs, 1);

  // The next day nothing is new: one line, which counts what waits for Monday.
  const day2 = fakes();
  const three = await cli(["run", ...at(state, "2026-11-14")], day2);
  assert.equal(three.code, 0, three.err);
  const line = `No changes, nothing broken. 1 is still behind, ${UNLISTED} things are not in the Cookbook; details on Monday.`;
  assert.equal(three.out, `${line}\n`);
  assert.equal(readFileSync(join(state, "runs", "2026-11-14", "report.md"), "utf8"), `${line}\n`);
  assert.equal(day2.run.count(/parallel-cli/), 1);
  const saved2 = readJson(join(state, "state.json"));
  assert.equal(saved2.lastRun, "2026-11-14");
  assert.deepEqual(saved2.week, { runs: 2, changes: 0 });
});

test("a change day: release notes go to texts/ and only to the request with no tools; risky first; answers printed as text", async (t) => {
  const state = tmp(t);
  const cat = { ...CAT, tools: [...CAT.tools, tool("widget", "Widget", [{ name: "cli", installed: { kind: "none" }, feed: { kind: "npm", package: "widget-cli" } }])] };
  const widget = (version) => ({ "https://registry.npmjs.org/widget-cli/latest": { version } });
  const base1 = fakes();
  base1.fetcher = fakeFetch({ [NPM]: { version: "1.31.0" }, ...widget("2.0.0") });
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], base1, cat)).code, 0);

  const day = fakes({
    npm: "1.32.0",
    gh: {
      "repos/obra/superpowers/releases/latest": { tag_name: "v7.1.0", draft: false, prerelease: false },
      "repos/obra/superpowers/releases?per_page=30": [{ tag_name: "v7.1.0", draft: false, prerelease: false, published_at: "2026-11-14T08:00:00Z", body: "SUPERPOWERS-NOTES: the old flow is deprecated." }],
      // npm publishes no notes: the repository the part's `notes` names is read instead.
      "repos/firecrawl/cli/releases?per_page=30": [
        { tag_name: "v1.32.0", draft: false, prerelease: false, body: "FIRECRAWL-NOTES: adds --json." },
        { tag_name: "v1.31.0", draft: false, prerelease: false, body: "FIRECRAWL-NOTES: faster maps." },
      ],
    },
  });
  day.fetcher = fakeFetch({ [NPM]: { version: "1.32.0" }, ...widget("2.1.0") });
  const r = await cli(["run", ...at(state, "2026-11-14")], day, cat);
  assert.equal(r.code, 0, r.err);
  const folder = join(state, "runs", "2026-11-14");
  const result = readJson(join(folder, "result.json"));
  // Risky first (the notes say "deprecated"), then by tool name.
  assert.deepEqual(result.changes.map((c) => [c.key, c.risky]), [["superpowers/plugin", true], ["firecrawl/cli", false], ["widget/cli", false]]);
  assert.deepEqual(result.changes.map((c) => c.textFile), ["texts/superpowers-plugin.txt", "texts/firecrawl-cli.txt", null]);
  assert.deepEqual(result.changes[0].answers, RISKY_ANSWER);
  assert.equal(result.changes[2].notRead, "no release notes found");
  assert.deepEqual(result.reads, { count: 2, failed: 0, input: 2648, output: 390, missingUsage: 0 });
  assert.match(readFileSync(join(folder, "texts", "firecrawl-cli.txt"), "utf8"), /FIRECRAWL-NOTES: adds --json[\s\S]*FIRECRAWL-NOTES: faster maps/);
  assert.match(readFileSync(join(folder, "texts", "superpowers-plugin.txt"), "utf8"), /SUPERPOWERS-NOTES/);
  // The notes reach the two requests with no tools and nothing else: not result.json, not a command line.
  assert.ok(!readFileSync(join(folder, "result.json"), "utf8").includes("-NOTES"));
  const reads = day.run.calls.filter((c) => c.argv[0] === "claude" && c.argv[1] === "-p");
  assert.equal(reads.length, 2);
  assert.ok(reads.every((c) => c.argv.includes("--tools") && c.argv[c.argv.indexOf("--tools") + 1] === ""));
  assert.ok(reads[1].opts.input.includes("FIRECRAWL-NOTES") && reads[1].opts.input.includes("### Firecrawl without surprises"));
  for (const c of day.run.calls.filter((x) => !reads.includes(x))) {
    assert.ok(!JSON.stringify(c).includes("-NOTES"), c.argv.join(" "));
  }
  for (const c of reads) assert.ok(!c.argv.some((a) => a.includes("-NOTES")));
  // The report: the answers as text, the update lines, the link, and the cost.
  const report = readFileSync(join(folder, "report.md"), "utf8");
  assert.equal(r.out, `${join(folder, "report.md")}\n${report}`);
  assert.match(report, /^Updates, 14 Nov: 3 changes\n/);
  const sp = report.indexOf("\nSuperpowers 7.0.2 -> 7.1.0, plugin, may need a change (major version or breaking notes)\n");
  const fc = report.indexOf("\nFirecrawl 1.29.0 -> 1.32.0, pinned copy\n");
  assert.ok(sp > 0 && fc > sp, report);
  assert.ok(report.includes("\n- Changed: Use \\`new-flow\\` \\<now\\>; the old flow is deprecated.\n"));
  assert.ok(report.includes('\n- To update: say "update Superpowers" (read the diff from the installed commit, then update the marketplace and the plugin).\n'));
  assert.ok(report.includes("\n- Link: https://github.com/obra/superpowers/releases/tag/v7.1.0\n"));
  assert.ok(report.includes("\nWidget 2.0.0 -> 2.1.0, not installed\n- No release notes found.\n- Link: https://www.npmjs.com/package/widget-cli/v/2.1.0\n"));
  assert.ok(report.endsWith("\n\n2 release notes read on the Claude plan: 2,648 input and 390 output tokens; one paid Parallel check.\n"), report);

  // The read stage again on the same folder: the changes already answered are kept, nothing is read twice.
  const before = readJson(join(folder, "result.json"));
  const again = fakes();
  const rerun = await cli(["read", ...at(state, "2026-11-14", "--out", folder)], again, cat);
  assert.equal(rerun.code, 0, rerun.err);
  assert.equal(again.run.count(/^claude -p/), 0);
  assert.equal(again.gh.calls.filter((a) => /releases\?per_page/.test(a[1])).length, 0);
  const after = readJson(join(folder, "result.json"));
  assert.deepEqual(after.changes.map((c) => c.answers), before.changes.map((c) => c.answers));
  assert.deepEqual(after.reads, before.reads);
});

test("a self-updated tool: 'already installed', no update line, and the link names the installed version, not the newest", async (t) => {
  const CLAUDE = "1c9ccea9-8ebf-4d9c-9512-38e6890ea5b6"; // Claude Code, a self-updating tool in tables.mjs
  const cat = { version: 1, ignored: [], tools: [tool(CLAUDE, "Claude Code", [{ name: "cli", installed: { kind: "command" }, feed: { kind: "npm", package: "@anthropic-ai/claude-code", tag: "stable" } }])] };
  const NPM_CC = "https://registry.npmjs.org/%40anthropic-ai%2Fclaude-code/stable";
  const deps = (installed) => {
    const f = fakes();
    const inner = f.run;
    f.run = async (argv, opts) => (argv.join(" ") === "claude --version" ? ok(`${installed} (Claude Code)\n`) : inner(argv, opts));
    f.fetcher = fakeFetch({ [NPM_CC]: { version: "2.1.5" } });
    return f;
  };
  const state = tmp(t);
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], deps("2.1.0"), cat)).code, 0);
  const r = await cli(["run", ...at(state, "2026-11-14")], deps("2.1.2"), cat);
  assert.equal(r.code, 0, r.err);
  const result = readJson(join(state, "runs", "2026-11-14", "result.json"));
  assert.deepEqual(result.changes.map((c) => [c.kind, c.from, c.to, c.source]),
    [["installed-changed", "2.1.0", "2.1.2", "https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.2"]]);
  assert.ok(r.out.includes("\nClaude Code 2.1.0 -> 2.1.2, installed command, already installed\n- No release notes found.\n- Link: https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.2\n"), r.out);
  assert.ok(!r.out.includes("To update"));
});

test("--no-read: changes say 'read skipped', no notes are fetched and no request is made", async (t) => {
  const state = tmp(t);
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], fakes())).code, 0);
  const day = fakes({ npm: "1.32.0" });
  const r = await cli(["run", ...at(state, "2026-11-14", "--no-read")], day);
  assert.equal(r.code, 0, r.err);
  assert.equal(day.run.count(/^claude -p/), 0);
  assert.ok(!day.gh.calls.some((a) => /releases\?per_page/.test(a[1])));
  const folder = join(state, "runs", "2026-11-14");
  assert.ok(!existsSync(join(folder, "texts")));
  assert.deepEqual(readJson(join(folder, "result.json")).changes.map((c) => c.notRead), ["read skipped"]);
  assert.ok(r.out.includes("\nFirecrawl 1.29.0 -> 1.32.0, pinned copy\n- Not read: read skipped.\n"));
});

test("more than 10 changes: 10 are read and the rest say 'not read today'", async (t) => {
  const state = tmp(t);
  const ids = Array.from({ length: 11 }, (_, i) => `t${String(i + 1).padStart(2, "0")}`);
  const cat = {
    version: 1, ignored: [],
    tools: ids.map((id) => tool(id, `Tool ${id}`, [{ name: "cli", installed: { kind: "none" }, feed: { kind: "github", repository: `o/${id}` } }])),
  };
  const gh = (v) => Object.fromEntries(ids.flatMap((id) => [
    [`repos/o/${id}/releases/latest`, { tag_name: `v${v}`, draft: false, prerelease: false }],
    [`repos/o/${id}/releases?per_page=30`, [{ tag_name: `v${v}`, draft: false, prerelease: false, body: `notes of ${id}` }]],
  ]));
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], { ...fakes(), gh: fakeGh(gh("1.0.0")) }, cat)).code, 0);
  const day = { ...fakes(), gh: fakeGh(gh("1.1.0")) };
  const r = await cli(["run", ...at(state, "2026-11-14")], day, cat);
  assert.equal(r.code, 0, r.err);
  assert.equal(day.run.count(/^claude -p/), 10);
  const result = readJson(join(state, "runs", "2026-11-14", "result.json"));
  assert.deepEqual(result.changes.map((c) => c.notRead), [...Array(10).fill(null), "cap"]);
  assert.ok(r.out.includes("\nTool t11 1.0.0 -> 1.1.0, not installed\n- Not read today: more than 10 changes.\n"));
});

test("the paid check runs at most once per real local day, whatever --today says; a skipped one with no stored outcome is unchecked", async (t) => {
  const state = tmp(t);
  const first = fakes({ paidOk: false });
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], first)).code, 0);
  assert.equal(first.run.count(/parallel-cli/), 1);
  const marker = join(state, "paid-check.json");
  assert.deepEqual(readJson(marker), { on: "2026-11-13", results: { parallel: { service: "Parallel", outcome: "broken", error: "402 payment required" } } });
  // A later --today on the same real day: the stored outcome is reused, not paid again.
  const again = { ...fakes(), now: new Date("2026-11-13T09:00:00") };
  const r = await cli(["run", ...at(state, "2026-11-14")], again);
  assert.equal(r.code, 0, r.err);
  assert.equal(again.run.count(/parallel-cli/), 0);
  assert.ok(r.out.includes("\nBroken\n- Parallel: 402 payment required\n"));
  assert.ok(!r.out.includes("paid Parallel check"));
  // A marker for today with no outcome for the service: Parallel is unchecked, never dropped.
  writeFileSync(marker, JSON.stringify({ on: "2026-11-13", results: {} }));
  const third = { ...fakes(), now: new Date("2026-11-13T10:00:00") };
  assert.equal((await cli(["run", ...at(state, "2026-11-15")], third)).code, 0);
  assert.equal(third.run.count(/parallel-cli/), 0);
  const result = readJson(join(state, "runs", "2026-11-15", "result.json"));
  assert.ok(result.unchecked.includes("Parallel"), JSON.stringify(result.unchecked));
  assert.ok(!result.working.includes("Parallel") && !result.broken.some((b) => b.service === "Parallel"));
  // The next real day it runs again, once.
  const fourth = fakes();
  assert.equal((await cli(["run", ...at(state, "2026-11-16")], fourth)).code, 0);
  assert.equal(fourth.run.count(/parallel-cli/), 1);
  assert.deepEqual(readJson(marker), { on: "2026-11-16", results: { parallel: { service: "Parallel", outcome: "working" } } });
});

test("a state file that cannot be read: the report says it was reset and this run is a new baseline", async (t) => {
  const state = tmp(t);
  writeFileSync(join(state, "state.json"), "{");
  const r = await cli(["run", ...at(state, "2026-11-13")], fakes());
  assert.equal(r.code, 0, r.err);
  assert.ok(r.out.includes("\nThe state file could not be read, so it was reset: this run is a new baseline"));
  assert.equal(readJson(join(state, "runs", "2026-11-13", "result.json")).stateReset, true);
  assert.equal(readJson(join(state, "state.json")).lastRun, "2026-11-13");
});

test("a run that fails before report.md is written saves no state, so the next run reports again", async (t) => {
  const state = tmp(t);
  const folder = join(state, "runs", "2026-11-13");
  mkdirSync(join(folder, "report.md"), { recursive: true }); // report.md cannot be written
  const bad = await cli(["run", ...at(state, "2026-11-13")], fakes());
  assert.equal(bad.code, 1);
  assert.equal(bad.out, "");
  assert.match(bad.err, /^updates\.mjs: /);
  assert.ok(existsSync(join(folder, "result.json")));
  assert.ok(!existsSync(join(state, "state.json")));
  assert.ok(!existsSync(join(state, "run.lock"))); // removed even though the run failed
  assert.ok(existsSync(join(state, "paid-check.json"))); // written right after the paid call
  rmSync(join(folder, "report.md"), { recursive: true });
  const retry = fakes();
  const good = await cli(["run", ...at(state, "2026-11-13")], retry);
  assert.equal(good.code, 0, good.err);
  assert.ok(good.out.includes("\nFirst run: "));
  assert.ok(existsSync(join(state, "state.json")));
  assert.equal(retry.run.count(/parallel-cli/), 0); // the failed run's paid call is not paid again
});

test("run folders older than 30 days are removed; today's is kept", async (t) => {
  const state = tmp(t);
  const runs = join(state, "runs");
  for (const d of ["2026-10-01", "2026-10-13", "2026-10-14", "2026-11-13", "notes"]) {
    mkdirSync(join(runs, d, "texts"), { recursive: true });
    writeFileSync(join(runs, d, "texts", "a.txt"), "x");
  }
  // A link inside an old folder is removed itself; what it points to is never touched.
  const outside = join(state, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "keep.txt"), "keep");
  symlinkSync(outside, join(runs, "2026-10-01", "link"), "junction");
  assert.deepEqual(pruneRuns(state, "2026-11-13").sort(), ["2026-10-01", "2026-10-13"]);
  assert.deepEqual(readdirSync(runs).sort(), ["2026-10-14", "2026-11-13", "notes"]);
  assert.equal(readFileSync(join(outside, "keep.txt"), "utf8"), "keep");
  // A runs folder that is itself a link is never followed.
  const other = tmp(t);
  mkdirSync(join(outside, "2026-01-01"));
  symlinkSync(outside, join(other, "runs"), "junction");
  assert.deepEqual(pruneRuns(other, "2026-11-13"), []);
  assert.ok(existsSync(join(outside, "2026-01-01")));
  // `run` prunes at its start and keeps today's folder.
  mkdirSync(join(runs, "2026-09-01"));
  const r = await cli(["run", ...at(state, "2026-11-13")], fakes());
  assert.equal(r.code, 0, r.err);
  assert.ok(!existsSync(join(runs, "2026-09-01")));
  assert.ok(existsSync(join(runs, "2026-11-13", "report.md")));
  assert.ok(existsSync(join(runs, "2026-10-14")));
});

// A skill copy followed by its commits: where it stands is known only from a recorded commit.
const C1 = "a".repeat(40), C2 = "b".repeat(40);
const SKILL_CAT = { version: 1, ignored: [], tools: [tool("x", "X skill", [{ name: "skill", installed: { kind: "skill", folder: "x" }, feed: { kind: "commit", repository: "o/x" } }])] };
const head = (sha) => ({
  ...fakes(),
  gh: fakeGh({ "repos/o/x/commits?per_page=1": [{ sha }], [`repos/o/x/commits?sha=${sha}&per_page=30`]: [{ sha, commit: { message: "Update x", committer: { date: "2026-11-14T00:00:00Z" } } }] }),
});

test("record stores the commit and the next compare is not behind", async (t) => {
  const cat = SKILL_CAT;
  const state = tmp(t);
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], head(C1), cat)).code, 0);
  const sat = await cli(["run", ...at(state, "2026-11-14", "--no-read")], head(C2), cat);
  assert.ok(sat.out.includes(`\nX skill ${C1.slice(0, 7)} -> ${C2.slice(0, 7)}, skill copy\n`), sat.out);
  const notRecorded = tmp(t);
  cpSync(state, notRecorded, { recursive: true });

  const rec = await cli(["record", "x/skill", C2, "--home", HOME, "--state", state], {}, cat);
  assert.equal(rec.code, 0, rec.err);
  assert.equal(rec.out, `Recorded ${C2.slice(0, 7)} as the installed commit of X skill (x/skill).\n`);
  assert.equal(readJson(join(state, "state.json")).parts["x/skill"].installedCommit, C2);

  // Monday: with the commit recorded it is not behind; without it, it is still behind.
  const mon = await cli(["run", ...at(state, "2026-11-16")], head(C2), cat);
  assert.equal(mon.code, 0, mon.err);
  assert.deepEqual(readJson(join(state, "runs", "2026-11-16", "result.json")).stillBehind, []);
  await cli(["run", ...at(notRecorded, "2026-11-16")], head(C2), cat);
  assert.deepEqual(readJson(join(notRecorded, "runs", "2026-11-16", "result.json")).stillBehind.map((s) => s.key), ["x/skill"]);

  // record refuses an unknown part, a commit that is not one, and an unreadable state file.
  const empty = tmp(t);
  for (const args of [["record", "nope/x", C2], ["record", "x/skill", "abc"], ["record", "x/skill"]]) {
    const r = await cli([...args, "--home", HOME, "--state", empty], {}, cat);
    assert.equal(r.code, 2, args.join(" "));
    assert.equal(r.out, "");
  }
  writeFileSync(join(empty, "state.json"), "{");
  const broken = await cli(["record", "x/skill", C2, "--home", HOME, "--state", empty], {}, cat);
  assert.equal(broken.code, 1);
  assert.equal(readFileSync(join(empty, "state.json"), "utf8"), "{");
});

test("report refuses a run folder from an earlier day and one whose connect stage has not run; nothing is saved", async (t) => {
  const state = tmp(t);
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], fakes())).code, 0);
  assert.equal((await cli(["run", ...at(state, "2026-11-14")], fakes())).code, 0);
  const before = readFileSync(join(state, "state.json"), "utf8");
  const old = await cli(["report", ...at(state, "2026-11-14", "--out", join(state, "runs", "2026-11-13"))], fakes());
  assert.equal(old.code, 1);
  assert.match(old.err, /^updates\.mjs: .*2026-11-13/);
  assert.equal(old.out, "");
  assert.equal(readFileSync(join(state, "state.json"), "utf8"), before);

  const fresh = tmp(t);
  const out = join(fresh, "manual");
  for (const stage of ["inventory", "compare"]) assert.equal((await cli([stage, ...at(fresh, "2026-11-13", "--out", out)], fakes())).code, 0);
  const early = await cli(["report", ...at(fresh, "2026-11-13", "--out", out)], fakes());
  assert.equal(early.code, 1);
  assert.match(early.err, /connect/);
  assert.ok(!existsSync(join(fresh, "state.json")));
  assert.ok(!existsSync(join(out, "report.md")));
  // A stored `quiet` is never trusted: report works it out from the lists.
  assert.equal((await cli(["connect", ...at(fresh, "2026-11-13", "--out", out)], fakes())).code, 0);
  const result = readJson(join(out, "result.json"));
  writeFileSync(join(out, "result.json"), JSON.stringify({ ...result, quiet: true }));
  const r = await cli(["report", ...at(fresh, "2026-11-13", "--out", out)], fakes());
  assert.equal(r.code, 0, r.err);
  assert.match(r.out.split("\n")[1], /^Updates, 13 Nov: /);
});

test("report never saves over a later run's state", async (t) => {
  // No --today here: the day is the (fake) real clock's, as on the scheduled run.
  const state = tmp(t);
  const out = join(state, "manual");
  const on = (day) => ({ ...fakes(), now: new Date(`${day}T07:00:00`) });
  const args = (...more) => ["--home", HOME, "--state", state, ...more];
  for (const stage of ["inventory", "compare", "connect"]) assert.equal((await cli([stage, ...args("--out", out)], on("2026-11-13"))).code, 0);
  assert.equal((await cli(["run", ...args()], on("2026-11-14"))).code, 0);
  const before = readFileSync(join(state, "state.json"), "utf8");
  const late = await cli(["report", ...args("--out", out)], on("2026-11-13"));
  assert.equal(late.code, 1);
  assert.match(late.err, /later run \(2026-11-14\)/);
  assert.equal(readFileSync(join(state, "state.json"), "utf8"), before);
  assert.ok(!existsSync(join(out, "report.md")));
});

test("a record made between the start of a run and its report survives the report", async (t) => {
  const state = tmp(t);
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], head(C1), SKILL_CAT)).code, 0);
  const out = join(state, "manual");
  for (const stage of ["inventory", "compare", "connect", "read"]) {
    assert.equal((await cli([stage, ...at(state, "2026-11-14", "--out", out)], head(C2), SKILL_CAT)).code, 0, stage);
  }
  assert.equal((await cli(["record", "x/skill", C2, "--home", HOME, "--state", state], {}, SKILL_CAT)).code, 0);
  const r = await cli(["report", ...at(state, "2026-11-14", "--out", out)], head(C2), SKILL_CAT);
  assert.equal(r.code, 0, r.err);
  const saved = readJson(join(state, "state.json"));
  assert.equal(saved.lastRun, "2026-11-14");
  assert.equal(saved.parts["x/skill"].installedCommit, C2);
});

test("release notes that could not be fetched say so; only a feed that answered with none says 'No release notes found.'; a major version stays first", async (t) => {
  const state = tmp(t);
  const cat = {
    version: 1, ignored: [],
    tools: [
      tool("alpha", "Alpha", [{ name: "cli", installed: { kind: "none" }, feed: { kind: "github", repository: "o/alpha" } }]),
      tool("beta", "Beta", [{ name: "cli", installed: { kind: "none" }, feed: { kind: "npm", package: "beta-cli" } }], { repository: "o/beta" }),
      tool("zeta", "Zeta", [{ name: "cli", installed: { kind: "none" }, feed: { kind: "github", repository: "o/zeta" } }]),
    ],
  };
  const latest = (a, z) => ({
    "repos/o/alpha/releases/latest": { tag_name: `v${a}`, draft: false, prerelease: false },
    "repos/o/zeta/releases/latest": { tag_name: `v${z}`, draft: false, prerelease: false },
  });
  const day = (a, b, z, more = {}) => ({ ...fakes(), gh: fakeGh({ ...latest(a, z), ...more }), fetcher: fakeFetch({ "https://registry.npmjs.org/beta-cli/latest": { version: b } }) });
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], day("1.0.0", "1.0.0", "1.0.0"), cat)).code, 0);
  // Alpha's releases answer with none in range; Beta (npm) falls back to its repository, which fails;
  // Zeta, a major version, has no releases endpoint at all.
  const d = day("1.1.0", "1.1.0", "2.0.0", { "repos/o/alpha/releases?per_page=30": [] });
  const r = await cli(["run", ...at(state, "2026-11-14")], d, cat);
  assert.equal(r.code, 0, r.err);
  assert.equal(d.run.count(/^claude -p/), 0);
  const result = readJson(join(state, "runs", "2026-11-14", "result.json"));
  assert.deepEqual(result.changes.map((c) => [c.key, c.risky, c.notRead]), [
    ["zeta/cli", true, "release notes could not be fetched (gh api failed: HTTP 404: Not Found)"],
    ["alpha/cli", false, "no release notes found"],
    ["beta/cli", false, "release notes could not be fetched (gh api failed: HTTP 404: Not Found)"],
  ]);
  assert.match(r.out, /\nUpdates, 14 Nov: 3 changes, 2 could not be read\n/);
  assert.ok(r.out.includes("\nZeta 1.0.0 -> 2.0.0, not installed, may need a change (major version or breaking notes)\n- Not read: release notes could not be fetched (gh api failed: HTTP 404: Not Found).\n"), r.out);
  assert.ok(r.out.includes("\nAlpha 1.0.0 -> 1.1.0, not installed\n- No release notes found.\n"));
  assert.ok(r.out.includes("\nBeta 1.0.0 -> 1.1.0, not installed\n- Not read: release notes could not be fetched (gh api failed: HTTP 404: Not Found).\n"));
});

test("one run at a time: a lock younger than 30 minutes stops a run and every stage; an older one is replaced", async (t) => {
  const state = tmp(t);
  const lock = join(state, "run.lock");
  const held = JSON.stringify({ pid: 99999, started: new Date(Date.now() - 5 * 60_000).toISOString() });
  writeFileSync(lock, held);
  const busy = await cli(["run", ...at(state, "2026-11-13")], fakes());
  assert.equal(busy.code, 1);
  assert.match(busy.err, /another run is in progress/);
  for (const stage of ["inventory", "compare", "connect", "read", "report"]) {
    const r = await cli([stage, ...at(state, "2026-11-13")], fakes());
    assert.equal(r.code, 1, stage);
    assert.match(r.err, /another run is in progress/);
  }
  assert.equal(readFileSync(lock, "utf8"), held); // another run's lock is left alone
  assert.deepEqual(readdirSync(state), ["run.lock"]);
  writeFileSync(lock, JSON.stringify({ pid: 99999, started: new Date(Date.now() - 31 * 60_000).toISOString() }));
  const r = await cli(["run", ...at(state, "2026-11-13")], fakes());
  assert.equal(r.code, 0, r.err);
  assert.ok(!existsSync(lock));
});

test("--today needs --state, and may not be earlier than the last run", async (t) => {
  const noState = await cli(["run", "--home", HOME, "--today", "2026-11-13"], fakes());
  assert.equal(noState.code, 2);
  assert.match(noState.err, /--today needs --state/);
  const state = tmp(t);
  assert.equal((await cli(["run", ...at(state, "2026-11-14")], fakes())).code, 0);
  const before = readFileSync(join(state, "state.json"), "utf8");
  const back = await cli(["run", ...at(state, "2026-11-13")], fakes());
  assert.equal(back.code, 2);
  assert.match(back.err, /earlier than the last run \(2026-11-14\)/);
  assert.equal(readFileSync(join(state, "state.json"), "utf8"), before);
  assert.ok(!existsSync(join(state, "runs", "2026-11-13")));
});

test("usage errors exit 2 and change nothing", async (t) => {
  const state = tmp(t);
  for (const args of [
    ["run", "--today", "13-11-2026"], ["run", "--today", "2026-02-30"], ["nope"], [], ["run", "--bogus"], ["run", "--out"], ["run", "extra"],
  ]) {
    const r = await cli([...args, "--home", HOME, "--state", state], fakes());
    assert.equal(r.code, 2, JSON.stringify(args));
    assert.equal(r.out, "");
    assert.match(r.err, /^updates\.mjs: /);
  }
  assert.deepEqual(readdirSync(state), []);
});

test("the stages run one at a time on one run folder", async (t) => {
  const state = tmp(t);
  const out = join(state, "manual");
  const f = fakes();
  for (const stage of ["inventory", "compare", "connect", "read"]) {
    const r = await cli([stage, ...at(state, "2026-11-13", "--out", out)], f);
    assert.equal(r.code, 0, `${stage}: ${r.err}`);
  }
  assert.ok(!existsSync(join(state, "state.json")));
  const r = await cli(["report", ...at(state, "2026-11-13", "--out", out)], f);
  assert.equal(r.code, 0, r.err);
  assert.ok(r.out.startsWith(`${join(out, "report.md")}\n`));
  assert.equal(readJson(join(state, "state.json")).lastRun, "2026-11-13");
  // A stage whose input is missing fails with exit 1.
  const lost = await cli(["compare", ...at(state, "2026-11-13", "--out", join(state, "empty"))], f);
  assert.equal(lost.code, 1);
  assert.match(lost.err, /inventory\.json/);
});

test("an offline day on the real catalog: one 'all N feeds failed' line and nothing marked seen", async (t) => {
  const state = tmp(t);
  const offline = {
    fetcher: async () => { throw new Error("fetch failed"); },
    gh: async () => ({ code: 1, stdout: "", stderr: "error connecting to api.github.com" }),
    run: async () => ({ code: 1, stdout: "", stderr: "offline" }),
  };
  const r = await cli(["run", ...at(state, "2026-11-13", "--no-read")], offline, null);
  assert.equal(r.code, 0, r.err);
  const result = readJson(join(state, "runs", "2026-11-13", "result.json"));
  assert.equal(result.couldNotCheck[0].key, ALL_FEEDS);
  assert.match(r.out, /\nCould not check\n- all \d+ feeds failed: [^\n]+\n/);
  assert.equal((r.out.match(/feeds failed/g) ?? []).length, 1);
  assert.ok(Object.values(readJson(join(state, "state.json")).parts).every((p) => p.latest === null));
});

test("recipeSection: the Cookbook section the recipe names, up to the next heading of its level", () => {
  const text = "# Cookbook\n\n## Recipes\n\n### Alpha\nalpha body\n```\n### not a heading\n```\n#### Detail\nmore\n### Beta\nbeta\n## Multi (`x-*`)\nmulti body\n### Inner\ninner\n## End\n";
  assert.equal(recipeSection(text, "Alpha"), "### Alpha\nalpha body\n```\n### not a heading\n```\n#### Detail\nmore");
  assert.equal(recipeSection(text, "Multi (`x-*`)"), "## Multi (`x-*`)\nmulti body\n### Inner\ninner");
  assert.equal(recipeSection(text, "End"), "## End");
  assert.equal(recipeSection(text, "Missing"), "");
  assert.equal(recipeSection(text, null), "");
});

// ---- fix round 1 (Task 8): pages under context-mode's 4,096-byte cut -------------------

import { PAGE_BYTES, labelOf, reportPages } from "../plugins/cookbook/skills/stack-updates/scripts/updates.mjs";

const utf8 = (s) => Buffer.byteLength(s, "utf8");
const bodyOf = (page) => page.slice(page.indexOf("\n") + 1);
const FILE = "C:/state/runs/2026-11-23/report.md";

test("reportPages: a report that fits is printed as before, the path and then the text", () => {
  const text = "Updates, 23 Nov: 1 broken\n\nBroken\n- X: down\n";
  assert.deepEqual(reportPages(FILE, text), [`${FILE}\n${text}`]);
  assert.ok(PAGE_BYTES < 4096, "a page stays under context-mode's 4,096-byte replace trigger");
});

test("reportPages: a long report is cut at line ends into pages of at most PAGE_BYTES bytes, each saying which page it is", () => {
  const lines = ["Updates, 23 Nov: 40 changes", ""];
  for (let i = 0; i < 40; i++) lines.push(`Tool ${i} 1.0.${i} -> 1.0.${i + 1}, pinned copy`, "- Changed: ünïcödé text, långer than plain ASCII, so bytes and characters differ.", "- Link: https://www.npmjs.com/package/x", "");
  const text = `${lines.join("\n")}\n`;
  const pages = reportPages(FILE, text);
  assert.ok(pages.length >= 2);
  pages.forEach((p, i) => {
    assert.ok(utf8(p) <= PAGE_BYTES, `page ${i + 1} is ${utf8(p)} bytes`);
    assert.equal(p.split("\n")[0], i === 0 ? `Page 1 of ${pages.length}: ${FILE}` : `Page ${i + 1} of ${pages.length}`);
  });
  assert.equal(pages.map(bodyOf).join(""), text, "the pages hold the whole report, in order, nothing added");
});

test("reportPages: a line longer than a page is cut at character boundaries, never inside a character", () => {
  const long = `${"é".repeat(2500)}😀${"x".repeat(10)}`;
  const pages = reportPages(FILE, `Updates\n${long}\n`);
  const pieces = pages.map(bodyOf).join("").split("\n").filter(Boolean).slice(1);
  assert.ok(pages.every((p) => utf8(p) <= PAGE_BYTES && p.isWellFormed()));
  assert.equal(pieces.join(""), long);
});

test("labelOf: a part named after the package it tracks reads 'tool / package'; other single parts read as the tool", () => {
  const ab = { id: "agent-browser", name: "agent-browser", parts: [{ name: "playwright-core", installed: { kind: "pinned", folder: "site-login", package: "playwright-core" } }] };
  assert.equal(labelOf({ tool: ab, part: ab.parts[0] }), "agent-browser / playwright-core");
  const fc = { id: "firecrawl", name: "Firecrawl", parts: [{ name: "cli", installed: { kind: "pinned", folder: "firecrawl-cli", package: "firecrawl-cli" } }] };
  assert.equal(labelOf({ tool: fc, part: fc.parts[0] }), "Firecrawl");
  const two = { id: "browserbase", name: "Browserbase", parts: [{ name: "cli", installed: { kind: "pinned", folder: "b", package: "browse" } }, { name: "service", installed: { kind: "hosted" } }] };
  assert.equal(labelOf({ tool: two, part: two.parts[0] }), "Browserbase cli");
});

test("a long report: run prints page 1 with the page count, `page <n>` prints the rest from today's report.md, and nothing else is accepted", async (t) => {
  const state = tmp(t);
  const ids = Array.from({ length: 30 }, (_, i) => `t${String(i + 1).padStart(2, "0")}`);
  const cat = {
    version: 1, ignored: [],
    tools: ids.map((id) => tool(id, `Tool ${id}`, [{ name: "cli", installed: { kind: "none" }, feed: { kind: "github", repository: `o/${id}` } }])),
  };
  const gh = (v) => Object.fromEntries(ids.map((id) => [`repos/o/${id}/releases/latest`, { tag_name: `v${v}`, draft: false, prerelease: false }]));
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], { ...fakes(), gh: fakeGh(gh("1.0.0")) }, cat)).code, 0);
  const r = await cli(["run", ...at(state, "2026-11-14", "--no-read")], { ...fakes(), gh: fakeGh(gh("1.1.0")) }, cat);
  assert.equal(r.code, 0, r.err);
  const file = join(state, "runs", "2026-11-14", "report.md");
  const text = readFileSync(file, "utf8");
  assert.ok(utf8(text) > PAGE_BYTES);
  const first = /^Page 1 of (\d+): (.+)\n/.exec(r.out);
  assert.ok(first, r.out.slice(0, 120));
  const n = Number(first[1]);
  assert.equal(first[2], file);
  assert.ok(utf8(r.out) <= PAGE_BYTES);
  const pages = [r.out];
  for (let k = 2; k <= n; k++) {
    const p = await cli(["page", String(k), ...at(state, "2026-11-14")], {}, cat);
    assert.equal(p.code, 0, p.err);
    assert.ok(utf8(p.out) <= PAGE_BYTES);
    assert.ok(p.out.startsWith(`Page ${k} of ${n}\n`));
    pages.push(p.out);
  }
  assert.equal(pages.map(bodyOf).join(""), text);
  // page 1 again equals what run printed; --no-read is accepted and changes nothing.
  assert.equal((await cli(["page", "1", ...at(state, "2026-11-14", "--no-read")], {}, cat)).out, r.out);
  // Out of range, not a small whole number, or with --out: a usage error, nothing printed.
  for (const bad of [String(n + 1), "0", "01", "x", "100", "-1"]) {
    const b = await cli(["page", bad, ...at(state, "2026-11-14")], {}, cat);
    assert.equal(b.code, 2, `page ${bad}`);
    assert.equal(b.out, "");
  }
  assert.equal((await cli(["page", "2", ...at(state, "2026-11-14"), "--out", state], {}, cat)).code, 2);
  assert.equal((await cli(["page"], {}, cat)).code, 2);
  // No report for that day: an error, not an empty page.
  const none = await cli(["page", "1", ...at(state, "2026-11-15")], {}, cat);
  assert.equal(none.code, 1);
  assert.match(none.err, /no report\.md for 2026-11-15/);
});

// ---- final review fixes --------------------------------------------------------

test("notesRepository: the part's notes, else the tool's repository as owner/name or exactly its github.com address", () => {
  const t = (repository) => ({ repository });
  const p = (notes) => ({ feed: { kind: "npm", package: "x" }, ...(notes === undefined ? {} : { notes }) });
  assert.equal(notesRepository(t("o/r"), p()), "o/r");
  for (const url of ["https://github.com/o/r", "https://github.com/o/r/", "https://github.com/o/r.git"]) assert.equal(notesRepository(t(url), p()), "o/r", url);
  for (const bad of ["", "http://github.com/o/r", "https://www.github.com/o/r", "https://github.com/o", "https://github.com/o/r/tree/main",
    "git+https://github.com/o/r.git", "https://github.com/o/r.git/", "https://github.com/o/r?x=1", "https://github.com/../r", " o/r", undefined]) {
    assert.equal(notesRepository(t(bad), p()), null, String(bad));
  }
  // The part's own notes source comes before the tool's repository.
  assert.equal(notesRepository(t("o/r"), p({ kind: "github", repository: "a/b" })), "a/b");
  assert.equal(notesRepository(t("o/r"), p({ kind: "npm", repository: "a/b" })), null);
});

test("every active or trial part with an npm feed has a repository for its release notes, or a reason it has none", () => {
  const real = JSON.parse(readFileSync(new URL("../plugins/cookbook/catalog.json", import.meta.url), "utf8"));
  // npm publishes no notes. These two are released from a monorepo whose release tags are
  // "<package>@x.y.z", which no reader here follows (checked 14 November 2026).
  const KNOWN_NONE = {
    "browserbase/cli": "browse is released from browserbase/stagehand, tagged browse@x.y.z",
    "wrangler/cli": "wrangler is released from cloudflare/workers-sdk, tagged wrangler@x.y.z",
  };
  const parts = real.tools.filter((x) => x.lifecycle === "active" || x.lifecycle === "trial")
    .flatMap((x) => x.parts.filter((p) => p.feed.kind === "npm").map((p) => ({ key: `${x.id}/${p.name}`, repo: notesRepository(x, p) })));
  assert.deepEqual(parts.filter((p) => p.repo === null).map((p) => p.key).sort(), Object.keys(KNOWN_NONE).sort());
  for (const reason of Object.values(KNOWN_NONE)) assert.ok(reason.length > 0);
  const repoOf = (key) => parts.find((p) => p.key === key)?.repo;
  assert.equal(repoOf("1c9ccea9-8ebf-4d9c-9512-38e6890ea5b6/cli"), "anthropics/claude-code"); // Claude Code
  assert.equal(repoOf("agent-browser/playwright-core"), "microsoft/playwright"); // the tool's github.com address
  assert.equal(repoOf("firecrawl/cli"), "firecrawl/cli");
  assert.equal(repoOf("parallel/cli"), "parallel-web/parallel-web-tools");
  assert.equal(repoOf("shopify-cli/cli"), "Shopify/cli");
});

test("a tool whose repository is its github.com address gets its release notes from there", async (t) => {
  const state = tmp(t);
  const cat = { version: 1, ignored: [], tools: [
    tool("gizmo", "Gizmo", [{ name: "cli", installed: { kind: "none" }, feed: { kind: "npm", package: "gizmo-cli" } }], { repository: "https://github.com/o/gizmo" }),
  ] };
  const npm = (version) => fakeFetch({ "https://registry.npmjs.org/gizmo-cli/latest": { version } });
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], { ...fakes(), fetcher: npm("1.0.0") }, cat)).code, 0);
  const d = { ...fakes(), fetcher: npm("1.1.0"), gh: fakeGh({ "repos/o/gizmo/releases?per_page=30": [{ tag_name: "v1.1.0", draft: false, prerelease: false, body: "GIZMO-NOTES: a new flag." }] }) };
  const r = await cli(["run", ...at(state, "2026-11-14")], d, cat);
  assert.equal(r.code, 0, r.err);
  const folder = join(state, "runs", "2026-11-14");
  const result = readJson(join(folder, "result.json"));
  assert.deepEqual(result.changes.map((c) => [c.key, c.textFile, c.notRead]), [["gizmo/cli", "texts/gizmo-cli.txt", null]]);
  assert.match(readFileSync(join(folder, "texts", "gizmo-cli.txt"), "utf8"), /GIZMO-NOTES/);
  assert.equal(d.run.count(/^claude -p/), 1);
});

test("inert: an entity-encoded link or address cannot be decoded into one", () => {
  assert.equal(inert("https&#58;//evil.test"), String.raw`https\&#58;//evil.test`);
  assert.equal(inert("www&#46;evil&#46;test"), String.raw`www\&#46;evil\&#46;test`);
  assert.equal(inert("a & b"), String.raw`a \& b`);
});

test("a report too long to page fails before the state is saved: state.json is untouched", async (t) => {
  const state = tmp(t);
  assert.equal((await cli(["run", ...at(state, "2026-11-13")], fakes())).code, 0);
  const before = readFileSync(join(state, "state.json"), "utf8");
  // 220 missing parts whose names are 400 four-byte characters: two lines a page, more than 99 pages.
  const wide = "\u{1F600}".repeat(400);
  const many = Array.from({ length: 220 }, (_, i) => tool(`gone-${i}`, wide,
    [{ name: "cli", installed: { kind: "pinned", folder: `gone-${i}`, package: "gone" }, feed: { kind: "none", reason: "fixture" } }]));
  const r = await cli(["run", ...at(state, "2026-11-14")], fakes(), { ...CAT, tools: [...CAT.tools, ...many] });
  assert.equal(r.code, 1);
  assert.match(r.err, /more than 99 pages/);
  assert.equal(readFileSync(join(state, "state.json"), "utf8"), before, "the baseline did not move");
});
