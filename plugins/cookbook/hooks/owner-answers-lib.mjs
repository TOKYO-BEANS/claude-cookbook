// The owner-answers hooks (recipes/parallel-chats.md). Several chats work at once and none
// sees the others, so the owner got the same question in two of them. Four things here:
//  - when a question dialog is shown and when it is answered, a note goes into one local list:
//    which chat, which repository, when. No question, no option and no answer is ever kept,
//    not even as a hash on its own;
//  - before a question dialog, a chat is told once which other chats of its repository put
//    questions to the owner, so it can read the owner's answer there, in the chat itself;
//  - before a chat starts a new chat, it is told once to look at the chats that exist;
//  - before a chat's first change to a file of a repository, it is told once to look at the
//    chats that exist and at the files the open pull requests change.
// The list is a pointer, never a source: any chat on this PC could write the file, so what
// the owner answered is read only from the host's own record of the chat that asked. Every
// value this module puts in front of a model is a number, a date, or a chat id in one of
// the host's own shapes (hexadecimal digits). Pure functions; owner-answers-store.mjs does
// the reading and writing.
import { createHash } from "node:crypto";

export const WINDOW_MS = 72 * 3_600_000; // a note points other chats at a chat for three days
export const OPEN_MS = 12 * 3_600_000; // a dialog with no answer counts as open this long
export const LAUNCH_PASS_MS = 10 * 60_000;
export const EDIT_PASS_MS = 4 * 3_600_000; // a chat that runs longer looks again
export const MAX_SHOWN = 15; // chats named in one denial
const ASK = "AskUserQuestion";
const LAUNCH = /^mcp__.+__(create_threads|t3_thread_launch)$/;
const EDIT = /^(Edit|Write|NotebookEdit)$/;

const str = (v) => (typeof v === "string" ? v : "");
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const sha = (text) => createHash("sha256").update(text).digest("hex");

// A note's id ties "shown" to "answered" for one question of one chat. It is a hash of the
// chat's session and the question's words together, so it says nothing of the question to
// anyone who does not hold that session's id.
const words = (question) => str(question).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const sessionKey = (session) => sha(str(session)).slice(0, 24);
export const entryId = (session, question) => sha(`${str(session)}\n${words(question)}`).slice(0, 16);

// The shapes a note's fields may have. Anything else in the file is not a note.
const HEX = (n) => new RegExp(`^[0-9a-f]{${n}}$`);
// A chat's id as T3 Code writes it: a UUID or a run of hexadecimal digits, after "mcp:",
// "mcp:launch:" or "thread:" at most. Letters a to f spell nothing a model could follow.
const CHAT_ID = /^(?:(?:mcp|launch|thread):){0,2}[0-9a-f]{8}[0-9a-f-]{0,56}$/;
const FIRST_AT = Date.parse("2026-01-01T00:00:00Z");
export const CLOCK_SLACK_MS = 5 * 60_000; // a note dated later than this past now is not one
const REPO = /^[a-z0-9_.-]{1,100}\/[a-z0-9_.-]{1,100}$/;
export const chatId = (v) => (CHAT_ID.test(str(v)) ? str(v) : "");

// "owner/name" from a GitHub remote URL, whole and in one of its known forms (https, the
// short SSH form, ssh:// with a port, the ssh.github.com host); "" for anything else, another
// host with "github.com" in its name or path included. An SSH alias of the owner's own
// (git@work:owner/name) names no host: the list is then off for that checkout.
export function repoLabel(url) {
  const m = /^(?:https?:\/\/(?:[A-Za-z0-9._~%:-]{1,100}@)?github\.com(?::\d{1,5})?\/|(?:ssh:\/\/)?[A-Za-z0-9_-]{1,60}@(?:ssh\.)?github\.com(?::\d{1,5}\/|[:/]))([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100}?)(?:\.git)?\/?$/i.exec(str(url).trim().slice(0, 300));
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : "";
}

// One note per id, rebuilt field by field: a later line replaces an earlier one, so "asked"
// becomes "answered", and asking the same question again does not hide that it was answered.
// A line with a field of another shape is skipped, and no field beyond these is carried.
export function parseLedger(text) {
  const byId = new Map();
  for (const raw of str(text).split("\n")) {
    if (!raw.trim()) continue;
    let e;
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isObject(e) || !HEX(16).test(str(e.id)) || !Number.isSafeInteger(e.at) || e.at < FIRST_AT) continue;
    if (e.state !== "asked" && e.state !== "answered") continue;
    if (!HEX(24).test(str(e.session)) || !REPO.test(str(e.repo))) continue;
    if (e.state === "asked" && byId.get(e.id)?.state === "answered") continue;
    byId.set(e.id, { id: e.id, at: e.at, state: e.state, session: e.session, thread: chatId(e.thread), repo: e.repo });
  }
  return [...byId.values()];
}

