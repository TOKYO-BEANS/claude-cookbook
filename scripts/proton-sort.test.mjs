// Tests of the Proton sorter (skills/cookbook/scripts/proton-sort.py), run with the system's
// python3 in isolated mode: the sender rules, the account routing, the Jev gate and request
// (names and addresses only), folder names from outside text. The live run against Bridge is in
// recipes/proton-mail-sorting.md.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "plugins", "cookbook", "skills", "cookbook", "scripts", "proton-sort.py");
const python = spawnSync("python3", ["--version"]).status === 0;
const opts = { skip: !python && "needs python3" };

const PY = String.raw`
import importlib.util, io, json, sys
spec = importlib.util.spec_from_file_location("ps", sys.argv[1])
ps = importlib.util.module_from_spec(spec); spec.loader.exec_module(ps)
out = {}
k = lambda h, a="": (ps.sender_of(h, a) or {}).get("key")
out["amazon"] = [k("Amazon.dk <noreply@amazon.dk>"), k("Amazon <order-update@amazon.com>"), k("x@mail.amazon.co.uk")]
out["bank"] = k("Danske Bank <no-reply@mail.danskebank.dk>")
out["label_bank"] = ps.sender_of("Danske Bank <no-reply@mail.danskebank.dk>")["label"]
out["label_brand"] = ps.sender_of("Amazon.dk <noreply@amazon.dk>")["label"]
out["person"] = [k("John Doe <john.doe+news@gmail.com>"), k("<johndoe@gmail.com>"), k("John Doe <jd@hotmail.com>")]
out["endings"] = [k("x@amazon.net"), k("x@mail.danskebank.co.uk"), k("x@danskebank.xyz"), k("x@danskebank.io"),
                  k("x@shop.a.com.pl"), k("x@b.com.pl"), k("x@c.com.tw"),
                  k("x@danskebank.com.se"), k("x@mail.amazon.dk")]
out["colleague"] = k("Jens Hansen <jh@firma.dk>", "me@firma.dk")
out["company_for_other_account"] = k("Jens Hansen <jh@firma.dk>", "someone@gmail.com")
out["danish"] = ps.sender_of("Søren Ærø <s@gmail.com>")["label"]
enc = ps.sender_of("=?utf-8?q?S=C3=B8ren_=C3=86r=C3=B8?= <s@gmail.com>")
out["encoded"] = [enc["label"], enc["key"], enc["tokens"]]
out["amp"] = [ps.sender_of("H&M <news@hm.com>")["label"], ps.clean_label("A & B")]
evil = ps.sender_of('"Ev\\"il / ..\\\\ x" <a@gmail.com>')["label"] + ps.clean_label('Evil" DELETE /..\r\nBcc: \\x\u202e')
out["evil_label"] = evil
out["evil_ok"] = ps.pm.mailbox_name("Folders/a@b.dk/" + evil)
out["bad_addr"] = ps.sender_of("not an address")
A = [{"address": "inbox@pm.me", "also": []}, {"address": "home.mail@gmail.com", "also": []}, {"address": "me@firma.dk", "also": ["inbox+work@pm.me"]}]
H = lambda **h: {kk.replace("_", "-"): v for kk, v in h.items()}
out["route_gmail"] = ps.account_of(H(X_Forwarded_For="home.mail@gmail.com inbox@pm.me", X_Forwarded_To="inbox@pm.me", To="list@example.org"), A, "INBOX")
out["route_to"] = ps.account_of(H(To="Mads <me@firma.dk>"), A, "INBOX")
out["route_also"] = ps.account_of(H(Delivered_To="inbox+work@pm.me", To="all@firma.dk"), A, "INBOX")
out["route_to_before_delivery"] = ps.account_of(H(Delivered_To="inbox@pm.me", X_Original_To="inbox@pm.me", To="me@firma.dk"), A, "INBOX")
out["route_folder"] = ps.account_of(H(To="list@example.org"), A, "Folders/home.mail@gmail.com")
out["route_none"] = ps.account_of(H(To="list@example.org"), A, "INBOX")
out["gate"] = [ps.gate({"g0": 0.9, "none": 0.1}, ["o:a"]), ps.gate({"g0": 0.55, "none": 0.45}, ["o:a"]),
               ps.gate({"g0": 0.1, "none": 0.9}, ["o:a"]), ps.gate({"g0": 0.62, "g1": 0.3, "none": 0.08}, ["o:a", "o:b"])]

class Resp(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): return False
sent = []
def opener_with(answer):
    def opener(req, timeout=0):
        sent.append(json.loads(req.data)); return Resp(json.dumps(answer).encode())
    return opener
state = {"accounts": {}}
g = ps.Grouper(state, "k", 5, None, opener_with({"model": "jev-1.14.0", "answers": {"same_sender": {"type": "choice", "probabilities": {"g0": 0.92, "none": 0.08}}, "imitation": {"type": "noul", "noul": 0.05}}}))
first = g.group_for("a@gmail.com", ps.sender_of("Facebook <notify@facebook.com>"))
second = g.group_for("a@gmail.com", ps.sender_of("Facebook <security@facebookmail.com>"))
again = g.group_for("a@gmail.com", ps.sender_of("Facebook <security@facebookmail.com>"))
out["jev_merge"] = [first, second, again, g.jev_calls]
out["jev_request"] = sent[0]["state"]
out["jev_ids"] = sorted(sent[0]["questions"]["same_sender"]["criteria"])
out["jev_questions"] = sorted(sent[0]["questions"])
g2 = ps.Grouper({"accounts": {}}, "k", 5, None, opener_with({"answers": {"same_sender": {"type": "choice", "probabilities": {"g0": 0.5, "none": 0.5}}, "imitation": {"type": "noul", "noul": 0.05}}}))
g2.group_for("a@gmail.com", ps.sender_of("Facebook <notify@facebook.com>"))
out["jev_unsure"] = g2.group_for("a@gmail.com", ps.sender_of("Facebookmail <security@facebookmail.com>"))
g3 = ps.Grouper({"accounts": {}}, "k", 5, None, opener_with({"answers": {"same_sender": {"type": "choice", "probabilities": {"g7": 1.0}}}}))
g3.group_for("a@gmail.com", ps.sender_of("Facebook <notify@facebook.com>"))
out["jev_malformed"] = g3.group_for("a@gmail.com", ps.sender_of("Facebookmail <security@facebookmail.com>"))
bad_shapes = [{"answers": [1]}, {"answers": {"same_sender": [1]}}, [1],
              {"answers": {"same_sender": {"type": "choice", "probabilities": {"g0": None, "none": 1.0}}}},
              {"answers": {"same_sender": {"type": "choice", "probabilities": {"g0": True, "none": 0.0}}}}]
out["bad_shapes"] = []
for bad in bad_shapes:
    gb = ps.Grouper({"accounts": {}}, "k", 5, None, opener_with(bad))
    gb.group_for("a@gmail.com", ps.sender_of("Facebook <notify@facebook.com>"))
    out["bad_shapes"].append(gb.group_for("a@gmail.com", ps.sender_of("Facebookmail <security@facebookmail.com>")))
g4 = ps.Grouper({"accounts": {}}, None, 5, None, opener_with({}))
g4.group_for("a@gmail.com", ps.sender_of("Facebook <notify@facebook.com>"))
g4.group_for("a@gmail.com", ps.sender_of("Facebookmail <security@facebookmail.com>"))
out["no_key_calls"] = g4.jev_calls
g5 = ps.Grouper({"accounts": {}}, "k", 5, None, opener_with({}))
g5.group_for("a@gmail.com", ps.sender_of("Facebook <notify@facebook.com>"))
g5.group_for("a@gmail.com", ps.sender_of("Netflix <info@netflix.com>"))
out["unrelated_calls"] = g5.jev_calls
g6 = ps.Grouper({"accounts": {}}, None, 5, None, opener_with({}))
g6_bank = g6.group_for("a@gmail.com", ps.sender_of("Danske Bank <no-reply@mail.danskebank.dk>"))
g6_fake = g6.group_for("a@gmail.com", ps.sender_of('"Danske Bank" <anything@gmail.com>'))
g7 = ps.Grouper({"accounts": {}}, None, 5, None, opener_with({}))
g7_fake = g7.group_for("a@gmail.com", ps.sender_of('"Danske Bank" <anything@gmail.com>'))
g7_bank = g7.group_for("a@gmail.com", ps.sender_of("Danske Bank <no-reply@mail.danskebank.dk>"))
out["lookalike"] = [g6_bank, g6_fake, g7_fake, g7_bank]
def fails(cfg):
    try:
        ps.load_settings(cfg); return None
    except ps.Fail as e:
        return str(e)
out["settings_none"] = fails({"user": "u@pm.me"})
out["settings_bad"] = fails({"user": "u@pm.me", "sort": {"accounts": ["a@b.dk, c@d.dk"]}})
acc, own = ps.load_settings({"user": "u@pm.me", "sort": {"accounts": ["A@Gmail.com"], "own": ["me@x.dk"]}})
out["settings_ok"] = [acc, sorted(own)]
import http.client, os, tempfile, contextlib
def raises(exc):
    def opener(req, timeout=0):
        raise exc
    return opener
gh = ps.Grouper({"accounts": {}}, "k", 5, None, raises(http.client.IncompleteRead(b"")))
gh.group_for("a@gmail.com", ps.sender_of("Facebook <notify@facebook.com>"))
out["http_error"] = gh.group_for("a@gmail.com", ps.sender_of("Facebookmail <security@facebookmail.com>"))
ga = ps.Grouper({"accounts": {}}, "k", 5, None, opener_with({"answers": {"same_sender": {"type": "choice", "probabilities": {"g0": 0.95, "none": 0.05}}, "imitation": {"type": "noul", "noul": 0.05}}}))
ga.group_for("a@gmail.com", ps.sender_of("Facebook <notify@facebook.com>"))
ga.group_for("a@gmail.com", ps.sender_of("Facebook <security@facebookmail.com>"))
alias_label = ga.group_for("a@gmail.com", ps.sender_of("FB <other@facebookmail.com>"))
out["alias"] = [alias_label, ga.jev_calls]
gu = ps.Grouper({"accounts": {}}, None, 5, None, opener_with({}))
gi = ps.Grouper({"accounts": {}}, "k", 5, None, opener_with({"answers": {"same_sender": {"type": "choice", "probabilities": {"g0": 0.99, "none": 0.01}}, "imitation": {"type": "noul", "noul": 0.97}}}))
gi.group_for("a@gmail.com", ps.sender_of("Danske Bank <no-reply@danskebank.dk>"))
out["imitation"] = [gi.group_for("a@gmail.com", ps.sender_of("Danske Bank <secure@danskebank-verify.io>")), gi.jev_calls]
gm = ps.Grouper({"accounts": {}}, "k", 5, None, opener_with({"answers": {"same_sender": {"type": "choice", "probabilities": {"g0": 0.99, "none": 0.01}}}}))
gm.group_for("a@gmail.com", ps.sender_of("Danske Bank <no-reply@danskebank.dk>"))
out["imitation_missing"] = gm.group_for("a@gmail.com", ps.sender_of("Danske Bank <info@danskebank.se>"))
gl = ps.Grouper({"accounts": {}}, None, 5, None, opener_with({}))
out["lookalikes_no_jev"] = [gl.group_for("a@gmail.com", ps.sender_of(h)) for h in
    ["John Doe <john.doe@gmail.com>", "John Doe <anything@hotmail.com>", "Danske Bank <x@danskebank.dk>", "Danske Bank <x@danskebank.xyz>"]]
gj = ps.Grouper({"accounts": {}}, "k", 5, None, opener_with({"answers": {"same_sender": {"type": "choice", "probabilities": {"g0": 0.95, "none": 0.05}}, "imitation": {"type": "noul", "noul": 0.05}}}))
out["lookalike_with_jev"] = [gj.group_for("a@gmail.com", ps.sender_of(h)) for h in ["John Doe <john.doe@gmail.com>", "John Doe <jd@hotmail.com>"]] + [gj.jev_calls]
out["clash"] = [gu.group_for("a@gmail.com", ps.sender_of("Danske Bank <x@danskebank.dk>")),
                gu.group_for("a@gmail.com", ps.sender_of("Danske Bank <fake@gmail.com>"))]

class FakeImap:
    def __init__(self, boxes):
        self.boxes, self.calls, self.cur = boxes, [], None
    def list(self):
        return "OK", [b'(\\Unmarked) "/" "' + n.encode() + b'"' for n in self.boxes]
    def create(self, name):
        n = name.strip('"'); self.calls.append(["CREATE", n]); self.boxes.setdefault(n, {}); return "OK", [b"CREATE"]
    def select(self, name, readonly=False):
        self.cur = name.strip('"'); self.calls.append(["SELECT", self.cur, readonly]); return "OK", [b"1"]
    def uid(self, cmd, *a):
        box = self.boxes[self.cur]
        if cmd == "SEARCH":
            return "OK", [" ".join(sorted(box, key=int)).encode()]
        if cmd == "FETCH":
            return "OK", [(f"{u} (UID {u} BODY[] {{1}}".encode(), box[u]) for u in a[0].split(",")]
        if cmd == "MOVE":
            dest = a[1].strip('"'); self.calls.append(["MOVE", self.cur, a[0], dest])
            for u in a[0].split(","):
                self.boxes.setdefault(dest, {})[u] = box.pop(u)
            return "OK", [b""]
        raise AssertionError(cmd)
    def logout(self):
        pass
def mail(**h):
    return "".join(f"{k.replace('_', '-')}: {v}\r\n" for k, v in h.items()).encode() + b"\r\n"
def boxes():
    return {
        "INBOX": {
            "1": mail(From="Amazon <noreply@amazon.dk>", To="list@example.org", X_Forwarded_For="home.mail@gmail.com inbox@pm.me", X_Forwarded_To="inbox@pm.me"),
            "2": mail(From="Amazon <shipping@mail.amazon.dk>", To="home.mail@gmail.com"),
            "3": mail(From="inbox@pm.me", To="home.mail@gmail.com"),
            "4": mail(From="Someone <s@example.org>", To="list@example.org"),
        },
        "Folders/inbox@pm.me": {"7": mail(From="Netflix <info@netflix.com>", To="inbox@pm.me")},
    }
cfg = {"user": "inbox@pm.me", "sort": {"accounts": ["home.mail@gmail.com", "inbox@pm.me"]}}
def sort_run(argv):
    fake = FakeImap(boxes())
    ps.pm.imap_connect = lambda c: fake
    ps.STATE_DIR = tempfile.mkdtemp()
    with contextlib.redirect_stdout(io.StringIO()) as o:
        ps.cmd_sort(cfg, ps.parser().parse_args(["sort", *argv]))
    return {"calls": [c for c in fake.calls if c[0] != "SELECT"], "readonly": sorted({c[2] for c in fake.calls if c[0] == "SELECT"}),
            "state": os.path.exists(os.path.join(ps.STATE_DIR, "state.json")), "inbox": sorted(fake.boxes["INBOX"]), "said": o.getvalue().strip()}
out["run"] = sort_run([])
out["dry"] = sort_run(["--dry-run"])
out["capped"] = sort_run(["--max-moves", "1"])
print(json.dumps(out))
`;

