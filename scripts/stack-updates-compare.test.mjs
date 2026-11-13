// Run by `npm test` (node --test). `compare` is pure: these tests feed it a small
// catalog, installed and latest records and yesterday's state, day by day in
// November 2026 (the 16th and the 23rd are Mondays). Only `loadState` and
// `saveState` touch the disk, in a temporary folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ALL_FEEDS, READ_LIMIT, compare, compareVersions, isQuiet, isRisky, loadState, saveState,
} from "../plugins/cookbook/skills/stack-updates/scripts/lib/compare.mjs";
import { SELF_UPDATING_TOOLS } from "../plugins/cookbook/skills/stack-updates/scripts/lib/tables.mjs";

const CLAUDE = "1c9ccea9-8ebf-4d9c-9512-38e6890ea5b6"; // Claude Code's tool id in catalog.json
const CC = `${CLAUDE}/cli`;
const tool = (id, name, parts, lifecycle = "active") => ({ id, name, lifecycle, parts });
const part = (name, installed, feed) => ({ name, installed, feed });
const CATALOG = {
  version: 1,
  ignored: [],
  tools: [
    tool("browse", "Browserbase", [part("cli", { kind: "pinned", folder: "browserbase", package: "browse" }, { kind: "npm", package: "browse" })]),
    tool("alpha", "Alpha", [part("plugin", { kind: "plugin", id: "alpha@market" }, { kind: "marketplace", repository: "o/alpha", plugin: "alpha" })]),
    tool(CLAUDE, "Claude Code", [part("cli", { kind: "command" }, { kind: "npm", package: "@anthropic-ai/claude-code" })]),
    tool("watch", "Watched", [part("watch", { kind: "none" }, { kind: "npm", package: "watched" })], "watching"),
    tool("graph", "Graph service", [part("mcp", { kind: "hosted", server: "graph" }, { kind: "changelog", url: "https://changelog.test/" })]),
    tool("skilly", "Skilly", [part("skill", { kind: "skill", folder: "skilly" }, { kind: "commit", repository: "o/skilly" })]),
    tool("plain", "Plain", [part("skill", { kind: "skill", folder: "plain" }, { kind: "none", reason: "no public source" })]),
  ],
};
const SHA = (c) => c.repeat(40);
const read = (version, extra = {}) => ({ state: "read", version, ...extra });
const ok = (fields) => ({ ok: true, source: "https://source.test/", ...fields });
const failed = (message = "fetch failed") => ({ ok: false, message });
const stray = { kind: "plugin", name: "stray@market" };

// Everything installed and up to date.
const INSTALLED = {
  "browse/cli": read("0.11.3"),
  "alpha/plugin": read("1.2.0", { commit: SHA("a") }),
  [CC]: read("2.1.0"),
  "watch/watch": { state: "none" },
  "graph/mcp": { state: "hosted" },
  "skilly/skill": read("0123456789abcdef"),
  "plain/skill": read("fedcba9876543210"),
};
const LATEST = {
  "browse/cli": ok({ version: "0.11.3" }),
  "alpha/plugin": ok({ version: "1.2.0", commit: SHA("b") }),
  [CC]: ok({ version: "2.1.0" }),
  "watch/watch": ok({ version: "1.0.0" }),
  "graph/mcp": ok({ hash: "h1" }),
  "skilly/skill": ok({ commit: SHA("c") }),
  "plain/skill": { ok: true, source: "" },
};

// One run: today's records are the defaults with `installed`, `latest` and the unlisted items patched in.
function day(today, state, { installed = {}, latest = {}, unlisted = [], unreadable = [] } = {}) {
  return compare({
    catalog: CATALOG,
    installed: { ...INSTALLED, ...installed },
    latest: { ...LATEST, ...latest },
    unlisted: { items: unlisted, unreadable },
    state,
    today,
  });
}
const nothing = { items: [], unreadable: [] };
const NONE_HELD = { couldNotCheck: 0, stillBehind: 0, unlisted: 0, missing: 0 };
const held = (counts) => ({ ...NONE_HELD, ...counts });

test("first run: baseline, reports only what is already behind, unlisted, missing", () => {
  const { result, state } = day("2026-11-13", null, {
    installed: { "alpha/plugin": { state: "not-found", message: "not in the plugin registry" } },
    latest: { "browse/cli": ok({ version: "0.11.4" }), [CC]: ok({ version: "2.1.5" }), "skilly/skill": ok({ commit: SHA("d") }) },
    unlisted: [stray],
  });
  assert.equal(result.firstRun, true);
  assert.equal(result.date, "2026-11-13");
  assert.deepEqual(result.changes, []);
  // Claude Code is behind its feed too, but it updates itself; the skill copy's position is unknown.
  assert.deepEqual(result.stillBehind, [{ key: "browse/cli", installed: "0.11.3", latest: "0.11.4", since: "2026-11-13" }]);
  assert.deepEqual(result.missing, [{ key: "alpha/plugin" }]);
  assert.deepEqual(result.unlisted, [stray]);
  assert.deepEqual(result.couldNotCheck, []);
  assert.deepEqual([result.broken, result.unchecked, result.dates], [[], [], []]);
  assert.deepEqual(result.suppressed, NONE_HELD);
  assert.equal(result.weekly, null);
  assert.equal(result.quiet, false);
  // The baseline: what was seen is remembered, nothing is marked reported.
  assert.equal(state.version, 1);
  assert.equal(state.lastRun, "2026-11-13");
  assert.equal(state.lastMonday, "2026-11-09");
  assert.deepEqual(state.week, { runs: 1, changes: 0 });
  assert.deepEqual(state.parts["browse/cli"], {
    installed: "0.11.3", latest: "0.11.4", reported: null, behindSince: "2026-11-13",
    feedErrorSince: null, feedErrorShown: null, installedCommit: null,
  });
  assert.equal(state.parts[CC].installed, "2.1.0");
  assert.equal(state.parts[CC].latest, "2.1.5");
  assert.equal(state.parts[CC].behindSince, null);
  assert.equal(state.parts["watch/watch"].latest, "1.0.0");
  assert.equal(state.parts["graph/mcp"].latest, "h1");
  assert.equal(state.parts["skilly/skill"].latest, SHA("d"));
  assert.equal(state.parts["skilly/skill"].behindSince, null);
  assert.deepEqual(state.missing, { "alpha/plugin": "2026-11-13" });
  assert.deepEqual(state.unlisted, { "plugin:stray@market": "2026-11-13" });
  // A feed that cannot be read is said on the first run too: a baseline never implies "up to date".
  const failing = day("2026-11-13", null, { latest: { "skilly/skill": failed("gh api failed: HTTP 404") } });
  assert.deepEqual(failing.result.couldNotCheck, [{ key: "skilly/skill", message: "gh api failed: HTTP 404", since: "2026-11-13" }]);
  assert.equal(failing.state.parts["skilly/skill"].latest, null);
});

