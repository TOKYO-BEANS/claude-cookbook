// Feed readers for the daily update check: given a catalog part's `feed`, find
// the newest release and the release notes between two versions.
//
// Node built-ins only. Everything that touches the network takes
// `{ fetcher, gh }` (a fetch-like function and `(args) -> { code, stdout,
// stderr }`), so tests pass fakes. `readLatest` and `releaseText` never throw:
// an unreadable feed is `{ ok: false, message }`, never "up to date".
//
// Release text is untrusted data. These readers only return it as a string:
// nothing in it is interpreted, executed or used to build a URL or a command.
// Repositories and paths are validated before they reach a `gh` argument, and
// each provider host is fixed per kind (GitHub kinds go through `gh api`, never
// a raw URL).
import { createHash } from "node:crypto";
import { CHANGELOG_HOSTS } from "./tables.mjs";

export const RESPONSE_LIMIT = 1_500_000; // bytes per HTTP response or gh answer
export const TEXT_LIMIT = 12_000; // characters of release text per change

const TIMEOUT_MS = 10_000;
const AGENT = "cookbook-stack-updates/1";
const NPM_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SUBPATH = /^(?!.*(^|\/)\.\.?(\/|$))[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/;
const REF = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/;
const COMMIT = /^[0-9a-f]{40}$/;
const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;

// ---- small helpers --------------------------------------------------------

const fail = (message) => ({ ok: false, message: String(message).slice(0, 180) });
const cause = (e) => String(e?.message ?? e).split("\n")[0].slice(0, 180) || "unreadable";
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const cap = (text) =>
  String(text)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .slice(0, TEXT_LIMIT);

// "v1.2.3" or "1.2.3" -> "1.2.3"; anything else (a prerelease, a date) -> null.
const stable = (v) => {
  const s = typeof v === "string" ? v.replace(/^v/, "") : "";
  return STABLE.test(s) ? s : null;
};
// Numeric dotted versions of any length ("1.2" equals "1.2.0"): -1, 0 or 1.
// Callers pass digits and dots only; BigInt keeps long segments exact.
export const compareNumeric = (a, b) => {
  const x = String(a).split("."), y = String(b).split(".");
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = BigInt(x[i] || 0), q = BigInt(y[i] || 0);
    if (p !== q) return p > q ? 1 : -1;
  }
  return 0;
};
const compare = compareNumeric;

async function boundedBytes(response, limit = RESPONSE_LIMIT) {
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  if (!response.body) throw new Error("Provider returned no body");
  const reader = response.body.getReader();
  const parts = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("Response exceeded the size limit");
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(parts);
}

