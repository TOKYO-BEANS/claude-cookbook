#!/usr/bin/env node
// The size of a change in meaningful lines, apart from all lines: tests, lock
// files, fixtures and generated files are left out. The same rules and the same
// line as the Stack Atlas AI review's comment (TOKYO-BEANS/Stack-Atlas,
// templates/ai-review/review.mjs, `leftOutKind` and `sizeLine`, standard v35);
// change both together.
//
//   node meaningful-lines.mjs [base]   (default: origin/HEAD; compares base...HEAD)
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LOCK_FILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "gemfile.lock",
  "poetry.lock",
  "pipfile.lock",
  "uv.lock",
  "composer.lock",
  "go.sum",
  "flake.lock",
  "deno.lock",
  "packages.lock.json",
  "podfile.lock",
  "pubspec.lock",
  "mix.lock",
  "gradle.lockfile",
]);
const GENERATED_FOLDERS = new Set(["generated", "__generated__", "dist"]);
const GENERATED_NAMES = [
  /\.min\.(js|mjs|cjs|css)$/i,
  /\.(js|css)\.map$/i,
  /\.generated\.[^.]+$/i,
  /\.pb\.go$/i,
  /_pb2(_grpc)?\.pyi?$/i,
  /\.g\.dart$/i,
];
const FIXTURE_FOLDERS = new Set(["fixtures", "fixture", "__fixtures__", "testdata"]);
const TEST_FOLDERS = new Set(["test", "tests", "__tests__", "spec", "specs", "e2e", "__snapshots__", "__mocks__"]);
const TEST_NAMES = [
  /\.(test|spec)\.[^.]+$/i,
  /_test\.(go|py|rb|exs?)$/i,
  /_spec\.rb$/i,
  /^test_[^/]*\.py$/i,
  /Tests?\.(java|kt|cs|swift)$/,
  /\.snap$/i,
];

// "lock", "generated", "fixture" or "test" for a file the meaningful count
// leaves out, null for one it counts.
export function leftOutKind(file) {
  const segments = String(file ?? "").split(/[\\/]/).filter(Boolean);
  const base = segments.at(-1) ?? "";
  const folders = segments.slice(0, -1).map((s) => s.toLowerCase());
  if (LOCK_FILES.has(base.toLowerCase())) return "lock";
  if (folders.some((f) => GENERATED_FOLDERS.has(f)) || GENERATED_NAMES.some((re) => re.test(base)))
    return "generated";
  if (folders.some((f) => FIXTURE_FOLDERS.has(f))) return "fixture";
  if (folders.some((f) => TEST_FOLDERS.has(f)) || TEST_NAMES.some((re) => re.test(base))) return "test";
  return null;
}

// `git diff --numstat -z`: "added\tdeleted\tpath\0", or for a rename
// "added\tdeleted\t\0old\0new\0". A binary file reads "-" and counts 0 lines.
export function parseNumstat(text) {
  const tokens = String(text ?? "").split("\0");
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const m = /^(\d+|-)\t(\d+|-)\t(.*)$/s.exec(tokens[i]);
    if (!m) continue;
    let file = m[3];
    if (file === "") {
      file = tokens[i + 2] ?? "";
      i += 2;
    }
    const count = (v) => (v === "-" ? 0 : Number(v));
    out.push({ path: file, added: count(m[1]), deleted: count(m[2]) });
  }
  return out;
}

export function lineCounts(entries) {
  const total = { added: 0, deleted: 0, files: 0 };
  const meaningful = { added: 0, deleted: 0, files: 0 };
  const leftOut = { test: 0, lock: 0, fixture: 0, generated: 0 };
  for (const e of entries) {
    total.added += e.added;
    total.deleted += e.deleted;
    total.files++;
    const kind = leftOutKind(e.path);
    if (kind) leftOut[kind]++;
    else {
      meaningful.added += e.added;
      meaningful.deleted += e.deleted;
      meaningful.files++;
    }
  }
  return { total, meaningful, leftOut };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const LEFT_OUT_WORDS = { test: "test file", lock: "lock file", fixture: "fixture", generated: "generated file" };
export function sizeLine({ total: t, meaningful: m, leftOut }) {
  const left = Object.entries(LEFT_OUT_WORDS)
    .filter(([kind]) => leftOut[kind] > 0)
    .map(([kind, word]) => plural(leftOut[kind], word));
  return (
    `Meaningful lines: +${m.added} / -${m.deleted} in ${plural(m.files, "file")}. ` +
    `All lines: +${t.added} / -${t.deleted} in ${plural(t.files, "file")}` +
    (left.length ? `; left out of the meaningful count: ${left.join(", ")}.` : ".")
  );
}

export function main(argv = process.argv.slice(2), git = (args) => execFileSync("git", args, { encoding: "utf8" })) {
  const base = argv[0] ?? "origin/HEAD";
  if (argv.length > 1 || base.startsWith("-")) {
    console.error("Usage: node meaningful-lines.mjs [base]");
    return 2;
  }
  const raw = git(["-c", "core.quotepath=off", "diff", "--numstat", "-z", "--no-color", "--no-ext-diff", `${base}...HEAD`]);
  console.log(sizeLine(lineCounts(parseNumstat(raw))));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = main();
