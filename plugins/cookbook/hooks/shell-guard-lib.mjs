// The shell guard (recipes/learning-loop.md): two Bash mistakes the weekly review found again
// and again are stopped before they run, and the denial names the exact next step.
// - `pkill -f <pattern>` (or `pgrep -f` feeding `kill`) whose pattern can match its own shell:
//   Claude Code runs the whole command as one bash's argument, so the pattern is in that
//   bash's command line and the shell kills itself (exit 143 or 144: 15 of 18 such runs in a week).
//   A pattern with a bracket class (`[f]ilm.py`) cannot match its own text.
// - `rm -rf`: the machine's permission rule denies it anyway; this names what to do instead.
// Pure; the hook file (sandbox-route.mjs) calls it before the sandbox route.
import { read } from "./sandbox-route-lib.mjs";

// Cheap first look: most commands name none of these.
export const GUARD_HINT = /\brm\b|pkill|pgrep/;
const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;

// The simple commands of a bash text, words only. Here-document bodies are data and are
// dropped; a command substitution or backticks are read as separate commands.
export function commandsOf(text) {
  const plain = text.replace(HEREDOC, "\n").replace(/\$\(|`/g, ";").replace(/<</g, " ");
  return read(plain, "bash").commands.map((c) => c.words);
}

// A command's own words, after variable assignments and the wrappers that run another command.
function head(words) {
  let w = words.slice();
  for (;;) {
    while (w.length && /^[A-Za-z_]\w*=/.test(w[0])) w = w.slice(1);
    if (["sudo", "env", "nohup", "exec", "do", "then", "else", "!"].includes(w[0])) w = w.slice(1);
    else if (w[0] === "timeout") {
      w = w.slice(1);
      while (w.length && /^(-|\d)/.test(w[0])) w = w.slice(1);
    } else return w;
  }
}

const flags = (w) => w.slice(1).filter((x) => /^-[A-Za-z0-9]+$/.test(x)).join("");
const longs = (w) => new Set(w.slice(1).filter((x) => x.startsWith("--")));

export function isRmRf(words) {
  const w = head(words);
  if (w[0] !== "rm") return false;
  const f = flags(w);
  const l = longs(w);
  return (/[rR]/.test(f) || l.has("--recursive")) && (/f/.test(f) || l.has("--force"));
}

// The pattern of a `pkill -f` or `pgrep -f`, or null.
export function fullPattern(words) {
  const w = head(words);
  if (w[0] !== "pkill" && w[0] !== "pgrep") return null;
  if (!/f/.test(flags(w)) && !longs(w).has("--full")) return null;
  const rest = w.slice(1).filter((x) => !x.startsWith("-"));
  return rest.length ? rest[rest.length - 1] : null;
}

// A `pgrep -f` kills only when its output goes straight to kill: `pgrep … | xargs kill`,
// `kill $(pgrep …)` or `for p in $(pgrep …); do kill …`. A pgrep that only lists runs.
const FEEDS_KILL = /\bpgrep\b[^;&|\n]*\|\s*xargs\b[^;&|\n]*\bkill\b|\bkill\b[^;&|\n]*\$\(\s*pgrep\b|\bin\s+\$\(\s*pgrep\b[^)]*\)\s*;\s*do\b[^\n]*?\bkill\b/;

const deny = (reason) => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });

// The hook's answer: a denial naming the next step, or null to let the call run.
export function guard(input) {
  if (input?.tool_name !== "Bash") return null;
  const command = input?.tool_input?.command;
  if (typeof command !== "string" || !GUARD_HINT.test(command)) return null;
  const cmds = commandsOf(command);
  const killing = FEEDS_KILL.test(command.replace(HEREDOC, "\n"));
  const lines = [];
  for (const words of cmds) {
    const pattern = fullPattern(words);
    if (pattern !== null && (head(words)[0] === "pkill" || killing) && !/\[[^\]]+\]/.test(pattern)) {
      const fixed = pattern.replace(/[A-Za-z]/, (c) => `[${c}]`);
      lines.push(`- \`${head(words).join(" ")}\`: the pattern also matches this command's own shell (Claude Code runs the whole command as one bash's argument), so the shell kills itself (exit 143 or 144). Put one letter in brackets, \`'${fixed}'\`: it matches the process but not its own text. Or kill by process id.`);
    }
    if (isRmRf(words)) {
      lines.push(`- \`${words.join(" ")}\`: \`rm -rf\` is denied on this machine. A scratch folder you mean to fill again: use a fresh one, \`D=$(mktemp -d -p "$S")\`. A folder that should go: \`mv <folder> ~/.local/share/backups/$(date +%F)-<name>\`. Never get round the rule with another command or shell.`);
    }
  }
  if (!lines.length) return null;
  return deny(["Not run (the Cookbook's shell guard, recipes/learning-loop.md):", ...lines, "Change the command and run it again."].join("\n"));
}
