// Fixed tables the daily update check and the catalog check both read. They
// live inside the plugin because the plugin ships only plugins/cookbook.

// Hosts a `changelog` feed may name. Empty until a hosted part gets a chosen
// changelog page; add the host here in the same pull request.
export const CHANGELOG_HOSTS = Object.freeze([]);

// The only commands the daily update check ever runs to read an installed
// version, keyed by part key "<tool id>/<part name>". argv[0] is a bare command
// name that must be a real executable on PATH (no .cmd or .bat shim: it is run
// without a shell). `pattern` is matched against stdout; group 1 is the version.
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
});
