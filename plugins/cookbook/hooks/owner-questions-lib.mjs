// The owner-questions Stop hook, as pure functions: which session it works in, what the
// turn did, what the closing text leaves open, and what Claude is told when it stops once.
// The entry file (owner-questions.mjs) wires in the transcript, the Jev broker and the log.

export const MARKER = "❓ "; // a waiting chat's title starts with this; t3_thread_list titleContains "❓"
export const OWNER_THRESHOLD = 0.6; // Jev's owner_item Noul at or above this means "open"
export const DONE_THRESHOLD = 0.5; // Jev's declares_done Noul at or above this means "done"

const ORGANIZE = "mcp__t3-code__t3_thread_organize";
const UPDATE = "mcp__t3-code__t3_thread_update";
const ASK = "AskUserQuestion";

// The fallback when Jev cannot answer. Measured on 30 held-out closings (16 November 2026) it
// found 8 of 11 owner items, against 11 of 11 for Jev, so it is only the fallback.
const OWNER_PHRASES =
  /\b(say (yes|go|so|if|"[^"]+")|your (yes|merge yes|call|decision|answer|sign-in|login)|decision for you|still yours|needed from you|needs? (a |your |one )?(yes|answer|decision|sign-in)|waits? (on|for) your|do you want|should i\b|would you (like|rather)|tell me\b|unless you say|if you.?d rather|is your call|up to you|merge #?\d+\?)/i;
const DONE_PHRASES =
  /\b(this (chat|job) is (done|finished|complete)|nothing (else|further) is (open|queued|left)|nothing (else )?is left running|nothing else is open)/i;

export function phraseCheck(text) {
  const t = String(text ?? "");
  return { owner: OWNER_PHRASES.test(t), done: DONE_PHRASES.test(t) };
}

const ownThread = (input, threadId) => !input?.threadId || input.threadId === threadId;

const isPrompt = (o) => {
  if (o.type !== "user" || o.isMeta || o.isSidechain || o.isCompactSummary) return false;
  const c = o.message?.content;
  return typeof c === "string" || (Array.isArray(c) && c.some((x) => x?.type === "text"));
};

// Reads a JSONL transcript. Only lines that can matter are parsed.
export function readTranscript(text, { threadId } = {}) {
  const lines = String(text ?? "").split("\n");
  let t3Tools = false;
  let scripted = false;
  let marked = false;
  let turnCalls = [];
  for (const line of lines) {
    if (!line) continue;
    const maybe = line.includes('"attachment"') || line.includes('"tool_use"') || line.includes('"type":"user"');
    if (!maybe) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type === "attachment") {
      const a = o.attachment ?? {};
      if (a.type === "deferred_tools_delta" && Array.isArray(a.addedNames) && a.addedNames.includes(ORGANIZE)) t3Tools = true;
      if (a.type === "budget_usd") scripted = true;
      continue;
    }
    if (o.isSidechain) continue;
    if (isPrompt(o)) {
      turnCalls = [];
      continue;
    }
    if (o.type !== "assistant" || !Array.isArray(o.message?.content)) continue;
    for (const c of o.message.content) {
      if (c?.type !== "tool_use") continue;
      turnCalls.push({ name: c.name, input: c.input ?? {} });
      if (String(c.name).startsWith("mcp__t3-code__")) t3Tools = true; // tools loaded up front
      if (c.name === UPDATE && ownThread(c.input, threadId)) {
        if (c.input?.action === "rename") marked = String(c.input.title ?? "").startsWith(MARKER.trim());
        if (c.input?.action === "regenerate_title") marked = false;
      }
    }
  }
  const asked = turnCalls.some((c) => c.name === ASK);
  const settled = turnCalls.some((c) => c.name === ORGANIZE && c.input.action === "settle" && ownThread(c.input, threadId));
  return { t3Tools, scripted, marked, turnCalls, asked, settled };
}

// "full": a T3 thread (dialog, marker, settle). "dialog": a terminal or desktop session.
// "skip": scripted runs, T3 delegate children and anything unknown.
export function sessionMode({ env = {}, transcript }) {
  const entry = String(env.CLAUDE_CODE_ENTRYPOINT ?? "");
  if (transcript?.scripted) return "skip";
  if (String(env.T3CODE_THREAD_ID ?? "").startsWith("thread:delegated-task:")) return "skip";
  if (transcript?.t3Tools) return "full";
  if (entry === "cli" || entry === "claude-desktop" || entry.startsWith("claude-vscode") || entry.startsWith("claude-jetbrains")) return "dialog";
  return "skip"; // t3-code without T3 tools is a nested `claude -p`; sdk-* is scripted
}

