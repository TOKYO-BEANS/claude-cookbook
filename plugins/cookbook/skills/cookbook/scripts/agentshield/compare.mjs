// The baseline compare of the AgentShield scan, and the text of new-findings.md.
// A finding is the same one when its file, its id and its title are the same. AgentShield
// builds some ids from a position in the file, so an edit above a finding can make it
// "new" and "resolved" at once: such a pair gets a changed-evidence hint.

import { maskOutput, maskText } from "./sanitize.mjs";

const SEVERITIES = ["critical", "high", "medium", "low", "info"];
const text = (v, max = 400) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export const findingKey = (f) => [f.file ?? "", f.id ?? "", f.title ?? ""].join("\u0000");

// What the scan keeps of a finding: enough to compare and to read, never a whole report.
// The scanner quotes the files it read, so what it says is masked again here: the names a
// finding is found by (id, file) with the copy's own mask, its texts with the stricter one.
export const slim = (f) => ({
  id: maskText(text(f.id, 200)), severity: SEVERITIES.includes(f.severity) ? f.severity : "info", category: text(f.category, 60),
  title: maskOutput(text(f.title, 200)), file: maskText(text(f.file, 300)), ...(Number.isInteger(f.line) ? { line: f.line } : {}),
  description: maskOutput(text(f.description)), evidence: maskOutput(text(f.evidence, 300)),
});

export function totals(findings) {
  const out = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const f of findings) out[SEVERITIES.includes(f.severity) ? f.severity : "info"] += 1;
  return out;
}

// { added, resolved }: what the current run has beyond the baseline, and what it lacks.
// Two findings with one key count twice. An added finding whose file and title match a
// resolved one carries `hint`, the resolved finding's id.
export function compare(baselineFindings, currentFindings) {
  const left = new Map();
  for (const f of baselineFindings) left.set(findingKey(f), [...(left.get(findingKey(f)) ?? []), f]);
  const added = [];
  for (const f of currentFindings) {
    const same = left.get(findingKey(f));
    if (same?.length) same.shift(); else added.push({ ...f });
  }
  const resolved = [...left.values()].flat();
  const free = [...resolved];
  for (const f of added) {
    const i = free.findIndex((r) => r.file === f.file && r.title === f.title);
    if (i >= 0) f.hint = free.splice(i, 1)[0].id;
  }
  const bySeverity = (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
  return { added: added.sort(bySeverity), resolved: resolved.sort(bySeverity) };
}

const totalsLine = (t) => `${SEVERITIES.map((s) => `${s} ${t[s]}`).join(", ")} (${SEVERITIES.reduce((n, s) => n + t[s], 0)})`;
const one = (f, n) => [
  `### ${n}. [${f.severity}] ${text(f.title, 200)}`,
  `- file: ${text(f.file, 300) || "(none)"}${Number.isInteger(f.line) ? `, line ${f.line}` : ""}`,
  `- id: ${text(f.id, 200)}; category: ${text(f.category, 60)}`,
  ...(f.description ? [`- what: ${text(f.description)}`] : []),
  ...(f.evidence ? [`- evidence: ${text(f.evidence, 300)}`] : []),
  ...(f.hint ? [`- Changed-evidence hint: the same title in the same file was resolved in this run (${text(f.hint, 200)}): probably one finding whose position or text changed.`] : []),
].join("\n");

// The text of new-findings.md. The first three lines are read by a program.
export function renderFindings(run) {
  const head = (n, r) => [`NEW_FINDINGS: ${n}`, `RESOLVED_FINDINGS: ${r}`, `MODE: ${run.mode}`];
  if (run.mode === "failed") {
    return [...head("unknown", "unknown"), `RUN: ${run.at}`, `REASON: ${text(run.reason, 600)}`, `LOGS: ${run.logs}`, ""].join("\n");
  }
  const t = totals(run.findings);
  const lines = [
    ...(run.mode === "compare" ? head(run.added.length, run.resolved.length) : head(run.mode === "baseline-created" ? 0 : "unknown", run.mode === "baseline-created" ? 0 : "unknown")),
    `RUN: ${run.at}`,
    `TOOL: ${run.tool}`,
    `SCORE: ${run.score.numericScore}/100, grade ${run.score.grade}${run.baseline ? `; baseline ${run.baseline.score?.numericScore}/100 of ${run.baseline.savedAt}` : ""}`,
    `TOTALS: ${totalsLine(t)}`,
    `PREVIOUS_RUN: ${run.previous ? `${text(run.previous.at, 40)}: ${totalsLine(run.previous.totals)}, score ${run.previous.score}/100` : "none"}`,
    `FILES: ${run.copy.files} copied, ${run.filesScanned ?? "?"} read by the scanner; ${run.copy.masked.length} with a masked or redacted value`,
    `SKIPPED: ${run.copy.skipped?.length ?? 0}`,
    `BLOCKED_CALLS: ${run.blockedCalls}`,
    "",
  ];
  if (run.mode === "no-baseline") {
    lines.push("No baseline has been accepted yet, so nothing can be called new. Only the owner decides a baseline.", "");
    const top = run.findings.filter((f) => f.severity === "critical" || f.severity === "high");
    lines.push(`## Critical and high findings (${top.length})`, "", ...top.map((f, i) => one(f, i + 1)), "");
  } else if (run.mode === "baseline-created") {
    lines.push(`This run was saved as the baseline${run.previousBaseline ? `; the one before it is ${run.previousBaseline}` : ""}.`, "");
  } else {
    lines.push(`## New findings (${run.added.length})`, "", ...(run.added.length ? run.added.map((f, i) => one(f, i + 1)) : ["None."]), "");
    lines.push(`## Resolved findings (${run.resolved.length})`, "", ...(run.resolved.length ? run.resolved.map((f) => `- [${f.severity}] ${text(f.title, 200)} (${text(f.file, 300) || "no file"})`) : ["None."]), "");
  }
  if (run.copy.skipped?.length) {
    lines.push("## Files left out of the copy", "", "The scanner did not read these: a finding in one of them cannot show up, new or resolved.", "");
    for (const skipped of run.copy.skipped.slice(0, 60)) lines.push(`- ${text(skipped.file, 300)}: ${text(skipped.why, 80)}`);
    if (run.copy.skipped.length > 60) lines.push(`- and ${run.copy.skipped.length - 60} more files`);
    lines.push("");
  }
  if (run.copy.masked.length) {
    lines.push("## Values the sanitizer took out", "", "Counts only, by file. A file that was not here in the last run is worth a look.", "");
    for (const m of run.copy.masked.slice(0, 60)) lines.push(`- ${m.file}: ${Object.entries(m.counts).map(([k, n]) => `${k} x${n}`).join(", ")}`);
    if (run.copy.masked.length > 60) lines.push(`- and ${run.copy.masked.length - 60} more files`);
    lines.push("");
  }
  return lines.join("\n");
}