test("a new release is a change once, in full", () => {
  const d1 = day("2026-11-13", null);
  assert.deepEqual(d1.result.changes, []);
  const newer = {
    latest: {
      "browse/cli": ok({ version: "0.11.4", source: "https://www.npmjs.com/package/browse/v/0.11.4" }),
      "watch/watch": ok({ version: "1.1.0" }),
      "graph/mcp": ok({ hash: "h2" }),
      "skilly/skill": ok({ commit: SHA("d") }),
    },
  };
  const d2 = day("2026-11-14", d1.state, newer);
  assert.deepEqual(d2.result.changes.find((c) => c.key === "browse/cli"), {
    key: "browse/cli", tool: "browse", part: "cli", kind: "new-release", from: "0.11.3", to: "0.11.4",
    installedKind: "pinned", risky: false, source: "https://www.npmjs.com/package/browse/v/0.11.4",
    textFile: null, answers: null, notRead: null,
  });
  // A watching tool, a hosted page and a skill copy with no recorded commit: a change the first time they move.
  const pick = (k) => {
    const c = d2.result.changes.find((x) => x.key === k);
    return c && [c.kind, c.from, c.to, c.installedKind];
  };
  assert.deepEqual(pick("watch/watch"), ["new-release", "1.0.0", "1.1.0", "none"]);
  assert.deepEqual(pick("graph/mcp"), ["new-release", "h1", "h2", "hosted"]);
  assert.deepEqual(pick("skilly/skill"), ["new-release", SHA("c"), SHA("d"), "skill"]);
  assert.equal(d2.result.changes.length, 4);
  assert.equal(d2.result.firstRun, false);
  assert.equal(d2.state.parts["browse/cli"].reported, "0.11.4");
  assert.equal(d2.state.parts["browse/cli"].behindSince, "2026-11-14");
  assert.deepEqual(d2.state.week, { runs: 2, changes: 4 });
  const d3 = day("2026-11-15", d2.state, newer);
  assert.deepEqual(d3.result.changes, []);
  assert.deepEqual(d3.result.stillBehind, []); // a Sunday: the reminder waits for Monday
  assert.equal(d3.result.quiet, true);
});

test("still behind: one line on the first run on or after Monday", () => {
  const newer = { latest: { "browse/cli": ok({ version: "0.11.4" }), "watch/watch": ok({ version: "1.1.0" }), "graph/mcp": ok({ hash: "h2" }) } };
  const fri = day("2026-11-13", null);
  const sat = day("2026-11-14", fri.state, newer);
  assert.equal(sat.result.changes.length, 3);
  assert.deepEqual(sat.result.suppressed, NONE_HELD); // reported in full today, not held back
  const sun = day("2026-11-15", sat.state, newer);
  assert.deepEqual(sun.result.stillBehind, []);
  assert.deepEqual(sun.result.suppressed, held({ stillBehind: 1 }));
  assert.equal(sun.result.quiet, true); // held back is not news
  const mon = day("2026-11-16", sun.state, newer);
  // Only the installed part: a watching tool and a hosted page are never behind.
  assert.deepEqual(mon.result.stillBehind, [{ key: "browse/cli", installed: "0.11.3", latest: "0.11.4", since: "2026-11-14" }]);
  assert.deepEqual(mon.result.changes, []);
  assert.deepEqual(mon.result.suppressed, NONE_HELD);
  const tue = day("2026-11-17", mon.state, newer);
  assert.deepEqual(tue.result.stillBehind, []);
  assert.deepEqual(tue.result.suppressed, held({ stillBehind: 1 }));
  // No run on the Monday: the Tuesday run shows it.
  const tueOnly = day("2026-11-17", sun.state, newer);
  assert.deepEqual(tueOnly.result.stillBehind.map((s) => s.key), ["browse/cli"]);
  // Updated on Wednesday: no longer behind, and the next Monday has nothing to remind.
  const updated = { ...newer, installed: { "browse/cli": read("0.11.4") } };
  const wed = day("2026-11-18", tue.state, updated);
  assert.equal(wed.state.parts["browse/cli"].behindSince, null);
  assert.deepEqual(wed.result.changes, []);
  const mon2 = day("2026-11-23", wed.state, updated);
  assert.deepEqual(mon2.result.stillBehind, []);
  assert.equal(mon2.result.quiet, true);
});

