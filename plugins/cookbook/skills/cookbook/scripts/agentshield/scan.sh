#!/usr/bin/env bash
# The weekly AgentShield scan (recipes/agent-audit.md): starts scan.mjs beside this file.
# install.sh copies this folder to ~/.local/share/stack-atlas/agentshield; the scheduled
# task runs that copy. /usr/bin/node by its full path: a scheduled run has a short PATH.
# AGENTSHIELD_NODE names another Node (the tests use it); the scan needs Node 25 or newer.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node="${AGENTSHIELD_NODE:-/usr/bin/node}"
[ -x "$node" ] || node="$(command -v node)"
# A run takes seconds. One that hangs is stopped after ten minutes; new-findings.md then
# still says that the run did not finish.
if command -v timeout > /dev/null; then exec timeout 600 "$node" "$here/scan.mjs" "$@"; fi
exec "$node" "$here/scan.mjs" "$@"
