// Runs the 41 odd Ed25519 cases (../../ed25519-odd-cases.json) through Rust Ed25519 crates and prints a
// JSON result to standard output. Evidence only: no verifier in this repository uses them. From this folder:
//   cd rust && cargo run --release > ../rust-results.json
use ed25519_dalek::Verifier;
use std::fs;

fn main() {
    let raw = fs::read_to_string("../../ed25519-odd-cases.json").expect("cases file");
    let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let cases = v["cases"].as_array().unwrap();
    let mut dalek = vec![];
    let mut dalek_strict = vec![];
    let mut zebra = vec![];
    let mut compact = vec![];
    for c in cases {
        let pub_b = hex::decode(c["pub"].as_str().unwrap()).unwrap();
        let sig_b = hex::decode(c["sig"].as_str().unwrap()).unwrap();
        let msg = c["msg"].as_str().unwrap().as_bytes();

        // ed25519-dalek: verify (RFC 8032 equation, S must be below L) and verify_strict (also refuses small-order A and R)
        let (d, ds) = (|| -> (bool, bool) {
            let pk: [u8; 32] = match pub_b.clone().try_into() { Ok(x) => x, Err(_) => return (false, false) };
            let vk = match ed25519_dalek::VerifyingKey::from_bytes(&pk) { Ok(x) => x, Err(_) => return (false, false) };
            let sg: [u8; 64] = match sig_b.clone().try_into() { Ok(x) => x, Err(_) => return (false, false) };
            let sig = ed25519_dalek::Signature::from_bytes(&sg);
            (vk.verify(msg, &sig).is_ok(), vk.verify_strict(msg, &sig).is_ok())
        })();
        dalek.push(d);
        dalek_strict.push(ds);

        // ed25519-zebra: ZIP 215 rules (cofactored equation, non-canonical encodings accepted)
        let z = (|| -> bool {
            let pk: [u8; 32] = match pub_b.clone().try_into() { Ok(x) => x, Err(_) => return false };
            let vk = match ed25519_zebra::VerificationKey::try_from(pk) { Ok(x) => x, Err(_) => return false };
            let sg: [u8; 64] = match sig_b.clone().try_into() { Ok(x) => x, Err(_) => return false };
            vk.verify(&ed25519_zebra::Signature::from(sg), msg).is_ok()
        })();
        zebra.push(z);

        // ed25519-compact
        let k = (|| -> bool {
            let pk = match ed25519_compact::PublicKey::from_slice(&pub_b) { Ok(x) => x, Err(_) => return false };
            let sg = match ed25519_compact::Signature::from_slice(&sig_b) { Ok(x) => x, Err(_) => return false };
            pk.verify(msg, &sg).is_ok()
        })();
        compact.push(k);
    }
    let out = serde_json::json!({
        "versions": {
            "Rust ed25519-dalek, verify": "2.2.0",
            "Rust ed25519-dalek, verify_strict": "2.2.0",
            "Rust ed25519-zebra": "4.2.0",
            "Rust ed25519-compact": "2.6.0"
        },
        "results": {
            "Rust ed25519-dalek, verify": dalek,
            "Rust ed25519-dalek, verify_strict": dalek_strict,
            "Rust ed25519-zebra": zebra,
            "Rust ed25519-compact": compact
        }
    });
    println!("{}", out);
}