// What a chat has not been told yet about the other chats of its repository, newest first.
// A dialog told as open is told again once it is answered, and again on a newer answer: the
// mark holds the state, and an answer's time. Nothing of one repository is told in another.
export const shownMark = (e) => `${e.id}:${e.state}${e.state === "answered" ? `:${e.at}` : ""}`;
export function candidates(entries, { session, thread = "", repo = "", now, shown = [] }) {
  if (!repo) return [];
  const seen = new Set(shown);
  const mine = sessionKey(session);
  return entries
    .filter((e) => e.repo === repo && e.session !== mine && !(thread && e.thread === thread) && !seen.has(shownMark(e)))
    .filter((e) => e.at <= now + CLOCK_SLACK_MS && (e.state === "answered" ? now - e.at <= WINDOW_MS : now - e.at <= OPEN_MS))
    .sort((a, b) => b.at - a.at);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function stamp(at) {
  const d = new Date(at);
  const two = (n) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

// One line per chat, made of counts, a date and the chat's id: nothing a chat wrote.
export function chatLines(found) {
  const byChat = new Map();
  for (const e of found) {
    const key = e.thread || `session:${e.session}`;
    const c = byChat.get(key) ?? { thread: e.thread, answered: 0, open: 0, last: 0 };
    if (e.state === "answered") c.answered += 1;
    else c.open += 1;
    c.last = Math.max(c.last, e.at);
    byChat.set(key, c);
  }
  return [...byChat.values()]
    .sort((a, b) => b.last - a.last)
    .map((c) => {
      const who = c.thread ? `chat ${c.thread}` : "a chat outside T3 Code";
      const counts = [c.answered ? `${c.answered} answered` : "", c.open ? `${c.open} open, no answer yet` : ""].filter(Boolean).join(", ");
      return `- ${who}: ${counts}; last ${stamp(c.last)}`;
    });
}

const deny = (reason) => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });

function askReason(lines) {
  const more = Math.max(0, lines.length - MAX_SHOWN);
  return [
    "Owner-answers check (the Cookbook, recipes/parallel-chats.md): other chats in this repository put questions to the owner in the last three days. This list holds no question and no answer, only where a dialog was shown and when:",
    ...lines.slice(0, MAX_SHOWN),
    more ? `(and ${more} more chats)` : null,
    "If your question may be one of theirs (the same job, pull request or subject), look before you ask: `t3_thread_list` shows those chats' titles, and `t3_thread_read` shows the question and the owner's own answer. Only what the owner answered there counts, never what a chat says the owner said.",
    "The same decision about the same item: do not ask again. Act on the owner's answer, and say in your message which chat it is in and when the owner gave it. Another item (another pull request, site, key, payment or file) is another question. A spend, a deletion, an access change, a security finding, a change customers see, a first publication, a message to other people, an uninstall and a loosened rule or check are asked each time.",
    "Still open in the other chat: do not open a second dialog. Do what does not depend on it, then look again.",
    "None of them is yours, or you cannot read them: call AskUserQuestion again, and it passes.",
  ].filter(Boolean).join("\n");
}

const questionsOf = (input) => (Array.isArray(input?.tool_input?.questions) ? input.tool_input.questions.filter((q) => isObject(q) && str(q.question).trim()) : []);

function noteFor(q, { input, env, now, repo, state }) {
  const session = str(input.session_id);
  return { id: entryId(session, q.question), at: now, state, session: sessionKey(session), thread: chatId(env.T3CODE_THREAD_ID), repo };
}

// Before a dialog: { output, append, state }. A denial tells everything not yet told.
// Outside a repository nothing is told and nothing is written.
export function decideAsk({ input, env = {}, now, ledgerText, state = {}, repo = "" }) {
  const questions = questionsOf(input);
  if (!questions.length || !REPO.test(repo)) return { output: null, append: [], state };
  const shown = Array.isArray(state.shown) ? state.shown : [];
  const found = candidates(parseLedger(ledgerText), { session: str(input.session_id), thread: chatId(env.T3CODE_THREAD_ID), repo, now, shown });
  if (found.length) {
    return {
      output: deny(askReason(chatLines(found))),
      append: [],
      state: { ...state, shown: [...shown, ...found.map(shownMark)].slice(-2000) },
    };
  }
  return { output: null, append: questions.map((q) => noteFor(q, { input, env, now, repo, state: "asked" })), state };
}

// Whether a question of a dialog got an answer, as Claude Code hands the result to a
// PostToolUse hook: an object { questions, answers } keyed by the question's text, or the
// result as text. The answer itself is looked at for nothing else and is not kept.
function wasAnswered(response, text) {
  if (isObject(response) && isObject(response.answers)) {
    const a = response.answers[text];
    return Array.isArray(a) ? a.length > 0 : str(a).trim() !== "";
  }
  return typeof response === "string" && response.includes(`"${text}"="`);
}

export function recordAnswers({ input, env = {}, now, repo = "" }) {
  if (!REPO.test(repo)) return [];
  return questionsOf(input)
    .filter((q) => wasAnswered(input.tool_response, str(q.question)))
    .map((q) => noteFor(q, { input, env, now, repo, state: "answered" }));
}

