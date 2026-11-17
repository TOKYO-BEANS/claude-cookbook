// The boat route hook (plugins/cookbook/hooks/boat-route*.mjs, recipes/boat.md).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { decide, find, instead, kind, marked, place, read } from "../plugins/cookbook/hooks/boat-route-lib.mjs";

const HOOK = fileURLToPath(new URL("../plugins/cookbook/hooks/boat-route.mjs", import.meta.url));
const kinds = (text, opts = {}) => find(text, { cwd: "/w", windows: false, ...opts }).runs.map((r) => r.kind);

test("the test runners and scans it stops, in command position", () => {
  assert.deepEqual(kinds("npm test"), ["npm"]);
  assert.deepEqual(kinds("npm run test:unit"), ["npm"]);
  assert.deepEqual(kinds("npm t -- --grep x"), ["npm"]);
  assert.deepEqual(kinds("pnpm test"), ["npm"]);
  assert.deepEqual(kinds("node --test"), ["node"]);
  assert.deepEqual(kinds("node --test-reporter=spec --test scripts/a.test.mjs"), ["node"]);
  assert.deepEqual(kinds('"C:/Program Files/nodejs/node.exe" --test'), ["node"]);
  assert.deepEqual(kinds("pytest -q tests/"), ["pytest"]);
  assert.deepEqual(kinds("python3 -m pytest"), ["pytest"]);
  assert.deepEqual(kinds("uv run --with pytest pytest"), ["pytest"]);
  assert.deepEqual(kinds("semgrep scan --config p/default ."), ["semgrep"]);
  assert.deepEqual(kinds("semgrep --config auto"), ["semgrep"]);
  assert.deepEqual(kinds("semgrep ci --dry-run"), ["semgrep-ci"]);
  assert.deepEqual(kinds("timeout 600 npm test 2>&1 | tail -20"), ["npm"]);
  assert.deepEqual(kinds("CI=1 npm test"), ["npm"]);
  assert.deepEqual(kinds("git status && npm test; echo done"), ["npm"]);
  assert.deepEqual(kinds("bash -c 'npm ci && npm test'"), ["npm"]);
  assert.deepEqual(kinds('pwsh -Command "npm test"'), ["npm"]);
  assert.deepEqual(kinds("node C:/x/with-key.mjs semgrep SEMGREP_APP_TOKEN semgrep scan ."), ["semgrep"]);
});

test("what it leaves alone: other commands, quoted words, scripts, here-documents", () => {
  for (const text of [
    'grep -n "npm test" README.md',
    "git commit -m 'run npm test on boat'",
    "npm ci",
    "npm install --save-dev x",
    "npm run build",
    "node scripts/check.mjs --test",
    "node -e \"console.log('--test')\"",
    "semgrep --version",
    "echo pytest",
    "cat > notes.md <<'EOF'\nnpm test\npytest\nEOF\ngit status",
    "node plugins/cookbook/skills/cookbook/scripts/boat-run.mjs --timeout 1200 --push . -- npm test",
    "node boat-run.mjs --timeout 600 --push . -- bash -c 'npm ci && npm test'",
  ]) assert.deepEqual(kinds(text), [], text);
  assert.deepEqual(kinds("$x = @'\nnpm test\n'@\nWrite-Output $x", { shell: "powershell" }), []);
});

test("PowerShell: backslashes are literal, the backtick escapes", () => {
  const r = find("Set-Location C:\\Users\\me\\repo; npm test", { shell: "powershell", cwd: "C:/", windows: true }).runs;
  assert.deepEqual(r.map((x) => [x.kind, x.dir]), [["npm", "C:/Users/me/repo"]]);
  assert.deepEqual(read("echo `\"npm test`\"", "powershell").commands.map((c) => c.words), [["echo", '"npm', 'test"']]);
});

test("the folder: cd before it, npm --prefix, Git Bash drive paths and ~", () => {
  const dir = (text, opts) => find(text, { cwd: "C:/start", home: "C:/Users/me", windows: true, ...opts }).runs.map((r) => r.dir);
  assert.deepEqual(dir("cd /c/Users/me/repo && npm test"), ["C:/Users/me/repo"]);
  assert.deepEqual(dir("cd ~/repo && npm test"), ["C:/Users/me/repo"]);
  assert.deepEqual(dir("npm --prefix sub test"), ["C:/start/sub"]);
  assert.deepEqual(dir("npm test"), ["C:/start"]);
  assert.equal(place("/a", "../b", { windows: false }), "/b");
});