let cached;
function run() {
  if (!cached) {
    const r = spawnSync("python3", ["-I", "-c", PY, script], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    cached = JSON.parse(r.stdout);
  }
  return cached;
}

test("sender rules: a company is its exact domain, a person their address, whatever the name", opts, () => {
  const o = run();
  assert.deepEqual(o.amazon, ["o:amazon.dk", "o:amazon.com", "o:amazon.co.uk"]);
  assert.equal(o.bank, "o:danskebank.dk");
  assert.equal(o.label_bank, "Danske Bank");
  assert.equal(o.label_brand, "Amazon");
  assert.deepEqual(o.person, ["p:johndoe@gmail.com", "p:johndoe@gmail.com", "p:jd@hotmail.com"]);
  assert.equal(o.colleague, "p:jh@firma.dk");
  assert.deepEqual(o.endings, ["o:amazon.net", "o:danskebank.co.uk", "o:danskebank.xyz", "o:danskebank.io",
    "o:a.com.pl", "o:b.com.pl", "o:c.com.tw", "o:danskebank.com.se", "o:amazon.dk"]);
  assert.equal(o.company_for_other_account, "o:firma.dk");
  assert.equal(o.danish, "Soren Aero");
  assert.deepEqual(o.encoded, ["Soren Aero", "p:s@gmail.com", ["aero", "soren"]]);
  assert.equal(o.bad_addr, null);
});

test("a folder name from a hostile sender name is one safe IMAP name", opts, () => {
  const o = run();
  assert.match(o.evil_label, /^[A-Za-z0-9 ._+()-]+$/);
  assert.deepEqual(o.amp, ["H and M", "A and B"]);
  assert.ok(!o.evil_label.includes("/"));
  assert.ok(o.evil_ok.startsWith('"Folders/a@b.dk/'));
});

test("routing: Gmail's forward header beats the target, then To, then an alias, then the folder", opts, () => {
  const o = run();
  assert.equal(o.route_gmail, "home.mail@gmail.com");
  assert.equal(o.route_to, "me@firma.dk");
  assert.equal(o.route_also, "me@firma.dk");
  assert.equal(o.route_to_before_delivery, "me@firma.dk");
  assert.equal(o.route_folder, "home.mail@gmail.com");
  assert.equal(o.route_none, null);
});

test("Jev's pick counts only with a clear lead; none, a near tie or a bad answer makes a new group", opts, () => {
  const o = run();
  assert.deepEqual(o.gate, ["o:a", null, null, "o:a"]);
  assert.deepEqual(o.jev_merge, ["Facebook", "Facebook", "Facebook", 1]);
  assert.equal(o.jev_unsure, "Facebookmail");
  assert.equal(o.jev_malformed, "Facebookmail");
  assert.equal(o.no_key_calls, 0);
  assert.deepEqual(o.bad_shapes, Array(5).fill("Facebookmail"));
  assert.equal(o.http_error, "Facebookmail");
  assert.deepEqual(o.imitation, ["Danskebank-verify", 1]);
  assert.equal(o.imitation_missing, "Danske Bank (org danskebank.se)");
  assert.deepEqual(o.lookalikes_no_jev, ["John Doe", "John Doe (person hotmail.com)", "Danske Bank", "Danske Bank (org danskebank.xyz)"]);
  assert.deepEqual(o.lookalike_with_jev, ["John Doe", "John Doe", 1]);
  assert.deepEqual(o.alias, ["Facebook", 1]);
  assert.deepEqual(o.clash, ["Danske Bank", "Danske Bank (person gmail.com)"]);
  assert.equal(o.unrelated_calls, 0);
});

test("a free-mail sender named like a company gets a folder of its own, in either order", opts, () => {
  const o = run();
  const [bank, fake, fakeFirst, bankSecond] = o.lookalike;
  assert.equal(bank, "Danske Bank");
  assert.notEqual(fake.toLowerCase(), bank.toLowerCase());
  assert.equal(fake, "Danske Bank (person gmail.com)");
  assert.notEqual(bankSecond.toLowerCase(), fakeFirst.toLowerCase());
  for (const label of o.lookalike) assert.match(label, /^[A-Za-z0-9 ._+()-]+$/);
});

test("Jev sees names and addresses only, with a none-of-these option", opts, () => {
  const o = run();
  assert.deepEqual(Object.keys(o.jev_request).sort(), ["groups", "new_sender"]);
  assert.deepEqual(o.jev_request.new_sender, { name: "Facebook", address: "security@facebookmail.com" });
  assert.deepEqual(o.jev_request.groups, { g0: { name: "Facebook", addresses: ["notify@facebook.com"] } });
  assert.deepEqual(o.jev_ids, ["g0", "none"]);
  assert.deepEqual(o.jev_questions, ["imitation", "same_sender"]);
});

test("settings: accounts are required, one address each, lower-cased; own addresses kept", opts, () => {
  const o = run();
  assert.match(o.settings_none, /needs "sort"/);
  assert.match(o.settings_bad, /one address per value/);
  assert.deepEqual(o.settings_ok, [[{ address: "a@gmail.com", also: [] }], ["a@gmail.com", "me@x.dk", "u@pm.me"]]);
});

test("a run makes the folders it needs, moves by account and sender, keeps the cap; a dry run changes nothing", opts, () => {
  const o = run();
  assert.deepEqual(o.run.calls, [
    ["CREATE", "Folders/home.mail@gmail.com"],
    ["CREATE", "Folders/home.mail@gmail.com/Amazon"],
    ["MOVE", "INBOX", "1,2", "Folders/home.mail@gmail.com/Amazon"],
    ["CREATE", "Folders/inbox@pm.me/Netflix"],
    ["MOVE", "Folders/inbox@pm.me", "7", "Folders/inbox@pm.me/Netflix"],
  ]);
  assert.deepEqual(o.run.inbox, ["3", "4"]);
  assert.equal(o.run.state, true);
  assert.match(o.run.said, /^moved 3 mail\(s\) into 2 sender folder\(s\); 2 left in place/);
  assert.deepEqual(o.dry.calls, []);
  assert.deepEqual(o.dry.readonly, [true]);
  assert.equal(o.dry.state, false);
  assert.match(o.dry.said, /^would move 3 mail.*dry run: rules only/);
  assert.equal(o.capped.calls.filter((c) => c[0] === "MOVE").map((c) => c[2]).join(" "), "1");
});