test("a self-updating tool: a change when the installed version moves, marked installed-changed", () => {
  assert.ok(SELF_UPDATING_TOOLS.includes(CLAUDE));
  const d1 = day("2026-11-13", null);
  const source = "https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.2";
  const moved = { installed: { [CC]: read("2.1.2") }, latest: { [CC]: ok({ version: "2.1.2", source }) } };
  const d2 = day("2026-11-14", d1.state, moved);
  assert.deepEqual(d2.result.changes, [{
    key: CC, tool: CLAUDE, part: "cli", kind: "installed-changed", from: "2.1.0", to: "2.1.2",
    installedKind: "command", risky: false, source, textFile: null, answers: null, notRead: null,
  }]);
  assert.equal(d2.state.parts[CC].installed, "2.1.2");
  const d3 = day("2026-11-15", d2.state, moved);
  assert.deepEqual(d3.result.changes, []);
  // A major version that arrived by itself is still marked risky.
  const d4 = day("2026-11-16", d3.state, { installed: { [CC]: read("3.0.0") }, latest: { [CC]: ok({ version: "3.0.0" }) } });
  assert.deepEqual(d4.result.changes.map((c) => [c.kind, c.from, c.to, c.risky]), [["installed-changed", "2.1.2", "3.0.0", true]]);
});

test("a self-updating tool rolled back and forward again is not reported twice", () => {
  const at = (v) => ({ installed: { [CC]: read(v) }, latest: { [CC]: ok({ version: "2.1.3" }) } });
  const d1 = day("2026-11-13", null, at("2.1.0"));
  const d2 = day("2026-11-14", d1.state, at("2.1.2"));
  assert.deepEqual(d2.result.changes.map((c) => [c.kind, c.from, c.to]), [["installed-changed", "2.1.0", "2.1.2"]]);
  const d3 = day("2026-11-15", d2.state, at("2.1.0")); // rolled back
  assert.deepEqual(d3.result.changes, []);
  const d4 = day("2026-11-16", d3.state, at("2.1.2")); // forward again: already reported
  assert.deepEqual(d4.result.changes, []);
  assert.equal(d4.state.parts[CC].reported, "2.1.2");
  const d5 = day("2026-11-17", d4.state, at("2.1.3")); // a version not reported before
  assert.deepEqual(d5.result.changes.map((c) => [c.kind, c.from, c.to]), [["installed-changed", "2.1.2", "2.1.3"]]);
});

test("a release that arrives already installed is reported once, as installed-changed", () => {
  const at = (inst, lat) => ({ installed: { "browse/cli": read(inst) }, latest: { "browse/cli": ok({ version: lat }) } });
  const d1 = day("2026-11-13", null, at("1.0.0", "1.0.0"));
  assert.deepEqual(d1.result.changes, []); // the baseline reports no change
  const d2 = day("2026-11-14", d1.state, at("1.1.0", "1.1.0"));
  assert.deepEqual(d2.result.changes, [{
    key: "browse/cli", tool: "browse", part: "cli", kind: "installed-changed", from: "1.0.0", to: "1.1.0",
    installedKind: "pinned", risky: false, source: "https://source.test/", textFile: null, answers: null, notRead: null,
  }]);
  assert.equal(d2.state.parts["browse/cli"].reported, "1.1.0");
  assert.equal(d2.state.parts["browse/cli"].behindSince, null);
  const d3 = day("2026-11-15", d2.state, at("1.1.0", "1.1.0"));
  assert.deepEqual(d3.result.changes, []);
  // Installed before the feed showed it: compared from the release seen before, never from itself.
  const e1 = day("2026-11-13", null, at("1.1.0", "1.0.0"));
  const e2 = day("2026-11-14", e1.state, at("1.1.0", "1.1.0"));
  assert.deepEqual(e2.result.changes.map((c) => [c.kind, c.from, c.to]), [["installed-changed", "1.0.0", "1.1.0"]]);
  // Installed newer than the new release: not this release, so no change.
  const f1 = day("2026-11-13", null, at("1.2.0", "1.0.0"));
  assert.deepEqual(day("2026-11-14", f1.state, at("1.2.0", "1.1.0")).result.changes, []);
  // A commit feed whose new commit was recorded before the check saw it: refs from the last commit seen.
  const recorded = structuredClone(d1.state);
  recorded.parts["skilly/skill"].installedCommit = SHA("d");
  const g = day("2026-11-14", recorded, { latest: { "skilly/skill": ok({ commit: SHA("d") }) } });
  assert.deepEqual(
    g.result.changes.map((c) => [c.key, c.kind, c.from, c.to, c.fromRef, c.toRef]),
    [["skilly/skill", "installed-changed", SHA("c"), SHA("d"), SHA("c"), SHA("d")]],
  );
  // Not for a part with no readable installed version: a watching tool's release stays a new release.
  const w = day("2026-11-14", d1.state, { latest: { "watch/watch": ok({ version: "1.1.0" }) } });
  assert.deepEqual(w.result.changes.map((c) => [c.key, c.kind]), [["watch/watch", "new-release"]]);
});

