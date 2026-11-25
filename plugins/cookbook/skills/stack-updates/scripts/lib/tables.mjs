// Fixed tables the daily update check and the catalog check both read. They
// live inside the plugin because the plugin ships only plugins/cookbook.

// Hosts a `changelog` feed may name; add a host here in the same pull request as
// its feed. A changelog feed follows only a hosted or none part (check.mjs): a page
// hash cannot say an installed version is behind. A page qualifies only when it is
// the vendor's own, answers without a redirect, and its text changes only with a
// release: on 13 November 2026 it read the same twice and carried no live counter.
// Rejected that day: graphify.com and firecrawl.dev (a live star count in the page
// text), docs.parallel.ai (the docs build id) and developers.cloudflare.com (several
// entries a day across every product). proton.me left on 14 November 2026: the
// Proton Pass CLI follows its GitHub releases instead.
export const CHANGELOG_HOSTS = Object.freeze([
  "www.browserbase.com", // Browserbase: the platform changelog
]);

// Tool ids whose installed version moves without us: Claude Code updates itself,
// and the app syncs the Wix plugin. A part of such a
// tool is reported when its installed version changes, never as "still behind".
// Today only Claude Code has a readable version: Wix is a hosted part with
// no feed, so it is never reported; its id takes effect only if it gets one.
// `check.mjs` requires each id to name a tool in the catalog.
export const SELF_UPDATING_TOOLS = Object.freeze([
  "1c9ccea9-8ebf-4d9c-9512-38e6890ea5b6", // Claude Code
  "wix", // Wix
]);

// The only commands the daily update check ever runs to read an installed
// version, keyed by part key "<tool id>/<part name>". argv[0] is a bare command
// name that must be an executable on PATH (it is run without a shell), or `{share}/<relative path>` for a binary under ~/.local/share.
// `{share}`, `{bin}` (~/.local/bin) and `{lib}` (this plugin's scripts/lib) are the only substitutions, allowed only in the tables of this file, never in the catalog. `pattern` is matched against stdout; group 1 is the version.
// Each pattern was written against the real output on the owner's PC on
// 13 November 2026 and read again on the Ubuntu laptop on 19 November 2026 (the
// binaries under ~/.local/share have no `.exe` there). A part whose command cannot
// run here has no entry.
export const VERSION_COMMANDS = Object.freeze({
  "1c9ccea9-8ebf-4d9c-9512-38e6890ea5b6/cli": { argv: ["claude", "--version"], pattern: /^(\d+\.\d+\.\d+) \(Claude Code\)/m },
  "git/cli": { argv: ["git", "--version"], pattern: /^git version (\S+)/m },
  "node/runtime": { argv: ["node", "--version"], pattern: /^v(\d+\.\d+\.\d+)\s*$/m },
  "github/gh-cli": { argv: ["gh", "--version"], pattern: /^gh version (\d+\.\d+\.\d+)/m },
  "depot/cli": { argv: ["depot", "--version"], pattern: /^depot version (\d+\.\d+\.\d+)/m },
  "semgrep/cli": { argv: ["semgrep", "--version"], pattern: /^(\d+\.\d+\.\d+)\s*$/m },
  "gitleaks/cli": { argv: ["gitleaks", "version"], pattern: /^(\d+\.\d+\.\d+)\s*$/m },
  "trivy/cli": { argv: ["trivy", "--version"], pattern: /^Version: (\d+\.\d+\.\d+)/m },
  "osv-scanner/cli": { argv: ["osv-scanner", "--version"], pattern: /^osv-scanner version: (\d+\.\d+\.\d+)/m },
  "lightcraft/cli": { argv: ["{share}/lightcraft/bin/lightcraft-cli", "--version"], pattern: /^lightcraft-cli (\d+\.\d+\.\d+)/m },
  "photocraft/cli": { argv: ["{share}/photocraft/bin/photocraft-cli", "--version"], pattern: /^photocraft-cli (\d+\.\d+\.\d+)/m },
  "boat/cli": { argv: ["{share}/boat/boat", "--version"], pattern: /^boat (\d+\.\d+\.\d+)/m },
  "cliproxyapi/cli": { argv: ["{share}/cliproxyapi/bin/cli-proxy-api", "-h"], pattern: /^CLIProxyAPI Version: (\d+\.\d+\.\d+),/m },
  "proton-pass-cli/cli": { argv: ["{share}/proton-pass-cli/pass-cli", "--version"], pattern: /^Proton Pass CLI (\d+\.\d+\.\d+)/m },
  "google-workspace-cli/cli": { argv: ["{share}/gws/gws", "--version"], pattern: /^gws (\d+\.\d+\.\d+)/m },
  // Written against the real output on the Ubuntu laptop on 19 November 2026.
  "mise/cli": { argv: ["mise", "--version"], pattern: /^(\d{4}\.\d{1,2}\.\d+) /m },
  "uv/cli": { argv: ["uv", "--version"], pattern: /^uv (\d+\.\d+\.\d+)/m },
  "rustup/cli": { argv: ["rustup", "--version"], pattern: /^rustup (\d+\.\d+\.\d+)/m },
  "ast-grep/cli": { argv: ["ast-grep", "--version"], pattern: /^ast-grep (\d+\.\d+\.\d+)/m },
  "yt-dlp/cli": { argv: ["yt-dlp", "--version"], pattern: /^(\d{4}\.\d{2}\.\d{2})\s*$/m },
  // Proton Mail Bridge is an apt package; its own --version starts the window. Written against
  // the real output on the Ubuntu laptop on 20 November 2026.
  "proton-mail-bridge/app": { argv: ["dpkg-query", "--show", "protonmail-bridge"], pattern: /^protonmail-bridge\s+(\d+\.\d+\.\d+)/m },
  // The creative kit and the documents kit. Written against the real output on the Ubuntu
  // laptop on 20 November 2026. Blender is read from snapd: its own --version starts the app.
  "imagemagick/cli": { argv: ["magick", "-version"], pattern: /^Version: ImageMagick (\d+\.\d+\.\d+-\d+)/m },
  "libvips/cli": { argv: ["vips", "--version"], pattern: /^vips-(\d+\.\d+\.\d+)/m },
  "inkscape/cli": { argv: ["inkscape", "--version"], pattern: /^Inkscape (\d+\.\d+(?:\.\d+)?) /m },
  "blender/cli": { argv: ["snap", "list", "blender"], pattern: /^blender\s+(\d+\.\d+\.\d+)\s/m },
  "typst/cli": { argv: ["typst", "--version"], pattern: /^typst (\d+\.\d+\.\d+)/m },
  "pandoc/cli": { argv: ["pandoc", "--version"], pattern: /^pandoc (\d+(?:\.\d+)+)/m },
  "jupyter/cli": { argv: ["jupyter-lab", "--version"], pattern: /^(\d+\.\d+\.\d+)\s*$/m },
});

