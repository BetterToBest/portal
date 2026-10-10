mod ed;
mod json;

use ed::{is_lower_hex, verify42};
use json::{canon, canon_str, V};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

#[derive(Clone)]
struct E {
    code: &'static str,
    wher: &'static str,
    index: Option<usize>,
}
fn ej(e: &E) -> Value {
    json!({"code": e.code, "where": e.wher, "index": e.index})
}

fn sha256(b: &[u8]) -> [u8; 32] {
    let mut o = [0u8; 32];
    o.copy_from_slice(&Sha256::digest(b));
    o
}

fn str_hex(v: Option<&V>, n: usize) -> Option<String> {
    let s = v?.as_string()?;
    if is_lower_hex(&s, n) { Some(s) } else { None }
}

fn cp_count(v: &V) -> usize {
    String::from_utf16(if let V::Str(u) = v { u } else { return 0 }).map(|s| s.chars().count()).unwrap_or(0)
}

struct Cp {
    operator: String,
    root: String,
    size: i64,
    time: i64,
    sig: String,
}

fn parse_cp(v: &V) -> Option<Cp> {
    canon(v)?; // nothing from section 2 forbidden, no duplicate keys
    if !v.has_exact_keys(&["operator", "root", "size", "time", "sig"]) {
        return None;
    }
    Some(Cp {
        operator: str_hex(v.get("operator"), 64)?,
        root: str_hex(v.get("root"), 64)?,
        size: v.get("size")?.as_int()?,
        time: v.get("time")?.as_int()?,
        sig: str_hex(v.get("sig"), 128)?,
    })
}

fn cp_sig_ok(c: &Cp) -> bool {
    let msg = format!(
        "{{\"operator\":\"{}\",\"root\":\"{}\",\"size\":{},\"time\":{}}}",
        c.operator, c.root, c.size, c.time
    );
    verify42(&c.operator, msg.as_bytes(), &c.sig)
}

fn merkle(l: &[[u8; 32]]) -> [u8; 32] {
    if l.len() == 1 {
        let mut b = vec![0u8];
        b.extend_from_slice(&l[0]);
        return sha256(&b);
    }
    let mut k = 1usize;
    while k * 2 < l.len() {
        k *= 2;
    }
    let mut b = vec![1u8];
    b.extend_from_slice(&merkle(&l[..k]));
    b.extend_from_slice(&merkle(&l[k..]));
    sha256(&b)
}

fn int_in(v: Option<&V>, min: i64) -> bool {
    matches!(v.and_then(|x| x.as_int()), Some(i) if i >= min)
}
fn str_len(v: Option<&V>, lo: usize, hi: usize) -> bool {
    match v {
        Some(s @ V::Str(_)) => {
            let n = cp_count(s);
            n >= lo && n <= hi
        }
        _ => false,
    }
}

fn body_ok(t: &str, b: &V) -> bool {
    match t {
        "genesis" => b.has_exact_keys(&["threshold", "comment_seconds"]) && int_in(b.get("threshold"), 1) && int_in(b.get("comment_seconds"), 0),
        "register_key" => b.has_exact_keys(&["public_key", "label"]) && str_hex(b.get("public_key"), 64).is_some() && str_len(b.get("label"), 1, 40),
        "propose" => b.has_exact_keys(&["title", "text"]) && str_len(b.get("title"), 1, 120) && str_len(b.get("text"), 1, 20000),
        "amend" => {
            b.has_exact_keys(&["proposal", "title", "text"])
                && str_hex(b.get("proposal"), 64).is_some()
                && str_len(b.get("title"), 1, 120)
                && str_len(b.get("text"), 1, 20000)
        }
        "sign" => b.has_exact_keys(&["proposal", "version"]) && str_hex(b.get("proposal"), 64).is_some() && str_hex(b.get("version"), 64).is_some(),
        "comment" => b.has_exact_keys(&["proposal", "text"]) && str_hex(b.get("proposal"), 64).is_some() && str_len(b.get("text"), 1, 2000),
        _ => false,
    }
}