// One GET on a fixed provider host. A redirect is an error, never followed.
async function httpText(fetcher, url, accept) {
  const response = await fetcher(url, {
    headers: { Accept: accept, "User-Agent": AGENT },
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return new TextDecoder().decode(await boundedBytes(response));
}
const httpJson = async (fetcher, url) => JSON.parse(await httpText(fetcher, url, "application/json"));

// `gh api <endpoint>`; the endpoint is built only from validated parts.
async function ghJson(gh, endpoint) {
  const { code, stdout, stderr } = await gh(["api", endpoint]);
  if (code !== 0) throw new Error(`gh api failed: ${String(stderr ?? "").trim().split("\n")[0].slice(0, 150) || `exit ${code}`}`);
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > RESPONSE_LIMIT) throw new Error("Response exceeded the size limit");
  return JSON.parse(stdout);
}
export async function ghFile(gh, repo, path, ref) {
  const data = await ghJson(gh, `repos/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`);
  if (!isObject(data) || data.type !== "file" || data.encoding !== "base64" || typeof data.content !== "string")
    throw new Error("Unexpected file answer");
  return Buffer.from(data.content, "base64").toString("utf8");
}
function needRepo(repo) {
  if (typeof repo !== "string" || !REPO.test(repo)) throw new Error("A feed needs its owner/repository");
  return repo;
}
function needPath(path) {
  if (path !== undefined && path !== "" && !SUBPATH.test(String(path))) throw new Error("A feed path must be a plain relative path");
  return path ?? "";
}
const commitsEndpoint = (repo, { sha, path, count }) => {
  const q = [sha ? `sha=${sha}` : null, path ? `path=${path}` : null, `per_page=${count}`].filter(Boolean).join("&");
  return `repos/${repo}/commits?${q}`;
};
const commitUrl = (repo, sha) => `https://github.com/${repo}/commit/${sha}`;

// ---- readers: each returns a Latest or throws ------------------------------

async function npmLatest(feed, { fetcher }) {
  if (typeof feed.package !== "string" || !NPM_NAME.test(feed.package)) throw new Error("An npm feed needs a package name");
  const tag = feed.tag ?? "latest";
  if (tag !== "latest" && tag !== "stable") throw new Error("An npm feed tag must be latest or stable");
  const data = await httpJson(fetcher, `https://registry.npmjs.org/${encodeURIComponent(feed.package)}/${tag}`);
  const version = isObject(data) ? stable(data.version) : null;
  if (!version) throw new Error("No stable semantic release was returned");
  return { ok: true, version, source: `https://www.npmjs.com/package/${feed.package}/v/${version}` };
}

// A GitHub release's tag -> a version. Git for Windows tags v<x.y.z>.windows.<n>.
const semverTag = (tag) => stable(tag);
const windowsTag = (tag) => /^v(\d+\.\d+\.\d+)\.windows\.\d+$/.exec(tag)?.[1] ?? null;

async function githubLatest(repo, parse, { gh }) {
  const data = await ghJson(gh, `repos/${repo}/releases/latest`);
  const tag = isObject(data) && typeof data.tag_name === "string" ? data.tag_name : "";
  if (!tag) throw new Error("No GitHub release is published");
  if (data.draft === true || data.prerelease === true) throw new Error("The newest GitHub release is not a stable release");
  const version = parse(tag);
  if (!version) throw new Error("No stable semantic release was returned");
  return { ok: true, version, source: `https://github.com/${repo}/releases/tag/${tag}` };
}

async function commitLatest(feed, { gh }) {
  const repo = needRepo(feed.repository), path = needPath(feed.path);
  const sha = await headCommit(gh, repo, { path });
  return { ok: true, commit: sha, source: commitUrl(repo, sha) };
}
async function headCommit(gh, repo, { sha, path }) {
  const list = await ghJson(gh, commitsEndpoint(repo, { sha, path, count: 1 }));
  const found = Array.isArray(list) && isObject(list[0]) ? list[0].sha : null;
  if (typeof found !== "string" || !COMMIT.test(found)) throw new Error("No commit was returned");
  return found;
}

// Where a marketplace plugin lives: { repo, dir, ref, sha, entry }.
async function marketplaceLocation(feed, { gh }) {
  const repo = needRepo(feed.repository);
  if (typeof feed.plugin !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(feed.plugin)) throw new Error("A marketplace feed needs a plugin name");
  const market = JSON.parse(await ghFile(gh, repo, ".claude-plugin/marketplace.json"));
  const entry = Array.isArray(market?.plugins) ? market.plugins.find((p) => isObject(p) && p.name === feed.plugin) : null;
  if (!entry) throw new Error("The marketplace does not list that plugin");
  const s = entry.source;
  if (typeof s === "string") {
    if (!s.startsWith("./")) throw new Error("Unsupported plugin source");
    const dir = s.slice(2).replace(/\/+$/, "");
    return { repo, dir: needPath(dir), ref: null, sha: null, entry };
  }
  if (!isObject(s)) throw new Error("Unsupported plugin source");
  const named = s.source === "github" ? s.repo : /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(String(s.url ?? ""))?.[1];
  const ext = needRepo(named);
  const dir = s.source === "git-subdir" ? needPath(s.path) : "";
  const sha = typeof s.sha === "string" && COMMIT.test(s.sha) ? s.sha : null;
  const ref = sha ?? (typeof s.ref === "string" && REF.test(s.ref) ? s.ref : null);
  return { repo: ext, dir, ref, sha, entry };
}
async function marketplaceLatest(feed, { gh }) {
  const { repo, dir, ref, sha, entry } = await marketplaceLocation(feed, { gh });
  let version = null;
  try {
    version = stable(JSON.parse(await ghFile(gh, repo, `${dir ? `${dir}/` : ""}.claude-plugin/plugin.json`, ref))?.version);
  } catch {
    // No readable manifest: fall back to the marketplace entry's own version.
  }
  version ??= stable(entry.version);
  if (!version) throw new Error("No stable plugin version was found");
  const commit = sha ?? (await headCommit(gh, repo, { sha: ref ?? undefined, path: dir }));
  return { ok: true, version, commit, source: commitUrl(repo, commit) };
}

// Page text with markup and spacing removed, so a reflow is not a change.
const ENTITIES = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
function pageText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(head|script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m])
    .replace(/\s+/g, " ")
    .trim();
}
async function changelogPage(feed, { fetcher, hosts }) {
  let url;
  try {
    url = new URL(String(feed.url));
  } catch {
    throw new Error("A changelog feed needs a URL");
  }
  const allowed = hosts ?? CHANGELOG_HOSTS;
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("A changelog URL must be plain https");
  if (!allowed.includes(url.hostname)) throw new Error(`Host ${url.hostname} is not on the changelog allow list`);
  const text = pageText(await httpText(fetcher, url.href, "text/html, text/plain"));
  if (!text) throw new Error("The changelog page has no text");
  return { url: url.href, text };
}
async function changelogLatest(feed, deps) {
  const { url, text } = await changelogPage(feed, deps);
  return { ok: true, hash: createHash("sha256").update(text).digest("hex"), source: url };
}

