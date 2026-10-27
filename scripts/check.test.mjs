// The Cookbook's own consistency check: the tool file and the recipes agree.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkCookbook } from "./check.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const catalogText = read("plugins/cookbook/catalog.json");
const skillText = read("plugins/cookbook/skills/cookbook/SKILL.md");
const catalog = JSON.parse(catalogText);
const withTools = (fn) => JSON.stringify({ ...catalog, tools: fn(structuredClone(catalog.tools)) });
const errors = (o = {}) => checkCookbook({ catalogText, skillText, ...o });

test("the real files pass", () => {
  assert.deepEqual(errors(), []);
  assert.equal(catalog.tools.length, 32);
});

test("file shape", () => {
  assert.deepEqual(errors({ catalogText: "{" }), ["catalog.json does not parse"]);
  assert.match(errors({ catalogText: '{"version":2,"tools":[]}' })[0], /exactly/);
});

test("ids are unique", () => {
  const text = withTools((t) => [...t, t[0]]);
  assert.ok(errors({ catalogText: text }).some((e) => /duplicate id/.test(e)));
});

test("every recipe heading exists", () => {
  const text = withTools((t) => (t.find((x) => x.id === "parallel").recipe = "No such heading", t));
  assert.ok(errors({ catalogText: text }).some((e) => /\(parallel\): recipe heading/.test(e)));
});

test("field rules", () => {
  const broken = (patch) =>
    errors({ catalogText: withTools((t) => (Object.assign(t.find((x) => x.id === "git"), patch), t)) });
  assert.ok(broken({ extra: 1 }).some((e) => /unknown field extra/.test(e)));
  assert.ok(broken({ category: "Other" }).some((e) => /category/.test(e)));
  assert.ok(broken({ website: "http://git-scm.com/" }).some((e) => /website/.test(e)));
  assert.ok(broken({ lifecycle: "retiring" }).some((e) => /lifecycle/.test(e)));
  assert.ok(broken({ uses: ["node"] }).some((e) => /only workflows list uses/.test(e)));
  assert.ok(broken({ source: "github", repository: "" }).some((e) => /owner\/name/.test(e)));
});

test("feeds: only on vendor tools, only each kind's own fields", () => {
  assert.equal(catalog.tools.filter((t) => "feed" in t).length, 11);
  const withFeed = (id, feed) =>
    errors({ catalogText: withTools((t) => ((t.find((x) => x.id === id).feed = feed), t)) });
  assert.deepEqual(withFeed("graphify", { kind: "jevModels" }), []);
  assert.deepEqual(withFeed("graphify", { kind: "npm", package: "@scope/name", tag: "stable", updater: "x" }), []);
  assert.ok(withFeed("node", { kind: "github", repository: "nodejs/node" }).some((e) => /\(node\): npm and github tools already have a feed/.test(e)));
  assert.ok(withFeed("graphify", "npm").some((e) => /feed must be an object/.test(e)));
  assert.ok(withFeed("graphify", { kind: "pypi" }).some((e) => /feed kind must be/.test(e)));
  assert.ok(withFeed("graphify", { kind: "toString" }).some((e) => /feed kind must be/.test(e)));
  assert.ok(withFeed("graphify", { kind: "npm", package: "Not A Name" }).some((e) => /feed package/.test(e)));
  assert.ok(withFeed("graphify", { kind: "npm", package: "x", tag: "next" }).some((e) => /feed tag/.test(e)));
  assert.ok(withFeed("graphify", { kind: "github", repository: "https://github.com/a/b" }).some((e) => /feed repository/.test(e)));
  assert.ok(withFeed("graphify", { kind: "gitForWindows", repository: "a/b" }).some((e) => /feed field repository is not allowed/.test(e)));
  assert.ok(withFeed("graphify", { kind: "jevModels", url: "https://x.test/" }).some((e) => /feed field url is not allowed/.test(e)));
  assert.ok(withFeed("graphify", { kind: "jevModels", updater: "x".repeat(201) }).some((e) => /feed updater/.test(e)));
});

test("a bold first choice must name a listed tool", () => {
  const skill = skillText.replace("**Graphify**", "**Sourcegraph**");
  assert.ok(errors({ skillText: skill }).some((e) => /"Sourcegraph" names no tool/.test(e)));
});

test("a tool with a recipe is named in the skill", () => {
  const text = withTools((t) => (t.find((x) => x.id === "openseo").name = "Open SEO Pro", t));
  assert.ok(errors({ catalogText: text }).some((e) => /\(openseo\): name not mentioned/.test(e)));
});
