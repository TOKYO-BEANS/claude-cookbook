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
// and the app syncs the Wix and Adobe for creativity plugins. A part of such a
// tool is reported when its installed version changes, never as "still behind".
// Today only Claude Code has a readable version: Wix and Adobe are hosted parts with
// no feed, so they are never reported; their ids take effect only if they get one.
// `check.mjs` requires each id to name a tool in the catalog.
export const SELF_UPDATING_TOOLS = Object.freeze([
  "1c9ccea9-8ebf-4d9c-9512-38e6890ea5b6", // Claude Code
  "wix", // Wix
  "adobe-for-creativity", // Adobe for creativity
]);

// The only commands the daily update check ever runs to read an installed
// version, keyed by part key "<tool id>/<part name>". argv[0] is a bare command
// name that must be a real executable on PATH (no .cmd or .bat shim: it is run
// without a shell), or `{share}/<relative path>` for a binary under ~/.local/share.
// `{share}`, `{bin}` (~/.local/bin) and `{lib}` (this plugin's scripts/lib) are the only substitutions, allowed only in the tables of this file, never in the catalog. When the capture is a 40-character hex id it is a commit, not a version. `pattern` is matched against stdout; group 1 is the version.
// Each pattern was written against the real output on the owner's PC on
// 13 November 2026. A part whose command cannot run here has no entry.
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
  "boat/cli": { argv: ["{share}/boat/boat.exe", "--version"], pattern: /^boat (\d+\.\d+\.\d+)/m },
  "proton-pass-cli/cli": { argv: ["{share}/proton-pass-cli/pass-cli.exe", "--version"], pattern: /^Proton Pass CLI (\d+\.\d+\.\d+)/m },
  "google-workspace-cli/cli": { argv: ["{share}/gws/gws.exe", "--version"], pattern: /^gws (\d+\.\d+\.\d+)/m },
  // The upstream commit the local patches sit on (HEAD is local patch commits on top of it).
  "jev-router/pinned": { argv: ["git", "-C", "{share}/jev-router", "merge-base", "HEAD", "origin/HEAD"], pattern: /^([0-9a-f]{40})\s*$/m },
});

// The only commands the daily update check runs to prove a service answers,
// keyed by tool id. One real, free, read-only call each, with one exception:
// `parallel` is the single paid check (one search, one result), allowed by the
// owner on 7 October 2026. `argv` follows the rules of VERSION_COMMANDS and adds
// tokens: `{bin}` is ~/.local/bin and `{lib}` is this plugin's scripts/lib folder.
// A CLI that keeps its key in the DPAPI store is a `.cmd` shim in ~/.local/bin; Node
// cannot start one without a shell, so it runs as the fixed argv
// `cmd.exe /d /c {bin}/<name>.cmd <arguments>`. Every element is a constant of
// this table: nothing from the catalog, a file or a command's output is put in one.
// `ok` must match a line that proves the account answered (an identity, a plan or a
// balance line), not just a zero exit. Each pattern was written against the real
// output on the owner's PC on 13 November 2026, except `proton-pass-cli`, which
// was signed out that day: its pattern is a "Label: value" line and is unproven.
// No result keeps account detail: only the service name and, on a failure, a
// scrubbed error of at most 200 characters. Jev has no entry: `connect.mjs` reads
// the router's decision log instead. `claude mcp list` is run once by `connect.mjs`
// for every hosted part that names a server.
const shim = (name, ...args) => ["cmd.exe", "/d", "/c", `{bin}/${name}.cmd`, ...args];
export const CONNECTION_CHECKS = Object.freeze({
  github: { argv: ["gh", "api", "user", "--jq", ".login"], ok: /^(?!(?:null|error|none|undefined|true|false)\s*$)[A-Za-z0-9][A-Za-z0-9-]{0,38}\s*$/im },
  depot: { argv: ["depot", "org", "list"], ok: /^Organization ID,Name\r?\n[^\r\n,]+,[^\r\n]+/m },
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
