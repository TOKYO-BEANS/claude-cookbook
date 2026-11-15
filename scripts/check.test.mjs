// The Cookbook's own consistency check: the tool file and the recipes agree.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OTHER_TEXTS, PAGE_READ_LIMIT, SKILL_LIMIT, checkCookbook, readCost, readPages } from "./check.mjs";
import { CHANGELOG_HOSTS, SELF_UPDATING_TOOLS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const catalogText = read("plugins/cookbook/catalog.json");
const skillText = read("plugins/cookbook/skills/cookbook/SKILL.md");
const catalog = JSON.parse(catalogText);
const withTools = (fn) => JSON.stringify({ ...catalog, tools: fn(structuredClone(catalog.tools)) });
const pages = readPages(new URL("../plugins/cookbook/skills/cookbook/", import.meta.url));
const errors = (o = {}) => checkCookbook({ catalogText, skillText, pages, ...o });
const withPage = (name, fn) => pages.map((p) => (p.name === name ? { name, text: fn(p.text) } : p));

test("the real files pass", () => {
  assert.deepEqual(errors(), []);
  assert.ok(catalog.tools.length >= 50);
});

test("file shape", () => {
  assert.deepEqual(errors({ catalogText: "{" }), ["catalog.json does not parse"]);
  assert.match(errors({ catalogText: '{"version":2,"tools":[]}' })[0], /exactly/);
});

test("ids are unique", () => {
  const text = withTools((t) => [...t, t[0]]);
  assert.ok(errors({ catalogText: text }).some((e) => /duplicate id/.test(e)));
});

test("every recipe heading is the title of a page in recipes/", () => {
  const text = withTools((t) => (t.find((x) => x.id === "parallel").recipe = "No such heading", t));
  assert.ok(errors({ catalogText: text }).some((e) => /\(parallel\): recipe heading names no page title/.test(e)));
  // A title that only an options page carries does not count.
  const options = withTools((t) => (t.find((x) => x.id === "parallel").recipe = "Options weighed: ship", t));
  assert.ok(errors({ catalogText: options }).some((e) => /\(parallel\): recipe heading names no page title/.test(e)));
});

test("the map: a row cannot point to a recipe file that does not exist", () => {
  const skill = skillText.replace("(recipes/boat.md)", "(recipes/no-such-page.md)");
  assert.notEqual(skill, skillText);
  assert.ok(errors({ skillText: skill }).some((e) => e === "SKILL.md: link to recipes/no-such-page.md, which does not exist"));
  // The same when the page itself is gone.
  const gone = errors({ pages: pages.filter((p) => p.name !== "recipes/boat.md") });
  assert.ok(gone.some((e) => e === "SKILL.md: link to recipes/boat.md, which does not exist"));
});

test("the map: every row has an owner, a fallback and a recipe page, a dash or 'being built'", () => {
  const row = (r) => skillText.replace("| **Keep healthy** | | | |", `| **Keep healthy** | | | |\n${r}`);
  assert.deepEqual(errors({ skillText: row("| A new job | someone | — | — |") }), []);
  assert.deepEqual(errors({ skillText: row("| A new job | someone | — | being built |") }), []);
  assert.ok(errors({ skillText: row("| A new job | someone | — | see the wiki |") }).some((e) => /row "A new job" names no recipe page/.test(e)));
  assert.ok(errors({ skillText: row("| A new job | someone | — | |") }).some((e) => /row "A new job" names no recipe page/.test(e)));
  assert.ok(errors({ skillText: row("| A new job | | — | — |") }).some((e) => /row "A new job" has no owner/.test(e)));
  assert.ok(errors({ skillText: row("| A new job | someone | | — |") }).some((e) => /row "A new job" has no fallback/.test(e)));
  assert.ok(errors({ skillText: row("| A new job | someone | — |") }).some((e) => /row "A new job" needs 4 cells/.test(e)));
  // Only a bold job cell makes a group heading: a job row left blank is reported, not skipped.
  const blank = errors({ skillText: row("| A new job | | | |") });
  assert.ok(blank.some((e) => /row "A new job" has no owner/.test(e)) && blank.some((e) => /row "A new job" has no fallback/.test(e)));
  assert.ok(blank.some((e) => /row "A new job" names no recipe page/.test(e)));
  assert.deepEqual(errors({ skillText: row("| **A new group** | | | |") }), []);
  assert.ok(errors({ skillText: row("| A new job | someone | — | [why](options/ship.md) |") }).some((e) => /a recipe page is in recipes\//.test(e)));
  assert.ok(errors({ skillText: skillText.replace("## The map", "## Choosing") }).some((e) => /no "## The map" section/.test(e)));
});

test("pages: a link between pages resolves, and every page is reached from SKILL.md", () => {
  const broken = withPage("recipes/boat.md", (t) => `${t}\nSee [x](missing.md).\n`);
  assert.ok(errors({ pages: broken }).some((e) => e === "recipes/boat.md: link to missing.md, which does not exist"));
  const orphan = [...pages, { name: "recipes/orphan.md", text: "# An orphan\n\nNothing links here.\n" }];
  assert.ok(errors({ pages: orphan }).some((e) => e === "recipes/orphan.md: no map row or page links to it"));
  // Reached through another page, not only from the map.
  assert.ok(!skillText.includes("boat-setup.md") && pages.some((p) => p.name === "recipes/boat-setup.md"));
  // A link out of the skill folder or to another site is not a page link.
  assert.deepEqual(errors({ pages: withPage("recipes/boat.md", (t) => `${t}\n[doc](https://example.com/a.md)\n`) }), []);
});

test("the stack-updates skill's update table names recipe pages by their exact titles", () => {
  const titles = new Set(pages.filter((p) => p.name.startsWith("recipes/")).map((p) => /^# (.+)\r?\n/.exec(p.text)[1].trim()));
  const skill = read("plugins/cookbook/skills/stack-updates/SKILL.md").replace(/\r/g, "");
  const table = skill.slice(skill.indexOf("| Kind | What to do | Recipe |"));
  const rows = table.split("\n").filter((l) => l.startsWith("|")).slice(2);
  assert.ok(rows.length >= 5);
  const named = rows.flatMap((r) => [...r.split("|").at(-2).matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  assert.ok(named.length >= 6);
  for (const n of named) assert.ok(titles.has(n), `"${n}" is not the title of a page in recipes/`);
  // The steps are on the page the row names: an update row never points at a page without them.
  const body = (title) => pages.find((p) => p.text.startsWith(`# ${title}\n`) || p.text.startsWith(`# ${title}\r\n`)).text;
  for (const n of named.filter((x) => /setup|mods|terminal proxy/.test(x))) assert.match(body(n), /update/i, n);
});

test("pages: each fits one Read, has its own title and a plain name; SKILL.md stays an index", () => {
  const long = withPage("recipes/seo.md", (t) => `${t}${"x".repeat(60)}\n`.repeat(40));
  assert.ok(errors({ pages: long }).some((e) => /^recipes\/seo\.md: \d+ bytes as a Read result, over 4000: split the page$/.test(e)));
  assert.equal(readCost("ab\ncd\n"), 6 + 9 * 3);
  for (const p of pages) assert.ok(readCost(p.text.replace(/\r/g, "")) <= PAGE_READ_LIMIT, p.name);
  assert.ok(errors({ pages: withPage("recipes/seo.md", (t) => t.replace(/^# .+\n/, "")) }).some((e) => /seo\.md: must start with a "# Title" line/.test(e)));
  const twin = withPage("recipes/seo.md", (t) => t.replace(/^# .+\n/, "# Cloudflare\n"));
  assert.ok(errors({ pages: twin }).some((e) => /same title as/.test(e)));
  assert.ok(errors({ pages: [...pages, { name: "notes/Extra.md", text: "# Extra\n" }] }).some((e) => /notes\/Extra\.md: a page is/.test(e)));
  assert.ok(errors({ pages: withPage("recipes/seo.md", (t) => `${t}\nCosts $5.\n`) }).some((e) => /recipes\/seo\.md line \d+: dollar sign before a digit/.test(e)));
  const fat = `${skillText}\n${"word ".repeat(SKILL_LIMIT / 5)}`;
  assert.ok(errors({ skillText: fat }).some((e) => /^SKILL\.md is \d+ bytes, over 14000/.test(e)));
});

test("field rules", () => {
  assert.ok(broken({ extra: 1 }).some((e) => /unknown field extra/.test(e)));
  assert.ok(broken({ category: "Other" }).some((e) => /category/.test(e)));
  assert.ok(broken({ website: "http://git-scm.com/" }).some((e) => /website/.test(e)));
  assert.ok(broken({ lifecycle: "retiring" }).some((e) => /lifecycle/.test(e)));
  assert.ok(broken({ uses: ["node"] }).some((e) => /only workflows list uses/.test(e)));
  assert.ok(broken({ source: "github", repository: "" }).some((e) => /owner\/name/.test(e)));
});

const P = (name, extra = {}) => ({ name, installed: { kind: "command" }, feed: { kind: "none", reason: "test" }, ...extra });
const broken = (patch, id = "git") =>
  errors({ catalogText: withTools((t) => (Object.assign(t.find((x) => x.id === id), patch), t)) });
const part = (patch) =>
  errors({ catalogText: withTools((t) => ((t.find((x) => x.id === "git").parts[0] = { ...t.find((x) => x.id === "git").parts[0], ...patch }), t)) });
const withTop = (patch) => JSON.stringify({ ...catalog, ...patch });

test("parts: every tool has at least one, names are unique", () => {
  assert.ok(broken({ parts: [] }).some((e) => /at least one part/.test(e)));
  assert.ok(broken({ parts: [P("cli"), P("cli")] }).some((e) => /duplicate part cli/.test(e)));
  assert.ok(broken({ feed: { kind: "npm", package: "x" } }).some((e) => /unknown field feed/.test(e)));
});
test("installed: only known kinds and each kind's own fields", () => {
  assert.ok(part({ installed: { kind: "script" } }).some((e) => /installed kind/.test(e)));
  assert.ok(part({ installed: { kind: "command", run: "x --version" } }).some((e) => /installed field run is not allowed/.test(e)));
  assert.ok(part({ installed: { kind: "pinned", folder: "../x", package: "x" } }).some((e) => /installed folder/.test(e)));
  assert.ok(part({ installed: { kind: "project", repository: "a/b" } }).some((e) => /installed package/.test(e)));
});
test("feed: known kinds, own fields, changelog host on the allow list", () => {
  assert.ok(part({ feed: { kind: "pypi" } }).some((e) => /feed kind/.test(e)));
  assert.ok(part({ feed: { kind: "changelog", url: "http://x.test/" } }).some((e) => /feed url/.test(e)));
  assert.ok(part({ feed: { kind: "changelog", url: "https://evil.test/log" } }).some((e) => /feed host evil.test is not on the allow list/.test(e)));
  assert.ok(part({ feed: { kind: "none" } }).some((e) => /feed none needs a reason/.test(e)));
  assert.ok(part({ feed: { kind: "marketplace", repository: "a/b" } }).some((e) => /feed plugin/.test(e)));
  assert.ok(Object.isFrozen(CHANGELOG_HOSTS) && Array.isArray(CHANGELOG_HOSTS));
});
test("feed: a changelog page on an allowed host passes; the same path on another host does not", () => {
  // On a hosted part: a changelog feed follows nothing else (see "a changelog feed is allowed only on a hosted or none part").
  const onHosted = (feed) => errors({ catalogText: withTools((t) => ((t.find((x) => x.id === "browserbase").parts.find((p) => p.name === "service").feed = feed), t)) });
  for (const host of CHANGELOG_HOSTS) assert.deepEqual(onHosted({ kind: "changelog", url: `https://${host}/changelog` }), [], host);
  assert.ok(part({ feed: { kind: "changelog", url: "https://browserbase.com/changelog" } }).some((e) => /feed host browserbase.com is not on the allow list/.test(e)));
  assert.ok(part({ feed: { kind: "changelog", url: "https://www.browserbase.com/changelog?page=2" } }).some((e) => /feed url/.test(e)));
});
test("the real catalog keeps the shapes the first real run corrected (13 November 2026)", () => {
  const partOf = (id, name) => catalog.tools.find((t) => t.id === id).parts.find((p) => p.name === name);
  // The OpenSEO plugin's version is its manifest's (1.0.x), not the app's GitHub releases (0.1.x).
  assert.equal(partOf("openseo", "plugin").feed.kind, "marketplace");
  // Safe Chain is a CI pin: the Claude plugin's version (1.2.x) is not Safe Chain's (1.5.x).
  assert.equal(partOf("aikido", "safe-chain").installed.kind, "none");
  assert.equal(partOf("aikido", "safe-chain").feed.repository, "AikidoSec/safe-chain");
  // Wix updates itself and its version is outside the folders the check reads: an npm release is not a change.
  assert.equal(partOf("wix", "plugin").feed.kind, "none");
  // Only the folder that records its source gets a feed.
  assert.deepEqual(partOf("shopify-theme-skills", "themes").feed, { kind: "commit", repository: "Shopify/liquid-skills", path: "plugins/liquid-skills/skills/shopify-liquid-themes" });
  assert.equal(partOf("shopify-theme-skills", "standards").feed.kind, "none");
  assert.equal(partOf("browserbase", "service").feed.url, "https://www.browserbase.com/changelog");
});
test("the real catalog keeps the shapes of review fix round 1", () => {
  const partOf = (id, name) => catalog.tools.find((t) => t.id === id).parts.find((p) => p.name === name);
  // The local Semgrep (a uv tool) and the standard's CI pin are two installs: only the local one is followed here.
  const cli = partOf("semgrep", "cli");
  assert.equal(cli.installed.kind, "command");
  assert.match(cli.feed.updater, /uv tool upgrade semgrep/);
  assert.doesNotMatch(cli.feed.updater, /standard bump/);
  assert.deepEqual(partOf("semgrep", "ci-pin"), {
    name: "ci-pin", installed: { kind: "none" },
    feed: { kind: "none", reason: "the standard's pin moves through a standard bump; the standard's own daily run reports it" },
  });
  // agent-browser's part tracks the library it is built on, and is named after it.
  const ab = catalog.tools.find((t) => t.id === "agent-browser");
  assert.deepEqual(ab.parts.map((p) => p.name), ["playwright-core"]);
  assert.equal(ab.parts[0].installed.package, "playwright-core");
});
test("no dollar sign before a digit in the plugin's other skill bodies", () => {
  const found = errors({ otherTexts: [{ name: "skills/x/SKILL.md", text: "Rules\r\nIt costs $5 a day." }] });
  assert.deepEqual(found, ['skills/x/SKILL.md line 2: dollar sign before a digit (write "${1}" or USD 30)']);
  assert.deepEqual(errors({ otherTexts: [{ name: "a.md", text: 'Use "${1}" and USD 20.' }] }), []);
  // The real files named by OTHER_TEXTS pass.
  assert.deepEqual(errors({ otherTexts: OTHER_TEXTS.map((p) => ({ name: p, text: read(p) })) }), []);
  assert.deepEqual([...OTHER_TEXTS], ["plugins/cookbook/skills/stack-updates/SKILL.md"]);
});
test("feed: each kind's own fields and values", () => {
  assert.deepEqual(part({ feed: { kind: "npm", package: "@scope/name", tag: "stable", updater: "x" } }), []);
  assert.deepEqual(part({ feed: { kind: "jevModels" } }), []);
  assert.deepEqual(part({ feed: { kind: "commit", repository: "a/b", path: "skills/x" } }), []);
  assert.ok(part({ feed: "npm" }).some((e) => /feed must be an object/.test(e)));
  assert.ok(part({ feed: { kind: "toString" } }).some((e) => /feed kind/.test(e)));
  assert.ok(part({ feed: { kind: "npm", package: "Not A Name" } }).some((e) => /feed package/.test(e)));
  assert.ok(part({ feed: { kind: "npm", package: "x", tag: "next" } }).some((e) => /feed tag/.test(e)));
  assert.ok(part({ feed: { kind: "github", repository: "https://github.com/a/b" } }).some((e) => /feed repository/.test(e)));
  assert.ok(part({ feed: { kind: "gitForWindows", repository: "a/b" } }).some((e) => /feed field repository is not allowed/.test(e)));
  assert.ok(part({ feed: { kind: "nodeDist", url: "https://x.test/" } }).some((e) => /feed field url is not allowed/.test(e)));
  assert.ok(part({ feed: { kind: "jevModels", updater: "x".repeat(201) } }).some((e) => /feed updater/.test(e)));
  assert.ok(part({ name: "Bad Name" }).some((e) => /part name/.test(e)));
});
test("lifecycle watching, dates and ignored", () => {
  assert.deepEqual(broken({ lifecycle: "watching" }), []);
  assert.ok(broken({ dates: [{ label: "Trial ends", on: "19 Nov" }] }).some((e) => /date on must be YYYY-MM-DD/.test(e)));
  // An impossible date of the right shape is an error line, not a crash.
  assert.ok(broken({ dates: [{ label: "Trial ends", on: "2026-13-45" }] }).some((e) => /date on must be YYYY-MM-DD/.test(e)));
  assert.ok(errors({ catalogText: withTop({ ignored: [{ name: "ruff" }] }) }).some((e) => /ignored entry needs a reason/.test(e)));
});

test("a bold first choice must name a listed tool", () => {
  const skill = skillText.replace("**Graphify**", "**Sourcegraph**");
  assert.ok(errors({ skillText: skill }).some((e) => /"Sourcegraph" names no tool/.test(e)));
});

test("a tool with a recipe is named in the skill", () => {
  const text = withTools((t) => (t.find((x) => x.id === "openseo").name = "Open SEO Pro", t));
  assert.ok(errors({ catalogText: text }).some((e) => /\(openseo\): name not mentioned/.test(e)));
});

test("no dollar sign before a digit: Claude Code fills it with an argument", () => {
  assert.ok(errors({ skillText: `${skillText}\nCosts $5.` }).some((e) => /line \d+: dollar sign before a digit/.test(e)));
  assert.deepEqual(errors({ skillText: `${skillText}\nUse "\${1}", $ARGUMENTS and USD 30.` }), []);
});

test("version commands: every key names a command part and every command part has a key", () => {
  const good = { "git/cli": { argv: ["git", "--version"], pattern: /(\d+)/ } };
  const all = Object.fromEntries(catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind === "command").map((p) => [`${t.id}/${p.name}`, good["git/cli"]])));
  assert.deepEqual(errors({ commands: all }), []);
  assert.ok(errors({ commands: { ...all, "ghost/cli": good["git/cli"] } }).some((e) => /names no part/.test(e)));
  const notCommand = catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind !== "command").map((p) => `${t.id}/${p.name}`))[0];
  assert.ok(errors({ commands: { ...all, [notCommand]: good["git/cli"] } }).some((e) => /not command/.test(e)));
  const { "git/cli": _drop, ...missing } = all;
  assert.ok(errors({ commands: missing }).some((e) => /git\/cli has no version command/.test(e)));
});

test("self-updating tools: each id names a tool in the catalog", () => {
  assert.ok(Object.isFrozen(SELF_UPDATING_TOOLS));
  const names = SELF_UPDATING_TOOLS.map((id) => catalog.tools.find((t) => t.id === id)?.name);
  assert.deepEqual(names.sort(), ["Adobe for creativity", "Claude Code", "Wix"]);
  assert.deepEqual(errors({ selfUpdating: [...SELF_UPDATING_TOOLS] }), []);
  assert.ok(errors({ selfUpdating: [...SELF_UPDATING_TOOLS, "ghost"] }).some((e) => /self-updating tools: ghost names no tool/.test(e)));
});

test("version commands: argv[0] is a bare name or {share}/ without .., and {share}, {bin} and {lib} are the only tokens", () => {
  const all = Object.fromEntries(catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind === "command").map((p) => [`${t.id}/${p.name}`, { argv: ["git", "--version"], pattern: /(\d+)/ }])));
  const withArgv = (argv) => errors({ commands: { ...all, "git/cli": { argv, pattern: /(\d+)/ } } });
  assert.deepEqual(withArgv(["{share}/boat/boat.exe", "--version"]), []);
  assert.ok(withArgv(["{share}/../evil.exe"]).some((e) => /bare command name/.test(e)));
  assert.ok(withArgv(["{share}/a/../b.exe"]).some((e) => /bare command name/.test(e)));
  assert.ok(withArgv(["/abs/git"]).some((e) => /bare command name/.test(e)));
  assert.ok(withArgv(["git", "{home}/x"]).some((e) => /unknown token/.test(e)));
});

test("version commands: {bin}/ and the fixed cmd.exe shape are allowed; .., a second token and other cmd.exe forms are not", () => {
  const all = Object.fromEntries(catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind === "command").map((p) => [`${t.id}/${p.name}`, { argv: ["git", "--version"], pattern: /(\d+)/ }])));
  const withArgv = (argv) => errors({ commands: { ...all, "git/cli": { argv, pattern: /(\d+)/ } } });
  assert.deepEqual(withArgv(["cmd.exe", "/d", "/c", "{bin}/boat.cmd", "limits"]), []);
  assert.deepEqual(withArgv(["node", "{bin}/with-key.mjs", "k", "E", "node", "{lib}/cloudflare-verify.mjs"]), []);
  assert.deepEqual(withArgv(["{bin}/tool.exe", "--version"]), []);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{bin}/../evil.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{bin}/a/b.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{share}/x.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{bin}/x.exe"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/k", "{bin}/boat.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/c", "{bin}/boat.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "echo", "{bin}/boat.cmd"]).length > 0);
  assert.ok(withArgv(["cmd.exe"]).length > 0);
  assert.ok(withArgv(["cmd", "/d", "/c", "{bin}/boat.cmd"]).length > 0);
  assert.ok(withArgv(["powershell", "-File", "x"]).length > 0);
  assert.ok(withArgv(["{bin}/../x.exe"]).length > 0);
  assert.ok(withArgv(["{bin}/a/b.exe"]).length > 0);
  assert.ok(withArgv(["git", "{bin}/{share}/x"]).some((e) => /unknown token/.test(e)));
  assert.ok(withArgv(["git", "{share}/a/{bin}/b"]).some((e) => /unknown token/.test(e)));
  assert.ok(withArgv(["git", "--x={share}/a"]).some((e) => /unknown token/.test(e)));
  assert.ok(withArgv(["git", "{bin}/../x"]).some((e) => /unknown token/.test(e)));
});

const goodCheck = { argv: ["gh", "api", "user"], ok: /\S/ };
test("connection checks: every key names a tool id", () => {
  assert.deepEqual(errors({ checks: { github: goodCheck } }), []);
  assert.ok(errors({ checks: { github: goodCheck, ghost: goodCheck } }).some((e) => /connection checks: ghost names no tool/.test(e)));
});
test("connection checks: at most one entry is paid", () => {
  assert.deepEqual(errors({ checks: { github: { ...goodCheck, paid: true }, depot: goodCheck } }), []);
  assert.ok(errors({ checks: { github: { ...goodCheck, paid: true }, depot: { ...goodCheck, paid: true } } }).some((e) => /connection checks: at most one check may be paid/.test(e)));
});
test("connection checks: argv follows the table rules and ok is a RegExp", () => {
  assert.ok(errors({ checks: { github: { argv: ["cmd.exe", "/k", "x"], ok: /x/ } } }).some((e) => /connection checks: github/.test(e)));
  assert.ok(errors({ checks: { github: { argv: ["gh", "{home}/x"], ok: /x/ } } }).some((e) => /unknown token/.test(e)));
  assert.ok(errors({ checks: { github: { argv: ["gh"], ok: "x" } } }).some((e) => /ok must be a RegExp/.test(e)));
  assert.ok(errors({ checks: { github: { argv: ["gh"], ok: /x/, paid: "yes" } } }).some((e) => /paid must be true/.test(e)));
});

test("connection checks: no token after the cmd.exe shim", () => {
  assert.deepEqual(errors({ checks: { github: { argv: ["cmd.exe", "/d", "/c", "{bin}/boat.cmd", "limits"], ok: /x/ } } }), []);
  assert.ok(errors({ checks: { github: { argv: ["cmd.exe", "/d", "/c", "{bin}/boat.cmd", "{share}/x"], ok: /x/ } } }).some((e) => /token after the shim/.test(e)));
  assert.ok(errors({ checks: { github: { argv: ["cmd.exe", "/d", "/c", "{bin}/boat.cmd", "{lib}/x"], ok: /x/ } } }).some((e) => /token after the shim/.test(e)));
});

// ---- final review fixes --------------------------------------------------------

// The Browserbase service part: hosted, with the one changelog feed left in the catalog.
const hosted = (patch) =>
  errors({ catalogText: withTools((t) => (Object.assign(t.find((x) => x.id === "browserbase").parts.find((p) => p.name === "service"), patch), t)) });

test("a changelog feed is allowed only on a hosted or none part, and the error names the part", () => {
  const page = { kind: "changelog", url: "https://www.browserbase.com/changelog" };
  assert.deepEqual(hosted({ feed: page }), []);
  assert.deepEqual(hosted({ installed: { kind: "none" }, feed: page }), []);
  const onCommand = part({ feed: page }); // git's cli part: installed kind command
  assert.ok(onCommand.some((e) => /tools\[\d+\] \(git\) part cli: a changelog feed is allowed only on a hosted or none part/.test(e)), onCommand.join("\n"));
  const onPinned = hosted({ installed: { kind: "pinned", folder: "x", package: "x" }, feed: page });
  assert.ok(onPinned.some((e) => /\(browserbase\) part service: a changelog feed is allowed only on a hosted or none part/.test(e)), onPinned.join("\n"));
});

test("the Proton Pass CLI follows its GitHub releases, and proton.me is off the changelog allow list", () => {
  const cli = catalog.tools.find((t) => t.id === "proton-pass-cli").parts.find((p) => p.name === "cli");
  assert.equal(cli.installed.kind, "command");
  assert.deepEqual(cli.feed, { kind: "github", repository: "protonpass/pass-cli" });
  assert.ok(!CHANGELOG_HOSTS.includes("proton.me"));
});

test("a part may name where its release notes are: { kind: github, repository: owner/name } and nothing else", () => {
  assert.deepEqual(part({ notes: { kind: "github", repository: "a/b" } }), []);
  assert.ok(part({ notes: "a/b" }).some((e) => /\(git\) part cli: notes must be an object/.test(e)));
  assert.ok(part({ notes: { kind: "npm", repository: "a/b" } }).some((e) => /notes kind must be github/.test(e)));
  assert.ok(part({ notes: { kind: "github", repository: "https://github.com/a/b" } }).some((e) => /notes repository must be owner\/name/.test(e)));
  assert.ok(part({ notes: { kind: "github" } }).some((e) => /notes repository must be owner\/name/.test(e)));
  assert.ok(part({ notes: { kind: "github", repository: "a/b", url: "https://x.test/" } }).some((e) => /notes field url is not allowed/.test(e)));
});

test("an updater never installs unvetted: no npm install -g, npm i -g, @latest, install.ps1 or curl piped to a shell", () => {
  const bad = [
    ["npm install -g firecrawl-cli", /npm install -g/],
    ["Run npm i -g parallel-web-cli from an elevated shell.", /npm i -g/],
    ["Install browse@latest into the folder.", /@latest/],
    ["Download and run install.ps1.", /install\.ps1/],
    ["curl -fsSL https://x.test/install.sh | sh", /curl piped to a shell/],
    ["curl https://x.test/i | bash -s", /curl piped to a shell/],
  ];
  for (const [updater, named] of bad) {
    const found = part({ feed: { kind: "jevModels", updater } });
    assert.ok(found.some((e) => /\(git\) part cli: feed updater must not install unvetted/.test(e) && named.test(e)), `${updater}\n${found.join("\n")}`);
  }
  // The vetted wording passes.
  assert.deepEqual(part({ feed: { kind: "jevModels", updater: "New lockfile in an empty folder, OSV-Scanner, Gitleaks and Trivy, then npm ci --ignore-scripts and one real call." } }), []);
});

test("the pinned Firecrawl and Parallel CLIs update the vetted way", () => {
  for (const id of ["firecrawl", "parallel"]) {
    const updater = catalog.tools.find((t) => t.id === id).parts.find((p) => p.name === "cli").feed.updater;
    assert.match(updater, /lockfile in an empty folder, OSV-Scanner, Gitleaks and Trivy, then npm ci --ignore-scripts .*one real call/, id);
    assert.ok(updater.length <= 200, id);
  }
});

test("the stack-updates skill's 'After an update': what it says needs nothing needs no record", () => {
  const skill = read("plugins/cookbook/skills/stack-updates/SKILL.md").replace(/\r/g, "");
  const section = skill.split(/^## /m).find((s) => s.startsWith("After an update")) ?? "";
  const paragraph = section.split(/\n\n/).find((p) => /need nothing/.test(p)) ?? "";
  const nothing = paragraph.replace(/\n/g, " ").split(/(?<=\.) /).find((s) => /need nothing/.test(s)) ?? "";
  assert.match(nothing, /^Registry plugins.*need nothing/, "the sentence saying what needs nothing");
  // A skill copy or a local plugin port has nothing on disk that says its commit: it needs a record.
  const needsRecord = (p) => p.installed.kind === "skill" || (p.installed.kind === "plugin" && p.installed.id.endsWith("@claude-local"));
  for (const [, name] of nothing.matchAll(/`([^`]+)`/g)) {
    const [id, partName] = name.split("/");
    const t = catalog.tools.find((x) => x.id === id);
    if (!t) continue; // not a catalog name
    const parts = partName ? t.parts.filter((p) => p.name === partName) : t.parts;
    assert.ok(parts.length, name);
    for (const p of parts) assert.ok(!needsRecord(p), `"${name}" is said to need nothing, but ${t.id}/${p.name} needs a record`);
  }
  assert.match(section, /`jev-router\/plugin`[^.]*`record`/);
});

test("argv patterns: a literal dot before cmd, and no shell metacharacter or whitespace in any element", () => {
  const all = Object.fromEntries(catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind === "command").map((p) => [`${t.id}/${p.name}`, { argv: ["git", "--version"], pattern: /(\d+)/ }])));
  const withArgv = (argv) => errors({ commands: { ...all, "git/cli": { argv, pattern: /(\d+)/ } } });
  assert.ok(withArgv(["cmd.exe", "/d", "/c", "{bin}/a_cmd"]).length > 0, "{bin}/a_cmd is not a .cmd shim");
  assert.ok(withArgv(["{share}/boat/boat_exe"]).length === 0); // a bare name may hold any of [A-Za-z0-9._-]
  for (const bad of ["a&b", "a|b", "a<b", "a>b", "a^b", "%PATH%", "a!b", 'a"b', "a b", "a\tb"]) {
    assert.ok(withArgv(["git", bad]).some((e) => /shell metacharacter or whitespace/.test(e)), bad);
    assert.ok(errors({ checks: { github: { argv: ["cmd.exe", "/d", "/c", "{bin}/boat.cmd", bad], ok: /x/ } } }).some((e) => /connection checks: github .*shell metacharacter or whitespace/.test(e)), bad);
  }
  assert.ok(withArgv(["gi&t", "--version"]).length > 0);
  // The real tables pass.
  assert.deepEqual(errors(), []);
});