test("a failing feed on a Monday still shows the remembered still-behind line", () => {
  const behind = { latest: { "browse/cli": ok({ version: "0.11.4" }) } };
  const fri = day("2026-11-13", null, behind);
  const line = { key: "browse/cli", installed: "0.11.3", latest: "0.11.4", since: "2026-11-13" };
  const mon = day("2026-11-16", fri.state, { latest: { "browse/cli": failed("Provider returned HTTP 503") } });
  assert.deepEqual(mon.result.stillBehind, [line]);
  assert.deepEqual(mon.result.couldNotCheck.map((c) => c.key), ["browse/cli"]);
  assert.equal(mon.state.parts["browse/cli"].behindSince, "2026-11-13");
  const tue = day("2026-11-17", mon.state, { latest: { "browse/cli": failed("Provider returned HTTP 503") } });
  assert.deepEqual(tue.result.stillBehind, []);
  assert.deepEqual(tue.result.suppressed, held({ stillBehind: 1, couldNotCheck: 1 }));
  // Every feed failing on the Monday: one could-not-check line, and the remembered line still.
  const offline = Object.fromEntries(Object.entries(LATEST).map(([k, v]) => [k, k === "plain/skill" ? v : failed("fetch failed")]));
  const monOff = day("2026-11-16", fri.state, { latest: offline });
  assert.deepEqual(monOff.result.stillBehind, [line]);
  assert.deepEqual(monOff.result.couldNotCheck.map((c) => c.key), [ALL_FEEDS]);
});

test("a self-updating tool: a newer release that has not arrived is not a change", () => {
  const d1 = day("2026-11-13", null);
  const waiting = { latest: { [CC]: ok({ version: "2.1.3" }) } };
  const d2 = day("2026-11-14", d1.state, waiting);
  assert.deepEqual(d2.result.changes, []);
  assert.equal(d2.state.parts[CC].latest, "2.1.3");
  const mon = day("2026-11-16", d2.state, waiting);
  assert.deepEqual(mon.result.stillBehind, []); // never "still behind": it updates itself
  // When it arrives, the change covers the old and the new installed version.
  const tue = day("2026-11-17", mon.state, { installed: { [CC]: read("2.1.3") }, latest: { [CC]: ok({ version: "2.1.3" }) } });
  assert.deepEqual(tue.result.changes.map((c) => [c.key, c.kind, c.from, c.to]), [[CC, "installed-changed", "2.1.0", "2.1.3"]]);
});

test("unlisted and missing: the first day, then Mondays", () => {
  const gone = { "alpha/plugin": { state: "not-found", message: "not in the plugin registry" } };
  const other = { kind: "skill", name: "other" };
  const fri = day("2026-11-13", null, { installed: gone, unlisted: [stray] });
  assert.deepEqual([fri.result.missing, fri.result.unlisted], [[{ key: "alpha/plugin" }], [stray]]);
  assert.deepEqual(fri.result.suppressed, NONE_HELD);
  const sat = day("2026-11-14", fri.state, { installed: gone, unlisted: [stray, other] });
  assert.deepEqual([sat.result.missing, sat.result.unlisted], [[], [other]]); // only the new one
  assert.deepEqual(sat.result.suppressed, held({ unlisted: 1, missing: 1 }));
  const sun = day("2026-11-15", sat.state, { installed: gone, unlisted: [stray, other] });
  assert.deepEqual([sun.result.missing, sun.result.unlisted], [[], []]);
  assert.deepEqual(sun.result.suppressed, held({ unlisted: 2, missing: 1 }));
  const mon = day("2026-11-16", sun.state, { installed: gone, unlisted: [other, stray] });
  assert.deepEqual(mon.result.missing, [{ key: "alpha/plugin" }]);
  assert.deepEqual(mon.result.unlisted, [stray, other]);
  assert.deepEqual(mon.result.suppressed, NONE_HELD);
  const tue = day("2026-11-17", mon.state, { installed: gone, unlisted: [stray, other] });
  assert.deepEqual([tue.result.missing, tue.result.unlisted], [[], []]);
  // A source that could not be read leaves what is remembered alone.
  const partial = day("2026-11-18", tue.state, { installed: gone, unlisted: [], unreadable: ["claude mcp list: timed out"] });
  assert.deepEqual(partial.state.unlisted, { "plugin:stray@market": "2026-11-13", "skill:other": "2026-11-14" });
  // Installed again, or listed in the catalog: forgotten, so a later return is new again.
  const thu = day("2026-11-19", partial.state, { unlisted: [] });
  assert.deepEqual([thu.state.unlisted, thu.state.missing], [{}, {}]);
  assert.deepEqual([thu.result.missing, thu.result.unlisted], [[], []]);
  const fri2 = day("2026-11-20", thu.state, { unlisted: [stray] });
  assert.deepEqual(fri2.result.unlisted, [stray]);
});

