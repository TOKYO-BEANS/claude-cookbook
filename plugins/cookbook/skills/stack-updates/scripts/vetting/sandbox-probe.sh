#!/usr/bin/env bash
# Runs INSIDE a Depot sandbox (Ubuntu), never on this PC. pinned-sandbox.sh pushes it there
# with a package.json and a package-lock.json. It installs with install scripts ON, starts
# the package's command once, and prints what the install and the start did: lifecycle
# scripts, DNS names asked for, connections, programs run, files written elsewhere and
# processes left behind. Everything it prints is data about outside code.
# The outside code runs as a user of its own without sudo, so it cannot alter the probe or
# what the probe records. It still shares the machine: the probe sees which programs start,
# which addresses are connected to and which names are asked for, not what is sent to them.
#
# Usage: bash sandbox-probe.sh <npm package>
#    or: bash sandbox-probe.sh --cmd "<install command>" ["<start command>"]
#    or: bash sandbox-probe.sh --report <folder>
#    or: bash sandbox-probe.sh --left <ps after> <pids before> <own pid>
#    or: bash sandbox-probe.sh --meta-line <key> <value>, --safe-name <name>
# The second form is for code that is not an npm package (a pnpm workspace, a Python tool):
# send the folder and this file with `sandbox-run.mjs --vet <folder>`, and both commands
# run in that folder under the same probe. The third form only prints the report from a
# folder of captured files, and the fourth only lists the left-over processes; the tests
# use both, and they need no sandbox.
set -uo pipefail

# One "key=value" line for $T/meta. The value is cut to one line of printable characters:
# some values come from outside code, and a line break in one would add a key of its own.
meta_line() { printf '%s=%s\n' "$1" "$(printf '%s' "$2" | tr -cd '\40-\176' | cut -c1-300)"; }
# A command name from a package.json, or nothing when it is not a plain name: the name ends
# up in a command line and in the report.
safe_name() { if [[ "$1" =~ ^[A-Za-z0-9._@+-]+$ ]]; then printf '%s' "$1"; fi; }

clean() { tr -cd '\11\12\40-\176' | cut -c1-160; }
# The names asked for, from tcpdump's lines. Every question type is shown, with its type
# unless it is an address lookup: a TXT or NULL question can carry data out.
names() { grep -oE ' [A-Za-z0-9]+\? [^ ]+' \
  | awk '{ t = $1; sub(/\?$/, "", t); n = $2; sub(/\.$/, "", n)
           print (t ~ /^(A|AAAA|HTTPS|SVCB|Type64|Type65)$/) ? n : n " (" t ")" }' | sort -u | own_names; }