fn version_hash(title: &V, text: &V) -> String {
    let mut s = String::from("{\"text\":");
    if let V::Str(u) = text {
        canon_str(u, &mut s);
    }
    s.push_str(",\"title\":");
    if let V::Str(u) = title {
        canon_str(u, &mut s);
    }
    s.push('}');
    hex::encode(sha256(s.as_bytes()))
}

struct Prop {
    id: String,
    proposer: String,
    title: String,
    versions: Vec<String>,
    sigs: Vec<String>,
    tt: Option<i64>,
}

struct Info {
    errs: Vec<&'static str>,
    fmt_ok: bool,
    recomputed: [u8; 32],
    rtype: String,
    author: String,
    time: i64,
}

fn read_file(p: &str) -> Vec<u8> {
    match std::fs::read(p) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("cannot read {}: {}", p, e);
            std::process::exit(2);
        }
    }
}

fn finish(ints: Vec<E>, rules: Vec<E>, summary: Value) -> i32 {
    let ok = ints.is_empty() && rules.is_empty();
    let out = json!({
        "ok": ok,
        "integrity_errors": ints.iter().map(ej).collect::<Vec<_>>(),
        "rule_errors": rules.iter().map(ej).collect::<Vec<_>>(),
        "summary": summary,
    });
    println!("{}", serde_json::to_string_pretty(&out).unwrap());
    if ok { 0 } else { 1 }
}

fn check_entry(i: usize, ev: &V, prev: Option<&V>) -> (Info, ) {
    let mut inf = Info { errs: vec![], fmt_ok: false, recomputed: [0u8; 32], rtype: String::new(), author: String::new(), time: 0 };
    // ---- format (section 3, 4 shape, section 2)
    let fmt = (|| -> Option<(i64, String, i64, String)> {
        canon(ev)?;
        if !ev.has_exact_keys(&["index", "prev", "time", "record", "hash"]) {
            return None;
        }
        let index = ev.get("index")?.as_int()?;
        let time = ev.get("time")?.as_int()?;
        if time < 0 {
            return None;
        }
        let prevh = str_hex(ev.get("prev"), 64)?;
        let hash = str_hex(ev.get("hash"), 64)?;
        let r = ev.get("record")?;
        if !r.has_exact_keys(&["type", "author", "body", "sig"]) {
            return None;
        }
        let ty = r.get("type")?.as_string()?;
        let author = str_hex(r.get("author"), 64)?;
        str_hex(r.get("sig"), 128)?;
        if !matches!(r.get("body")?, V::Obj(_)) {
            return None;
        }
        inf.rtype = ty;
        inf.author = author;
        Some((index, prevh, time, hash))
    })();
    let (index, prevh, time, hash) = match fmt {
        Some(x) => x,
        None => {
            inf.errs.push("BAD_FORMAT");
            return (inf,);
        }
    };
    inf.fmt_ok = true;
    inf.time = time;
    if index != i as i64 {
        inf.errs.push("BAD_INDEX");
    }
    let expected_prev: Option<String> = if i == 0 {
        Some("0".repeat(64))
    } else {
        prev.and_then(|p| p.get("hash")).and_then(|h| h.as_string())
    };
    if expected_prev.as_deref() != Some(prevh.as_str()) {
        inf.errs.push("BAD_PREV");
    }
    let r = ev.get("record").unwrap();
    let canon_rec = canon(r).unwrap();
    let h = format!("{{\"index\":{},\"prev\":\"{}\",\"record\":{},\"time\":{}}}", index, prevh, canon_rec, time);
    inf.recomputed = sha256(h.as_bytes());
    if hex::encode(inf.recomputed) != hash {
        inf.errs.push("BAD_HASH");
    }
    let mut msg = format!("{{\"author\":\"{}\",\"body\":", inf.author);
    msg.push_str(&canon(r.get("body").unwrap()).unwrap());
    msg.push_str(",\"type\":");
    if let V::Str(u) = r.get("type").unwrap() {
        canon_str(u, &mut msg);
    }
    msg.push('}');
    let sig = r.get("sig").unwrap().as_string().unwrap();
    if !verify42(&inf.author, msg.as_bytes(), &sig) {
        inf.errs.push("BAD_SIG");
    }
    (inf,)
}