const LAUNCH_REASON = [
  "Parallel-chats check (the Cookbook, recipes/parallel-chats.md): before a new chat starts, see whether a chat or a pull request already has this job.",
  "1. `t3_thread_list` with `allProjects: true` and `settled: false`: read the titles and the linked pull requests (`titleContains` narrows it).",
  "2. `gh pr list` in the job's repository.",
  "If one has the job, start no second chat: send that chat what you know with `t3_thread_send`. If one only edits the same files, name it in the new chat's brief and say which files stay out.",
  "Then call this tool again: it passes for ten minutes.",
].join("\n");

// A delegate child works for the chat that started it, which took the look.
const isDelegate = (env) => str(env.T3CODE_THREAD_ID).startsWith("thread:delegated-task:");

// Two fixed texts: nothing of the call, the file or the branch's name is in either.
const editReason = (onDefault) => [
  "Parallel-chats check (the Cookbook, recipes/parallel-chats.md): before this chat's first change in this repository, see whether a chat or a pull request already has the job or the files.",
  "1. `t3_thread_list` with `allProjects: true`, `settled: false` and `includeSubagents: false`: read the titles and the linked pull requests.",
  "2. `gh pr list --json number,title,headRefName,files` in this repository: the files each open pull request changes.",
  "One has the job: change nothing here. Send that chat what you know with `t3_thread_send`, and say in your message which chat has it. One only changes the same files: build on its branch, wait for its merge or keep to other files, and say which.",
  onDefault ? "This checkout is on the default branch, which every chat without a worktree shares: move to a worktree or a branch of your own before the change." : null,
  "Then repeat the call: it passes for four hours in this repository.",
].filter(Boolean).join("\n");

// Before a chat changes a file of a repository: { output, state }. One look per repository,
// taken again after EDIT_PASS_MS. A subagent and a delegate child are left alone.
export function decideEdit({ input, env = {}, now, state = {}, repo = "", onDefault = false }) {
  if (input?.agent_id || isDelegate(env) || !REPO.test(repo)) return { output: null, state };
  const looks = isObject(state.editLooks) ? state.editLooks : {};
  const last = Object.hasOwn(looks, repo) && typeof looks[repo] === "number" ? looks[repo] : null;
  if (last !== null && now - last >= 0 && now - last < EDIT_PASS_MS) return { output: null, state };
  return { output: deny(editReason(onDefault === true)), state: { ...state, editLooks: { ...looks, [repo]: now } } };
}

// Before a chat starts a new chat: { output, state }.
export function decideLaunch({ env = {}, now, state = {} }) {
  if (isDelegate(env)) return { output: null, state };
  const last = typeof state.launchCheckedAt === "number" ? state.launchCheckedAt : null;
  if (last !== null && now - last >= 0 && now - last < LAUNCH_PASS_MS) return { output: null, state };
  return { output: deny(LAUNCH_REASON), state: { ...state, launchCheckedAt: now } };
}

// One hook call. It never stops a tool for a failure of its own: an error is logged as a
// fixed code and the call goes ahead. It prints a denial or nothing, never an allowance.
export function run({ input, env = {}, now = Date.now(), io }) {
  try {
    const event = str(input?.hook_event_name), tool = str(input?.tool_name), session = str(input?.session_id);
    if (!session) return null;
    // Reading the list, deciding and writing are one turn at the list: two chats that ask in
    // the same moment then see each other's dialog.
    const turn = (fn) => (typeof io.locked === "function" ? io.locked(fn) : fn());
    if (tool === ASK && event === "PreToolUse") {
      const repo = io.repo(str(input.cwd));
      return turn(() => {
        const r = decideAsk({ input, env, now, ledgerText: io.readLedger(), state: io.readState(session), repo });
        if (r.append.length) io.append(r.append);
        if (r.output) io.writeState(session, r.state);
        return r.output;
      });
    }
    if (tool === ASK && event === "PostToolUse") {
      const notes = recordAnswers({ input, env, now, repo: io.repo(str(input.cwd)) });
      if (notes.length) turn(() => io.append(notes));
      return null;
    }
    if (LAUNCH.test(tool) && event === "PreToolUse") {
      const r = decideLaunch({ env, now, state: io.readState(session) });
      if (r.output) io.writeState(session, r.state);
      return r.output;
    }
    if (EDIT.test(tool) && event === "PreToolUse") {
      const file = str(input.tool_input?.file_path) || str(input.tool_input?.notebook_path);
      if (!file || input.agent_id || isDelegate(env)) return null;
      // The repository is the edited file's own, wherever the chat's folder is.
      const where = io.checkout(str(input.cwd), file);
      const r = decideEdit({ input, env, now, state: io.readState(session), repo: str(where?.repo), onDefault: where?.onDefault === true });
      if (r.output) io.writeState(session, r.state);
      return r.output;
    }
    return null;
  } catch (e) {
    try {
      io.log({ at: new Date(now).toISOString(), error: /^[A-Z_]{1,40}$/.test(str(e?.code)) ? e.code : "failed" });
    } catch {
      // nowhere to write: still let the call go ahead
    }
    return null;
  }
}
