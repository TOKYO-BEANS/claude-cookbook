// Run by `npm test` (node --test). Every provider is mocked: no network, no keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CHUNK_CHARS, MAX_CHUNKS, QUESTIONS, THRESHOLDS,
  callJev, chunkText, classifyScrapeError, fetchStage, judgeStage, jevWorker, main, parseArgs,
  parseCredits, planCost, renderReport, route, scoreRun, searchStage,
} from "../plugins/cookbook/skills/cookbook/scripts/web-batch.mjs";

const QUESTION = "Which Node.js release made node:test stable?";
const long = (word) => `${word} `.repeat(100); // over MIN_TEXT_CHARS

function tmp() {
  return mkdtempSync(join(tmpdir(), "web-batch-"));
}

// Mock providers. pages: url -> { markdown } | { fail: kind, error } ; jev: text marker -> answers
function mocks({ pages = {}, balance = { remaining: 500, total: 1000 }, jev = () => ({ answers: 0.9, has_content: 0.9, instructs_ai: 0.01 }), judge, search } = {}) {
  const calls = { scrape: [], judge: 0, balance: 0, search: 0 };
  const scrapeQueue = Object.fromEntries(Object.entries(pages).map(([u, v]) => [u, Array.isArray(v) ? [...v] : [v]]));
  return {
    calls,
    providers: {
      async search(args) {
        calls.search++;
        if (search) return search(args);
        return Object.keys(pages).map((url) => ({ url, title: `T ${url}` }));
      },
      async balance() {
        calls.balance++;
        if (balance instanceof Error) throw balance;
        return typeof balance === "function" ? balance(calls.balance) : balance;
      },
      async scrape(url) {
        calls.scrape.push(url);
        const q = scrapeQueue[url];
        const v = q.length > 1 ? q.shift() : q[0];
        if (v.fail) return { ok: false, kind: v.fail, error: v.error ?? v.fail };
        return { ok: true, markdown: v.markdown, metadata: { title: `Title ${url}`, creditsUsed: v.credits ?? 1, contentType: v.contentType ?? "text/html" } };
      },
      async judge(bodies) {
        calls.judge++;
        if (judge) return judge(bodies);
        return bodies.map((b) => ({ ok: true, model: "jev-1.14.0", usage: { input_tokens: 100, output_tokens: 3 }, answers: jev(b) }));
      },
    },
  };
}

async function runAll(dir, m, extra = {}) {
  const manifest = await searchStage({ question: QUESTION, pages: extra.pages ?? 30 }, m.providers);
  await fetchStage(manifest, dir, m.providers, { maxCredits: extra.maxCredits ?? 30, pdfPages: 3, sleep: async () => {} });
  await judgeStage(manifest, dir, m.providers, { model: "jev-1.14.0", cacheDir: join(dir, "cache"), pdfPages: 3 });
  return manifest;
}
const byUrl = (m, url) => m.pages.find((p) => p.url === url);

test("route: the truth table, with fixed thresholds in code", () => {
  const ok = (a, c, extra = {}) => route({ status: "ok", chars: 5000, jev: { answers: a, has_content: c, instructs_ai: 0 }, ...extra });
  assert.equal(THRESHOLDS.yes, 0.7);
  assert.equal(THRESHOLDS.no, 0.3);
  assert.equal(ok(0.7, 0.9).verdict, "answers");
  assert.equal(ok(0.95, 0.1).verdict, "answers");
  assert.equal(ok(0.69, 0.9).verdict, "uncertain");
  assert.equal(ok(0.31, 0.9).verdict, "uncertain");
  assert.equal(ok(0.3, 0.9).verdict, "doesn't");
  assert.equal(ok(0.3, 0.5).verdict, "doesn't");
  assert.equal(ok(0.1, 0.3).verdict, "junk");
  assert.equal(ok(0.1, 0.9, { cut: "only part was judged" }).verdict, "uncertain");
  assert.equal(ok(0.1, 0.1, { cut: "only part was judged" }).verdict, "uncertain");
  assert.equal(route({ status: "ok", chars: 50 }).verdict, "junk");
  assert.equal(route({ status: "error", error: "Firecrawl: blocked" }).verdict, "error");
  assert.equal(route({ status: "skipped", error: "skipped: credit cap 5 reached" }).verdict, "error");
  assert.equal(route({ status: "ok", chars: 5000, jevError: "HTTP 500" }).verdict, "error");
  assert.equal(route({ status: "ok", chars: 5000 }).verdict, "error");
  const flagged = route({ status: "ok", chars: 5000, jev: { answers: 0.9, has_content: 0.9, instructs_ai: 0.8 } });
  assert.equal(flagged.verdict, "answers");
  assert.match(flagged.reason, /instructions aimed at AI/);
});