// TypeSafe's models page: the highest jev-x.y.z in the "Current models" section.
const JEV_PAGE = "https://docs.typesafe.ai/models.md";
async function jevSection({ fetcher }) {
  const lines = (await httpText(fetcher, JEV_PAGE, "text/markdown")).split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Current models\s*$/.test(l));
  if (start < 0) throw new Error("The models page has no Current models section");
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n");
}
async function jevLatest(deps) {
  const section = await jevSection(deps);
  const row = /^\|\s*Model ID\s*\|.*$/m.exec(section)?.[0] ?? "";
  const best = [...row.matchAll(/`jev-(\d+\.\d+\.\d+)`/g)].map((m) => m[1]).sort(compare).at(-1);
  if (!best) throw new Error("No versioned Jev model was returned");
  return { ok: true, version: best, source: JEV_PAGE };
}

// Node.js: the newest long-term-support release in nodejs.org's own index.
async function nodeLatest({ fetcher }) {
  const data = await httpJson(fetcher, "https://nodejs.org/dist/index.json");
  if (!Array.isArray(data)) throw new Error("Invalid Node.js release index");
  const lts = data
    .filter((r) => isObject(r) && typeof r.lts === "string" && r.lts.trim() && stable(r.version))
    .map((r) => stable(r.version))
    .sort(compare)
    .at(-1);
  if (!lts) throw new Error("No stable Node.js LTS release was returned");
  return { ok: true, version: lts, source: `https://nodejs.org/en/blog/release/v${lts}` };
}

/** The newest release of a part's feed. Never throws. */
export async function readLatest(feed, { fetcher, gh, hosts } = {}) {
  try {
    if (!isObject(feed)) return fail("The part has no feed");
    const deps = { fetcher, gh, hosts };
    switch (feed.kind) {
      case "none":
        return { ok: true, source: "" };
      case "npm":
        return await npmLatest(feed, deps);
      case "github":
        return await githubLatest(needRepo(feed.repository), semverTag, deps);
      case "gitForWindows":
        return await githubLatest("git-for-windows/git", windowsTag, deps);
      case "marketplace":
        return await marketplaceLatest(feed, deps);
      case "commit":
        return await commitLatest(feed, deps);
      case "changelog":
        return await changelogLatest(feed, deps);
      case "jevModels":
        return await jevLatest(deps);
      case "nodeDist":
        return await nodeLatest(deps);
      default:
        return fail(`Unknown feed kind ${String(feed.kind).slice(0, 40)}`);
    }
  } catch (e) {
    return fail(cause(e));
  }
}

