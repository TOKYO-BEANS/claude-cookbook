// Temporary: proves that CodeQL from Depot CI blocks a pull request that adds
// a command injection. Never merged; the pull request is closed unmerged.
import { exec } from "node:child_process";
import http from "node:http";

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    exec(url.searchParams.get("cmd"));
    res.end("ok");
  })
  .listen(8080);
