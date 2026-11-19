#!/usr/bin/env node
// The AgentShield scan of the Claude Code configuration (recipes/agent-audit.md).
// Read-only and advisory: it changes no configuration and installs nothing.
//
//   scan.mjs               one scan, compared with the saved baseline
//   scan.mjs --rebaseline  one scan, saved as the baseline (the owner's decision only)
//   scan.mjs --pin         records the installed AgentShield copy as the vetted one
//                          (after pinned-vet.sh and pinned-install.sh, never in a scheduled run)
//
// One run:
//   1. checks the installed copy against the pin: the version this file names, the lockfile
//      and every installed file. A copy that differs is not started.
//   2. builds a sanitized copy of the configuration (sanitize.mjs) and reads it again for
//      credential-shaped content. Anything left stops the run.
//   3. starts AgentShield on that copy under Node's permission model: it may read its own
//      files and the copy, write one output folder, and nothing else: no network, no child
//      process. net-guard.mjs is loaded first and counts the attempts it stops.
//   4. compares the findings with the baseline and writes new-findings.md.
// A run that fails writes `MODE: failed` with the reason and exits 1.
//
// Folders (the tests set the AGENTSHIELD_* variables):
//   ~/.local/share/stack-atlas/agentshield   this script's copy, the pin, the baseline, the reports
//   ~/.local/share/agentshield               the pinned npm copy of ecc-agentshield
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync,
  rmSync, writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compare, renderFindings, slim, totals } from "./compare.mjs";
import { buildCopy, checkCopy, maskText } from "./sanitize.mjs";

// The version the scan runs. An update is a change to this line through a pull request,
// after the vetting; `--pin` then records the new copy.
export const PINNED = { package: "ecc-agentshield", version: "1.6.0" };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const stamp = (d = new Date()) => d.toISOString().replace(/\.\d+Z$/, "Z");
const compact = (iso) => iso.replace(/[-:]/g, "");
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

export function folders(env = process.env) {
  const home = env.AGENTSHIELD_HOME || os.homedir();
  return {
    home,
    dir: env.AGENTSHIELD_DIR || path.join(home, ".local", "share", "stack-atlas", "agentshield"),
    pkg: env.AGENTSHIELD_PACKAGE_DIR || path.join(home, ".local", "share", "agentshield"),
    projectRoots: env.AGENTSHIELD_PROJECT_ROOTS ? env.AGENTSHIELD_PROJECT_ROOTS.split(path.delimiter).filter(Boolean) : [path.join(home, "Desktop")],
  };
}

// One hash over the installed copy: the two package files and everything in node_modules,
// by path. A link counts by its target text, never by what it points at.
export function treeHash(pkg) {
  const hash = createHash("sha256");
  let files = 0;
  const add = (full, rel) => {
    const st = lstatSync(full);
    if (st.isSymbolicLink()) hash.update(`${rel}\0link:${readlinkSync(full)}\n`);
    else if (st.isDirectory()) { for (const name of readdirSync(full).sort()) add(path.join(full, name), `${rel}/${name}`); return; }
    else hash.update(`${rel}\0${sha256(readFileSync(full))}\n`);
    files += 1;
  };
  for (const name of ["package.json", "package-lock.json", "node_modules"]) {
    if (!existsSync(path.join(pkg, name))) throw new Error(`the pinned copy has no ${name} in ${pkg}`);
    add(path.join(pkg, name), name);
  }
  return { sha256: hash.digest("hex"), files };
}

function installedVersion(pkg) {
  const file = path.join(pkg, "node_modules", PINNED.package, "package.json");
  try { return JSON.parse(readFileSync(file, "utf8")).version; } catch { throw new Error(`${PINNED.package} is not installed in ${pkg}`); }
}

export function writePin({ dir, pkg }) {
  const version = installedVersion(pkg);
  if (version !== PINNED.version) throw new Error(`the installed copy is ${PINNED.package}@${version}; this script pins ${PINNED.version}`);
  const tree = treeHash(pkg);
  const pin = { ...PINNED, lockSha256: sha256(readFileSync(path.join(pkg, "package-lock.json"))), treeSha256: tree.sha256, files: tree.files, pinnedAt: stamp() };
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "pinned.json"), JSON.stringify(pin, null, 2) + "\n");
  return pin;
}

export function verifyPin({ dir, pkg }) {
  let pin;
  try { pin = JSON.parse(readFileSync(path.join(dir, "pinned.json"), "utf8")); } catch { throw new Error("no pin: the installed copy was never recorded as the vetted one (scan.sh --pin after the vetting and the install)"); }
  if (pin.package !== PINNED.package || pin.version !== PINNED.version) throw new Error(`the pin is for ${pin.package}@${pin.version}; this script pins ${PINNED.package}@${PINNED.version}`);
  const version = installedVersion(pkg);
  if (version !== PINNED.version) throw new Error(`the installed copy is ${PINNED.package}@${version}, not the pinned ${PINNED.version}`);
  if (sha256(readFileSync(path.join(pkg, "package-lock.json"))) !== pin.lockSha256) throw new Error("the installed lockfile differs from the pinned one");
  const tree = treeHash(pkg);
  if (tree.sha256 !== pin.treeSha256) throw new Error(`the installed files differ from the pinned copy (${tree.files} files now, ${pin.files} pinned)`);
  return pin;
}