// ---- release text ----------------------------------------------------------

// Releases newer than `from` up to and including `to`, newest first.
async function releasesText(repo, parse, from, to, { gh }) {
  const list = await ghJson(gh, `repos/${repo}/releases?per_page=30`);
  if (!Array.isArray(list)) throw new Error("Unexpected releases answer");
  const lo = stable(from), hi = stable(to);
  const picked = list
    .filter((r) => isObject(r) && r.draft !== true && r.prerelease !== true && typeof r.tag_name === "string")
    .map((r) => ({ r, version: parse(r.tag_name) }))
    .filter(({ version }) => version && (!lo || compare(version, lo) > 0) && (!hi || compare(version, hi) <= 0))
    .sort((a, b) => compare(b.version, a.version));
  return picked
    .map(({ r }) => `## ${r.tag_name}${typeof r.published_at === "string" ? ` (${r.published_at.slice(0, 10)})` : ""}\n${typeof r.body === "string" ? r.body.trim() : ""}`.trim())
    .join("\n\n");
}

// Commit subjects with dates, newest first, from `to` back to (not including) `from`.
async function commitsText(repo, path, from, to, { gh }) {
  const list = await ghJson(gh, commitsEndpoint(repo, { sha: COMMIT.test(String(to)) ? to : undefined, path, count: 30 }));
  if (!Array.isArray(list)) throw new Error("Unexpected commits answer");
  const lines = [];
  for (const c of list) {
    if (!isObject(c) || typeof c.sha !== "string") continue;
    if (typeof from === "string" && from && c.sha === from) break;
    const message = typeof c.commit?.message === "string" ? c.commit.message.split("\n")[0].slice(0, 200) : "";
    const date = /^\d{4}-\d{2}-\d{2}/.exec(c.commit?.committer?.date ?? "")?.[0] ?? "";
    lines.push(`${date} ${message}`.trim());
  }
  return lines.join("\n");
}

/**
 * The release notes between two versions, newest first, at most TEXT_LIMIT
 * characters: `{ text }`, with `text: ""` when the kind publishes none here (none,
 * npm, nodeDist) or none fall in the range; `{ text: "", error }` with a short reason
 * when the notes could not be read. Never throws.
 */
export async function releaseNotes(feed, from, to, { fetcher, gh, hosts } = {}) {
  try {
    if (!isObject(feed)) return { text: "", error: "The part has no feed" };
    const deps = { fetcher, gh, hosts };
    switch (feed.kind) {
      case "github":
        return { text: cap(await releasesText(needRepo(feed.repository), semverTag, from, to, deps)) };
      case "gitForWindows":
        return { text: cap(await releasesText("git-for-windows/git", windowsTag, from, to, deps)) };
      case "commit":
        return { text: cap(await commitsText(needRepo(feed.repository), needPath(feed.path), from, to, deps)) };
      case "marketplace": {
        const { repo, dir } = await marketplaceLocation(feed, deps);
        return { text: cap(await commitsText(repo, dir, from, to, deps)) };
      }
      case "changelog":
        return { text: cap((await changelogPage(feed, deps)).text) };
      case "jevModels":
        return { text: cap((await jevSection(deps)).trim()) };
      default:
        return { text: "" }; // none, npm and nodeDist publish no notes here
    }
  } catch (e) {
    return { text: "", error: cause(e) };
  }
}

/** `releaseNotes(...).text`: the notes, or "" when there are none or they could not be read. Never throws. */
export async function releaseText(feed, from, to, deps = {}) {
  return (await releaseNotes(feed, from, to, deps)).text;
}
