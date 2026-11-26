// The shell guard (plugins/cookbook/hooks/shell-guard-lib.mjs, recipes/learning-loop.md).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { guard } from "../plugins/cookbook/hooks/shell-guard-lib.mjs";

const HOOK = fileURLToPath(new URL("../plugins/cookbook/hooks/sandbox-route.mjs", import.meta.url));
const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });
const denied = (command) => guard(bash(command))?.hookSpecificOutput.permissionDecision === "deny";
const reason = (command) => guard(bash(command)).hookSpecificOutput.permissionDecisionReason;

test("a pkill -f that would kill its own shell is stopped, with the bracketed pattern", () => {
  for (const c of [
    'pkill -f "film.py -- roll phone" ; cd /x && python3 a.py',
    "pkill -f 'merge-when-green.sh repo 66'; sleep 1; pgrep -af merge",
    'pgrep -f "gh pr checks 36 --watch" | xargs -r kill 2>/dev/null; sleep 1',
    "for p in $(pgrep -f 'onboard.sh repo'); do kill -TERM $p; done",
    "kill $(pgrep -f astro.mjs)",
    'sudo pkill -9 -f "node --test scripts/a.test.mjs"',
    'pkill --full "x y"',
  ]) assert.ok(denied(c), c);
  assert.match(reason('pkill -f "film.py -- roll"'), /'\[f\]ilm\.py -- roll'/);
});

test("a pkill or pgrep that cannot kill its own shell runs", () => {
  for (const c of [
    'pkill -f "[f]ilm.py -- roll"; echo done',
    "pgrep -af 'merge-when-green' | cut -c1-120",
    "pkill node",
    "ps -eo pid,args | grep x",
    'grep -n "pkill -f x" notes.md',
    "git commit -qm 'note: pkill -f kills its own shell'",
    "python3 - <<'EOF'\nimport os\nos.system('pkill -f film.py')\nEOF",
  ]) assert.ok(!denied(c), c);
});

test("rm -rf is stopped with the next step; other removals run", () => {
  for (const c of [
    "S=/tmp/s; D=$S/t; rm -rf $D; mkdir -p $D",
    "cd x && rm -fr build",
    "timeout 5 rm -Rf out",
    "rm -r -f out",
    "rm --recursive --force out",
    "env A=1 rm -rf x",
  ]) assert.ok(denied(c), c);
  assert.match(reason("rm -rf $D"), /mktemp -d -p "\$S"/);
  assert.match(reason("rm -rf $D"), /~\/\.local\/share\/backups\//);
  for (const c of [
    "rm -f a.txt",
    "rm -r empty",
    "git rm -rf --cached x",
    'echo "never rm -rf"',
    "cat <<'EOF' > notes.md\nrm -rf is denied\nEOF",
  ]) assert.ok(!denied(c), c);
});

test("only Bash is guarded, and nothing else is touched", () => {
  assert.equal(guard({ tool_name: "PowerShell", tool_input: { command: "pkill -f x; echo" } }), null);
  assert.equal(guard({ tool_name: "Bash", tool_input: {} }), null);
  assert.equal(guard(bash("ls -la")), null);
});

test("the hook process denies through the guard and still never fails the call", () => {
  const hook = (input) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: "utf8" });
  let r = hook({ ...bash("pkill -f 'a b'; echo"), cwd: "/" });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, "deny");
  r = hook({ ...bash("echo hi"), cwd: "/" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});
