// The boat route (recipes/boat.md): a local `npm test`, `node --test`, `pytest` or
// `semgrep scan|ci` in a repository on boat-run's upload list is stopped before it starts,
// and the denial names the boat-run.mjs command to use instead. A run that needs Windows or
// this PC ends with a `# local-run: <why>` comment. Everything here is pure; the hook file
// (boat-route.mjs) brings git and the upload list.
import { posix, win32 } from "node:path";

// Cheap first look: most commands name none of these, and they leave without a parse.
export const HINT = /npm|pnpm|yarn|--test|pytest|py\.test|semgrep/i;
// The marker: a reason of at least ten characters, in a comment of the command.
const MARKER = /^#\s*local-run:\s*(\S.{8,}\S)/i;

// A small shell reader: enough of bash and PowerShell to tell a command word from a quoted
// argument (`grep "npm test"` runs grep). Returns the simple commands in order, each with its
// words and raw text, and the comments.
export function read(text, shell = "bash") {
  const ps = shell === "powershell";
  const esc = ps ? "`" : "\\";
  const seps = ps ? ";&|\n(){}" : ";&|\n(){}`";
  const list = [];
  const comments = [];
  let words = [];
  let word = null;
  let start = -1;
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endCommand = (at) => {
    endWord();
    if (words.length) list.push({ words, raw: text.slice(start, at).trim() });
    words = [];
    start = -1;
  };
  const heredocs = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (start < 0 && !/\s/.test(c) && !seps.includes(c)) start = i;
    // A here-document's lines are data, not commands: skipped to the line that ends it.
    if (c === "\n" && heredocs.length) {
      endCommand(i);
      let at = i + 1;
      for (const d of heredocs.splice(0)) {
        for (;;) {
          const end = text.indexOf("\n", at);
          const line = text.slice(at, end < 0 ? text.length : end);
          at = end < 0 ? text.length : end + 1;
          if (line.trim() === d || end < 0) break;
        }
      }
      i = at - 1;
      continue;
    }
    if (!ps && c === "<" && text[i + 1] === "<" && text[i + 2] !== "<") {
      const m = /^-?[ \t]*(['"]?)([A-Za-z0-9_.-]+)\1/.exec(text.slice(i + 2));
      if (m) {
        heredocs.push(m[2]);
        i += 1 + m[0].length;
        continue;
      }
    }
    // A PowerShell here-string, @' ... '@ or @" ... "@: one word.
    if (ps && c === "@" && (text[i + 1] === "'" || text[i + 1] === '"') && /^[ \t]*\r?\n/.test(text.slice(i + 2))) {
      const q = text[i + 1];
      const end = text.indexOf(`\n${q}@`, i + 2);
      word = (word ?? "") + text.slice(i + 2, end < 0 ? text.length : end);
      i = end < 0 ? text.length : end + 2;
      continue;
    }
    // `2>&1` and `&>`: a redirection, not a separator.
    if (c === "&" && (text[i - 1] === ">" || text[i + 1] === ">")) {
      word = (word ?? "") + c;
      continue;
    }
    if (c === esc && i + 1 < text.length) {
      i += 1;
      if (text[i] !== "\n") word = (word ?? "") + text[i];
    } else if (c === "'") {
      let j = i + 1;
      let s = "";
      while (j < text.length && !(text[j] === "'" && !(ps && text[j + 1] === "'"))) {
        if (ps && text[j] === "'" && text[j + 1] === "'") j += 1;
        s += text[j];
        j += 1;
      }
      word = (word ?? "") + s;
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < text.length && text[j] !== '"') {
        if (text[j] === esc && j + 1 < text.length) j += 1;
        s += text[j];
        j += 1;
      }
      word = (word ?? "") + s;
      i = j;
    } else if (c === "#" && word === null) {
      const end = text.indexOf("\n", i);
      comments.push(text.slice(i, end < 0 ? text.length : end).trim());
      endCommand(i);
      i = end < 0 ? text.length : end;
    } else if (seps.includes(c)) {
      endCommand(i);
    } else if (/\s/.test(c)) {
      endWord();
    } else {
      word = (word ?? "") + c;
    }
  }
  endCommand(text.length);
  return { commands: list, comments };
}

export const program = (w) => String(w).replace(/\\/g, "/").split("/").pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, "");