const OWNER_FULL = [
  "Owner-question check: your closing message leaves something with the owner (a question, a yes, a choice or an action by them), and this turn neither asked it with AskUserQuestion nor marked the thread as waiting. Do one of these now:",
  `1. Ask each item with AskUserQuestion, one question per item, each with a "Not now" option, and act on the answers. A "not now" goes into the handoff as outstanding.`,
  `2. If it has to wait (the owner must do something first): pin this thread (t3_thread_organize, action pin), rename it to "${MARKER}" plus the question in at most 25 characters (t3_thread_update, action rename), and end with a message whose first line is the question.`,
  "If nothing in it waits on the owner, end with one line that says so.",
].join("\n");
const OWNER_DIALOG = [
  "Owner-question check: your closing message leaves something with the owner (a question, a yes, a choice or an action by them), and this turn did not ask it with AskUserQuestion.",
  `Ask each item with AskUserQuestion now, one question per item, each with a "Not now" option, and act on the answers. If nothing in it waits on the owner, end with one line that says so.`,
].join("\n");
const SETTLE =
  "Owner-question check: your closing message says the job is done, but this turn did not settle the thread. If the job is merged and verified and nothing waits on the owner: write the handoff and save what is durable to memory, then call t3_thread_organize with action settle as the last call. If the job is not done, say in one line what comes next.";
const UNMARK = `Owner-question check: this thread is still marked as waiting on the owner (its title starts with "${MARKER.trim()}"), but your closing message leaves nothing with them. If the question is answered: unpin the thread (t3_thread_organize, action unpin) and give it back its title (t3_thread_update, action rename to the earlier title, or regenerate_title). If it still waits, begin your closing message with the question.`;

export function decide({ mode, turn, verdict }) {
  const problems = [];
  if (verdict.owner && !turn.asked && !turn.marked) problems.push("owner");
  if (mode === "full" && verdict.done && !turn.settled && !(verdict.owner && turn.marked)) problems.push("settle");
  if (mode === "full" && turn.marked && !verdict.owner) problems.push("unmark");
  const text = { owner: mode === "full" ? OWNER_FULL : OWNER_DIALOG, settle: SETTLE, unmark: UNMARK };
  return { problems, reason: problems.map((p) => text[p]).join("\n\n") };
}

// Only these codes are shown; any other text from the broker or Jev becomes "other".
export function errorCode(error) {
  const e = String(error ?? "");
  const fixed = ["no broker yet (started)", "no broker yet (starting)", "no broker yet (with-key.mjs not found)", "no broker", "no key", "version"];
  if (fixed.includes(e)) return e;
  const http = /^HTTP (\d{3})$/.exec(e);
  if (http) return `HTTP ${http[1]}`;
  if (/^(broker )?timed out after \d+ ms$/.test(e)) return "timed out";
  if (e.startsWith("malformed")) return "malformed answer";
  if (e.startsWith("network error")) return "network error";
  if (e.startsWith("broker")) return "broker error";
  return "other";
}
const unit = (n) => typeof n === "number" && n >= 0 && n <= 1;
const shapeOk = (a) => a && typeof a === "object" && Object.keys(a).length === 2 && unit(a.owner_item) && unit(a.declares_done);

export function verdictFrom(answer, text) {
  const phrases = phraseCheck(text);
  if (answer?.ok && !shapeOk(answer.answers)) answer = { ok: false, error: "malformed answer" };
  if (answer?.ok) {
    return {
      source: "jev",
      owner: answer.answers.owner_item >= OWNER_THRESHOLD,
      done: answer.answers.declares_done >= DONE_THRESHOLD || phrases.done,
      scores: { owner_item: answer.answers.owner_item, declares_done: answer.answers.declares_done },
    };
  }
  return { source: "phrases", owner: phrases.owner, done: phrases.done, error: errorCode(answer?.error) };
}

// The whole hook. Returns the JSON to print, or null to let the stop go ahead. Never throws.
export async function run({ input, env, readFile, classify, log, now = () => Date.now() }) {
  const started = now();
  try {
    if (input?.hook_event_name !== "Stop" || input.stop_hook_active) return null;
    const transcript = readTranscript(readFile(input.transcript_path), { threadId: env.T3CODE_THREAD_ID });
    const mode = sessionMode({ env, transcript });
    if (mode === "skip") return null;
    const text = String(input.last_assistant_message ?? "");
    const verdict = verdictFrom(await classify(text), text);
    const { problems, reason } = decide({ mode, turn: transcript, verdict });
    log({
      at: new Date(started).toISOString(),
      session: input.session_id ?? null,
      mode,
      source: verdict.source,
      scores: verdict.scores ?? null,
      error: verdict.error ?? null,
      owner: verdict.owner,
      done: verdict.done,
      asked: transcript.asked,
      marked: transcript.marked,
      settled: transcript.settled,
      problems,
      ms: now() - started,
    });
    const fallback = verdict.source === "phrases" ? `Owner-question check used its phrase list: Jev was not asked (${verdict.error}).` : null;
    if (problems.length) {
      const out = { decision: "block", reason: fallback ? `${reason}\n\n(Checked with the phrase list; Jev was unavailable: ${verdict.error}.)` : reason };
      if (fallback) out.systemMessage = fallback;
      return out;
    }
    return fallback ? { systemMessage: fallback } : null;
  } catch (e) {
    try {
      log({ at: new Date(started).toISOString(), session: input?.session_id ?? null, crash: String(e?.message ?? e) });
    } catch {
      // the log is best effort
    }
    return null;
  }
}
