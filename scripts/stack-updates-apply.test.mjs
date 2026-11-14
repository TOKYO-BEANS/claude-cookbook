// The routine-update rules (lib/apply.mjs): which behind parts a session may install
// without asking. Whatever cannot be read counts against an update, never for it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DAILY_LIMIT, NOTES, REASONS, ROUTINE_COMMAND_PARTS, SOAK_DAYS, decide, decideAll, levelOf } from "../plugins/cookbook/skills/stack-updates/scripts/lib/apply.mjs";

const TODAY = "2026-11-20";
const part = (over = {}) => ({ key: "tool/cli", installed: "1.2.3", latest: "1.2.4", latestSince: "2026-11-10", applyFailed: null, ...over });
const facts = (over = {}) => ({ kind: "pinned", lifecycle: "active", selfUpdating: false, localPort: false, notes: "clean", today: TODAY, ...over });
const A = "a".repeat(40), B = "b".repeat(40);
const ask = (reason) => ({ decision: "ask", reason });
const ROUTINE = { decision: "routine" };

test("levelOf: the first number that moved up; null when it cannot be told", () => {
  assert.equal(levelOf("1.2.3", "2.0.0"), "major");
  assert.equal(levelOf("1.2.3", "1.3.0"), "minor");
  assert.equal(levelOf("v1.2.3", "1.2.10"), "patch");
  assert.equal(levelOf("1.9.9", "1.10.0"), "minor", "numbers, not text");
  assert.equal(levelOf("2.56.0.windows.2", "2.56.1"), "patch");
  for (const [from, to] of [["1.2.3", "1.2.3"], ["2.0.0", "1.9.9"], [A, B], ["1.2", "1.3"], [null, "1.0.0"], ["1.0.0", undefined]]) assert.equal(levelOf(from, to), null);
});

test("routine: a patch or minor release, notes checked, of a kind a session installs and the script can read back, seen long enough", () => {
  assert.deepEqual(decide(part(), facts()), ROUTINE);
  assert.deepEqual(decide(part({ latest: "1.3.0" }), facts()), ROUTINE);
  for (const kind of ["plugin", "pinned"]) assert.deepEqual(decide(part(), facts({ kind })), ROUTINE, kind);
  // A patch release whose notes were read and are empty.
  assert.deepEqual(decide(part(), facts({ notes: "none" })), ROUTINE);
  // A plugin that is versioned by commit: two different commit ids and real, clean notes.
  assert.deepEqual(decide(part({ installed: A, latest: B }), facts({ kind: "plugin" })), ROUTINE);
});

test("never from here: project, hosted and uninstalled parts, a tool only followed, a tool that updates itself, an unknown kind", () => {
  for (const kind of ["project", "hosted", "none", "something-new", undefined]) assert.deepEqual(decide(part(), facts({ kind })), { decision: "none" }, String(kind));
  assert.deepEqual(decide(part(), facts({ lifecycle: "watching" })), { decision: "none" });
  assert.deepEqual(decide(part(), facts({ selfUpdating: true })), { decision: "none" });
  assert.deepEqual(decide(null, facts()), { decision: "none" });
});

test("needs a yes: each rule has its own fixed reason, and the first that fails is the one shown", () => {
  assert.deepEqual(decide(part({ applyFailed: "1.2.4" }), facts()), ask(REASONS.failed));
  assert.deepEqual(decide(part({ applyFailed: "1.2.3" }), facts()), ROUTINE, "a failure of an older version does not hold back a newer one");
  assert.deepEqual(decide(part(), facts({ kind: "skill" })), ask(REASONS.skill));
  assert.deepEqual(decide(part({ installed: A, latest: B }), facts({ kind: "skill" })), ask(REASONS.skill));
  assert.deepEqual(decide(part(), facts({ kind: "command" })), ask(REASONS.outside));
  assert.deepEqual(decide(part(), facts({ kind: "plugin", localPort: true })), ask(REASONS.localPort));
  assert.deepEqual(decide(part({ latest: "2.0.0" }), facts()), ask(REASONS.major));
  assert.deepEqual(decide(part(), facts({ notes: "risky" })), ask(REASONS.risky));
  assert.deepEqual(decide(part(), facts({ notes: "partial" })), ask(REASONS.partial));
  assert.deepEqual(decide(part({ latest: "1.3.0" }), facts({ notes: "none" })), ask(REASONS.noNotes));
  assert.deepEqual(decide(part({ installed: A, latest: B }), facts({ kind: "plugin", notes: "none" })), ask(REASONS.noNotes), "commit ids have no patch level");
  // A major version with risky notes of a command part: the kind is said first.
  assert.deepEqual(decide(part({ latest: "2.0.0" }), facts({ kind: "command", notes: "risky" })), ask(REASONS.outside));
  // Nothing a note says makes a decision looser: "clean" never rescues a major version.
  assert.deepEqual(decide(part({ latest: "2.0.0" }), facts({ notes: "clean" })), ask(REASONS.major));
});

test("a version step that cannot be read is never routine, whatever the notes say", () => {
  for (const [installed, latest] of [
    ["unknown", "3.0.0"], ["1.9", "2.0.0"], ["1.2", "1.3"], ["2.0.0", "1.9.9"], ["1.2.3", "1.2.3"], [null, "1.0.0"], ["1.2.3", null],
    [A, "1.0.0"], ["1.0.0", B], [A, A], ["latest", "newest"],
  ]) {
    for (const kind of ["plugin", "pinned"]) {
      assert.deepEqual(decide(part({ installed, latest }), facts({ kind })), ask(REASONS.unreadable), `${installed} -> ${latest} (${kind})`);
    }
  }
});

