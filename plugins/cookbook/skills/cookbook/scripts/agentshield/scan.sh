#!/usr/bin/env bash
# The weekly AgentShield scan (recipes/agent-audit.md): starts scan.mjs beside this file.
# install.sh copies this folder to ~/.local/share/stack-atlas/agentshield; the scheduled
# task runs that copy. /usr/bin/node by its full path: a scheduled run has a short PATH.
# AGENTSHIELD_NODE names another Node (the tests use it); the scan needs Node 25 or newer.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node="${AGENTSHIELD_NODE:-/usr/bin/node}"
[ -x "$node" ] || node="$(command -v node)"
# A run takes seconds. One that hangs is stopped after ten minutes (AGENTSHIELD_TIMEOUT
# seconds otherwise; the tests use it), with everything it started. new-findings.md then
# still says that the run did not finish, and the copy it left is removed here, since a
# stopped run cannot do that itself.
command -v timeout > /dev/null || exec "$node" "$here/scan.mjs" "$@"
timeout --kill-after=10 "${AGENTSHIELD_TIMEOUT:-600}" "$node" "$here/scan.mjs" "$@"
code=$?
if [ "$code" -eq 124 ] || [ "$code" -eq 137 ]; then
  dir="${AGENTSHIELD_DIR:-${AGENTSHIELD_HOME:-$HOME}/.local/share/stack-atlas/agentshield}"
  rm -rf "$dir/work/copy" "$dir/work/home"
  echo "scan.sh: the run was stopped after its time limit; its copy of the configuration was removed" >&2
fi
exit "$code"
