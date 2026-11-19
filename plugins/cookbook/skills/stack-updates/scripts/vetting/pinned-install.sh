#!/usr/bin/env bash
# Installs a vetted version of a pinned npm copy from the lockfile pinned-vet.sh made.
# Usage: pinned-install.sh <install folder name> <new version>
#        pinned-install.sh <install folder name> --back
# <install folder>/.previous holds the package.json and package-lock.json of the last
# install that worked, so --back puts that version back. While an install has not finished
# (.previous/pending exists: npm failed, or the run was cut), a second run of any version
# leaves that backup alone. A first install (the folder holds neither file yet) has nothing
# to keep: it installs the vetted lockfile, and --back has nothing to put back until a
# later install. No install script runs.
set -uo pipefail
FOLDER="$1"; VER="$2"
SHARE="${VETTING_SHARE:-$HOME/.local/share}"
FIRST=""
D="$SHARE/$FOLDER"
if [ "$VER" = "--back" ]; then
  [ -f "$D/.previous/package-lock.json" ] || { echo "nothing to put back"; exit 2; }
  cp "$D/.previous/package.json" "$D/.previous/package-lock.json" "$D/" || { echo "the old files could not be put back"; exit 1; }
else
  V="$SHARE/vetting/$FOLDER-$VER"
  # Both files are checked before anything is touched: a copy that fails halfway would
  # leave the new lockfile beside the old package.json.
  if [ ! -f "$V/lock/package.json" ] || [ ! -f "$V/lock/package-lock.json" ]; then
    echo "no vetted package.json and package-lock.json in $V/lock: nothing was installed"
    exit 2
  fi
  mkdir -p "$D/.previous"
  if [ -e "$D/.previous/pending" ] && [ ! -e "$D/.previous/package-lock.json" ]; then
    # A first install that did not finish left no backup: this run is a first install again.
    FIRST=1
    echo "an earlier first install did not finish: there is no earlier version to keep"
  elif [ -e "$D/.previous/pending" ]; then
    echo "an earlier install did not finish: the backup of the last good version is kept"
  elif [ ! -e "$D/package.json" ] && [ ! -e "$D/package-lock.json" ]; then
    FIRST=1
    echo "a first install: there is no earlier version to keep"
  else
    cp "$D/package.json" "$D/package-lock.json" "$D/.previous/" || exit 1
  fi
  : > "$D/.previous/pending"
  if ! cp "$V/lock/package.json" "$V/lock/package-lock.json" "$D/"; then
    if [ -n "$FIRST" ]; then
      rm -f "$D/package.json" "$D/package-lock.json" "$D/.previous/pending"
      echo "the vetted files could not be copied in: nothing was installed"
      exit 1
    fi
    if ! cp "$D/.previous/package.json" "$D/.previous/package-lock.json" "$D/"; then
      echo "the vetted files could not be copied in, and the old files could not be put back: run pinned-install.sh $FOLDER --back"
      exit 1
    fi
    echo "the vetted files could not be copied in: the old files were put back and nothing was installed"
    exit 1
  fi
fi
cd "$D" || exit 1
npm ci --ignore-scripts --no-audit --no-fund > "$D/.previous/last-install.log" 2>&1; code=$?
[ "$code" -eq 0 ] && rm -f "$D/.previous/pending"
echo "npm ci exit $code"; tail -2 "$D/.previous/last-install.log" | cut -c1-160
exit $code
