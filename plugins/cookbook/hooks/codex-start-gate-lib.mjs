// The decision of the Codex start gate (codex-start-gate.mjs runs it as a PreToolUse hook):
// before T3's delegate_task, create_threads or t3_thread_launch starts an agent that is not
// plainly Claude, the Codex start check must pass (skills/cookbook/scripts/
// codex-start-check.mjs, recipes/codex.md). A start it refuses, cannot check or cannot read
// is denied. Its words are fixed: nothing from the brief, the checkout or GitHub is repeated.
import { REASONS, checkStart, plainRepoName } from "../skills/cookbook/scripts/codex-start-check.mjs";

export const DENIALS = {
  refused: "Codex is not started here:",
  brief: "Codex is not started: the brief needs exactly one line of the form Repository: TOKYO-BEANS/<name>, at the start of a line, with the plain repository name from the task.",
  checkout: "Codex is not started: only a start in this thread's own checkout can be checked first, so no separate worktree, other project or other machine, and not through t3_thread_launch.",
  unread: "Codex is not started: the start check's hook could not read this call.",
  fallback: "A piece this stops goes to a cookbook:review subagent (recipes/codex.md).",
};
export const NOTE = "Codex start check: passed. The Cookbook Codex reads is not main's version: do not lean on a page changed since (recipes/codex.md).";

const STARTERS = /__(delegate_task|create_threads|t3_thread_launch)$/;
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const given = (v) => v !== undefined && v !== null;
export const deny = (why) => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `${why} ${DENIALS.fallback}` } });

class Unread extends Error {}

// The agents one call would start: who runs each, its brief, and whether it runs in this
// thread's own checkout.
function startsOf(tool, toolInput) {
  if (!isObject(toolInput)) throw new Unread();
  if (tool === "delegate_task") return [{ target: toolInput.target, brief: toolInput.task, here: toolInput.isolation === undefined || toolInput.isolation === "shared" }];
  if (tool === "create_threads") {
    if (!Array.isArray(toolInput.threads) || !toolInput.threads.every(isObject)) throw new Unread();
    return toolInput.threads.map((t) => ({ target: t.target, brief: t.prompt, here: true }));
  }
  // modelSelection names the same things under its own keys. With any other key in it the
  // selection is passed on as it is, and plainlyClaude refuses it for that key.
  const selection = toolInput.modelSelection;
  const known = isObject(selection) && Object.keys(selection).every((key) => ["provider", "instanceId", "model", "options"].includes(key));
  const target = known ? { providerInstanceId: selection.instanceId, driverKind: selection.provider, model: selection.model } : selection;
  return [{ target, brief: toolInput.message, here: false }];
}

// Only a target that names nothing (it inherits this Claude session) or names Claude and a
// Claude model is left alone. Everything else is treated as Codex, and so is a target with a
// key this hook does not know: it may name a provider.
const TARGET_KEYS = new Set(["providerInstanceId", "driverKind", "model", "options", "environmentId", "projectId"]);
function plainlyClaude(target) {
  if (!given(target)) return true;
  if (!isObject(target) || !Object.keys(target).every((key) => TARGET_KEYS.has(key))) return false;
  const ids = [target.providerInstanceId, target.driverKind].filter(given);
  if (!ids.every((id) => typeof id === "string" && /^claudeAgent(_[0-9a-f-]{1,64})?$/.test(id))) return false;
  return !given(target.model) || (typeof target.model === "string" && /^claude-[a-z0-9.-]{1,60}$/.test(target.model));
}

function repoOf(brief) {
  if (typeof brief !== "string") return null;
  const named = brief.split(/\r?\n/).filter((line) => line.startsWith("Repository:"));
  if (named.length !== 1) return null;
  const repo = named[0].startsWith("Repository: TOKYO-BEANS/") ? named[0].slice("Repository: TOKYO-BEANS/".length) : null;
  return plainRepoName(repo) ? repo : null;
}

function refusal(check, repo, checkout) {
  let result;
  try {
    result = check({ repo, checkout });
  } catch {
    result = null;
  }
  if (result?.start === true && result.cookbook === "same") return { ok: true };
  if (result?.start === true && result.cookbook === "differs") return { ok: true, note: true };
  const reason = result?.start === false && Object.hasOwn(REASONS, result.reason) ? result.reason : "failed";
  return { ok: false, why: `${DENIALS.refused} ${REASONS[reason]}.` };
}

// null: the call goes ahead. Otherwise the hook's output.
export function decide({ input, env = {}, check = checkStart }) {
  try {
    if (!isObject(input) || typeof input.tool_name !== "string") throw new Unread();
    const tool = STARTERS.exec(input.tool_name)?.[1];
    if (!tool) return null;
    let note = false;
    const answers = new Map(); // one check per repository in a call, however many threads name it
    for (const start of startsOf(tool, input.tool_input)) {
      if (plainlyClaude(start.target)) continue;
      const elsewhere = isObject(start.target) && (given(start.target.environmentId) || given(start.target.projectId));
      const checkout = [env.CLAUDE_PROJECT_DIR, input.cwd].find((dir) => typeof dir === "string" && dir !== "");
      if (elsewhere || !start.here || !checkout) return deny(DENIALS.checkout);
      const repo = repoOf(start.brief);
      if (repo === null) return deny(DENIALS.brief);
      if (!answers.has(repo)) answers.set(repo, refusal(check, repo, checkout));
      const answer = answers.get(repo);
      if (!answer.ok) return deny(answer.why);
      note ||= answer.note === true;
    }
    return note ? { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: NOTE } } : null;
  } catch {
    return deny(DENIALS.unread);
  }
}