test("kind reads only the command word", () => {
  assert.equal(kind(["echo", "npm", "test"]), null);
  assert.deepEqual(kind(["npm", "test"]), { kind: "npm", dir: null });
});

test("the marker keeps a run local only with a reason", () => {
  assert.equal(marked(read("npm test # local-run: needs DPAPI on Windows").comments), true);
  assert.equal(marked(read("npm test # local-run:").comments), false);
  assert.equal(marked(read("npm test # local-run: x").comments), false);
  assert.equal(marked(read('echo "# local-run: in a string is not a comment"; npm test').comments), false);
});

const REPO = { listed: true, key: "github.com/o/r", top: "C:/w/r", prefix: "", deps: false, lock: true, requirements: false, semgrep: null };
const deps = (repo = REPO) => ({ cwd: (i) => i.cwd, home: "C:/Users/me", windows: true, script: "C:/p/boat-run.mjs", repo: () => repo });
const ask = (command, tool = "Bash") => ({ tool_name: tool, cwd: "C:/w/r", tool_input: { command } });

test("the command it names instead", () => {
  const run = (raw, k) => ({ kind: k, raw });
  assert.equal(instead(run("npm test", "npm"), REPO, { script: "C:/p/boat-run.mjs" }),
    `node "C:/p/boat-run.mjs" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test'`);
  assert.equal(instead(run("npm test", "npm"), { ...REPO, deps: true, prefix: "sub/" }, { script: "s" }),
    `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'cd sub && npm ci --ignore-scripts && npm test'`);
  assert.equal(instead(run("pytest -q", "pytest"), { ...REPO, requirements: true }, { script: "s" }),
    `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'uv run --with pytest --with-requirements requirements.txt pytest -q'`);
  assert.equal(instead(run("semgrep scan --config 'p/default'", "semgrep"), { ...REPO, semgrep: "1.140.0" }, { script: "s" }),
    `node "s" --type default --timeout 1800 --push "C:/w/r" -- bash -c 'uvx semgrep@1.140.0 scan --config '\\''p/default'\\'''`);
  assert.equal(instead(run("npm test -- 'a b'", "npm"), REPO, { script: "s", shell: "powershell" }),
    `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test -- ''a b'''`);
});

test("decide: a listed repository is denied with the route; others run", () => {
  const out = decide({ input: ask("npm test"), deps: deps() });
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /github\.com\/o\/r is on boat-run's upload list/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /node "C:\/p\/boat-run\.mjs" --timeout 1200 --push "C:\/w\/r" -- bash -c 'npm test'/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /# local-run: <why>/);
  assert.equal(decide({ input: ask("npm test"), deps: deps({ ...REPO, listed: false }) }), null);
  assert.equal(decide({ input: ask("npm test"), deps: deps(null) }), null);
  assert.equal(decide({ input: ask("npm test # local-run: the DPAPI tests need Windows"), deps: deps() }), null);
  assert.equal(decide({ input: ask("git status"), deps: deps() }), null);
  assert.equal(decide({ input: { tool_name: "Read", tool_input: { file_path: "npm test" } }, deps: deps() }), null);
  assert.equal(decide({ input: ask("npm test", "PowerShell"), deps: deps() }).hookSpecificOutput.permissionDecision, "deny");
  assert.match(decide({ input: ask("semgrep ci"), deps: deps() }).hookSpecificOutput.permissionDecisionReason, /CI `semgrep` job/);
});

// The hook as a process, on a repository made here and on the real upload list: a folder
// that is no repository, and one whose origin is not listed, both run.
test("the hook process lets unlisted folders run, and never fails the call", () => {
  const tmp = mkdtempSync(join(tmpdir(), "boat-route-"));
  try {
    const hook = (input) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: "utf8" });
    let r = hook({ tool_name: "Bash", cwd: tmp, tool_input: { command: "npm test" } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    spawnSync("git", ["init", "-q", tmp]);
    spawnSync("git", ["-C", tmp, "remote", "add", "origin", "https://example.invalid/nobody/not-listed.git"]);
    writeFileSync(join(tmp, "package.json"), "{}");
    r = hook({ tool_name: "Bash", cwd: tmp, tool_input: { command: "npm test" } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    r = spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
