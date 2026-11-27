// pr-text's size line: the same rules and words as the Stack Atlas AI review's comment (standard v35).
import assert from "node:assert/strict";
import test from "node:test";
import { leftOutKind, lineCounts, main, parseNumstat, sizeLine } from "../plugins/cookbook/skills/pr-text/meaningful-lines.mjs";

test("leftOutKind: tests, lock files, fixtures and generated files; the rest counts", () => {
  const cases = {
    "src/index.mjs": null,
    "README.md": null,
    "docs/test-plan.md": null,
    "lib/contest.mjs": null,
    "package-lock.json": "lock",
    "web/pnpm-lock.yaml": "lock",
    "Cargo.lock": "lock",
    "go.sum": "lock",
    "dist/app.js": "generated",
    "web/vendor.min.js": "generated",
    "src/__generated__/types.ts": "generated",
    "scripts/fixtures/a.json": "fixture",
    "scripts/check.test.mjs": "test",
    "pkg/util_test.go": "test",
    "tests/test_util.py": "test",
    "app/src/test/java/FooTest.java": "test",
  };
  for (const [file, kind] of Object.entries(cases)) assert.equal(leftOutKind(file), kind, file);
});

test("the size line counts the meaningful lines apart from all lines, renames and binaries read", () => {
  const raw = "3\t1\tsrc/a.mjs\0-\t-\timg.png\0" + "2\t2\t\0old/x.mjs\0new/x.mjs\0" + "40\t0\tscripts/a.test.mjs\x00300\t200\tpackage-lock.json\0";
  assert.equal(
    sizeLine(lineCounts(parseNumstat(raw))),
    "Meaningful lines: +5 / -3 in 3 files. All lines: +345 / -203 in 5 files; left out of the meaningful count: 1 test file, 1 lock file.",
  );
  assert.equal(sizeLine(lineCounts([])), "Meaningful lines: +0 / -0 in 0 files. All lines: +0 / -0 in 0 files.");
});

test("main compares base...HEAD and refuses a second argument or an option", () => {
  const calls = [];
  const git = (args) => {
    calls.push(args);
    return "1\t0\ta.mjs\0";
  };
  const log = console.log;
  const lines = [];
  console.log = (l) => lines.push(l);
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal(main(["origin/main"], git), 0);
    assert.equal(main(["a", "b"], git), 2);
    assert.equal(main(["--output=x"], git), 2);
  } finally {
    console.log = log;
    console.error = err;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].at(-1), "origin/main...HEAD");
  assert.deepEqual(lines, ["Meaningful lines: +1 / -0 in 1 file. All lines: +1 / -0 in 1 file."]);
});