fn verify(logp: &str, trustedp: Option<&str>) -> i32 {
    let bytes = read_file(logp);
    let trusted_bytes = trustedp.map(read_file);
    let bad_log = || finish(vec![E { code: "BAD_FORMAT", wher: "log", index: None }], vec![], Value::Null);
    let root = match json::parse(&bytes) {
        Ok(v) => v,
        Err(_) => return bad_log(),
    };
    if !root.has_exact_keys(&["format", "entries", "checkpoints"]) {
        return bad_log();
    }
    if root.get("format").and_then(|f| f.as_string()).as_deref() != Some("cip-test-log/0") {
        return bad_log();
    }
    let (entries, cps) = match (root.get("entries"), root.get("checkpoints")) {
        (Some(V::Arr(e)), Some(V::Arr(c))) => (e, c),
        _ => return bad_log(),
    };
    let n = entries.len();
    let mut ints: Vec<E> = vec![];
    let mut infos: Vec<Info> = vec![];
    for i in 0..n {
        let (inf,) = check_entry(i, &entries[i], if i > 0 { Some(&entries[i - 1]) } else { None });
        for c in &inf.errs {
            ints.push(E { code: c, wher: "entry", index: Some(i) });
        }
        infos.push(inf);
    }
    // ---- genesis / operator
    let mut operator: Option<String> = None;
    let mut settings: Option<(i64, i64)> = None;
    if n > 0 && infos[0].errs.is_empty() && infos[0].rtype == "genesis" {
        let body = entries[0].get("record").unwrap().get("body").unwrap();
        if body_ok("genesis", body) {
            operator = Some(infos[0].author.clone());
            settings = Some((body.get("threshold").unwrap().as_int().unwrap(), body.get("comment_seconds").unwrap().as_int().unwrap()));
        }
    }
    let rh: Vec<[u8; 32]> = infos.iter().map(|x| x.recomputed).collect();
    // ---- checkpoints
    for (ci, cv) in cps.iter().enumerate() {
        let mk = |code: &'static str| E { code, wher: "checkpoint", index: Some(ci) };
        let c = match parse_cp(cv) {
            Some(c) => c,
            None => {
                ints.push(mk("CP_BAD_FORMAT"));
                continue;
            }
        };
        if operator.as_deref() != Some(c.operator.as_str()) {
            ints.push(mk("CP_WRONG_OPERATOR"));
        }
        if !cp_sig_ok(&c) {
            ints.push(mk("CP_BAD_SIG"));
        }
        if c.size < 1 || c.size > n as i64 {
            ints.push(mk("CP_BAD_SIZE"));
            continue;
        }
        if hex::encode(merkle(&rh[..c.size as usize])) != c.root {
            ints.push(mk("CP_BAD_ROOT"));
        }
    }
    // ---- trusted
    if let Some(tb) = trusted_bytes {
        let mk = |code: &'static str| E { code, wher: "trusted", index: Some(0) };
        let parsed = json::parse(&tb).ok().and_then(|v| parse_cp(&v));
        match parsed {
            None => ints.push(mk("TRUSTED_BAD_FORMAT")),
            Some(c) => {
                if operator.as_deref() != Some(c.operator.as_str()) {
                    ints.push(mk("TRUSTED_WRONG_OPERATOR"));
                }
                if !cp_sig_ok(&c) {
                    ints.push(mk("TRUSTED_BAD_SIG"));
                }
                if c.size < 1 || c.size > n as i64 {
                    ints.push(mk("TRUSTED_TRUNCATED"));
                } else if hex::encode(merkle(&rh[..c.size as usize])) != c.root {
                    ints.push(mk("TRUSTED_MISMATCH"));
                }
            }
        }
    }
    // ---- rule errors
    let mut rules: Vec<E> = vec![];
    let mut registered: HashSet<String> = HashSet::new();
    let mut props: Vec<Prop> = vec![];
    let mut comments = 0usize;
    let mut have_settings = false;
    let (mut thr, mut cs) = (0i64, 0i64);
    for i in 0..n {
        if !infos[i].errs.is_empty() {
            continue;
        }
        let inf = &infos[i];
        let mut re = |code: &'static str| rules.push(E { code, wher: "entry", index: Some(i) });
        // 1 time reversed
        if i > 0 {
            if let Some(pt) = entries[i - 1].get("time").and_then(|t| t.as_int()) {
                if inf.time < pt {
                    re("TIME_REVERSED");
                }
            }
        }
        let rec = entries[i].get("record").unwrap();
        let body = rec.get("body").unwrap();
        let ty = inf.rtype.as_str();
        // 2
        if i == 0 && ty != "genesis" {
            re("NO_GENESIS");
        }
        if ty == "genesis" && i != 0 {
            re("DUPLICATE_GENESIS");
            continue;
        }
        // 3
        if !body_ok(ty, body) {
            re("BAD_BODY");
            continue;
        }
        if ty == "genesis" && i == 0 {
            have_settings = true;
            thr = settings.unwrap().0;
            cs = settings.unwrap().1;
        }
        // 4
        if !have_settings {
            continue;
        }
        let op = operator.as_deref().unwrap();
        // 5
        if ty == "register_key" {
            let pk = str_hex(body.get("public_key"), 64).unwrap();
            if pk != inf.author {
                re("SELF_REGISTER_MISMATCH");
                continue;
            }
            if pk == op || registered.contains(&pk) {
                re("DUPLICATE_KEY");
                continue;
            }
            let label = body.get("label").unwrap().as_string().unwrap();
            if !label.starts_with("test-") {
                re("BAD_LABEL");
                continue;
            }
            registered.insert(pk);
            continue;
        }
        // 6
        if inf.author != op && !registered.contains(&inf.author) {
            re("UNREGISTERED_AUTHOR");
            continue;
        }
        match ty {
            "genesis" => {}
            "propose" => {
                props.push(Prop {
                    id: hex::encode(inf.recomputed),
                    proposer: inf.author.clone(),
                    title: body.get("title").unwrap().as_string().unwrap(),
                    versions: vec![version_hash(body.get("title").unwrap(), body.get("text").unwrap())],
                    sigs: vec![],
                    tt: None,
                });
            }
            _ => {
                let pid = body.get("proposal").unwrap().as_string().unwrap();
                let pi = match props.iter().position(|p| p.id == pid) {
                    Some(x) => x,
                    None => {
                        re("UNKNOWN_PROPOSAL");
                        continue;
                    }
                };
                let p = &mut props[pi];
                if let Some(tt) = p.tt {
                    if inf.time >= tt + cs {
                        re("PROPOSAL_CLOSED");
                        continue;
                    }
                }
                match ty {
                    "amend" => {
                        if p.proposer != inf.author {
                            re("NOT_PROPOSER");
                            continue;
                        }
                        p.title = body.get("title").unwrap().as_string().unwrap();
                        p.versions.push(version_hash(body.get("title").unwrap(), body.get("text").unwrap()));
                        p.sigs.clear();
                        p.tt = None;
                    }
                    "sign" => {
                        let ver = body.get("version").unwrap().as_string().unwrap();
                        let mut bad = false;
                        if &ver != p.versions.last().unwrap() {
                            re("STALE_VERSION");
                            bad = true;
                        }
                        if p.sigs.contains(&inf.author) {
                            re("DUPLICATE_SIGNATURE");
                            bad = true;
                        }
                        if !bad {
                            p.sigs.push(inf.author.clone());
                            if p.sigs.len() as i64 == thr {
                                p.tt = Some(inf.time);
                            }
                        }
                    }
                    _ => {
                        comments += 1;
                    }
                }
            }
        }
    }
    // ---- summary
    let summary = if have_settings {
        let t_last = infos.iter().rev().find(|x| x.errs.is_empty()).map(|x| x.time).unwrap_or(0);
        let ps: Vec<Value> = props
            .iter()
            .map(|p| {
                let state = if (p.sigs.len() as i64) < thr {
                    "collecting"
                } else if t_last >= p.tt.unwrap() + cs {
                    "closed"
                } else {
                    "comment"
                };
                json!({"id": p.id, "title": p.title, "versions": p.versions.len(), "version": p.versions.last().unwrap(), "signatures": p.sigs.len(), "state": state})
            })
            .collect();
        json!({"entries": n, "registered": registered.len(), "comments": comments, "proposals": ps})
    } else {
        Value::Null
    };
    finish(ints, rules, summary)
}