test("could not check: the first day, then weekly, and state.latest is untouched", () => {
  const fri = day("2026-11-13", null);
  const down = { latest: { "browse/cli": failed("Provider returned HTTP 503") } };
  const sat = day("2026-11-14", fri.state, down);
  assert.deepEqual(sat.result.couldNotCheck, [{ key: "browse/cli", message: "Provider returned HTTP 503", since: "2026-11-14" }]);
  assert.equal(sat.result.quiet, false);
  assert.deepEqual(sat.state.parts["browse/cli"], { ...fri.state.parts["browse/cli"], feedErrorSince: "2026-11-14", feedErrorShown: "2026-11-14" });
  assert.deepEqual(sat.result.suppressed, NONE_HELD);
  let s = sat.state;
  for (const d of ["2026-11-15", "2026-11-16", "2026-11-20"]) {
    const r = day(d, s, down);
    assert.deepEqual(r.result.couldNotCheck, [], d);
    assert.deepEqual(r.result.suppressed, held({ couldNotCheck: 1 }), d); // held back, and counted
    s = r.state;
  }
  const week = day("2026-11-21", s, down);
  assert.deepEqual(week.result.couldNotCheck, [{ key: "browse/cli", message: "Provider returned HTTP 503", since: "2026-11-14" }]);
  assert.equal(week.state.parts["browse/cli"].latest, "0.11.3");
  // Back: the release that appeared meanwhile is still news, and the error is forgotten.
  const back = day("2026-11-22", week.state, { latest: { "browse/cli": ok({ version: "0.11.4" }) } });
  assert.deepEqual(back.result.changes.map((c) => [c.key, c.from, c.to]), [["browse/cli", "0.11.3", "0.11.4"]]);
  assert.deepEqual(back.result.couldNotCheck, []);
  assert.equal(back.state.parts["browse/cli"].feedErrorSince, null);
  // An installed version that cannot be read, or was not read at all, is "could not check" too.
  const unread = day("2026-11-24", back.state, {
    installed: { "plain/skill": { state: "unreadable", message: "EACCES: permission denied" }, "skilly/skill": undefined },
  });
  assert.deepEqual(unread.result.couldNotCheck, [
    { key: "plain/skill", message: "EACCES: permission denied", since: "2026-11-24" },
    { key: "skilly/skill", message: "the installed version was not read", since: "2026-11-24" },
  ]);
  assert.equal(unread.state.parts["plain/skill"].installed, back.state.parts["plain/skill"].installed);
  // A failure with no message is still a failure.
  const blank = day("2026-11-24", back.state, { latest: { "graph/mcp": { ok: false, message: "" } }, installed: { "plain/skill": { state: "unreadable", message: "" } } });
  assert.deepEqual(blank.result.couldNotCheck, [
    { key: "graph/mcp", message: "the feed could not be read", since: "2026-11-24" },
    { key: "plain/skill", message: "the installed version could not be read", since: "2026-11-24" },
  ]);
});

test("all feeds failing collapses to one could-not-check entry with the count", () => {
  const fri = day("2026-11-13", null);
  // `plain/skill` has feed kind none: it needs no network and stays ok.
  const offline = Object.fromEntries(Object.entries(LATEST).map(([k, v]) => [k, k === "plain/skill" ? v : failed("fetch failed")]));
  offline["graph/mcp"] = failed("getaddrinfo ENOTFOUND changelog.test");
  const sat = day("2026-11-14", fri.state, { latest: offline, installed: { [CC]: read("2.1.2") } });
  assert.equal(ALL_FEEDS, "all feeds");
  assert.deepEqual(sat.result.couldNotCheck, [{ key: ALL_FEEDS, message: "all 6 feeds failed: fetch failed", since: "2026-11-14", count: 6 }]);
  assert.deepEqual(sat.result.changes, []);
  assert.equal(sat.result.quiet, false);
  // Nothing is marked seen: every part keeps what it had, the installed version included.
  const kept = (st) => Object.fromEntries(Object.entries(st.parts).map(([k, p]) => [k, [p.installed, p.latest, p.reported, p.behindSince]]));
  assert.deepEqual(kept(sat.state), kept(fri.state));
  // No line named a part, so none counts as shown: a partial recovery names the ones still failing.
  assert.ok(Object.values(sat.state.parts).every((p) => p.feedErrorShown === null));
  const partial = day("2026-11-15", sat.state, { latest: { "browse/cli": failed("fetch failed") } });
  assert.deepEqual(partial.result.couldNotCheck, [{ key: "browse/cli", message: "fetch failed", since: "2026-11-14" }]);
  // Still offline the next day: one line again, since a run that read nothing is never quiet.
  const sun = day("2026-11-15", sat.state, { latest: offline, installed: { [CC]: read("2.1.2") } });
  assert.deepEqual(sun.result.couldNotCheck, [{ key: ALL_FEEDS, message: "all 6 feeds failed: fetch failed", since: "2026-11-14", count: 6 }]);
  // Online again: the self-update that happened meanwhile is reported once.
  const mon = day("2026-11-16", sun.state, { installed: { [CC]: read("2.1.2") }, latest: { [CC]: ok({ version: "2.1.2" }) } });
  assert.deepEqual(mon.result.couldNotCheck, []);
  assert.deepEqual(mon.result.changes.map((c) => [c.key, c.kind, c.from, c.to]), [[CC, "installed-changed", "2.1.0", "2.1.2"]]);
});

