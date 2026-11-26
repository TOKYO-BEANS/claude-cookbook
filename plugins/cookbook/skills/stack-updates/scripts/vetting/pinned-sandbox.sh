#!/usr/bin/env bash
# The sandbox step of the vetting: pinned-vet.sh calls it after the three scanners.
# Usage: pinned-sandbox.sh <install folder name> <npm package> <new version>
# It sends only the vetted package.json and package-lock.json (public packages) and
# sandbox-probe.sh to a new Depot sandbox through the Cookbook's sandbox-run.mjs (--vet),
# where the package is installed WITH its install scripts and started once. The sandbox gets
# none of the org's secrets and is stopped when the command ends. The scanners read the
# code; this shows what it does when it runs. This PC installs with --ignore-scripts,
# so the run is a signal about the package, not a rehearsal of the install here.
# A run that did not start or did not finish is "no result", never a clean one.
# VETTING_SHARE names another share folder than ~/.local/share, and VETTING_RUNNER another
# runner than sandbox-run.mjs (the tests use both).
set -uo pipefail
FOLDER="$1"; PKG="$2"; VER="$3"
SHARE="${VETTING_SHARE:-$HOME/.local/share}"
V="$SHARE/vetting/$FOLDER-$VER"
TOOLS="$(cd "$(dirname "$0")" && pwd)"
if [ -n "${VETTING_RUNNER:-}" ]; then RUN=("$VETTING_RUNNER"); RUNNER="$VETTING_RUNNER"
else RUNNER="$TOOLS/../../../cookbook/scripts/sandbox-run.mjs"; RUN=(node "$RUNNER"); fi
[ -f "$V/lock/package-lock.json" ] || { echo "SANDBOX: no result (no lockfile in $V/lock)"; exit 2; }
[ -f "$RUNNER" ] || { echo "SANDBOX: no result (no sandbox runner at $RUNNER)"; exit 2; }
SB="$V/sandbox"
rm -rf "$SB"; mkdir -p "$SB" "$V/out"
cp "$V/lock/package.json" "$V/lock/package-lock.json" "$TOOLS/sandbox-probe.sh" "$SB/"
cd "$V" || exit 1
"${RUN[@]}" --type small --timeout 900 --vet sandbox \
  -- bash sandbox-probe.sh "$PKG" > "$V/out/sandbox.log" 2>&1
code=$?
# The probe bounds its own report (about 45 lines at most); past 80 the rest is named, so
# the last lines never drop out of sight unnoticed.
shown=$(tr -cd '\11\12\40-\176' < "$V/out/sandbox.log" | grep -E '^(SANDBOX[ :]|  )' | cut -c1-200)
echo "$shown" | head -80
lines=$(echo "$shown" | wc -l)
[ "$lines" -le 80 ] || echo "SANDBOX: $((lines - 80)) more report lines are in $V/out/sandbox.log"
tail -1 "$V/out/sandbox.log" | tr -cd '\11\12\40-\176' | cut -c1-160
# Only the runner's own last line counts: the lines above it hold text from outside code.
tail -1 "$V/out/sandbox.log" | grep -qE '^SANDBOX-RUN: [a-z0-9]+ stopped;' \
  || echo "SANDBOX: the sandbox may still be running: node sandbox-run.mjs --list, then --stop <id>"
# A run in which DNS was not watched cannot show which hosts were asked: not a quiet run.
if grep -q "^SANDBOX dns capture failed" "$V/out/sandbox.log"; then
  echo "SANDBOX: no result (DNS was not watched); see $V/out/sandbox.log"
  exit 1
fi
if [ "$code" -ne 0 ] || ! grep -q '^SANDBOX start output' "$V/out/sandbox.log"; then
  echo "SANDBOX: no result (exit $code); see $V/out/sandbox.log"
  exit 1
fi
