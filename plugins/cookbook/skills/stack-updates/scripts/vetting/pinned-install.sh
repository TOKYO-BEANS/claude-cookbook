#!/usr/bin/env bash
# Installs a vetted version of a pinned npm copy from the lockfile pinned-vet.sh made.
# Usage: pinned-install.sh <install folder name> <new version>
# The old package.json and package-lock.json are kept in <install folder>/.previous, so
# "pinned-install.sh <folder> --back" puts the old version back. No install script runs.
set -uo pipefail
FOLDER="$1"; VER="$2"
SHARE="${VETTING_SHARE:-${HOME:-/c/Users/bruger}/.local/share}"
D="$SHARE/$FOLDER"
if [ "$VER" = "--back" ]; then
  [ -f "$D/.previous/package-lock.json" ] || { echo "nothing to put back"; exit 2; }
  cp "$D/.previous/package.json" "$D/.previous/package-lock.json" "$D/"
else
  V="$SHARE/vetting/$FOLDER-$VER"
  [ -f "$V/lock/package-lock.json" ] || { echo "no vetted lockfile in $V/lock"; exit 2; }
  mkdir -p "$D/.previous"
  cp "$D/package.json" "$D/package-lock.json" "$D/.previous/"
  cp "$V/lock/package.json" "$V/lock/package-lock.json" "$D/"
fi
cd "$D" || exit 1
npm ci --ignore-scripts --no-audit --no-fund > "$D/.previous/last-install.log" 2>&1; code=$?
echo "npm ci exit $code"; tail -2 "$D/.previous/last-install.log" | cut -c1-160
exit $code