test("a missing, empty or half-written state file is a first run", (t) => {
  const home = mkdtempSync(join(tmpdir(), "stack-updates-state-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const file = join(home, ".local", "share", "stack-updates", "state.json");
  // No file and no folder.
  let loaded = loadState(home);
  assert.equal(loaded.fresh, true);
  assert.equal(day("2026-11-13", loaded.state).result.firstRun, true);
  mkdirSync(join(home, ".local", "share", "stack-updates"), { recursive: true });
  const good = day("2026-11-13", null).state;
  const broken = ["", "  \n", "{", JSON.stringify(good).slice(0, 60), "null", "[]", "42", '{"version":2,"parts":{}}', '{"version":1}', '{"version":1,"parts":[]}'];
  for (const text of broken) {
    writeFileSync(file, text);
    loaded = loadState(home);
    assert.equal(loaded.fresh, true, JSON.stringify(text));
    const r = day("2026-11-16", loaded.state, { latest: { "browse/cli": ok({ version: "0.11.4" }) } });
    assert.equal(r.result.firstRun, true, JSON.stringify(text));
    assert.deepEqual(r.result.changes, []); // a baseline, never a flood of "new" releases
    assert.deepEqual(r.result.stillBehind.map((x) => x.key), ["browse/cli"]);
  }
  // A state handed to compare directly is checked the same way.
  assert.equal(day("2026-11-16", { version: 1, parts: "x" }).result.firstRun, true);
  // Odd fields inside a good file are repaired, not fatal.
  writeFileSync(file, JSON.stringify({ ...good, week: "x", parts: { ...good.parts, "browse/cli": 5 } }));
  loaded = loadState(home);
  assert.equal(loaded.fresh, false);
  assert.deepEqual(loaded.state.week, { runs: 0, changes: 0 });
  assert.equal(day("2026-11-14", loaded.state).result.firstRun, false);
  writeFileSync(file, JSON.stringify(good));
  loaded = loadState(home);
  assert.deepEqual(loaded, { state: good, fresh: false });
});

test("saveState leaves no temp file and survives a rerun", (t) => {
  const home = mkdtempSync(join(tmpdir(), "stack-updates-state-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const dir = join(home, ".local", "share", "stack-updates");
  const one = day("2026-11-13", null).state;
  saveState(home, one); // creates the folder
  assert.deepEqual(readdirSync(dir), ["state.json"]);
  assert.deepEqual(loadState(home), { state: one, fresh: false });
  const two = day("2026-11-14", one, { latest: { "browse/cli": ok({ version: "0.11.4" }) } }).state;
  saveState(home, two);
  assert.deepEqual(readdirSync(dir), ["state.json"]);
  assert.deepEqual(loadState(home), { state: two, fresh: false });
  assert.equal(JSON.parse(readFileSync(join(dir, "state.json"), "utf8")).lastRun, "2026-11-14");
  // A rename that fails (here: a folder where the file should be) throws and still leaves no temp file.
  const blocked = mkdtempSync(join(tmpdir(), "stack-updates-state-"));
  t.after(() => rmSync(blocked, { recursive: true, force: true }));
  mkdirSync(join(blocked, ".local", "share", "stack-updates", "state.json"), { recursive: true });
  assert.throws(() => saveState(blocked, one));
  assert.deepEqual(readdirSync(join(blocked, ".local", "share", "stack-updates")), ["state.json"]);
});

test("odd versions compare without throwing; installed newer than the feed is not behind", () => {
  const cases = [
    // [installed, latest, behind]
    ["2.56.1.windows.1", "2.56.1", false],
    ["v0.8.0", "0.8.0", false],
    ["boat 1.0.97", "1.0.97", false],
    ["1.2", "1.2.0", false],
    ["2.0.0", "1.9.0", false], // newer than the feed
    ["1.9.0", "1.10.0", true], // numbers, not text
    ["2.56.0.windows.2", "2.56.1", true],
    ["1.0.0-beta.1", "1.0.0", true],
    ["nightly", "1.0.0", true], // not orderable: compared by equality
  ];
  const parts = cases.map((_, n) => part(`v${n}`, { kind: "pinned", folder: `v${n}`, package: `v${n}` }, { kind: "npm", package: `v${n}` }));
  parts.push(part("sha", { kind: "command" }, { kind: "npm", package: "odd" }));
  const catalog = { version: 1, ignored: [], tools: [tool("odd", "Odd", parts)] };
  const installed = Object.fromEntries(cases.map(([i], n) => [`odd/v${n}`, read(i)]));
  const latest = Object.fromEntries(cases.map(([, l], n) => [`odd/v${n}`, ok({ version: l })]));
  installed["odd/sha"] = { state: "read", commit: SHA("e") }; // a commit against a version: no order, no guess
  latest["odd/sha"] = ok({ version: "1.0.0" });
  const { result } = compare({ catalog, installed, latest, unlisted: nothing, state: null, today: "2026-11-13" });
  assert.deepEqual(
    result.stillBehind.map((s) => s.key),
    cases.flatMap(([, , behind], n) => (behind ? [`odd/v${n}`] : [])),
  );
  assert.deepEqual(result.couldNotCheck, []);

  // A new release is newer by number; a feed that goes back is not news.
  const one = { version: 1, ignored: [], tools: [tool("one", "One", [part("cli", { kind: "pinned", folder: "one", package: "one" }, { kind: "npm", package: "one" })])] };
  const run = (today, state, lat) => compare({ catalog: one, installed: { "one/cli": read("1.9.0") }, latest: { "one/cli": ok({ version: lat }) }, unlisted: nothing, state, today });
  const a = run("2026-11-13", null, "1.9.0");
  const b = run("2026-11-14", a.state, "1.10.0");
  assert.deepEqual(b.result.changes.map((c) => [c.from, c.to]), [["1.9.0", "1.10.0"]]);
  const c = run("2026-11-15", b.state, "1.9.0"); // a pulled release
  assert.deepEqual(c.result.changes, []);
  const d = run("2026-11-17", c.state, "1.10.0"); // back again: already reported
  assert.deepEqual(d.result.changes, []);

  assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
  assert.ok(compareVersions("v1.2.3", "1.2.4") < 0);
  assert.equal(compareVersions("2.56.1.windows.1", "2.56.1"), 0);
  assert.ok(compareVersions("99999999999999999999.1", "99999999999999999998.9") > 0); // beyond 2^53
  assert.equal(compareVersions(SHA("a"), SHA("b")), null);
  assert.equal(compareVersions("same", "same"), 0);
  for (const junk of [undefined, null, "", 5, {}, [], "..", "1..2", "v", "x".repeat(500)])
    assert.doesNotThrow(() => compareVersions(junk, "1.0.0"), String(junk));
});

test("a second run the same day reports nothing new and does not double the week count", () => {
  const base = { unlisted: [stray] };
  const newer = { ...base, latest: { "browse/cli": ok({ version: "0.11.4" }) } };
  const fri = day("2026-11-13", null, base);
  const fri2 = day("2026-11-13", fri.state, base);
  assert.equal(fri2.result.firstRun, false);
  assert.deepEqual(fri2.result.unlisted, []);
  assert.equal(fri2.result.quiet, true);
  assert.deepEqual(fri2.state.week, { runs: 1, changes: 0 });
  const sat1 = day("2026-11-14", fri2.state, newer);
  assert.equal(sat1.result.changes.length, 1);
  assert.deepEqual(sat1.state.week, { runs: 2, changes: 1 });
  const sat2 = day("2026-11-14", sat1.state, newer);
  assert.deepEqual(sat2.result.changes, []);
  assert.equal(sat2.result.quiet, true);
  assert.deepEqual(sat2.state.week, { runs: 2, changes: 1 });
  const sun = day("2026-11-15", sat2.state, newer);
  const monA = day("2026-11-16", sun.state, newer);
  assert.deepEqual(monA.result.weekly, { runs: 3, changes: 1, from: "2026-11-09" });
  assert.deepEqual(monA.result.stillBehind.map((s) => s.key), ["browse/cli"]);
  assert.deepEqual(monA.result.unlisted, [stray]);
  assert.deepEqual(monA.state.week, { runs: 1, changes: 0 });
  const monB = day("2026-11-16", monA.state, newer);
  assert.equal(monB.result.weekly, null);
  assert.deepEqual(
    [monB.result.changes, monB.result.stillBehind, monB.result.unlisted, monB.result.missing, monB.result.couldNotCheck],
    [[], [], [], [], []],
  );
  assert.equal(monB.result.quiet, true);
  assert.deepEqual(monB.state.week, { runs: 1, changes: 0 });
  assert.equal(monB.state.lastMonday, "2026-11-16");
});

test("the first run after a week off still shows the Monday sections", () => {
  const setup = {
    installed: { "alpha/plugin": { state: "not-found", message: "not in the plugin registry" } },
    latest: { "browse/cli": ok({ version: "0.11.4" }) },
    unlisted: [stray],
  };
  const fri = day("2026-11-13", null, setup);
  const sat = day("2026-11-14", fri.state, setup);
  assert.equal(sat.result.quiet, true);
  // Away until Wednesday the 25th: two Mondays (the 16th and the 23rd) without a run.
  const wed = day("2026-11-25", sat.state, setup);
  assert.deepEqual(wed.result.stillBehind, [{ key: "browse/cli", installed: "0.11.3", latest: "0.11.4", since: "2026-11-13" }]);
  assert.deepEqual(wed.result.missing, [{ key: "alpha/plugin" }]);
  assert.deepEqual(wed.result.unlisted, [stray]);
  assert.deepEqual(wed.result.weekly, { runs: 2, changes: 0, from: "2026-11-09" }); // the week that began on the 9th
  assert.equal(wed.state.lastMonday, "2026-11-23");
  const thu = day("2026-11-26", wed.state, setup);
  assert.deepEqual([thu.result.stillBehind, thu.result.missing, thu.result.unlisted, thu.result.weekly], [[], [], [], null]);
});

test("a change carries commit refs when the comparison had them; versions stay in from and to", () => {
  const fri = day("2026-11-13", null);
  // A marketplace plugin: versions for people, the installed and newest commits for the release text.
  const sat = day("2026-11-14", fri.state, {
    latest: { "alpha/plugin": ok({ version: "1.3.0", commit: SHA("f") }), "skilly/skill": ok({ commit: SHA("d") }) },
  });
  const alpha = sat.result.changes.find((c) => c.key === "alpha/plugin");
  assert.deepEqual([alpha.from, alpha.to, alpha.fromRef, alpha.toRef], ["1.2.0", "1.3.0", SHA("a"), SHA("f")]);
  // A commit feed with nothing recorded: from the last commit seen to the new one.
  const skill = sat.result.changes.find((c) => c.key === "skilly/skill");
  assert.deepEqual([skill.from, skill.to, skill.fromRef, skill.toRef], [SHA("c"), SHA("d"), SHA("c"), SHA("d")]);
  // A commit recorded after an update is the one compared from.
  // It also wins over the commit read on the PC, which can be a local commit or a marketplace head.
  const recorded = structuredClone(fri.state);
  recorded.parts["skilly/skill"].installedCommit = SHA("9");
  recorded.parts["alpha/plugin"].installedCommit = SHA("8");
  const withRecord = day("2026-11-14", recorded, {
    latest: { "skilly/skill": ok({ commit: SHA("d") }), "alpha/plugin": ok({ version: "1.3.0", commit: SHA("f") }) },
  });
  assert.deepEqual(
    withRecord.result.changes.map((c) => [c.key, c.from, c.fromRef, c.toRef]),
    [["alpha/plugin", "1.2.0", SHA("8"), SHA("f")], ["skilly/skill", SHA("9"), SHA("9"), SHA("d")]],
  );
  // No commits in the comparison: no refs at all.
  const browse = day("2026-11-14", fri.state, { latest: { "browse/cli": ok({ version: "0.11.4" }) } }).result.changes[0];
  assert.ok(!("fromRef" in browse) && !("toRef" in browse));
  const watch = day("2026-11-14", fri.state, { latest: { "watch/watch": ok({ version: "1.1.0" }) } }).result.changes[0];
  assert.ok(!("fromRef" in watch) && !("toRef" in watch));
});

test("order: risky changes first, then by tool name", () => {
  const fri = day("2026-11-13", null);
  const sat = day("2026-11-14", fri.state, {
    latest: {
      "browse/cli": ok({ version: "0.12.0" }), // Browserbase
      "alpha/plugin": ok({ version: "2.0.0", commit: SHA("f") }), // Alpha, a major version
      "watch/watch": ok({ version: "2.0.0" }), // Watched, a major version
      "graph/mcp": ok({ hash: "h2" }), // Graph service
    },
  });
  assert.deepEqual(sat.result.changes.map((c) => [c.tool, c.risky]), [["alpha", true], ["watch", true], ["browse", false], ["graph", false]]);
});

test("at most 10 changes get a text; the rest have notRead 'cap'", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `w${String(i + 1).padStart(2, "0")}`);
  const catalog = { version: 1, ignored: [], tools: ids.map((id) => tool(id, `Tool ${id}`, [part("cli", { kind: "none" }, { kind: "npm", package: id })], "watching")) };
  const run = (today, state, version) => compare({
    catalog,
    installed: Object.fromEntries(ids.map((id) => [`${id}/cli`, { state: "none" }])),
    latest: Object.fromEntries(ids.map((id) => [`${id}/cli`, ok({ version })])),
    unlisted: nothing,
    state,
    today,
  });
  const a = run("2026-11-13", null, "1.0.0");
  const b = run("2026-11-14", a.state, "1.1.0");
  assert.equal(READ_LIMIT, 10);
  assert.equal(b.result.changes.length, 12);
  assert.deepEqual(b.result.changes.map((c) => c.notRead), [...Array(10).fill(null), "cap", "cap"]);
  assert.deepEqual(b.result.changes.slice(10).map((c) => c.tool), ["w11", "w12"]);
  assert.ok(b.result.changes.every((c) => c.textFile === null && c.answers === null));
  assert.deepEqual(b.state.week, { runs: 2, changes: 12 });
});

test("quiet is true only when every list is empty", () => {
  const empty = {
    date: "2026-11-13", quiet: true, firstRun: false, changes: [], stillBehind: [], broken: [], unchecked: [],
    dates: [], couldNotCheck: [], unlisted: [], missing: [], weekly: null,
  };
  assert.equal(isQuiet(empty), true);
  assert.equal(isQuiet({ ...empty, weekly: { runs: 7, changes: 2 } }), true); // the week count rides on the quiet line
  // A service with no check is a standing fact, not news; held-back counts are not news either.
  assert.equal(isQuiet({ ...empty, unchecked: ["TypeSafe / Jev", "Graphify"] }), true);
  assert.equal(isQuiet({ ...empty, suppressed: { couldNotCheck: 2, stillBehind: 1, unlisted: 3, missing: 1 } }), true);
  for (const k of ["changes", "stillBehind", "broken", "dates", "couldNotCheck", "unlisted", "missing"]) {
    assert.equal(isQuiet({ ...empty, [k]: [{}] }), false, k);
    assert.equal(isQuiet({ ...empty, unchecked: ["Graphify"], [k]: [{}] }), false, k);
  }
  const fri = day("2026-11-13", null);
  assert.equal(fri.result.quiet, true);
  const sat = day("2026-11-14", fri.state, { latest: { "graph/mcp": ok({ hash: "h2" }) } });
  assert.equal(sat.result.quiet, false);
  assert.equal(day("2026-11-15", sat.state, { latest: { "graph/mcp": ok({ hash: "h2" }) } }).result.quiet, true);
});

test("compare does not change its inputs and needs a real date", () => {
  const fri = day("2026-11-13", null, { unlisted: [stray] });
  const deepFreeze = (o) => {
    for (const v of Object.values(o)) if (v && typeof v === "object") deepFreeze(v);
    return Object.freeze(o);
  };
  const state = deepFreeze(structuredClone(fri.state));
  const before = structuredClone(state);
  const inputs = deepFreeze({
    catalog: structuredClone(CATALOG),
    installed: structuredClone(INSTALLED),
    latest: { ...structuredClone(LATEST), "browse/cli": ok({ version: "0.11.4" }) },
    unlisted: { items: [stray], unreadable: [] },
  });
  const { result, state: next } = compare({ ...inputs, state, today: "2026-11-16" });
  assert.deepEqual(state, before);
  assert.equal(result.changes.length, 1);
  assert.notEqual(next, state);
  assert.throws(() => compare({ ...inputs, state, today: "16 Nov" }), /YYYY-MM-DD/);
  assert.throws(() => compare({ ...inputs, state, today: "2026-02-30" }), /YYYY-MM-DD/);
});

test("isRisky", () => {
  assert.equal(isRisky("1.9.0", "2.0.0", ""), true);
  assert.equal(isRisky("1.9.0", "1.10.0", "Removed the old flag"), true);
  assert.equal(isRisky("1.9.0", "1.10.0", "Unbreakable speed"), false);
  assert.equal(isRisky("v1.9.0", "v2.0.0", ""), true);
  assert.equal(isRisky("0.9.0", "0.10.0", ""), false);
  assert.equal(isRisky("2.0.0", "1.0.0", ""), false);
  assert.equal(isRisky("1.0.0", "1.1.0", "BREAKING CHANGE: the config moved"), true);
  assert.equal(isRisky("1.0.0", "1.1.0", "The old API is Deprecated."), true);
  assert.equal(isRisky("1.0.0", "1.1.0", "deprecation notices; removes nothing; breakingly fast"), false);
  assert.equal(isRisky(SHA("a"), SHA("b"), ""), false);
  assert.equal(isRisky(null, "2.0.0", undefined), false);
});
