// The boat route hook (plugins/cookbook/hooks/boat-route*.mjs, recipes/boat.md).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { decide, find, instead, kind, marked, place, read, sh } from "../plugins/cookbook/hooks/boat-route-lib.mjs";

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
  assert.deepEqual(kind(["CI=1", "timeout", "60", "npm", "--prefix", "sub", "test"]), { kind: "npm", dir: "sub", env: ["CI=1"], envTyped: ["CI=1"], words: ["npm", "test"], typed: ["npm", "test"] });
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

test("the command it names instead, rebuilt from the parsed words", () => {
  const as = (text, repo = REPO, shell = "bash") => {
    const [run] = find(text, { shell: shell === "powershell" ? "powershell" : "bash", cwd: "C:/w/r", windows: true }).runs;
    return instead(run, repo, { script: "s", shell });
  };
  assert.equal(as("npm test"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test'`);
  assert.equal(as("npm test", { ...REPO, deps: true, prefix: "sub/" }),
    `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'cd sub && npm ci --ignore-scripts && npm test'`);
  // The folder option is not passed on: the folder is the run's own (review of #108).
  assert.equal(as("npm --prefix sub test", { ...REPO, prefix: "sub/" }), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'cd sub && npm test'`);
  assert.equal(as("pytest -q", { ...REPO, requirements: true }),
    `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'uv run --with pytest --with-requirements requirements.txt pytest -q'`);
  // Variables stay in front; a timeout wrapper is dropped (boat-run has its own).
  assert.equal(as("PYTHONPATH=. pytest -q"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'PYTHONPATH=. uv run --with pytest pytest -q'`);
  assert.equal(as("SEMGREP_SEND_METRICS=off semgrep scan --config p/default", { ...REPO, semgrep: "1.140.0" }),
    `node "s" --type default --timeout 1800 --push "C:/w/r" -- bash -c 'SEMGREP_SEND_METRICS=off uvx semgrep@1.140.0 scan --config p/default'`);
  assert.equal(as("timeout 600 semgrep scan ."), `node "s" --type default --timeout 1800 --push "C:/w/r" -- bash -c 'uvx semgrep scan .'`);
  assert.equal(as("python -m pytest"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'uv run --with pytest python3 -m pytest'`);
  // Quoted words keep their quotes; PowerShell gets its own outer quoting.
  assert.equal(as(`semgrep scan --config "p/a b"`), `node "s" --type default --timeout 1800 --push "C:/w/r" -- bash -c 'uvx semgrep scan --config "p/a b"'`);
  assert.equal(as("npm test -- 'it''s'", REPO, "powershell"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test -- "it''s"'`);
  assert.equal(sh("$x"), "'$x'");
  // Second review of #108: redirections are dropped; globs, $VAR and ~ keep their meaning.
  assert.equal(as("npm test 2>&1 | tail -20"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test'`);
  assert.equal(as("pytest tests/ > out.txt"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'uv run --with pytest pytest tests/'`);
  assert.equal(as("pytest tests/test_*.py ~/x"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'uv run --with pytest pytest tests/test_*.py ~/x'`);
  assert.equal(as(`npm test -- --grep "$PAT"`), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test -- --grep "$PAT"'`);
  assert.equal(as(`FOO="a b" npm test`), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'FOO="a b" npm test'`);
  assert.equal(as("npm test -- $env:FOO", REPO, "powershell"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test -- ''$env:FOO'''`);
  assert.deepEqual(kinds("cat <<\\EOF\nnpm test\nEOF"), []);
  // Third review: a quoted argument that looks like a redirection stays; PowerShell's *> goes.
  assert.equal(as(`npm test -- --grep "<x>" 2>&1`), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test -- --grep "<x>"'`);
  assert.equal(as("npm test *> out.txt", REPO, "powershell"), `node "s" --timeout 1200 --push "C:/w/r" -- bash -c 'npm test'`);
});

test("third review of #108: what the reader does not model is let through; pytest only as the program", () => {
  // Command substitutions, here-documents, block comments and here-strings: unread, allowed.
  assert.deepEqual(kinds(`git commit -m "$(echo "Fix flake; pytest now green")"`), []);
  assert.deepEqual(kinds(`gh pr comment 108 --body "$(printf '%s\\n' "Ran it; npm test passed")"`), []);
  assert.deepEqual(kinds("x=`npm test`"), []);
  assert.deepEqual(kinds("<#\nnpm test\n#>\nGet-Date", { shell: "powershell" }), []);
  assert.deepEqual(kinds("Write-Output $(npm test)", { shell: "powershell" }), []);
  // Installs that name pytest are not test runs.
  for (const text of ["uv pip install pytest", "uv add --dev pytest", "poetry add --group dev pytest", "pipenv install pytest", "uv run --with pytest python script.py", "uvx --from pytest ruff"]) {
    assert.deepEqual(kinds(text), [], text);
  }
  assert.deepEqual(kinds("uv run --with pytest pytest -q"), ["pytest"]);
  assert.deepEqual(kinds("uvx pytest"), ["pytest"]);
  assert.deepEqual(kinds("poetry run pytest"), ["pytest"]);
  // bash keywords before a runner.
  assert.deepEqual(kinds("for f in a b; do npm test; done"), ["npm"]);
  assert.deepEqual(kinds("if true; then npm test; fi"), ["npm"]);
});

test("review of #108: an odd quote in a commit message's here-document, and a quoted Windows folder", () => {
  const msg = "git commit -m \"$(cat <<'EOF'\nHook: a 6\" timeout\nnpm test now runs on boat\nEOF\n)\"";
  assert.deepEqual(kinds(msg), []);
  assert.equal(decide({ input: ask(msg), deps: deps() }), null);
  const r = find(String.raw`cd "C:\r\sub" && npm test`, { cwd: "C:/", windows: true }).runs;
  assert.deepEqual(r.map((x) => x.dir), ["C:/r/sub"]);
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
