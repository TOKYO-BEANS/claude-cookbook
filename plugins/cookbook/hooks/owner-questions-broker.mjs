// The Jev broker of the owner-questions Stop hook. Reading a key from the DPAPI store takes
// 2 to 27 seconds on this PC (PowerShell start), too slow for every turn's end. So the hook
// starts this process once, through with-key.mjs; it holds the key in its own memory only and
// answers "classify this closing text" on a local named pipe. It never returns the key.
// It exits after IDLE_MS without a request, after MAX_LIFE_MS in all (so a rotated key is
// picked up), and after NO_KEY_LIFE_MS when it has no key (so a later turn tries again).
import { createConnection, createServer } from "node:net";
import { userInfo, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { askJev } from "./owner-questions-jev.mjs";

export const IDLE_MS = 3 * 60 * 60_000;
export const MAX_LIFE_MS = 20 * 60 * 60_000;
export const NO_KEY_LIFE_MS = 10 * 60_000;

export function defaultPipe() {
  const user = String(userInfo().username || "user").replace(/[^A-Za-z0-9_-]/g, "_");
  return process.platform === "win32" ? `\\\\.\\pipe\\cookbook-owner-questions-${user}` : join(tmpdir(), `cookbook-owner-questions-${user}.sock`);
}

export function startBroker({ pipe = defaultPipe(), ask, idleMs = IDLE_MS, maxLifeMs = MAX_LIFE_MS }) {
  return new Promise((resolve, reject) => {
    let idle;
    const server = createServer((socket) => {
      clearTimeout(idle);
      idle = setTimeout(() => server.close(), idleMs);
      let buf = "";
      socket.setEncoding("utf8");
      socket.on("error", () => {});
      socket.on("data", async (chunk) => {
        buf += chunk;
        const nl = buf.indexOf("\n");
        if (nl < 0) return;
        let answer;
        try {
          answer = await ask(String(JSON.parse(buf.slice(0, nl)).text ?? ""));
        } catch (e) {
          answer = { ok: false, error: `broker: ${e?.message ?? e}` };
        }
        socket.end(`${JSON.stringify(answer)}\n`);
      });
    });
    server.once("error", reject);
    server.listen(pipe, () => {
      idle = setTimeout(() => server.close(), idleMs);
      const life = setTimeout(() => server.close(), maxLifeMs);
      server.on("close", () => {
        clearTimeout(idle);
        clearTimeout(life);
      });
      resolve(server);
    });
  });
}

// One request. A missing broker, a timeout or a bad reply is { ok: false }, never "nothing open".
export function askBroker(text, { pipe = defaultPipe(), timeoutMs = 7000 } = {}) {
  return new Promise((resolve) => {
    let buf = "";
    let done = false;
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
    socket.on("connect", () => socket.write(`${JSON.stringify({ text })}\n`));
    socket.on("data", (c) => {
      buf += c;
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      try {
        finish(JSON.parse(buf.slice(0, nl)));
      } catch {
        finish({ ok: false, error: "broker sent a bad reply" });
      }
    });
    socket.on("error", (e) => finish({ ok: false, error: e?.code === "ENOENT" || e?.code === "ECONNREFUSED" ? "no broker" : `broker: ${e?.code ?? e?.message}` }));
    socket.on("end", () => finish({ ok: false, error: "broker closed without a reply" }));
  });
}

// Started by with-key.mjs as: node with-key.mjs jev-compaction TYPESAFE_API_KEY node owner-questions-broker.mjs
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const key = process.env.TYPESAFE_API_KEY || "";
  delete process.env.TYPESAFE_API_KEY;
  startBroker({
    ask: (text) => askJev(text, { key }),
    maxLifeMs: key ? MAX_LIFE_MS : NO_KEY_LIFE_MS,
  }).catch(() => process.exit(0)); // another broker already listens: this one is not needed
}