// The only commands the daily update check runs to prove a service answers,
// keyed by tool id. One real, free, read-only call each, with one exception:
// `parallel` is the single paid check (one search, one result), allowed by the
// owner on 7 October 2026. `argv` follows the rules of VERSION_COMMANDS and adds
// tokens: `{bin}` is ~/.local/bin and `{lib}` is this plugin's scripts/lib folder.
// A CLI that gets its key from the OS key store is a launcher in ~/.local/bin: an
// executable `#!/bin/sh` file with no extension, started without a shell as
// `{bin}/<name> <arguments>` (by its full path, so the check never depends on the
// PATH a scheduled run gets). Every element is a constant of this table: nothing from the catalog, a file or a command's output is put in one.
// `ok` must match a line that proves the account answered (an identity, a plan or a
// balance line), not just a zero exit. Each pattern was written against the real
// output on the owner's PC on 13 November 2026, except `proton-pass-cli`, which
// was signed out that day (its pattern was written against the signed-in output
// on 14 November 2026), and `depot`, written on the Ubuntu laptop on 19 November 2026.
// No result keeps account detail: only the service name and, on a failure, a
// scrubbed error of at most 200 characters. Jev has no entry: `connect.mjs` reads
// the Jev compaction plugin's decision log instead. `claude mcp list` is run once by `connect.mjs`
// for every hosted part that names a server.
const shim = (name, ...args) => [`{bin}/${name}`, ...args];
export const CONNECTION_CHECKS = Object.freeze({
  github: { argv: ["gh", "api", "user", "--jq", ".login"], ok: /^(?!(?:null|error|none|undefined|true|false)\s*$)[A-Za-z0-9][A-Za-z0-9-]{0,38}\s*$/im },
  // Depot answers with the organisation token of the key store (`depot-org`): the CLI is not
  // signed in on Linux, and this read never asks for a login. One finalized invoice comes back
  // as JSON (seen on 19 November 2026); the result keeps none of it. Not `org credits`: Depot
  // allows that read once a minute, so a second run in that minute would read as broken.
  depot: { argv: ["node", "{bin}/with-key.mjs", "depot-org", "DEPOT_TOKEN", "depot", "org", "invoices", "list", "--page-size", "1"], ok: /^\{\s*"invoices":\s*\[/ },
  firecrawl: { argv: shim("firecrawl", "--status"), ok: /Credits: [\d,]+ \/ [\d,]+/ },
  boat: { argv: shim("boat", "limits"), ok: /"billingStatus":"[a-z_]+"/ },
  browserbase: { argv: shim("browse", "cloud", "projects", "list"), ok: /"concurrency":\s*\d+/ },
  // A signed-in CLI answers with "- Key: value" lines, among them "- Personal Access Token:
  // [Agent] <name>" (seen on 14 November 2026); its error and usage lines never count.
  "proton-pass-cli": { argv: shim("pass-cli", "info"), ok: /(?<![\s\S])(?![\s\S]*(?:error|usage|no session|authenticated client))[\s\S]*?^(?:- )?[A-Za-z][A-Za-z ]*:[ \t]*\S/im },
  "google-workspace-cli": { argv: shim("google", "status"), ok: /^(?!.*"works":\s*false).*"ok":\s*true/s },
  cloudflare: { argv: ["node", "{bin}/with-key.mjs", "cloudflare-wrangler", "CLOUDFLARE_API_TOKEN", "node", "{lib}/cloudflare-verify.mjs"], ok: /^active\s*$/m },
  parallel: { argv: shim("parallel-cli", "search", "status", "--json", "--max-results", "1", "--excerpt-max-chars-total", "200"), ok: /"status":\s*"ok"/, paid: true },
});

// The hosted MCP servers watched for skills (Skills over MCP): when one serves skills, the
// report says so, and our own skill for that job is retired (Cookbook
// `options/mcp-features.md`). `lib/mcp-skills.mjs` asks with no key, so only a server that
// answers `initialize` without a sign-in is here: Graphify answers 401 (25 November 2026)
// and is checked by hand at its releases. A count is news once, when it changes (the state keeps it).
export const MCP_SKILL_SERVERS = Object.freeze([
  { service: "Firecrawl", argv: ["node", "{lib}/mcp-skills.mjs", "https://mcp.firecrawl.dev/v2/mcp"] },
  { service: "Parallel", argv: ["node", "{lib}/mcp-skills.mjs", "https://mcp.parallel.ai/mcp/claude"] },
]);