const WRAPPERS = new Set(["time", "env", "nice", "nohup", "exec", "command", "builtin", "xargs"]);
const CD = new Set(["cd", "chdir", "pushd", "set-location", "sl", "push-location"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash"]);
const PS_SHELLS = new Set(["powershell", "pwsh"]);
const SCRIPT = /\.(m|c)?(j|t)s$/i;

// The words of one command after the wrappers that only start another: `VAR=1`,
// `timeout 600`, `env`, `time`.
function unwrap(words) {
  let i = 0;
  for (;;) {
    if (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i += 1;
    else if (i < words.length && WRAPPERS.has(program(words[i]))) i += 1;
    else if (i < words.length && program(words[i]) === "timeout") {
      i += 1;
      while (i < words.length && words[i].startsWith("-")) i += 1;
      i += 1; // the duration
    } else break;
  }
  return words.slice(i);
}

// What kind of heavy run one command is, or null. `dir` is set when the command names its
// own folder (`npm --prefix x test`).
export function kind(words) {
  const w = unwrap(words);
  if (!w.length) return null;
  const p = program(w[0]);
  const rest = w.slice(1);
  if (p === "npm" || p === "pnpm" || p === "yarn") {
    let dir = null;
    for (let i = 0; i < rest.length; i += 1) {
      const a = rest[i];
      if (["--prefix", "-C", "--dir", "--cwd"].includes(a)) {
        dir = rest[i + 1] ?? null;
        i += 1;
      } else if (a.startsWith("-")) continue;
      else if (/^(test|t|tst)(:.*)?$/.test(a)) return { kind: "npm", dir };
      else if ((a === "run" || a === "run-script") && /^test(:.*)?$/.test(rest[i + 1] ?? "")) return { kind: "npm", dir };
      else return null;
    }
    return null;
  }
  if (p === "node") {
    for (const a of rest) {
      if (a === "--test") return { kind: "node", dir: null };
      if (!a.startsWith("-") && SCRIPT.test(a)) return null;
    }
    return null;
  }
  if (p === "pytest" || p === "py.test") return { kind: "pytest", dir: null };
  if (["python", "python3", "py"].includes(p)) {
    const m = rest.indexOf("-m");
    return m >= 0 && program(rest[m + 1] ?? "") === "pytest" ? { kind: "pytest", dir: null } : null;
  }
  if (["uv", "uvx", "poetry", "pipenv", "pdm", "hatch"].includes(p)) {
    return rest.some((a) => program(a) === "pytest") ? { kind: "pytest", dir: null } : null;
  }
  if (p === "semgrep") {
    const sub = rest.find((a) => !a.startsWith("-"));
    if (sub === "ci") return { kind: "semgrep-ci", dir: null };
    if (sub === "scan" || rest.some((a) => a === "--config" || a === "-c" || a.startsWith("--config="))) return { kind: "semgrep", dir: null };
    return null;
  }
  return null;
}

// A folder as node on this PC reads it: Git Bash's /c/... becomes C:/..., ~ the home folder.
export function place(base, arg, { home = "", windows = process.platform === "win32" } = {}) {
  let a = String(arg);
  if (a === "~" || a.startsWith("~/") || a.startsWith("~\\")) a = home + a.slice(1);
  if (windows && /^\/[a-z](\/|$)/i.test(a)) a = `${a[1].toUpperCase()}:/${a.slice(3)}`;
  const path = windows ? win32 : posix;
  return path.resolve(base, a).replace(/\\/g, "/");
}

// Every heavy run in a command line, with the folder it runs in.
export function find(text, { shell = "bash", cwd = ".", home = "", windows = process.platform === "win32", depth = 0 } = {}) {
  const out = { runs: [], comments: [] };
  if (depth > 3 || !HINT.test(text)) return out;
  const { commands, comments } = read(text, shell);
  out.comments.push(...comments);
  let here = cwd;
  const opts = { home, windows, depth: depth + 1 };
  for (const c of commands) {
    const w = unwrap(c.words);
    if (!w.length) continue;
    const p = program(w[0]);
    if (CD.has(p)) {
      const arg = w.slice(1).find((a) => !a.startsWith("-"));
      if (arg) here = place(here, arg, { home, windows });
      continue;
    }
    // A shell started with a command line: read that line too.
    if (SHELLS.has(p)) {
      const at = w.findIndex((a, i) => i > 0 && /^-[a-z]*c[a-z]*$/.test(a));
      if (at > 0 && w[at + 1] !== undefined) {
        const inner = find(w[at + 1], { ...opts, shell: "bash", cwd: here });
        out.runs.push(...inner.runs);
        out.comments.push(...inner.comments);
      }
      continue;
    }
    if (PS_SHELLS.has(p)) {
      const at = w.findIndex((a, i) => i > 0 && /^-(c|command)$/i.test(a));
      if (at > 0) {
        const inner = find(w.slice(at + 1).join(" "), { ...opts, shell: "powershell", cwd: here });
        out.runs.push(...inner.runs);
        out.comments.push(...inner.comments);
      }
      continue;
    }
    // The key launcher: `node with-key.mjs <name> <VAR> <program> ...` starts the program.
    if (p === "node" && program(w[1] ?? "") === "with-key.mjs" && w.length > 4) {
      const k = kind(w.slice(4));
      if (k) out.runs.push({ ...k, dir: k.dir ? place(here, k.dir, { home, windows }) : here, raw: w.slice(4).join(" ") });
      continue;
    }
    const k = kind(c.words);
    if (k) out.runs.push({ ...k, dir: k.dir ? place(here, k.dir, { home, windows }) : here, raw: c.raw });
  }
  return out;
}

export const marked = (comments) => comments.some((c) => MARKER.test(c));

// The command to run instead, for one run in a listed repository.
// repo: { top, prefix, deps (package.json lists any), lock, requirements, semgrep (pinned version) }
export function instead(run, repo, { script, shell = "bash" }) {
  const cd = repo.prefix ? `cd ${repo.prefix.replace(/\/$/, "")} && ` : "";
  let inner = run.raw;
  let size = "--timeout 1200";
  if (run.kind === "npm" || run.kind === "node") {
    if (repo.deps) inner = `${repo.lock ? "npm ci" : "npm install"} --ignore-scripts && ${inner}`;
  } else if (run.kind === "pytest") {
    if (!/^uvx?\s/.test(inner)) inner = `uv run --with pytest${repo.requirements ? " --with-requirements requirements.txt" : ""} ${inner}`;
  } else {
    size = "--type default --timeout 1800";
    inner = inner.replace(/^\S*semgrep(\.exe)?/i, `uvx semgrep${repo.semgrep ? `@${repo.semgrep}` : ""}`);
  }
  const body = `${cd}${inner}`;
  const quoted = shell === "powershell" ? `'${body.replace(/'/g, "''")}'` : `'${body.replace(/'/g, "'\\''")}'`;
  return `node "${script}" ${size} --push "${repo.top}" -- bash -c ${quoted}`;
}

// The hook's answer: a denial naming the boat-run commands, or null to let the call run.
// deps.repo(dir) → { listed, key, top, prefix, deps, lock, requirements, semgrep } or null.
export function decide({ input, deps }) {
  const tool = input?.tool_name;
  if (tool !== "Bash" && tool !== "PowerShell") return null;
  const command = input?.tool_input?.command;
  if (typeof command !== "string" || !HINT.test(command)) return null;
  const shell = tool === "PowerShell" ? "powershell" : "bash";
  const found = find(command, { shell, cwd: deps.cwd(input), home: deps.home, windows: deps.windows });
  if (!found.runs.length || marked(found.comments)) return null;
  const lines = [];
  const repos = new Set();
  for (const run of found.runs) {
    const repo = deps.repo(run.dir);
    if (!repo || !repo.listed) continue;
    repos.add(repo.key);
    if (run.kind === "semgrep-ci") {
      lines.push(`- \`${run.raw}\`: \`semgrep ci\` needs the Semgrep token, which does not go into a sandbox; the repository's CI \`semgrep\` job runs it on every push (read it with \`gh pr checks\`), and sa-review's evidence step runs its own Supply Chain script.`);
    } else {
      lines.push(`- \`${run.raw}\` on boat:\n  ${instead(run, repo, { script: deps.script, shell })}`);
    }
  }
  if (!lines.length) return null;
  const reason = [
    `Not run on this PC: ${[...repos].join(", ")} ${repos.size === 1 ? "is" : "are"} on boat-run's upload list, so tests and scans run on boat (recipes/boat.md).`,
    ...lines,
    "A run that truly needs Windows or this PC (DPAPI, PowerShell, a local app) stays here: end the command with `# local-run: <why>`. The repository's Windows CI job runs its suite on Windows on every push.",
  ].join("\n");
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } };
}
