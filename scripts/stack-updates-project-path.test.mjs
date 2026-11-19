// Run by `npm test` (node --test). A project part's optional `path`: the folder whose
// lockfile holds the package. `gh` is a fake and the home folder is a temporary one.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readInstalled } from "../plugins/cookbook/skills/stack-updates/scripts/lib/inventory.mjs";

const home = mkdtempSync(join(tmpdir(), "stack-updates-path-"));
mkdirSync(join(home, ".local", "share", "stack-updates"), { recursive: true });
writeFileSync(join(home, ".local", "share", "stack-updates", "projects.json"), JSON.stringify({ "site-one": "example-owner/site-one" }));
after(() => rmSync(home, { recursive: true, force: true }));

const lock = JSON.stringify({ packages: { "node_modules/type-check": { version: "0.8.0" } } });
const file = { code: 0, stdout: JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from(lock).toString("base64") }), stderr: "" };
const part = (over = {}) => ({ kind: "project", project: "site-one", package: "type-check", ...over });

test("project: a path reads that folder's lockfile, and no path still reads the root one", async () => {
  const calls = [];
  const gh = async (args) => { calls.push(args); return file; };
  assert.deepEqual(await readInstalled(part({ path: "checks/type-check-trial" }), "tool/dependency", { home, gh }), { state: "read", version: "0.8.0" });
  assert.deepEqual(await readInstalled(part(), "tool/dependency", { home, gh }), { state: "read", version: "0.8.0" });
  assert.deepEqual(calls, [
    ["api", "repos/example-owner/site-one/contents/checks/type-check-trial/package-lock.json"],
    ["api", "repos/example-owner/site-one/contents/package-lock.json"],
  ]);
  const absent = await readInstalled(part({ package: "other", path: "checks/type-check-trial" }), "tool/dependency", { home, gh });
  assert.equal(absent.state, "not-found");
});

test("project: a path that is not a plain relative folder is unreadable, and gh is never called", async () => {
  const gh = async () => { throw new Error("no gh call may happen in this test"); };
  for (const path of ["../x", "/abs", "a//b", "a/../b", "x/", "a b", "", 7, null]) {
    const r = await readInstalled(part({ path }), "tool/dependency", { home, gh });
    assert.deepEqual(r, { state: "unreadable", message: "the project path must be a plain relative folder" }, JSON.stringify(path));
  }
});
