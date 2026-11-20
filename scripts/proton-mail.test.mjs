// Tests of the Proton Mail script (skills/cookbook/scripts/proton-mail.py), run with the
// system's python3 in isolated mode. They cover the parts that guard the conversation and the
// mail: outside text cut to safe lines, header injection refused, config limits, the key
// never printed. The live check against Bridge is in recipes/proton-mail.md.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "plugins", "cookbook", "skills", "cookbook", "scripts", "proton-mail.py");
const python = spawnSync("python3", ["--version"]).status === 0;
const opts = { skip: !python && "needs python3" };

const PY = String.raw`
import importlib.util, json, os, sys, tempfile, types
spec = importlib.util.spec_from_file_location("pm", sys.argv[1])
pm = importlib.util.module_from_spec(spec); spec.loader.exec_module(pm)
out = {}
out["one_line"] = pm.one_line("a\r\nBcc: x@y.z\x1b[31m‮evil", 200)
out["cut"] = pm.one_line("x" * 300, 10)
out["body"] = pm.safe_body("hi\x1b]0;t\x07\n\n\n\nthere", 100)
out["body_cut"] = pm.safe_body("y" * 50, 10)
out["html"] = pm.html_to_text("<style>p{}</style><p>One &amp; two</p><script>alert(1)</script>three<br>four")
def fails(fn, *a):
    try:
        fn(*a); return None
    except pm.Fail as e:
        return str(e)
out["uid_bad"] = fails(pm.check_uid, "1:*")
out["uid_ok"] = pm.check_uid("42")
out["folder_bad"] = fails(pm.mailbox_name, 'INBOX" DELETE "x')
out["folder_ok"] = pm.mailbox_name("Folders/Work")
out["search_bad"] = fails(pm.search_words, ['a"b'])
out["search_ok"] = pm.search_words(["invoice", "2026"])
d = tempfile.mkdtemp()
def cfg(obj):
    p = os.path.join(d, "c.json")
    with open(p, "w") as f: f.write(json.dumps(obj) if not isinstance(obj, str) else obj)
    return p
out["cfg_missing"] = fails(pm.load_config, os.path.join(d, "none.json"))
out["cfg_nouser"] = fails(pm.load_config, cfg({}))
out["cfg_remote"] = fails(pm.load_config, cfg({"user": "a@b.c", "host": "mail.example.com"}))
out["cfg_list"] = fails(pm.load_config, cfg("[]"))
good = pm.load_config(cfg({"user": "a@b.c"}))
out["cfg_ports"] = [good["imap_port"], good["smtp_port"], good["host"]]
os.environ.pop("PROTON_BRIDGE_PASSWORD", None)
out["pw_missing"] = fails(pm.password)
def args(**kw):
    base = dict(sender=None, to=["owner@example.com"], subject="Hi", body="Text", body_file=None, dry_run=True)
    base.update(kw); return types.SimpleNamespace(**base)
out["inject_to"] = fails(pm.build_message, good, args(to=["a@b.c\r\nBcc: x@y.z"]))
out["inject_from"] = fails(pm.build_message, good, args(sender="a@b.c\nBcc: x@y.z"))
out["bad_addr"] = fails(pm.build_message, good, args(to=["not an address"]))
out["empty"] = fails(pm.build_message, good, args(body="  "))
m = pm.build_message(good, args(subject="Line\r\nBcc: x@y.z", sender="Claude <claude@nofix.dev>"))
out["subject"] = m["Subject"]; out["from"] = m["From"]; out["bcc"] = m["Bcc"]
out["msgid"] = m["Message-ID"]
out["two_to"] = fails(pm.build_message, good, args(to=["owner@example.com, other@example.org"]))
out["two_to_semi"] = fails(pm.build_message, good, args(to=["owner@example.com; other@example.org"]))
out["file_missing"] = fails(pm.build_message, good, args(body=None, body_file=os.path.join(d, "none.txt")))
with open(os.path.join(d, "latin1.txt"), "wb") as f: f.write(b"caf\xe9")
out["file_latin1"] = fails(pm.build_message, good, args(body=None, body_file=os.path.join(d, "latin1.txt")))
with open(os.path.join(d, "big.txt"), "w") as f: f.write("x" * (pm.BODY_FILE_MAX + 1))
out["file_big"] = fails(pm.build_message, good, args(body=None, body_file=os.path.join(d, "big.txt")))
with open(os.path.join(d, "ok.txt"), "w", encoding="utf-8") as f: f.write("Grüße")
out["file_ok"] = pm.build_message(good, args(body=None, body_file=os.path.join(d, "ok.txt"))).get_content().strip()
out["search_utf8"] = pm.search_words(["Rechnung", "März"])
out["folder_utf8"] = fails(pm.mailbox_name, "Folders/Bücher")
import email, email.policy
raw = b"From: a@b.c\r\nSubject: s\r\nContent-Type: text/plain; charset=x-no-such-charset\r\n\r\nhello\r\n"
out["bad_charset"] = pm.body_text(email.message_from_bytes(raw, policy=email.policy.default)).strip()
print(json.dumps(out))
`;

