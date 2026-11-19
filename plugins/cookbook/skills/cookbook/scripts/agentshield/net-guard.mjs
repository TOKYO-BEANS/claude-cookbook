// Loaded with `node --import` before AgentShield starts (scan.mjs). Node's permission model
// already refuses the network and child processes for that run; this is the second lock,
// and the one that leaves a trace: an attempt it stops writes a `NETGUARD blocked` line,
// which the scan counts and reports. An attempt through a route not listed here is still
// refused by the permission model, without a line. The first line says whether the permission model is on:
// the scan stops when it is not.
import { syncBuiltinESMExports } from "node:module";
import childProcess from "node:child_process";
import dgram from "node:dgram";
import dns from "node:dns";
import http from "node:http";
import http2 from "node:http2";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const blocked = (what) => function guard() {
  process.stderr.write(`NETGUARD blocked ${what}\n`);
  const error = new Error(`the scan runs offline: ${what} is blocked`);
  error.code = "ERR_NETGUARD";
  throw error;
};
const lock = (object, label, names) => {
  for (const name of names) if (typeof object?.[name] === "function") object[name] = blocked(`${label}.${name}`);
};

lock(net, "net", ["connect", "createConnection", "createServer"]);
lock(net.Socket.prototype, "net.Socket", ["connect"]);
lock(net.Server.prototype, "net.Server", ["listen"]);
lock(tls, "tls", ["connect", "createServer"]);
lock(http, "http", ["request", "get", "createServer"]);
lock(https, "https", ["request", "get", "createServer"]);
lock(http2, "http2", ["connect", "createServer", "createSecureServer"]);
lock(dgram, "dgram", ["createSocket"]);
lock(dgram.Socket.prototype, "dgram.Socket", ["bind", "connect", "send"]);
const isLookup = (name) => /^(lookup|lookupService|resolve.*|reverse)$/.test(name);
lock(dns, "dns", Object.keys(dns).filter(isLookup));
lock(dns.promises, "dns.promises", Object.keys(dns.promises).filter(isLookup));
for (const [label, Resolver] of [["dns.Resolver", dns.Resolver], ["dns.promises.Resolver", dns.promises.Resolver]]) {
  if (Resolver?.prototype) lock(Resolver.prototype, label, Object.getOwnPropertyNames(Resolver.prototype).filter(isLookup));
}
lock(childProcess, "child_process", ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]);
for (const name of ["fetch", "WebSocket", "EventSource"]) {
  if (name in globalThis) globalThis[name] = blocked(name);
}
syncBuiltinESMExports();

const has = (scope) => { try { return process.permission ? process.permission.has(scope) : "off"; } catch { return "unknown"; } };
process.stderr.write(`NETGUARD ready net=${has("net")} child=${has("child")}\n`);
