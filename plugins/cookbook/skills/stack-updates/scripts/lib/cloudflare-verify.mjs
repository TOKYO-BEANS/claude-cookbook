// Cloudflare token check for the daily update check. It runs as the child of
// `with-key.mjs cloudflare-wrangler CLOUDFLARE_API_TOKEN`, which puts the token in
// this process's environment only. It prints "active" to stdout when Cloudflare says the
// token is active, otherwise the HTTP status or a short reason to stderr. It never
// prints the token or anything Cloudflare returns about the account.
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error("no token in the environment");
  process.exit(1);
}
try {
  const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  let status = "";
  try {
    status = (await res.json())?.result?.status ?? "";
  } catch { /* not JSON */ }
  if (res.ok && status === "active") console.log("active");
  else {
    console.error(`HTTP ${res.status}${status ? ` ${String(status).replace(/[^a-z_]/gi, "").slice(0, 20)}` : ""}`);
    process.exit(1);
  }
} catch {
  console.error("no answer");
  process.exit(1);
}