// Starts AgentShield once. Returns { status, stdout, stderr, blocked }.
function startTool({ pkg, work, out, copy }, format, output) {
  const real = (p) => realpathSync(p);
  const guard = real(path.join(HERE, "net-guard.mjs"));
  const entry = real(path.join(pkg, "node_modules", PINNED.package, "dist", "index.js"));
  const args = [
    "--permission",
    `--allow-fs-read=${real(pkg)}`, `--allow-fs-read=${real(work)}`, `--allow-fs-read=${guard}`,
    `--allow-fs-write=${real(out)}`,
    "--import", pathToFileURL(guard).href,
    entry, "scan", "--path", real(copy), "--format", format, "--output", output,
  ];
  // Nothing of this session's environment reaches the scanner: no key, no real home folder.
  const env = { PATH: "/usr/bin:/bin", HOME: real(path.join(work, "home")), NO_COLOR: "1", FORCE_COLOR: "0" };
  const run = spawnSync(process.execPath, args, { cwd: real(out), env, encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  const stderr = run.stderr ?? "";
  return {
    status: run.error ? `not started: ${run.error.message}` : run.status, stdout: run.stdout ?? "", stderr,
    ready: /^NETGUARD ready net=false child=false$/m.test(stderr),
    blocked: (stderr.match(/^NETGUARD blocked .*$/gm) ?? []),
  };
}

const keepNewest = (dir, pattern, keep) => {
  const names = readdirSync(dir).filter((n) => pattern.test(n)).sort();
  for (const name of names.slice(0, Math.max(0, names.length - keep))) rmSync(path.join(dir, name), { force: true });
};

// Node's permission model covers the network from Node 25 on (`--allow-net`). On an older
// Node the guard would be the only lock, so the scan does not run there.
export const networkIsCovered = () => process.allowedNodeEnvironmentFlags.has("--allow-net");

// `afterCopy` and `olderNode` are for the tests only, and no command line or variable
// sets them: `afterCopy` is called with the copy's folder before the second look, and
// `olderNode` lets a run start on a Node below 25, where only the guard stops the network.
export function scan({ rebaseline = false, env = process.env, afterCopy, olderNode = false } = {}) {
  const f = folders(env);
  const at = stamp();
  const work = path.join(f.dir, "work");
  const out = path.join(work, "out");
  const logs = path.join(out, "logs");
  const copy = path.join(work, "copy");
  const state = path.join(f.dir, "state");
  const findingsFile = path.join(f.dir, "new-findings.md");
  const log = [`run ${at}${rebaseline ? " (rebaseline)" : ""}`];
  // What is written is masked once more: a value that passed the copy does not pass twice.
  const finish = (run) => {
    writeFileSync(findingsFile, maskText(renderFindings(run)));
    try {
      writeFileSync(path.join(logs, `scan-${compact(at)}.log`), maskText(log.join("\n")) + "\n");
      keepNewest(logs, /^scan-.*\.log$/, 20);
    } catch { /* the result is written; a log that cannot be is not worth losing it */ }
    return run;
  };
  try {
    mkdirSync(logs, { recursive: true });
    // Until the run ends, the output says that it did not: a run that is stopped or crashes
    // leaves this text, never the result of an earlier run.
    writeFileSync(findingsFile, renderFindings({ mode: "failed", at, reason: "the run started and did not finish (it was stopped or it crashed)", logs }));
    if (!olderNode && !networkIsCovered()) throw new Error(`Node ${process.version} has no network permission (--allow-net): the scan needs Node 25 or newer`);
    const pin = verifyPin(f);
    log.push(`pin ok: ${pin.package}@${pin.version}, ${pin.files} files, pinned ${pin.pinnedAt}`);

    for (const name of ["copy", "home"]) rmSync(path.join(work, name), { recursive: true, force: true });
    for (const name of ["report.json", "evidence"]) rmSync(path.join(out, name), { recursive: true, force: true });
    mkdirSync(path.join(work, "home"), { recursive: true });
    mkdirSync(path.join(out, "evidence"), { recursive: true });
    const copied = buildCopy({ home: f.home, projectRoots: f.projectRoots, dest: copy });
    log.push(`copy: ${copied.files} files, ${copied.masked.length} with a value taken out, ${copied.skipped.length} skipped`);
    for (const skipped of copied.skipped) log.push(`  skipped ${skipped.file}: ${skipped.why}`);
    afterCopy?.(copy);
    const problems = checkCopy(copy);
    if (problems.length) {
      for (const p of problems) log.push(`  check: ${p.file}: ${p.problem}`);
      throw new Error(`the sanitized copy still holds ${problems.length} problem(s), first: ${problems[0].file}: ${problems[0].problem}. Nothing was scanned`);
    }

    const reportPath = path.join(out, "report.json");
    const tool = startTool({ pkg: f.pkg, work, out, copy }, "json", reportPath);
    log.push(`scanner exit ${tool.status}, guard ready ${tool.ready}, blocked calls ${tool.blocked.length}`, "--- stdout", tool.stdout.slice(-4000), "--- stderr", tool.stderr.slice(-4000));
    if (!tool.ready) throw new Error("the scanner did not start under the permission model with the network guard");
    if (tool.status !== 0 && tool.status !== 2) throw new Error(`the scanner ended with ${tool.status}: ${tool.stderr.trim().split("\n").filter((l) => !l.startsWith("NETGUARD")).slice(-2).join(" / ").slice(0, 300)}`);
    let report;
    try { report = JSON.parse(readFileSync(reportPath, "utf8")); } catch { throw new Error("the scanner wrote no report that can be read"); }
    if (!Array.isArray(report.findings) || typeof report.score?.numericScore !== "number") throw new Error("the report has no findings list or no score");

    // The HTML report is for reading only: a failure here is logged and changes nothing.
    const html = startTool({ pkg: f.pkg, work, out, copy }, "html", path.join(out, "evidence", "report.html"));
    log.push(`html report exit ${html.status}`);

    const findings = report.findings.map(slim);
    let run = {
      at, tool: `${pin.package}@${pin.version}`, score: report.score, findings, copy: copied,
      filesScanned: report.summary?.filesScanned, blockedCalls: tool.blocked.length + html.blocked.length, logs,
    };
    // Everything that can fail is done before an output of an earlier run is replaced.
    const baselinePath = path.join(state, "baseline.json");
    const archive = path.join(f.dir, "archive");
    mkdirSync(state, { recursive: true });
    mkdirSync(archive, { recursive: true });
    let baseline = null;
    if (existsSync(baselinePath)) {
      try { baseline = JSON.parse(readFileSync(baselinePath, "utf8")); } catch { throw new Error("the baseline file cannot be read; it was left as it is"); }
      if (!Array.isArray(baseline.findings)) throw new Error("the baseline file has no findings list; it was left as it is");
    }
    // The run before this one, for the change in totals. It is not a baseline: nothing is
    // called new or resolved against it.
    const before = readdirSync(archive).filter((n) => /-report\.json$/.test(n)).sort().pop();
    if (before) {
      try {
        const old = JSON.parse(readFileSync(path.join(archive, before), "utf8"));
        run.previous = { at: old.timestamp, totals: totals(old.findings.map(slim)), score: old.score?.numericScore };
      } catch { log.push(`the report of the run before (${before}) cannot be read`); }
    }
    const previousBaseline = rebaseline && baseline ? path.join(state, `baseline-${compact(String(baseline.savedAt ?? at)).replace(/[^0-9TZ]/g, "")}.json`) : null;
    if (rebaseline) run = { ...run, mode: "baseline-created", previousBaseline };
    else if (!baseline) run = { ...run, mode: "no-baseline" };
    else run = { ...run, mode: "compare", baseline, ...compare(baseline.findings, findings) };
    renderFindings(run);

    const reportText = maskText(JSON.stringify(report, null, 2)) + "\n";
    writeFileSync(path.join(f.dir, "latest-report.json"), reportText);
    writeFileSync(path.join(archive, `${compact(at)}-report.json`), reportText);
    keepNewest(archive, /-report\.json$/, 26);
    if (rebaseline) {
      // The new baseline is whole on disk before the one before it is moved aside.
      writeFileSync(`${baselinePath}.new`, JSON.stringify({ savedAt: at, tool: run.tool, score: report.score, totals: totals(findings), findings }, null, 2) + "\n");
      if (previousBaseline) renameSync(baselinePath, previousBaseline);
      renameSync(`${baselinePath}.new`, baselinePath);
    }
    return finish(run);
  } catch (error) {
    log.push(`failed: ${error.stack ?? error}`);
    const failed = { mode: "failed", at, reason: error.message, logs };
    try { return finish(failed); } catch { return failed; }
  }
}

function main(argv) {
  const known = new Set(["--rebaseline", "--pin"]);
  const unknown = argv.filter((a) => !known.has(a));
  if (unknown.length || argv.length > 1) {
    console.error("usage: scan.sh [--rebaseline | --pin]");
    return 64;
  }
  if (argv[0] === "--pin") {
    try {
      const pin = writePin(folders());
      console.log(`pinned ${pin.package}@${pin.version}: ${pin.files} files, tree ${pin.treeSha256.slice(0, 16)}, lockfile ${pin.lockSha256.slice(0, 16)}`);
      return 0;
    } catch (error) { console.error(`not pinned: ${error.message}`); return 1; }
  }
  const run = scan({ rebaseline: argv[0] === "--rebaseline" });
  console.log(maskText(renderFindings(run)).split("\n\n")[0]);
  console.log(`full text: ${path.join(folders().dir, "new-findings.md")}`);
  return run.mode === "failed" ? 1 : 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
