// The typed questions the owner-questions Stop hook asks Jev about a turn's closing text,
// and the call itself. The key comes from the caller (read at run time from the DPAPI store);
// nothing here reads a file or an environment setting for it.

export const MODEL = "jev-1.14.0"; // pinned like web-batch; the answer records the model Jev reports
export const QUESTION_VERSION = 1;
export const MAX_CHARS = 6000; // the closing text is cut to its last 6,000 characters

export const QUESTIONS = {
  owner_item: {
    type: "noul",
    instructions:
      "`closing_message` is the last message an AI assistant wrote to the owner of a project before it stopped working. Does it leave something with the owner to decide, answer, approve or do?",
    criteria: {
      true: "It asks the owner a question, asks for a yes, a choice, a sign-in, a click, a check by hand or another action by them, or names items as still the owner's or waiting on the owner.",
      false: "It only reports results, progress or the steps the assistant takes next by itself, such as waiting for checks, reviews or a background run; a note the owner may simply read does not count.",
    },
  },
  declares_done: {
    type: "noul",
    instructions:
      "Does `closing_message` say that the whole job of this chat is finished, with nothing more for the assistant to do in it?",
    criteria: {
      true: "It says the chat or job is done, or that everything is merged, verified and recorded with nothing left running or queued.",
      false: "Work goes on: it names next steps the assistant will take, waits on checks or a run, or reports one step of several.",
    },
  },
};

export function stateFor(text) {
  const t = String(text ?? "");
  return { closing_message: t.length > MAX_CHARS ? t.slice(-MAX_CHARS) : t };
}

// One request, no retries: the hook has a time limit, and a failure falls back to phrases.
export async function askJev(text, { key, fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  if (!key) return { ok: false, error: "no key" };
  let r;
  try {
    r = await fetchImpl("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, state: stateFor(text), questions: QUESTIONS }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    return { ok: false, error: timedOut ? `timed out after ${timeoutMs} ms` : `network error: ${e?.message ?? e}` };
  }
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
  const out = {};
  for (const id of Object.keys(QUESTIONS)) {
    const a = json?.answers?.[id];
    if (!a || a.type !== "noul" || typeof a.noul !== "number" || !(a.noul >= 0 && a.noul <= 1)) {
      return { ok: false, error: `malformed answer for ${id}` };
    }
    out[id] = a.noul;
  }
  return { ok: true, answers: out, model: json.model ?? null };
}
