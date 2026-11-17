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

// What this reader does not model, so a command that holds it is let through unread: a
// command substitution or a here-document (bash), a subexpression, a block comment or a
// here-string (PowerShell). Text inside them (a commit message, a pull request body) could
// otherwise be read as commands. A run missed this way is the safe side: the hook is a route.
const UNREAD = { bash: /\$\(|`|<</, powershell: /\$\(|<#|@['"]/ };

// A small shell reader: enough of bash and PowerShell to tell a command word from a quoted
// argument (`grep "npm test"` runs grep). Returns the simple commands in order, each with its
// words (and each word as typed) and raw text, and the comments.
export function read(text, shell = "bash") {
  const ps = shell === "powershell";
  if (UNREAD[ps ? "powershell" : "bash"].test(text)) return { commands: [], comments: [], unread: true };
  const esc = ps ? "`" : "\\";
  const seps = ps ? ";&|\n(){}" : ";&|\n(){}`";
  const list = [];
  const comments = [];
  let words = [];
  let typed = []; // each word as it was typed, quotes included
  let word = null;
  let wstart = -1;
  let start = -1;
  const add = (part, at) => {
    if (word === null) wstart = at;
    word = (word ?? "") + part;
  };
  const endWord = (at) => {
    if (word !== null) {
      words.push(word);
      typed.push(text.slice(wstart, at));
    }
    word = null;
  };
  const endCommand = (at) => {
    endWord(at);
    if (words.length) list.push({ words, typed, raw: text.slice(start, at).trim() });
    words = [];
    typed = [];
    start = -1;
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (start < 0 && !/\s/.test(c) && !seps.includes(c)) start = i;
    // `2>&1` and `&>`: a redirection, not a separator.
    if (c === "&" && (text[i - 1] === ">" || text[i + 1] === ">")) {
      add(c, i);
      continue;
    }
    if (c === esc && i + 1 < text.length) {
      i += 1;
      if (text[i] !== "\n") add(text[i], i - 1);
    } else if (c === "'") {
      let j = i + 1;
      let s = "";
      while (j < text.length && !(text[j] === "'" && !(ps && text[j + 1] === "'"))) {
        if (ps && text[j] === "'" && text[j + 1] === "'") j += 1;
        s += text[j];
        j += 1;
      }
      add(s, i);
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < text.length && text[j] !== '"') {
        // bash keeps a backslash in double quotes unless it comes before $ ` " \ or a newline.
        if (text[j] === esc && j + 1 < text.length && (ps || '$`"\\\n'.includes(text[j + 1]))) j += 1;
        s += text[j];
        j += 1;
      }
      add(s, i);
      i = j;
    } else if (c === "#" && word === null) {
      const end = text.indexOf("\n", i);
      comments.push(text.slice(i, end < 0 ? text.length : end).trim());
      endCommand(i);
      i = end < 0 ? text.length : end;
    } else if (seps.includes(c)) {
      endCommand(i);
    } else if (/\s/.test(c)) {
      endWord(i);
    } else {
      add(c, i);
    }
  }
  endCommand(text.length);
  return { commands: list, comments };
}

export const program = (w) => String(w).replace(/\\/g, "/").split("/").pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, "");