test("happy path: every verdict, a table that sorts open pages first, usage and token estimate", async () => {
  const dir = tmp();
  try {
    const pages = {
      "https://a.test/yes": { markdown: long("STABLE20") },
      "https://a.test/no": { markdown: long("UNRELATED") },
      "https://a.test/maybe": { markdown: long("MAYBE") },
      "https://a.test/nav": { markdown: long("NAV") },
      "https://a.test/empty": { markdown: "Loading..." },
    };
    const jev = (b) => {
      const t = b.state.page.text;
      if (t.includes("STABLE20")) return { answers: 0.93, has_content: 0.95, instructs_ai: 0.02 };
      if (t.includes("UNRELATED")) return { answers: 0.04, has_content: 0.92, instructs_ai: 0.01 };
      if (t.includes("MAYBE")) return { answers: 0.5, has_content: 0.9, instructs_ai: 0.01 };
      return { answers: 0.02, has_content: 0.1, instructs_ai: 0.01 };
    };
    const m = mocks({ pages, jev });
    const man = await runAll(dir, m);
    assert.equal(byUrl(man, "https://a.test/yes").verdict, "answers");
    assert.equal(byUrl(man, "https://a.test/no").verdict, "doesn't");
    assert.equal(byUrl(man, "https://a.test/maybe").verdict, "uncertain");
    assert.equal(byUrl(man, "https://a.test/nav").verdict, "junk");
    assert.equal(byUrl(man, "https://a.test/empty").verdict, "junk");
    assert.equal(m.calls.judge, 1, "one batch for all pages");
    assert.equal(man.jev.usage.requests, 4, "the empty page is junk by rule, without a Jev call");
    assert.equal(man.jev.usage.input_tokens, 400);
    assert.deepEqual(man.jev.models, ["jev-1.14.0"]);
    const { text, summary } = renderReport(man, dir);
    const rows = text.split("\n").filter((l) => /^\| \d/.test(l));
    assert.equal(rows.length, 5, "every page has a row");
    assert.match(rows[0], /\| answers \|/);
    assert.match(rows[1], /\| uncertain \|/);
    assert.deepEqual(summary.open.length, 2);
    assert.ok(summary.tokens.savedEst > 0);
    assert.equal(man.firecrawl.countedSpent, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("search failure stops the run before any credit is spent", async () => {
  const m = mocks({ search: async () => { throw new Error("Parallel search failed (exit 1)"); } });
  await assert.rejects(searchStage({ question: QUESTION, pages: 30 }, m.providers), /Parallel search failed/);
  assert.equal(m.calls.scrape.length, 0);
  await assert.rejects(searchStage({ question: QUESTION, pages: 30 }, mocks({ search: async () => [] }).providers), /no URLs/);
});

test("unreadable Firecrawl balance: refuses to spend", async () => {
  const dir = tmp();
  try {
    for (const balance of [null, new Error("status failed")]) {
      const m = mocks({ pages: { "https://a.test/1": { markdown: long("x") } }, balance });
      const man = await searchStage({ question: QUESTION, pages: 30 }, m.providers);
      await assert.rejects(fetchStage(man, dir, m.providers, { maxCredits: 30, pdfPages: 3 }), /balance|status failed/);
      assert.equal(m.calls.scrape.length, 0);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("balance below the plan: refuses to start", async () => {
  const dir = tmp();
  try {
    const pages = Object.fromEntries([1, 2, 3].map((n) => [`https://a.test/${n}`, { markdown: long("x") }]));
    const m = mocks({ pages, balance: { remaining: 2, total: 1000 } });
    const man = await searchStage({ question: QUESTION, pages: 30 }, m.providers);
    await assert.rejects(fetchStage(man, dir, m.providers, { maxCredits: 30, pdfPages: 3 }), /needs up to 3 credits but Firecrawl has 2/);
    assert.equal(m.calls.scrape.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("credit cap: pages past it are skipped rows, never scraped; a PDF URL plans its page cap", async () => {
  const dir = tmp();
  try {
    const pages = {
      "https://a.test/1": { markdown: long("x") },
      "https://a.test/doc.pdf": { markdown: long("x"), credits: 3, contentType: "application/pdf" },
      "https://a.test/3": { markdown: long("x") },
      "https://a.test/4": { markdown: long("x") },
    };
    assert.equal(planCost("https://a.test/doc.pdf", 3), 3);
    assert.equal(planCost("https://a.test/page", 3), 1);
    const m = mocks({ pages });
    const man = await runAll(dir, m, { maxCredits: 5 });
    assert.deepEqual(m.calls.scrape.sort(), ["https://a.test/1", "https://a.test/3", "https://a.test/doc.pdf"]);
    assert.equal(byUrl(man, "https://a.test/4").status, "skipped");
    assert.equal(byUrl(man, "https://a.test/4").verdict, "error");
    assert.match(byUrl(man, "https://a.test/4").reason, /credit cap 5/);
    assert.ok(man.firecrawl.countedSpent <= 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("blocked page: one error row, not retried, the rest carries on", async () => {
  const dir = tmp();
  try {
    const pages = {
      "https://a.test/blocked": { fail: "failed", error: "The URL failed to load (ERR_EMPTY_RESPONSE)" },
      "https://a.test/ok": { markdown: long("x") },
    };
    const m = mocks({ pages });
    const man = await runAll(dir, m);
    assert.equal(m.calls.scrape.filter((u) => u.endsWith("blocked")).length, 1);
    const row = byUrl(man, "https://a.test/blocked");
    assert.equal(row.verdict, "error");
    assert.match(row.reason, /ERR_EMPTY_RESPONSE/);
    assert.equal(byUrl(man, "https://a.test/ok").verdict, "answers");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("402 mid-run: no further scrapes, the remaining pages are error rows", async () => {
  const dir = tmp();
  try {
    const pages = {
      "https://a.test/1": { markdown: long("x") },
      "https://a.test/2": { fail: "credits", error: "HTTP 402 Insufficient credits" },
      "https://a.test/3": { markdown: long("x") },
      "https://a.test/4": { markdown: long("x") },
    };
    const m = mocks({ pages });
    const man = await searchStage({ question: QUESTION, pages: 30 }, m.providers);
    await fetchStage(man, dir, m.providers, { maxCredits: 30, pdfPages: 3, scrapeConcurrency: 1 });
    assert.deepEqual(m.calls.scrape, ["https://a.test/1", "https://a.test/2"]);
    for (const n of [2, 3, 4]) {
      const row = byUrl(man, `https://a.test/${n}`);
      assert.equal(row.status, "error");
      assert.match(row.error, /402/);
      assert.equal(route(row).verdict, "error");
    }
    assert.equal(classifyScrapeError("Error: Insufficient credits to perform this request"), "credits");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("429: retried with backoff, then an error row when retries run out", async () => {
  const dir = tmp();
  try {
    const pages = {
      "https://a.test/flaky": [{ fail: "rate", error: "HTTP 429" }, { markdown: long("x") }],
      "https://a.test/stuck": { fail: "rate", error: "HTTP 429 rate limit" },
    };
    const m = mocks({ pages });
    const man = await searchStage({ question: QUESTION, pages: 30 }, m.providers);
    const waits = [];
    await fetchStage(man, dir, m.providers, { maxCredits: 30, pdfPages: 3, rateRetries: 2, sleep: async (ms) => waits.push(ms) });
    assert.equal(byUrl(man, "https://a.test/flaky").status, "ok");
    assert.equal(m.calls.scrape.filter((u) => u.endsWith("stuck")).length, 3);
    assert.match(byUrl(man, "https://a.test/stuck").error, /rate limited/);
    assert.ok(waits.length >= 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Jev failures are error rows, never doesn't: HTTP error, malformed answer, worker crash", async () => {
  const dir = tmp();
  try {
    const pages = { "https://a.test/a": { markdown: long("A") }, "https://a.test/b": { markdown: long("B") } };
    // per-request failures
    let m = mocks({
      pages,
      judge: (bodies) => bodies.map((b) => (b.state.page.text.includes("A")
        ? { ok: false, error: "HTTP 503" }
        : { ok: false, error: 'malformed Jev answer for "answers"' })),
    });
    let man = await runAll(dir, m);
    assert.equal(byUrl(man, "https://a.test/a").verdict, "error");
    assert.match(byUrl(man, "https://a.test/a").reason, /HTTP 503/);
    assert.equal(byUrl(man, "https://a.test/b").verdict, "error");
    assert.match(byUrl(man, "https://a.test/b").reason, /malformed/);
    assert.equal(readdirSync(join(dir, "cache")).length, 0, "failures are never cached");
    // the whole worker fails (no key, crash)
    m = mocks({ pages, judge: async () => { throw new Error("Jev worker failed (exit 1)"); } });
    man = await runAll(dir, m);
    for (const p of man.pages) assert.equal(p.verdict, "error");
    // wrong result count
    m = mocks({ pages, judge: async () => [] });
    man = await runAll(dir, m);
    for (const p of man.pages) assert.match(p.reason, /wrong number/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("callJev: validates answers, reports HTTP errors and timeouts, retries 429, never echoes the key", async () => {
  const key = "ts_secret_value_123";
  const body = { model: "jev-1.14.0", state: {}, questions: QUESTIONS };
  const reply = (status, json) => async () => ({ ok: status < 300, status, headers: new Map(), json: async () => json });
  const good = { model: "jev-1.14.0", usage: { input_tokens: 9, output_tokens: 1 }, answers: { answers: { type: "noul", noul: 0.8 }, has_content: { type: "noul", noul: 0.9 }, instructs_ai: { type: "noul", noul: 0 } } };
  const ok = await callJev(body, { key, fetchImpl: reply(200, good) });
  assert.deepEqual(ok.answers, { answers: 0.8, has_content: 0.9, instructs_ai: 0 });
  const http = await callJev(body, { key, fetchImpl: reply(401, { error: { message: "bad key" } }), sleep: async () => {} });
  assert.equal(http.ok, false);
  assert.match(http.error, /HTTP 401/);
  const bad = await callJev(body, { key, fetchImpl: reply(200, { answers: { answers: { type: "noul", noul: 1.7 } } }) });
  assert.match(bad.error, /malformed/);
  const missing = await callJev(body, { key, fetchImpl: reply(200, { answers: {} }) });
  assert.match(missing.error, /malformed/);
  const timeout = await callJev(body, { key, timeoutMs: 5, fetchImpl: async (_u, o) => new Promise((_r, rej) => o.signal.addEventListener("abort", () => rej(o.signal.reason))) });
  assert.match(timeout.error, /timed out/);
  let n = 0;
  const retried = await callJev(body, { key, sleep: async () => {}, fetchImpl: async () => (++n < 3 ? reply(429, {})() : reply(200, good)()) });
  assert.equal(retried.ok, true);
  assert.equal(n, 3);
  for (const r of [http, bad, missing, timeout]) assert.ok(!r.error.includes(key));
});

test("jevWorker without a key writes an error result per job and makes no call", async () => {
  const dir = tmp();
  try {
    writeFileSync(join(dir, "jobs.json"), JSON.stringify([{ model: "m" }, { model: "m" }]));
    let calls = 0;
    const out = await jevWorker(join(dir, "jobs.json"), join(dir, "results.json"), { env: {}, fetchImpl: async () => { calls++; } });
    assert.equal(calls, 0);
    assert.equal(out.length, 2);
    assert.ok(out.every((r) => r.ok === false && /TYPESAFE_API_KEY missing/.test(r.error)));
    assert.ok(existsSync(join(dir, "results.json")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cache by page fingerprint: a rerun asks nothing; changed text asks again", async () => {
  const dir = tmp();
  try {
    const pages = { "https://a.test/a": { markdown: long("A") } };
    const m = mocks({ pages });
    const man = await runAll(dir, m);
    assert.equal(m.calls.judge, 1);
    await judgeStage(man, dir, m.providers, { model: "jev-1.14.0", cacheDir: join(dir, "cache"), pdfPages: 3 });
    assert.equal(m.calls.judge, 1, "served from cache");
    assert.equal(man.jev.usage.cached, 1);
    writeFileSync(join(dir, byUrl(man, "https://a.test/a").file), long("A changed"));
    await judgeStage(man, dir, m.providers, { model: "jev-1.14.0", cacheDir: join(dir, "cache"), pdfPages: 3 });
    assert.equal(m.calls.judge, 2);
    await judgeStage(man, dir, m.providers, { model: "jev-1.13.0", cacheDir: join(dir, "cache"), pdfPages: 3 });
    assert.equal(m.calls.judge, 3, "another model is another fingerprint");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("long pages: chunked, the best chunk counts, and text past the limit makes 'doesn't' uncertain", async () => {
  const { chunks, truncated } = chunkText("x".repeat(CHUNK_CHARS * 2 + 5));
  assert.equal(chunks.length, 3);
  assert.equal(truncated, false);
  assert.equal(chunkText("x".repeat(CHUNK_CHARS * MAX_CHUNKS + 1)).truncated, true);
  // Parts follow line ends and carry 1-based line ranges.
  const line = "a".repeat(CHUNK_CHARS / 4 - 1);
  const byLines = chunkText(Array(10).fill(line).join("\n"));
  assert.deepEqual(byLines.chunks.map((c) => [c.startLine, c.endLine]), [[1, 4], [5, 8], [9, 10]]);
  assert.ok(byLines.chunks.every((c) => c.text.length <= CHUNK_CHARS));
  const dir = tmp();
  try {
    const pages = {
      "https://a.test/long-yes": { markdown: "x".repeat(CHUNK_CHARS) + long("ANSWER") },
      "https://a.test/huge-no": { markdown: "y".repeat(CHUNK_CHARS * MAX_CHUNKS + 10) },
      "https://a.test/scan": { markdown: long("pdf body"), contentType: "application/pdf" },
    };
    const jev = (b) => (b.state.page.text.includes("ANSWER") ? { answers: 0.9, has_content: 0.9, instructs_ai: 0 } : { answers: 0.05, has_content: 0.9, instructs_ai: 0 });
    const man = await runAll(dir, mocks({ pages, jev }));
    assert.equal(byUrl(man, "https://a.test/long-yes").chunks, 2);
    assert.equal(byUrl(man, "https://a.test/long-yes").verdict, "answers");
    const { text, summary } = renderReport(man, dir);
    assert.match(text, /1 of 2 parts answer/);
    assert.match(text, /pages\/0\.md lines 1-1 \|/, "points at the best part's lines");
    assert.ok(summary.tokens.openPagesEst < summary.tokens.allPagesEst / 3, "open = best parts, not whole pages");
    assert.equal(byUrl(man, "https://a.test/huge-no").verdict, "uncertain");
    assert.match(byUrl(man, "https://a.test/huge-no").reason, /only the first/);
    assert.equal(byUrl(man, "https://a.test/scan").verdict, "uncertain", "a PDF behind a non-.pdf URL parsed only its first page");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("score: recall over labelled relevant pages and false answers; labels never reach the judge", async () => {
  const dir = tmp();
  try {
    const pages = { "https://a.test/r1": { markdown: long("R1") }, "https://a.test/r2": { markdown: long("R2") }, "https://a.test/n1": { markdown: long("N1") } };
    const seen = [];
    const jev = (b) => {
      seen.push(JSON.stringify(b));
      const t = b.state.page.text;
      return t.includes("R1") ? { answers: 0.9, has_content: 0.9, instructs_ai: 0 } : t.includes("R2") ? { answers: 0.1, has_content: 0.9, instructs_ai: 0 } : { answers: 0.8, has_content: 0.9, instructs_ai: 0 };
    };
    const man = await runAll(dir, mocks({ pages, jev }));
    const s = scoreRun(man, { "https://a.test/r1": true, "https://a.test/r2": true, "https://a.test/n1": false });
    assert.equal(s.recall, 0.5);
    assert.equal(s.missed[0].url, "https://a.test/r2");
    assert.equal(s.falseAnswers.length, 1);
    // Jev sees only the question and the page; labels are read by scoreRun alone.
    for (const x of seen.map((s) => JSON.parse(s))) {
      assert.deepEqual(Object.keys(x.state).sort(), ["page", "research_question"]);
      assert.deepEqual(Object.keys(x.state.page).sort(), ["part", "text", "title", "url"]);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("table cells escape backslashes before pipes, so a cell cannot split a row", () => {
  const manifest = {
    question: QUESTION,
    pages: [{ i: 0, url: "https://a.test/x\\|y", status: "error", verdict: "error", reason: "Firecrawl: a\\|b | c" }],
  };
  const row = renderReport(manifest, ".").text.split("\n").find((l) => l.startsWith("| 0 "));
  assert.ok(row.includes("a\\\\\\|b \\| c"), row);
  assert.ok(row.includes("https://a.test/x\\\\\\|y"), row);
  // Unescaped pipes are exactly the 7 column borders.
  assert.equal(row.replace(/\\\\/g, "").replace(/\\\|/g, "").split("|").length - 1, 7);
});

test("parseCredits and parseArgs guard the inputs", () => {
  assert.deepEqual(parseCredits("\x1b[2mCredits:\x1b[0m 733 / 1,000 \x1b[2m(73% left)\x1b[0m"), { remaining: 733, total: 1000 });
  assert.equal(parseCredits("not authenticated"), null);
  assert.throws(() => parseArgs(["run", "--pages", "51"]), /capped at 50/);
  assert.throws(() => parseArgs(["run", "--max-credits", "101"]), /capped at 100/);
  assert.throws(() => parseArgs(["run", "--pages", "0"]), /positive/);
  assert.throws(() => parseArgs(["run", "--jev-key", "ts_live abc"]), /key name/);
  const o = parseArgs(["run", "--question", "q"]);
  assert.equal(o.pages, 30);
  assert.equal(o.maxCredits, 30);
});

test("main: run end to end on mocks writes manifest, report and summary; score reads labels", async () => {
  const dir = tmp();
  try {
    const m = mocks({ pages: { "https://a.test/a": { markdown: long("A") } } });
    const out = [];
    await main(["run", "--question", QUESTION, "--out", dir, "--cache-dir", join(dir, "cache")], { providers: m.providers, log: (s) => out.push(s) });
    assert.match(out[0], /\| answers \|/);
    for (const f of ["manifest.json", "report.md", "summary.json"]) assert.ok(existsSync(join(dir, f)), f);
    writeFileSync(join(dir, "labels.json"), JSON.stringify({ "https://a.test/a": true }));
    await main(["score", "--out", dir, "--labels", join(dir, "labels.json")], { providers: m.providers, log: (s) => out.push(s) });
    assert.equal(JSON.parse(readFileSync(join(dir, "score.json"), "utf8")).recall, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
