#!/usr/bin/env bash
# Copies the scan's own files (not AgentShield) from this folder to the folder the
# scheduled task runs: ~/.local/share/stack-atlas/agentshield. Run it again after a merge
# that changes one of them. The pin, the baseline and the reports there are not touched.
# Usage: install.sh [target folder]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="${1:-$HOME/.local/share/stack-atlas/agentshield}"
mkdir -p "$target"
for file in scan.sh scan.mjs sanitize.mjs compare.mjs net-guard.mjs; do
  cp "$here/$file" "$target/$file"
done
chmod 755 "$target/scan.sh"
echo "installed 5 files in $target"
