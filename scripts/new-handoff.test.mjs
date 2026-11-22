// The handoff scaffold: a new entry with the five parts the check asks for.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HANDOFF_ENTRY_NAME, handoffEntryErrors } from "./check.mjs";
import { newHandoff, scaffold } from "./new-handoff.mjs";

test("scaffold: the five parts in order, and the check finds none missing", () => {
  const text = scaffold("Merge scripts poll faster");
  assert.match(text, /^# Merge scripts poll faster\n/);
  const labels = [...text.matchAll(/^\*\*(.+?)\.\*\*/gm)].map((m) => m[1]);
  assert.deepEqual(labels, ["What changed", "Verification", "Outstanding", "Dead ends", "Evidence"]);
  assert.deepEqual(handoffEntryErrors({ name: "2026-11-22-x.md", text }), []);
});

test("newHandoff: writes handoff/<date>-<slug>.md once, refuses a bad slug or an existing file", () => {
  const root = mkdtempSync(join(tmpdir(), "handoff-"));
  const path = newHandoff({ root, date: "2026-11-22", slug: "merge-scripts", title: "Merge scripts" });
  assert.equal(path, join(root, "handoff", "2026-11-22-merge-scripts.md"));
  assert.ok(HANDOFF_ENTRY_NAME.test("2026-11-22-merge-scripts.md"));
  assert.match(readFileSync(path, "utf8"), /^# Merge scripts\n/);
  writeFileSync(path, "kept");
  assert.throws(() => newHandoff({ root, date: "2026-11-22", slug: "merge-scripts", title: "x" }), /exists/);
  assert.equal(readFileSync(path, "utf8"), "kept");
  assert.throws(() => newHandoff({ root, date: "2026-11-22", slug: "Bad Slug", title: "x" }), /slug/);
  assert.throws(() => newHandoff({ root, date: "22-11-2026", slug: "ok", title: "x" }), /date/);
});
