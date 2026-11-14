#!/usr/bin/env bash
# Installs a vetted version of a pinned npm copy from the lockfile pinned-vet.sh made.
# Usage: pinned-install.sh <install folder name> <new version>
#        pinned-install.sh <install folder name> --back
# <install folder>/.previous holds the package.json and package-lock.json of the last
# install that worked, so --back puts that version back. While an install has not finished
# (.previous/pending exists: npm failed, or the run was cut), a second run of any version
# leaves that backup alone. No install script runs.
set -uo pipefail
FOLDER="$1"; VER="$2"
SHARE="${VETTING_SHARE:-${HOME:-/c/Users/bruger}/.local/share}"
D="$SHARE/$FOLDER"
if [ "$VER" = "--back" ]; then
  [ -f "$D/.previous/package-lock.json" ] || { echo "nothing to put back"; exit 2; }
  cp "$D/.previous/package.json" "$D/.previous/package-lock.json" "$D/" || { echo "the old files could not be put back"; exit 1; }
else
  V="$SHARE/vetting/$FOLDER-$VER"
  [ -f "$V/lock/package-lock.json" ] || { echo "no vetted lockfile in $V/lock"; exit 2; }
  mkdir -p "$D/.previous"
  if [ -e "$D/.previous/pending" ]; then
    echo "an earlier install did not finish: the backup of the last good version is kept"
  else
    cp "$D/package.json" "$D/package-lock.json" "$D/.previous/" || exit 1
  fi
  : > "$D/.previous/pending"
  cp "$V/lock/package.json" "$V/lock/package-lock.json" "$D/" || { echo "the vetted files could not be copied in: nothing was installed"; exit 1; }
fi
cd "$D" || exit 1
npm ci --ignore-scripts --no-audit --no-fund > "$D/.previous/last-install.log" 2>&1; code=$?
[ "$code" -eq 0 ] && rm -f "$D/.previous/pending"
echo "npm ci exit $code"; tail -2 "$D/.previous/last-install.log" | cut -c1-160
exit $code