test("notes that were not checked never give a routine update: the part waits a day and is checked again", () => {
  const wait = { decision: "waiting", until: "2026-11-21", reason: REASONS.unchecked };
  for (const notes of [null, undefined, "", "CLEAN", "ok", 1, {}]) {
    assert.deepEqual(decide(part(), facts({ notes })), wait, `patch, notes ${JSON.stringify(notes)}`);
    assert.deepEqual(decide(part({ latest: "1.3.0" }), facts({ notes })), wait, `minor, notes ${JSON.stringify(notes)}`);
  }
  assert.deepEqual([...NOTES], ["clean", "risky", "none", "partial"]);
  // A reason to ask still comes first.
  assert.deepEqual(decide(part({ latest: "2.0.0" }), facts({ notes: null })), ask(REASONS.major));
});

test("a listed pinned binary is the one command kind a session installs; every listed key is a command part of the catalog", () => {
  assert.ok(ROUTINE_COMMAND_PARTS.length > 0);
  for (const key of ROUTINE_COMMAND_PARTS) assert.deepEqual(decide(part({ key }), facts({ kind: "command" })), ROUTINE, key);
  const catalog = JSON.parse(readFileSync(fileURLToPath(new URL("../plugins/cookbook/catalog.json", import.meta.url)), "utf8"));
  const commandParts = new Set(catalog.tools.flatMap((t) => t.parts.filter((p) => p.installed.kind === "command").map((p) => `${t.id}/${p.name}`)));
  for (const key of ROUTINE_COMMAND_PARTS) assert.ok(commandParts.has(key), `${key} is not a command part in catalog.json`);
});

test("waiting: a release is routine only once it has been seen for the waiting days", () => {
  assert.equal(SOAK_DAYS, 3);
  assert.deepEqual(decide(part({ latestSince: TODAY }), facts()), { decision: "waiting", until: "2026-11-23" });
  assert.deepEqual(decide(part({ latestSince: "2026-11-18" }), facts()), { decision: "waiting", until: "2026-11-21" });
  assert.deepEqual(decide(part({ latestSince: "2026-11-17" }), facts()), ROUTINE);
  // No day, a day in the future or a bad day counts from today.
  for (const latestSince of [null, "2026-12-01", "2026-02-31", "soon"]) assert.deepEqual(decide(part({ latestSince }), facts()), { decision: "waiting", until: "2026-11-23" }, String(latestSince));
  assert.deepEqual(decide(part(), facts({ today: "not a day" })), { decision: "waiting", until: null });
  // Waiting never hides a reason to ask.
  assert.equal(decide(part({ latestSince: TODAY, latest: "2.0.0" }), facts()).decision, "ask");
});

test("decideAll: three lists; at most the daily limit is routine, the longest seen first, the rest wait until tomorrow", () => {
  assert.equal(DAILY_LIMIT, 5);
  const behind = [
    ...Array.from({ length: 7 }, (_, i) => part({ key: `t${i}/cli`, latestSince: `2026-11-1${i}` })), // seen since the 10th … 16th
    part({ key: "big/cli", latest: "2.0.0" }),
    part({ key: "new/cli", latestSince: TODAY }),
    part({ key: "repo/dep" }),
    part({ key: "gone/cli" }),
    "not an entry",
  ];
  const kinds = { "repo/dep": "project" };
  const factsFor = (key) => (key === "gone/cli" ? null : facts({ kind: kinds[key] ?? "pinned", today: undefined }));
  const out = decideAll(behind, factsFor, TODAY);
  assert.deepEqual(out.routine.map((r) => r.key), ["t0/cli", "t1/cli", "t2/cli", "t3/cli", "t4/cli"]);
  assert.deepEqual(out.routine[0], { key: "t0/cli", from: "1.2.3", to: "1.2.4", kind: "pinned" });
  assert.deepEqual(out.waiting.map((w) => [w.key, w.until]).sort(), [["new/cli", "2026-11-23"], ["t5/cli", "2026-11-21"], ["t6/cli", "2026-11-21"]]);
  assert.deepEqual(out.ask, [{ key: "big/cli", from: "1.2.3", to: "2.0.0", kind: "pinned", reason: REASONS.major }]);
  assert.ok(![...out.routine, ...out.waiting, ...out.ask].some((x) => x.key === "repo/dep" || x.key === "gone/cli"));
  assert.deepEqual(decideAll(undefined, () => facts(), TODAY), { routine: [], waiting: [], ask: [] });
  // Installs already attempted today count against the same limit.
  assert.deepEqual(decideAll(behind, factsFor, TODAY, { used: 3 }).routine.map((r) => r.key), ["t0/cli", "t1/cli"]);
  assert.deepEqual(decideAll(behind, factsFor, TODAY, { used: 5 }).routine, []);
  assert.deepEqual(decideAll(behind, factsFor, TODAY, { used: 9 }).routine, []);
  assert.equal(decideAll(behind, factsFor, TODAY, { used: -2 }).routine.length, 5);
  // A part that waits for its notes keeps that reason.
  const unchecked = decideAll([part()], () => facts({ notes: null, today: undefined }), TODAY);
  assert.deepEqual(unchecked.waiting, [{ key: "tool/cli", from: "1.2.3", to: "1.2.4", kind: "pinned", until: "2026-11-21", reason: REASONS.unchecked }]);
});