// Words before a command that start it, bash's keywords included (`for ...; do npm test`).
const WRAPPERS = new Set(["time", "env", "nice", "nohup", "exec", "command", "builtin", "xargs", "do", "then", "else", "elif", "if", "while", "until", "!"]);
// The runners that start a program: `uv run [options] pytest`, `uvx [options] pytest`. The
// options that take a value, so the value is not read as the program.
const RUN_VIA = new Set(["uv", "poetry", "pipenv", "pdm", "hatch"]);
const VALUE_OPTIONS = new Set(["--with", "--with-requirements", "--with-editable", "--python", "-p", "--project", "--directory", "--extra", "--group", "--env-file", "--from", "--package", "-e", "--env"]);
function programAfter(words) {
  for (let i = 0; i < words.length; i += 1) {
    if (VALUE_OPTIONS.has(words[i])) i += 1;
    else if (!words[i].startsWith("-")) return words[i];
  }
  return null;
}
const CD = new Set(["cd", "chdir", "pushd", "set-location", "sl", "push-location"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash"]);
const PS_SHELLS = new Set(["powershell", "pwsh"]);
const SCRIPT = /\.(m|c)?(j|t)s$/i;

// The words of one command after the wrappers that only start another: `VAR=1`,
// `timeout 600`, `env`, `time`. The variables are kept on `env` (boat-run has its own timeout).
function unwrap(words) {
  let i = 0;
  const env = [];
  for (;;) {
    if (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) env.push(i++);
    else if (i < words.length && WRAPPERS.has(program(words[i]))) i += 1;
    else if (i < words.length && program(words[i]) === "timeout") {
      i += 1;
      while (i < words.length && words[i].startsWith("-")) i += 1;
      i += 1; // the duration
    } else break;
  }
  const out = words.slice(i);
  out.env = env;
  out.start = i;
  return out;
}

// What kind of heavy run one command is, or null. `dir` is set when the command names its
// own folder (`npm --prefix x test`); `words` is the command without it and without the
// wrappers, `env` its leading variables, and `typed`/`envTyped` the same words as they were
// typed (`typed` defaults to `words`): what runs on boat.
export function kind(words, typed = words) {
  const w = unwrap(words);
  if (!w.length) return null;
  const found = (k, dir = null, at = w.map((_, j) => j)) => ({
    kind: k,
    dir,
    env: w.env.map((j) => words[j]),
    envTyped: w.env.map((j) => typed[j]),
    words: at.map((j) => w[j]),
    typed: at.map((j) => typed[w.start + j]),
  });
  const p = program(w[0]);
  const rest = w.slice(1);
  if (p === "npm" || p === "pnpm" || p === "yarn") {
    let dir = null;
    const own = [0];
    for (let i = 0; i < rest.length; i += 1) {
      const a = rest[i];
      if (["--prefix", "-C", "--dir", "--cwd"].includes(a)) {
        dir = rest[i + 1] ?? null;
        i += 1;
        continue;
      }
      own.push(i + 1);
      if (a.startsWith("-")) continue;
      if (/^(test|t|tst)(:.*)?$/.test(a) || ((a === "run" || a === "run-script") && /^test(:.*)?$/.test(rest[i + 1] ?? ""))) {
        for (let j = i + 2; j < w.length; j += 1) own.push(j);
        return found("npm", dir, own);
      }
      return null;
    }
    return null;
  }
  if (p === "node") {
    for (const a of rest) {
      if (a === "--test") return found("node");
      if (!a.startsWith("-") && SCRIPT.test(a)) return null;
    }
    return null;
  }
  if (p === "pytest" || p === "py.test") return found("pytest");
  if (["python", "python3", "py"].includes(p)) {
    const m = rest.indexOf("-m");
    return m >= 0 && program(rest[m + 1] ?? "") === "pytest" ? found("pytest") : null;
  }
  if (p === "uvx") return program(programAfter(rest) ?? "") === "pytest" ? found("pytest") : null;
  if (RUN_VIA.has(p)) {
    const run = rest.indexOf("run");
    return run >= 0 && program(programAfter(rest.slice(run + 1)) ?? "") === "pytest" ? found("pytest") : null;
  }
  if (p === "semgrep") {
    const sub = rest.find((a) => !a.startsWith("-"));
    if (sub === "ci") return found("semgrep-ci");
    if (sub === "scan" || rest.some((a) => a === "--config" || a === "-c" || a.startsWith("--config="))) return found("semgrep");
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
      if (k) out.runs.push({ ...k, asTyped: false, dir: k.dir ? place(here, k.dir, { home, windows }) : here, raw: w.slice(4).join(" ") });
      continue;
    }
    // Words typed for bash go on as typed (globs, $VAR, ~ and quotes keep their meaning);
    // PowerShell's are rebuilt with POSIX quoting.
    const k = kind(c.words, c.typed);
    if (k) out.runs.push({ ...k, asTyped: shell !== "powershell", dir: k.dir ? place(here, k.dir, { home, windows }) : here, raw: c.raw });
  }
  return out;
}

export const marked = (comments) => comments.some((c) => MARKER.test(c));

// The Semgrep version CI pins, from the standard's hash-locked requirements file, whose line
// is `semgrep==1.182.0 \` with the hashes on the lines after it.
export const semgrepPin = (text) => /^semgrep==([0-9][0-9A-Za-z.]*)(?=[\s\\;]|$)/m.exec(String(text ?? ""))?.[1] ?? null;

// The command to run instead, for one run in a listed repository.
// repo: { top, prefix, deps (package.json lists any), lock, requirements, semgrep (pinned version) }
// The command is rebuilt from its parsed words: a wrapper, a folder option and a redirection
// of this PC never reach the sandbox; bash words go as typed, PowerShell's with POSIX quoting.
export const sh = (w) => (/^[A-Za-z0-9_\/.:=@%+,-]+$/.test(w) ? w : /^[^$`"\\!]*$/.test(w) ? `"${w}"` : `'${w.replace(/'/g, "'\\''")}'`);
// Redirections, as typed (a quoted "<x>" is an argument): bash's and PowerShell's `*>`.
const REDIRECT = /^[\d*]?(>>?|<|&>|>&)/;
const BARE_REDIRECT = /^[\d*]?(>>?|<|&>)$/;

export function instead(run, repo, { script, shell = "bash" }) {
  const cd = repo.prefix ? `cd ${sh(repo.prefix.replace(/\/$/, ""))} && ` : "";
  const asTyped = run.asTyped !== false && Array.isArray(run.typed) && run.typed.length === run.words.length;
  const seen = Array.isArray(run.typed) && run.typed.length === run.words.length ? run.typed : run.words;
  const env = asTyped && run.envTyped
    ? run.envTyped
    : (run.env ?? []).map((e) => { const at = e.indexOf("="); return `${e.slice(0, at + 1)}${sh(e.slice(at + 1))}`; });
  const parts = asTyped ? [...run.typed] : run.words.map(sh);
  const words = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (i > 0 && REDIRECT.test(seen[i])) {
      if (BARE_REDIRECT.test(seen[i])) i += 1; // and its target
      continue;
    }
    words.push(parts[i]);
  }
  const p = program(run.words[0]);
  words[0] = ["python", "py"].includes(p) ? "python3" : p;
  let size = "--timeout 1200";
  let install = "";
  if (run.kind === "npm" || run.kind === "node") {
    if (repo.deps) install = `${repo.lock ? "npm ci" : "npm install"} --ignore-scripts && `;
  } else if (run.kind === "pytest") {
    if (!["uv", "uvx"].includes(p)) words.unshift("uv", "run", "--with", "pytest", ...(repo.requirements ? ["--with-requirements", "requirements.txt"] : []));
  } else {
    size = "--type default --timeout 1800";
    words.splice(0, 1, "uvx", `semgrep${repo.semgrep ? `@${repo.semgrep}` : ""}`);
  }
  const body = `${cd}${install}${[...env, ...words].join(" ")}`;
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
    "A run that truly needs Windows or this PC (DPAPI, PowerShell, a local app) stays here: end the command with `# local-run: <why>`, a reason of at least ten characters. The repository's Windows CI job runs its suite on Windows on every push.",
  ].join("\n");
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } };
}