# The capture sees the whole machine, so Ubuntu's own services show up in it now and then
# (time sync, the update and snap checks). Those few fixed names are marked, not hidden:
# they are the sandbox's, not the package's, and none of them is a name a package controls.
own_names() { sed -E 's/^((ntp|connectivity-check|motd|changelogs|esm|archive|security|api\.snapcraft)\.ubuntu\.com|api\.snapcraft\.io)$/\1 (the sandbox itself)/'; }
# Drops the lines whose first word is one of the system's own resolvers ($1, comma separated).
not_resolver() { awk -v res="$1" 'BEGIN { n = split(res, r, ","); for (i = 1; i <= n; i++) if (r[i] != "") sys[r[i]] = 1 }
  !($1 in sys)'; }
# The servers that were asked, other than loopback and the system's own resolvers ($1).
servers() { grep -E ' [A-Za-z0-9]+\? ' | sed -nE 's/.* > ([0-9a-fA-F:.]+)\.53: .*/\1/p' \
  | grep -vE '^(127\.|::1$)' | not_resolver "$1" | sort -u; }
# Remote addresses a process connected to ($1 a trace, $2 the system's resolvers). Loopback
# is local, port 0 is address sorting and sends nothing, and port 53 is left out only for
# the system's own resolvers: any other address on port 53 is remote traffic.
conns() { grep -E 'connect\(.*AF_INET' "$1" 2>/dev/null \
  | sed -nE 's/.*htons\(([0-9]+)\).*"([0-9a-fA-F:.]+)".*/\2 port \1/p' \
  | grep -vE '^(127\.|::1 )' | grep -v ' port 0$' \
  | awk -v res="$2" 'BEGIN { n = split(res, r, ","); for (i = 1; i <= n; i++) if (r[i] != "") sys[r[i]] = 1 }
      !($3 == "53" && ($1 in sys))' | sort -u; }
# The programs that were started. With several processes traced into one file, strace
# splits a call into "<unfinished ...>" and "<... execve resumed>" lines: they are joined by
# pid. A start whose result never came is counted, a start that failed is not.
execs() { awk '
    function prog(line) { match(line, /execve\("[^"]+"/); return substr(line, RSTART + 8, RLENGTH - 9) }
    /execve\("/ && /<unfinished \.\.\.>$/ { pending[$1] = prog($0); next }
    /<\.\.\. execve resumed>/ { if (($1 in pending) && $0 ~ / = 0$/) print pending[$1]; delete pending[$1]; next }
    /execve\("/ && / = 0$/ { print prog($0) }
    END { for (p in pending) print pending[p] }' "$1" 2>/dev/null \
  | sed 's#.*/##' | sort | uniq -c | sort -rn | head -12 \
  | awk '{printf "%s x%s, ", $2, $1}'; }

# Prints the command line of every process that was not there before and is not the probe
# itself. $1 holds "pid parent command line" lines, $2 the pids from before, $3 the probe's
# own pid. A process is the probe's when the probe is among its parents, and a kernel
# thread when its parent is pid 2. A name proves neither: a process chooses its own name.
left() {
  [ -r "$1" ] && [ -r "$2" ] || return 2
  awk -v self="$3" -v before_file="$2" '
    FILENAME == before_file { before[$1] = 1; next }
    { pid = $1; parent[pid] = $2; $1 = ""; $2 = ""; sub(/^ +/, ""); args[pid] = $0; order[++n] = pid }
    END {
      for (i = 1; i <= n; i++) {
        p = order[i]; if (p in before) continue
        own = 0; q = p
        for (hops = 0; hops < 64 && (q in parent); hops++) {
          if (q == self || q == 2 || parent[q] == 2) { own = 1; break }
          q = parent[q]
        }
        if (!own) print args[p]
      }
    }' "$2" "$1"
}

# Prints the SANDBOX lines from the files in $T. $T/meta holds one "key=value" per line.
# Every line is cut to 160 characters and stripped of control characters: the text comes
# from outside code.
report() { report_lines | clean; }
report_lines() {
  local pkg os node ci start label dns_install resolvers
  meta() { sed -n "s/^$1=//p" "$T/meta" | head -1; }
  pkg=$(meta pkg); os=$(meta os); node=$(meta node); ci=$(meta ci); start=$(meta start)
  label=$(meta label); dns_install=$(meta dns_install); resolvers=$(meta resolvers)
  echo "SANDBOX $pkg | $os | node $node | install exit $ci | start exit $start ($label)" | clean
  [ -s "$T/tcpdump.err" ] && grep -qiE 'permission|No such device|error' "$T/tcpdump.err" \
    && echo "SANDBOX dns capture failed: $(head -1 "$T/tcpdump.err" | clean)"

  echo "SANDBOX lifecycle scripts run:"
  grep -E '^> ' "$T/install.log" | sort -u | head -10 | clean | sed 's/^/  /'
  # 124 and 137 are the time limit ending the wait (137 when the tracer had to be killed).
  case "$ci" in 124 | 137) echo "SANDBOX the install did not end in time: something it started was still running" ;; esac
  [ "$ci" = "0" ] || { echo "SANDBOX install log, last lines:"; tail -5 "$T/install.log" | clean | sed 's/^/  /'; }

  echo "SANDBOX dns names during install: $(head -n "$dns_install" "$T/dns.txt" | names | tr '\n' ' ' | clean)"
  echo "SANDBOX dns names during start: $(tail -n +"$((dns_install + 1))" "$T/dns.txt" | names | tr '\n' ' ' | clean)"
  echo "SANDBOX dns servers asked other than the system's: $(servers "$resolvers" < "$T/dns.txt" | tr '\n' ' ' | clean)"

  local phase
  for phase in install start; do
    [ -f "$T/$phase.trace" ] || continue
    conns "$T/$phase.trace" "$resolvers" > "$T/$phase.conns"
    echo "SANDBOX $phase: $(wc -l < "$T/$phase.conns" | tr -d ' ') remote addresses; not on port 443: $(grep -v ' port 443$' "$T/$phase.conns" | head -8 | tr '\n' ';' | clean)"
    echo "SANDBOX $phase programs: $(execs "$T/$phase.trace" | clean)"
  done

  echo "SANDBOX files the outside code wrote outside the project, the npm cache and Node's compile cache: $(wc -l < "$T/files.txt" | tr -d ' ')"
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
if [ "${1:-}" = "--meta-line" ]; then
  meta_line "$2" "$3"
  exit 0
fi
if [ "${1:-}" = "--safe-name" ]; then
  safe_name "$2"
  exit 0
fi
if [ "${1:-}" = "--left" ]; then
  left "$2" "$3" "$4"
  exit $?
fi
# Everything below installs and runs outside code: only where a sandbox's tools are.
if ! command -v strace > /dev/null || ! command -v tcpdump > /dev/null || ! sudo -n true 2> /dev/null; then
  echo "sandbox-probe.sh installs and runs outside code. It needs strace, tcpdump and sudo, as a Depot sandbox has."
  exit 2
fi

INSTALL='npm ci --no-audit --no-fund --foreground-scripts'; START=""
if [ "$1" = "--cmd" ]; then PKG="(command)"; INSTALL="$2"; START="${3:-}"; else PKG="$1"; fi
HERE="$PWD"

# The outside code runs as its own user, "vet". That user has no sudo and cannot reach the
# probe or what it records: this folder and $T belong to the sandbox user and are closed to
# everyone else, the trace files are written by root, and the DNS capture runs as root. vet
# gets a copy of the folder and its own copy of Node, so nothing root or the sandbox user
# runs later comes from a place vet can write to.
T=/tmp/probe; mkdir -p "$T"; chmod 700 "$T" "$HERE"
WORK=/home/vet/work
NODE="$(command -v node)"
sudo -n useradd -m -s /bin/bash vet 2> /dev/null
if ! id vet > /dev/null 2>&1 || sudo -n -u vet sudo -n true 2> /dev/null; then
  echo "sandbox-probe.sh could not make a user without sudo for the outside code"
  exit 2
fi
if ! { sudo -n cp -r "$(dirname "$(dirname "$NODE")")" /opt/vet-node && sudo -n cp -r "$HERE" "$WORK" \
  && sudo -n rm -f "$WORK/sandbox-probe.sh" && sudo -n chown -R vet:vet /opt/vet-node "$WORK"; }; then
  echo "sandbox-probe.sh could not prepare the folder for the outside code"
  exit 2
fi
# Runs "$1" as vet in $WORK under strace, with a time limit of $2 seconds and the trace in $3.
as_vet() {
  sudo -n timeout -k 5 "$2" strace -f -qq -u vet -e trace=execve,connect -o "$3" \
    env -i HOME=/home/vet USER=vet LOGNAME=vet PATH="/opt/vet-node/bin:/usr/local/bin:/usr/bin:/bin" \
    bash -c "cd $WORK && $1"
}

ps -eo pid= | tr -d ' ' | sort > "$T/ps.before"
sudo -n tcpdump -i any -n -l port 53 > "$T/dns.txt" 2> "$T/tcpdump.err" &
sleep 2
touch "$T/marker"

# strace waits for every process the install started, so a daemon it leaves would hold the
# probe until the sandbox's own time limit and give no report. The limit here ends the wait
# (exit 124 or 137), and the daemon then shows under "processes left running".
as_vet "$INSTALL" "${PROBE_INSTALL_TIMEOUT:-600}" "$T/install.trace" > "$T/install.log" 2>&1
ci=$?
sleep 2
dns_install=$(wc -l < "$T/dns.txt")

# The package's command name is read as JSON by the sandbox user's own Node, never by a
# program vet could have replaced.
BIN=$(sudo -n "$NODE" -e '
const fs=require("fs");try{const p=JSON.parse(fs.readFileSync(process.argv[1]+"/node_modules/"+process.argv[2]+"/package.json","utf8"));const b=p.bin;
console.log(typeof b==="string"?p.name.replace(/^@[^/]+\//,""):b?Object.keys(b)[0]:"")}catch(e){}' "$WORK" "$PKG" 2>/dev/null)
BIN=$(safe_name "$BIN")
start="none"; label="no command"
if [ -n "$START" ]; then
  label="start command"
  as_vet "$START" 60 "$T/start.trace" < /dev/null > "$T/start.log" 2>&1
  start=$?
elif [ -n "$BIN" ] && sudo -n test -e "$WORK/node_modules/.bin/$BIN"; then
  label="$BIN --version"
  as_vet "$(printf 'node_modules/.bin/%q --version' "$BIN")" 30 "$T/start.trace" < /dev/null > "$T/start.log" 2>&1
  start=$?
fi
sleep 2
sudo -n pkill tcpdump; sleep 1

# Only files that belong to vet: other users' files are the machine's own services (a print
# or time daemon), and vet cannot write as anyone else.
sudo -n find / -xdev -newer "$T/marker" -type f -user vet \
  -not -path '/proc/*' -not -path '/sys/*' -not -path '/dev/*' -not -path '/run/*' \
  -not -path "$T/*" -not -path "$HERE/*" -not -path "$WORK/*" -not -path '/home/vet/.npm/*' \
  -not -path '/var/log/*' -not -path '/var/lib/systemd/*' -not -path '/var/cache/*' \
  -not -path '/tmp/node-compile-cache/*' -not -path '/home/user/.ascii/*' \
  2>/dev/null > "$T/files.txt"

ps -eo pid=,ppid=,args= > "$T/ps.after"
left "$T/ps.after" "$T/ps.before" "$$" > "$T/left.txt"

{
  meta_line pkg "$PKG"
  meta_line os "$(. /etc/os-release; echo "$PRETTY_NAME")"
  meta_line node "$(node -v 2>/dev/null)"
  meta_line ci "$ci"
  meta_line start "$start"
  meta_line label "$label"
  meta_line dns_install "$dns_install"
  # The system's own resolvers: the stub in /etc/resolv.conf and the servers systemd-resolved
  # forwards to, which is where a normal lookup is seen leaving the machine.
  meta_line resolvers "$({
    awk '/^nameserver/ { print $2 }' /etc/resolv.conf /run/systemd/resolve/resolv.conf 2>/dev/null
    resolvectl dns 2>/dev/null | sed 's/^[^:]*://' | tr ' ' '\n' | grep -E '^[0-9a-fA-F:.]*[.:][0-9a-fA-F:.]*$'
  } | sed 's/%.*//' | sort -u | paste -sd, -)"
} > "$T/meta"
report
exit 0