fn compare(pa: &str, pb: &str) -> i32 {
    let ba = read_file(pa);
    let bb = read_file(pb);
    let a = json::parse(&ba).ok().and_then(|v| parse_cp(&v));
    let b = json::parse(&bb).ok().and_then(|v| parse_cp(&v));
    let mut errs: Vec<E> = vec![];
    let mut relation = Value::Null;
    let mut operator = Value::Null;
    if a.is_none() {
        errs.push(E { code: "CMP_BAD_FORMAT", wher: "a", index: None });
    }
    if b.is_none() {
        errs.push(E { code: "CMP_BAD_FORMAT", wher: "b", index: None });
    }
    if let (Some(a), Some(b)) = (&a, &b) {
        let mut stop = false;
        if a.operator != b.operator {
            errs.push(E { code: "CMP_DIFFERENT_OPERATOR", wher: "both", index: None });
            stop = true;
        }
        if !cp_sig_ok(a) {
            errs.push(E { code: "CMP_BAD_SIG", wher: "a", index: None });
            stop = true;
        }
        if !cp_sig_ok(b) {
            errs.push(E { code: "CMP_BAD_SIG", wher: "b", index: None });
            stop = true;
        }
        if !stop {
            operator = json!(a.operator);
            if a.size != b.size {
                relation = json!("different-size");
            } else if a.root == b.root {
                relation = json!("identical");
            } else {
                relation = json!("conflict");
                errs.push(E { code: "CMP_CONFLICT", wher: "both", index: None });
            }
        }
    }
    let _ = (a.as_ref().map(|c| c.time), a.as_ref().map(|c| &c.root));
    let out = json!({"ok": errs.is_empty(), "errors": errs.iter().map(ej).collect::<Vec<_>>(), "relation": relation, "operator": operator});
    println!("{}", serde_json::to_string_pretty(&out).unwrap());
    if errs.is_empty() { 0 } else { 1 }
}

fn real_main() -> i32 {
    let a: Vec<String> = std::env::args().collect();
    let usage = || {
        eprintln!("usage: cip-verify verify <log.json> [--trusted <cp.json>] | compare <a.json> <b.json> | sigcheck <pubkey-hex> <message> <sig-hex>");
        2
    };
    if a.len() < 2 {
        return usage();
    }
    match a[1].as_str() {
        "verify" => {
            if a.len() == 3 {
                verify(&a[2], None)
            } else if a.len() == 5 && a[3] == "--trusted" {
                verify(&a[2], Some(&a[4]))
            } else if a.len() == 5 && a[2] == "--trusted" {
                verify(&a[4], Some(&a[3]))
            } else {
                usage()
            }
        }
        "compare" if a.len() == 4 => compare(&a[2], &a[3]),
        "sigcheck" if a.len() == 5 => {
            println!("{}", verify42(&a[2], a[3].as_bytes(), &a[4]));
            0
        }
        _ => usage(),
    }
}

fn main() {
    let h = std::thread::Builder::new().stack_size(1 << 30).spawn(real_main).unwrap();
    let code = h.join().unwrap_or(2);
    std::process::exit(code);
}
