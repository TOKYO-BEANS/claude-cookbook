// The Jev broker of the owner-questions Stop hook. Reading a key from the DPAPI store takes
// 2 to 27 seconds on this PC (PowerShell start), too slow for every turn's end. So the hook
// starts this process once, through with-key.mjs; it holds the key in its own memory only and
// answers "classify this closing text" on a local named pipe. It never returns the key.
// The pipe's name is random and kept in the owner's profile, so another account cannot take
// it first. The broker exits after IDLE_MS without a request, after MAX_LIFE_MS in all (so a
// rotated key is picked up) and after NO_KEY_LIFE_MS without a key. Each question version has
// its own pipe; a request of another version is answered "version" (a failure, not "nothing
// open").
import { createHash, randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_CHARS, MODEL, QUESTION_VERSION, askJev } from "./owner-questions-jev.mjs";

export const VERSION = `${MODEL}/q${QUESTION_VERSION}`;
export const IDLE_MS = 3 * 60 * 60_000;
export const MAX_LIFE_MS = 20 * 60 * 60_000;
export const NO_KEY_LIFE_MS = 10 * 60_000;
const SOCKET_MS = 15_000;
const MAX_REQUEST = 64 * 1024;

export function pipeName(stateDir, version = VERSION) {
  const file = join(stateDir, "pipe.json");
  let id = null;
  try {
    id = JSON.parse(readFileSync(file, "utf8")).id;
  } catch {
    id = null;
  }
  if (!/^[0-9a-f]{32}$/.test(String(id))) {
    id = randomBytes(16).toString("hex");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(file, JSON.stringify({ id }));
  }
  // Each question version has its own pipe, so sessions started before a plugin update and
  // after it each keep a broker of their own; the old one exits when it goes idle.
  const name = `cookbook-owner-questions-${id}-${createHash("sha256").update(version).digest("hex").slice(0, 8)}`;
  return process.platform === "win32" ? `\\\\.\\pipe\\${name}` : join(tmpdir(), `${name}.sock`);
}

export function startBroker({ pipe, ask, idleMs = IDLE_MS, maxLifeMs = MAX_LIFE_MS, version = VERSION }) {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    let idle;
    let life;
    const stop = () => {
      server.close();
      for (const s of sockets) s.destroy();
    };
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      clearTimeout(idle);
      idle = setTimeout(stop, idleMs);
      socket.setTimeout(SOCKET_MS, () => socket.destroy());
      let buf = "";
      let handled = false;
      socket.setEncoding("utf8");
      socket.on("error", () => {});
      socket.on("data", async (chunk) => {
        if (handled) return;
        buf += chunk;
        if (buf.length > MAX_REQUEST) return socket.destroy();
        const nl = buf.indexOf("\n");
        if (nl < 0) return;
        handled = true;
        let answer;
        let req = {};
        try {
          req = JSON.parse(buf.slice(0, nl));
        } catch {
          req = {};
        }
        if (req.v !== version) {
          socket.end(`${JSON.stringify({ ok: false, error: "version" })}\n`);
          return;
        }
        try {
          answer = await ask(String(req.text ?? ""));
        } catch {
          answer = { ok: false, error: "broker error" };
        }
        socket.end(`${JSON.stringify(answer)}\n`);
      });
    });
    server.on("close", () => {
      clearTimeout(idle);
      clearTimeout(life);
    });
    // Registered once: a failed listen keeps its callback, so a retry must not add a second.
    server.once("listening", () => {
      idle = setTimeout(stop, idleMs);
      life = setTimeout(stop, maxLifeMs);
      resolve(server);
    });
    const listen = (retry) => {
      server.once("error", async (e) => {
        if (retry && e?.code === "EADDRINUSE" && (await removeStaleSocket(pipe))) return listen(false);
        reject(e);
      });
      server.listen(pipe);
    };
    listen(process.platform !== "win32");
  });
}

// A Unix socket file outlives a broker that was killed (a named pipe on Windows does not), and
// then every new broker finds the path taken. The file is removed only when it is a socket of
// this account that nobody answers on; a live broker is never displaced.
async function removeStaleSocket(path) {
  try {
    const st = lstatSync(path);
    if (!st.isSocket() || st.uid !== process.getuid()) return false;
  } catch {
    return false;
  }
  const refused = await new Promise((resolve) => {
    const s = createConnection(path);
    s.once("connect", () => {
      s.destroy();
      resolve(false);
    });
    s.once("error", (e) => resolve(e?.code === "ECONNREFUSED"));
  });
  if (!refused) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

// One request. A missing broker, a timeout or a bad reply is { ok: false }, never "nothing open".
export function askBroker(text, { pipe, timeoutMs = 7000, version = VERSION } = {}) {
  return new Promise((resolve) => {
    let buf = "";
    let done = false;
    const t = String(text ?? "");
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(v);
    };
    const socket = createConnection(pipe);
    const timer = setTimeout(() => finish({ ok: false, error: `broker timed out after ${timeoutMs} ms` }), timeoutMs);
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${JSON.stringify({ v: version, text: t.length > MAX_CHARS ? t.slice(-MAX_CHARS) : t })}\n`));
    socket.on("data", (c) => {
      buf += c;
      if (buf.length > MAX_REQUEST) return finish({ ok: false, error: "broker sent a bad reply" });
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      try {
        finish(JSON.parse(buf.slice(0, nl)));
      } catch {
        finish({ ok: false, error: "broker sent a bad reply" });
      }
    });
    socket.on("error", (e) => finish({ ok: false, error: e?.code === "ENOENT" || e?.code === "ECONNREFUSED" ? "no broker" : "broker error" }));
    socket.on("end", () => finish({ ok: false, error: "broker closed without a reply" }));
  });
}

// Started by with-key.mjs as:
//   node with-key.mjs jev-compaction TYPESAFE_API_KEY node owner-questions-broker.mjs <pipe>
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2]) {
  const key = process.env.TYPESAFE_API_KEY || "";
  delete process.env.TYPESAFE_API_KEY;
  startBroker({
    pipe: process.argv[2],
    ask: (text) => askJev(text, { key }),
    maxLifeMs: key ? MAX_LIFE_MS : NO_KEY_LIFE_MS,
  }).catch(() => process.exit(0)); // the name is taken (another broker listens): not needed
}
