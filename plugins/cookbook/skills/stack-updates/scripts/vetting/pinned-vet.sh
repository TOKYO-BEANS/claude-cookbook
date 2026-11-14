#!/usr/bin/env bash
# Vetting of a new version of a pinned npm copy (~/.local/share/<folder>), before it is
# installed. Usage: pinned-vet.sh <install folder name> <npm package> <new version>
# It resolves a lockfile in an empty folder from the install folder's own package.json
# (same overrides, the new version), unpacks it without running any script, and runs
# OSV-Scanner, Gitleaks and Trivy. Nothing is executed on this PC and the install is not
# touched. Last, pinned-sandbox.sh installs the package with its install scripts and starts
# it once in a boat sandbox, and prints what that did.
set -uo pipefail
FOLDER="$1"; PKG="$2"; VER="$3"
SHARE="${VETTING_SHARE:-${HOME:-/c/Users/bruger}/.local/share}"
V="$SHARE/vetting/$FOLDER-$VER"
[ -f "$SHARE/$FOLDER/package.json" ] || { echo "no package.json in $SHARE/$FOLDER"; exit 2; }
mkdir -p "$V/cfg/empty" "$V/lock" "$V/out" "$V/copy"
printf '[extend]\nuseDefault = true\n' > "$V/cfg/gitleaks.toml"
: > "$V/cfg/osv.toml"
node -e '
const fs=require("fs");const [src,dst,pkg,ver]=process.argv.slice(1);
const p=JSON.parse(fs.readFileSync(src,"utf8"));
const where=p.dependencies&&pkg in p.dependencies?"dependencies":p.devDependencies&&pkg in p.devDependencies?"devDependencies":null;
if(!where){console.log("the package is not in the install folder package.json");process.exit(2)}
console.log("was",pkg+"@"+p[where][pkg],"| overrides",JSON.stringify(p.overrides||{}));
p[where][pkg]=ver;fs.writeFileSync(dst,JSON.stringify(p,null,2)+"\n");' "$SHARE/$FOLDER/package.json" "$V/lock/package.json" "$PKG" "$VER" || exit 2
cd "$V/lock" || exit 1
npm install --package-lock-only --ignore-scripts --no-audit --no-fund > "$V/out/lock.log" 2>&1; echo "lockfile exit $?"
node -e '
const l=require("./package-lock.json");const p=Object.entries(l.packages).filter(([k])=>k);
const pkg=process.argv[1];const main=l.packages["node_modules/"+pkg];
console.log("resolved",pkg+"@"+(main&&main.version),"| packages",p.length,"| with install script:",p.filter(([,v])=>v.hasInstallScript).map(([k])=>k.replace(/^.*node_modules\//,"")).join(", ")||"none");
console.log("without integrity:",p.filter(([,v])=>!v.integrity&&!v.link).length);' "$PKG"
npm ci --ignore-scripts --no-audit --no-fund > "$V/out/ci.log" 2>&1; echo "unpack exit $?"
# Gitleaks skips node_modules paths: scan a copy outside one.
[ -d "$V/copy/packages" ] || cp -r node_modules "$V/copy/packages"
echo "files $(find "$V/copy/packages" -type f | wc -l), $(du -sm "$V/copy/packages" | cut -f1) MB"
osv-scanner scan source --no-ignore --config "$V/cfg/osv.toml" -L "$V/lock/package-lock.json" --format json > "$V/out/osv.json" 2> "$V/out/osv.log"; echo "osv exit $?"
env -u GITLEAKS_CONFIG -u GITLEAKS_CONFIG_TOML gitleaks dir "$V/copy/packages" --config "$V/cfg/gitleaks.toml" --gitleaks-ignore-path "$V/cfg/empty" --report-format json --report-path "$V/out/gitleaks.json" --no-banner --redact > "$V/out/gitleaks.log" 2>&1; echo "gitleaks exit $?"
trivy fs --scanners vuln,secret --format json --output "$V/out/trivy.json" "$V/lock" > "$V/out/trivy.log" 2>&1; echo "trivy exit $?"
node -e '
const fs=require("fs");const V=process.argv[1]+"/out/";const rd=f=>{try{return JSON.parse(fs.readFileSync(V+f,"utf8"))}catch(e){return null}};
const o=rd("osv.json");const sev={};const hi=[];let scanned=(fs.readFileSync(V+"osv.log","utf8").match(/found (\d+) packages?/)||[])[1];
for(const r of (o&&o.results)||[])for(const p of r.packages||[])for(const g of p.groups||[]){const s=g.max_severity?Number(g.max_severity):null;const b=s===null?"unknown":s>=9?"critical":s>=7?"high":s>=4?"medium":"low";sev[b]=(sev[b]||0)+1;if(b==="critical"||b==="high"||b==="unknown")hi.push(b+" "+p.package.name+"@"+p.package.version+" "+g.ids.slice(0,2).join(","))}
console.log("OSV: read",scanned,"packages;",JSON.stringify(sev));hi.slice(0,12).forEach(l=>console.log("  "+l));
const g=rd("gitleaks.json");const by={};for(const f of g||[]){const k=f.RuleID+" "+String(f.File).replace(/\\/g,"/").replace(/^.*copy\/packages\//,"");by[k]=(by[k]||0)+1}
console.log("GITLEAKS:",Array.isArray(g)?g.length:"no report","findings");Object.entries(by).slice(0,12).forEach(([k,n])=>console.log("  "+n+" "+k.slice(0,150)));
const t=rd("trivy.json");const ts={};let sec=0;const th=[];for(const r of (t&&t.Results)||[]){for(const v of r.Vulnerabilities||[]){ts[v.Severity]=(ts[v.Severity]||0)+1;if(v.Severity==="HIGH"||v.Severity==="CRITICAL")th.push(v.Severity+" "+v.PkgName+"@"+v.InstalledVersion+" "+v.VulnerabilityID)}sec+=(r.Secrets||[]).length}
console.log("TRIVY: targets",((t&&t.Results)||[]).length,JSON.stringify(ts),"secrets",sec);[...new Set(th)].slice(0,12).forEach(l=>console.log("  "+l));' "$V"
# The sandbox run: what the package does when it is installed with scripts on and started.
bash "$(cd "$(dirname "$0")" && pwd)/pinned-sandbox.sh" "$FOLDER" "$PKG" "$VER"; echo "sandbox exit $?"
