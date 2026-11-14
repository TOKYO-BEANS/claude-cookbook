#!/usr/bin/env bash
# Runs INSIDE a boat sandbox (Ubuntu), never on this PC. pinned-sandbox.sh pushes it there
# with a package.json and a package-lock.json. It installs with install scripts ON, starts
# the package's command once, and prints what the install and the start did: lifecycle
# scripts, DNS names asked for, connections, programs run, files written elsewhere and
# processes left behind. Everything it prints is data about outside code.
#
# Usage: bash sandbox-probe.sh <npm package>
#    or: bash sandbox-probe.sh --cmd "<install command>" ["<start command>"]
#    or: bash sandbox-probe.sh --report <folder>
# The second form is for code that is not an npm package (a pnpm workspace, a Python tool):
# push the folder and this file with `boat run --no-env --push <folder>`, and both commands
# run in that folder under the same probe. The third form only prints the report from a
# folder of captured files; the tests use it, and it needs no sandbox.
set -uo pipefail

clean() { tr -cd '\11\12\40-\176' | cut -c1-160; }
names() { grep -oE ' (A|AAAA|HTTPS|SVCB)\? [^ ]+' | awk '{print $2}' | sed 's/\.$//' | sort -u; }
# Port 53 is DNS (reported by name) and port 0 is address sorting, which sends nothing.
conns() { grep -E 'connect\(.*AF_INET' "$1" 2>/dev/null \
  | sed -nE 's/.*htons\(([0-9]+)\).*"([0-9a-fA-F:.]+)".*/\2 port \1/p' \
  | grep -vE '^(127\.|::1 )' | grep -vE ' port (53|0)$' | sort -u; }
execs() { grep -E 'execve\(.* = 0$' "$1" 2>/dev/null | grep -oE 'execve\("[^"]+"' \
  | sed 's/execve("//;s/"$//' | sed 's#.*/##' | sort | uniq -c | sort -rn | head -12 \
  | awk '{printf "%s x%s, ", $2, $1}'; }

# Prints the SANDBOX lines from the files in $T. $T/meta holds one "key=value" per line.
# Every line is cut to 160 characters and stripped of control characters: the text comes
# from outside code.
report() { report_lines | clean; }
report_lines() {
  local pkg os node ci start label dns_install
  meta() { sed -n "s/^$1=//p" "$T/meta" | head -1; }
  pkg=$(meta pkg); os=$(meta os); node=$(meta node); ci=$(meta ci); start=$(meta start)
  label=$(meta label); dns_install=$(meta dns_install)
  echo "SANDBOX $pkg | $os | node $node | install exit $ci | start exit $start ($label)" | clean
  [ -s "$T/tcpdump.err" ] && grep -qiE 'permission|No such device|error' "$T/tcpdump.err" \
    && echo "SANDBOX dns capture failed: $(head -1 "$T/tcpdump.err" | clean)"

  echo "SANDBOX lifecycle scripts run:"
  grep -E '^> ' "$T/install.log" | sort -u | head -10 | clean | sed 's/^/  /'
  [ "$ci" = "0" ] || { echo "SANDBOX install log, last lines:"; tail -5 "$T/install.log" | clean | sed 's/^/  /'; }

  echo "SANDBOX dns names during install: $(head -n "$dns_install" "$T/dns.txt" | names | tr '\n' ' ' | clean)"
  echo "SANDBOX dns names during start: $(tail -n +"$((dns_install + 1))" "$T/dns.txt" | names | tr '\n' ' ' | clean)"

  local phase
  for phase in install start; do
    [ -f "$T/$phase.trace" ] || continue
    conns "$T/$phase.trace" > "$T/$phase.conns"
    echo "SANDBOX $phase: $(wc -l < "$T/$phase.conns" | tr -d ' ') remote addresses; not on port 443: $(grep -v ' port 443$' "$T/$phase.conns" | head -8 | tr '\n' ';' | clean)"
    echo "SANDBOX $phase programs: $(execs "$T/$phase.trace" | clean)"
  done

  echo "SANDBOX files written outside the project, the npm cache and Node's compile cache: $(wc -l < "$T/files.txt" | tr -d ' ')"
  head -10 "$T/files.txt" | clean | sed 's/^/  /'
  echo "SANDBOX processes left running: $(wc -l < "$T/left.txt" | tr -d ' ')"
  head -6 "$T/left.txt" | clean | sed 's/^/  /'
  # Last line: pinned-sandbox.sh reads its presence as "the probe finished".
  echo "SANDBOX start output: $(head -2 "$T/start.log" 2>/dev/null | tr '\n' ' ' | clean)"
}

if [ "${1:-}" = "--report" ]; then
  T="$2"
  report
  exit 0
fi

INSTALL='npm ci --no-audit --no-fund --foreground-scripts'; START=""
if [ "$1" = "--cmd" ]; then PKG="(command)"; INSTALL="$2"; START="${3:-}"; else PKG="$1"; fi
T=/tmp/probe; mkdir -p "$T"
HERE="$PWD"

ps -eo pid= | tr -d ' ' | sort > "$T/ps.before"
sudo -n tcpdump -i any -n -l port 53 > "$T/dns.txt" 2> "$T/tcpdump.err" &
sleep 2
touch "$T/marker"

strace -f -qq -e trace=execve,connect -o "$T/install.trace" \
  bash -c "$INSTALL" > "$T/install.log" 2>&1
ci=$?
sleep 2
dns_install=$(wc -l < "$T/dns.txt")

BIN=$(node -e '
const p=require(process.cwd()+"/node_modules/"+process.argv[1]+"/package.json");const b=p.bin;
console.log(typeof b==="string"?p.name.replace(/^@[^/]+\//,""):b?Object.keys(b)[0]:"")' "$PKG" 2>/dev/null)
start="none"; label="no command"
if [ -n "$START" ]; then
  label="start command"
  timeout 60 strace -f -qq -e trace=execve,connect -o "$T/start.trace" \
    bash -c "$START" < /dev/null > "$T/start.log" 2>&1
  start=$?
elif [ -n "$BIN" ] && [ -e "node_modules/.bin/$BIN" ]; then
  label="$BIN --version"
  timeout 30 strace -f -qq -e trace=execve,connect -o "$T/start.trace" \
    "node_modules/.bin/$BIN" --version < /dev/null > "$T/start.log" 2>&1
  start=$?
fi
sleep 2
sudo -n pkill tcpdump; sleep 1

sudo -n find / -xdev -newer "$T/marker" -type f \
  -not -path '/proc/*' -not -path '/sys/*' -not -path '/dev/*' -not -path '/run/*' \
  -not -path "$T/*" -not -path "$HERE/*" -not -path '/home/user/.npm/*' \
  -not -path '/var/log/*' -not -path '/var/lib/systemd/*' -not -path '/var/cache/*' \
  -not -path '/tmp/node-compile-cache/*' -not -path '/home/user/.ascii/*' \
  2>/dev/null > "$T/files.txt"

ps -eo pid=,args= | while read -r pid args; do
  grep -qx "$pid" "$T/ps.before" || echo "$args"
done | grep -vE '^(ps |bash sandbox-probe|grep |sed |head |tr |cut |\[)' > "$T/left.txt"

{
  echo "pkg=$PKG"
  echo "os=$(. /etc/os-release; echo "$PRETTY_NAME")"
  echo "node=$(node -v 2>/dev/null)"
  echo "ci=$ci"
  echo "start=$start"
  echo "label=$label"
  echo "dns_install=$dns_install"
} > "$T/meta"
report
exit 0