function run() {
  const dir = mkdtempSync(join(tmpdir(), "proton-mail-test-"));
  try {
    const file = join(dir, "t.py");
    writeFileSync(file, PY);
    const r = spawnSync("python3", ["-I", "-B", file, script], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("outside text becomes one safe line, cut to its length", opts, () => {
  const o = run();
  assert.equal(o.one_line, "a Bcc: x@y.z [31m evil");
  assert.equal(o.cut.length, 10);
  assert.ok(o.cut.endsWith("…"));
  assert.equal(o.body, "hi]0;t\n\nthere");
  assert.match(o.body_cut, /\[cut at 10 characters\]$/);
  assert.doesNotMatch(o.html, /alert|p\{\}/);
  assert.match(o.html, /One & two/);
});

test("UIDs, folders and search words that could alter the IMAP command are refused", opts, () => {
  const o = run();
  assert.match(o.uid_bad, /number/);
  assert.equal(o.uid_ok, "42");
  assert.match(o.folder_bad, /bad folder/);
  assert.equal(o.folder_ok, '"Folders/Work"');
  assert.match(o.search_bad, /no quotes/);
  assert.equal(o.search_ok, "invoice 2026");
});

test("config: a user is required, the host stays local, defaults are Bridge's", opts, () => {
  const o = run();
  assert.match(o.cfg_missing, /no config/);
  assert.match(o.cfg_nouser, /needs "user"/);
  assert.match(o.cfg_remote, /must be this machine/);
  assert.match(o.cfg_list, /JSON object/);
  assert.deepEqual(o.cfg_ports, [1143, 1025, "127.0.0.1"]);
  assert.match(o.pw_missing, /with-key\.mjs proton-bridge/);
});

test("send: header injection and bad addresses are refused", opts, () => {
  const o = run();
  assert.match(o.inject_to, /one address per value/);
  assert.match(o.inject_from, /one address per value/);
  assert.match(o.two_to, /one address per value/);
  assert.match(o.two_to_semi, /one address per value/);
  assert.match(o.bad_addr, /not an address/);
  assert.match(o.empty, /empty body/);
  assert.equal(o.subject, "Line Bcc: x@y.z");
  assert.equal(o.bcc, null);
  assert.equal(o.from, "Claude <claude@nofix.dev>");
  assert.match(o.msgid, /@nofix\.dev>$/);
});

test("a run without the key says how to start it and exits 2, printing no secret", opts, () => {
  const dir = mkdtempSync(join(tmpdir(), "proton-mail-test-"));
  try {
    const cfg = join(dir, "c.json");
    writeFileSync(cfg, JSON.stringify({ user: "a@b.c", cert: join(dir, "none.pem") }));
    const env = { PATH: process.env.PATH, PROTON_MAIL_CONFIG: cfg };
    const r = spawnSync("python3", ["-I", "-B", script, "send", "--to", "owner@example.com", "--subject", "s", "--body", "b"], { encoding: "utf8", env });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Bridge certificate not found|PROTON_BRIDGE_PASSWORD/);
    const d = spawnSync("python3", ["-I", "-B", script, "send", "--dry-run", "--to", "owner@example.com", "--subject", "s", "--body", "b"], { encoding: "utf8", env });
    assert.equal(d.status, 0, d.stderr);
    assert.match(d.stdout, /^dry run: from a@b\.c to owner@example\.com/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--body-file: a missing, non-UTF-8 or oversized file is a clean error", opts, () => {
  const o = run();
  assert.match(o.file_missing, /cannot read --body-file/);
  assert.match(o.file_latin1, /not UTF-8/);
  assert.match(o.file_big, /--body-file is over/);
  assert.equal(o.file_ok, "Grüße");
});

test("non-ASCII search words pass, non-ASCII folder names are refused, an unknown charset still reads", opts, () => {
  const o = run();
  assert.equal(o.search_utf8, "Rechnung März");
  assert.match(o.folder_utf8, /as `folders` prints it/);
  assert.equal(o.bad_charset, "hello");
});

test("--max below 1 is refused before any connection", opts, () => {
  const r = spawnSync("python3", ["-I", "-B", script, "read", "1", "--max", "-1"], { encoding: "utf8", env: { PATH: process.env.PATH } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--max is 1 to 100000/);
});
