# Do other Ed25519 libraries agree with SPEC section 4.2? (evidence, not a verifier)

Status: **evidence for reviewers, and the reason for rule 5.** The two verifiers in this repository, and the browser viewer, all sit on OpenSSL or BoringSSL. [SPEC section 4.2](../../SPEC.md) says exactly which public keys and signatures a verifier must accept, and [`ed25519-odd-cases.json`](../ed25519-odd-cases.json) holds 41 cases with the required result for each, computed from RFC 8032 arithmetic and not from any library. This folder runs those 41 cases through libraries that do **not** use OpenSSL or BoringSSL, and records what each one says. No verifier here uses any of them, and nothing in the project depends on this folder.

The first run was made against rules 1 to 4 of section 4.2, with 40 cases. It showed that libraries disagree on keys and signatures with a small-order component, and that a prime-order-subgroup check in front of any of them removes the disagreement. Rule 5 was added to section 4.2 because of that, and the one expected result it changes was updated in the vector file. The raw answers in `results.json` are what each library said, and do not depend on the rule; the table is computed against the current expected results. A 41st case (a key and `R` whose small-order components cancel, so that the plain equation holds) was added afterwards and every library was run again. Go, Java, PHP and three Rust crates were run on the same 41 cases after that, in a second round, and are in the same table. That makes thirteen libraries and wrappers, in sixteen variants.

CIP is a research proposal, not a live voting system. Everything here is test data and a few small programs that read files.

## What was run

| Library | Version | Notes |
|---|---|---|
| PyNaCl | 1.6.2 | Python, bundles libsodium |
| libsodium-wrappers | 0.8.4 | Node, libsodium built for WebAssembly |
| tweetnacl | 1.0.3 | Node, pure JavaScript port of TweetNaCl |
| @noble/curves | 2.4.0 | Node, pure JavaScript; run with its default and with `zip215: false` |
| @noble/ed25519 | 3.2.0 | Node, pure JavaScript; run with its default and with `zip215: false` |
| elliptic | 6.6.1 | Node, pure JavaScript |
| PyCryptodome | 3.24.0 | Python, own C and Python code |
| Go `crypto/ed25519` | Go 1.24.7 | Go's standard library; nothing was installed (the Go module proxy could not be reached from where this was run, so no third-party Go package was run) |
| JDK Ed25519 | 21.0.12.1 | OpenJDK 21's built-in `java.security.Signature` "Ed25519" |
| PHP sodium | PHP 8.3.6, libsodium 1.0.18 | PHP's `sodium_crypto_sign_verify_detached`, on the system libsodium. This is the same code base as PyNaCl and libsodium-wrappers, so it checks one more wrapper and version of libsodium, not a separate implementation |
| ed25519-dalek | 2.2.0 | Rust; run with `verify` and with `verify_strict` |
| ed25519-zebra | 4.2.0 | Rust; gave the same 41 answers as @noble's default mode |
| ed25519-compact | 2.6.0 | Rust, pure; gave the same 41 answers as @noble with `zip215: false` |

Each case is a public key, a message and a signature. A library that raises an error (or, in Go, panics) counts as having refused the case. The versions are the ones that installed from the standard package registries in October 2026.

## Results

Counts are out of 41 cases. "Agrees" means the library's yes or no matched what SPEC 4.2 requires (only one case must pass: the ordinary valid signature). "After the checks" means the library's yes counts only if the checks of section 4.2 that a program adds in front of any library also hold: the key rules (2 and 3), `S` below the group order, and the key and `R` in the prime-order subgroup (rule 5). Reproduce the table with `python3 analyze.py`.

| Library | Agrees on its own | Accepts what 4.2 refuses | Agrees after the checks |
|---|---|---|---|
| PHP sodium (libsodium) | 39 | 2 | 41 |
| PyNaCl (libsodium) | 39 | 2 | 41 |
| Rust ed25519-dalek, verify_strict | 39 | 2 | 41 |
| libsodium-wrappers | 39 | 2 | 41 |
| @noble/curves, zip215 off | 37 | 4 | 41 |
| @noble/ed25519, zip215 off | 37 | 4 | 41 |
| Rust ed25519-compact | 37 | 4 | 41 |
| Java Ed25519 (JDK) | 31 | 10 | 41 |
| elliptic | 27 | 14 | 41 |
| Go crypto/ed25519 | 26 | 15 | 41 |
| PyCryptodome | 26 | 15 | 41 |
| Rust ed25519-dalek, verify | 26 | 15 | 41 |
| tweetnacl | 24 | 17 | 41 |
| @noble/curves, default | 10 | 31 | 41 |
| @noble/ed25519, default | 10 | 31 | 41 |
| Rust ed25519-zebra | 10 | 31 | 41 |

No library refused a signature that 4.2 requires to be accepted.

## What this shows

1. **No library follows 4.2 on its own.** libsodium comes closest: it differs on two cases, both with an order-8 component that rule 5 refuses and libsodium accepts (a key with such a component whose plain equation holds, and a key and `R` whose small-order components cancel). libsodium through PHP, through PyNaCl and through libsodium-wrappers gave the same 41 answers, and so did `ed25519-dalek`'s `verify_strict`.
2. **The other libraries accept many cases 4.2 refuses**, mostly keys of small order or non-canonical spellings. A verifier built on one of them would disagree with this prototype about the same log, unless its author adds the checks. Go's `crypto/ed25519` and `ed25519-dalek`'s plain `verify` gave the same 41 answers as each other: both accept every small-order key whose plain equation holds, including non-canonical spellings of them. The JDK accepts the canonical small-order keys when the equation holds, but refuses the non-canonical spellings (cases 25 to 36), so it sits between those two and libsodium.
3. **Some gaps need more than a key filter.** `tweetnacl` accepts signatures whose `S` is not below the group order (the cases "S + L" and "S + 8L"). `@noble/*`, `PyCryptodome`, `ed25519-compact` and `ed25519-zebra` accept a signature with an order-8 component in `R`, and a key with an order-8 component where the plain equation fails. They appear to use the cofactored equation, which is a different but common reading of RFC 8032. Rule 4 forbids both cases. None of the six libraries added in the second round accepts an `S` that is not below the group order.
4. **The checks close every gap.** With the key rules, an `S` check and the prime-order-subgroup check (rule 5) in front, all sixteen variants agree on all 41 cases. Honest keys and signatures lie in the prime-order subgroup, so honest participants notice nothing. The cost is one multiplication by the group order for each new key and each signature, which the two programs and the viewer cache.

## What this does not show

- It does not cover the Ed25519 code inside Firefox or Safari, or .NET. They could not be run here. If you can run `../ed25519-odd-cases.json` through one of them, a result is welcome in [Discussions](https://github.com/BetterToBest/portal/discussions) or as an issue.
- Other libraries in the languages that were run were not: Bouncy Castle for Java, third-party Go packages (for example `ed25519consensus`), Rust's `ring`, and Rust crates other than the three above.
- PHP's sodium is libsodium again, so the thirteen libraries are fewer than thirteen separate code bases. Counting libsodium once, there are eleven.
- Library behavior changes between versions. These results are for the versions in the table only.
- Rule 5 is a proposal for reviewers to challenge (SPEC section 9, question 5), not a settled standard.
- Passing these 41 cases does not make a verifier correct. They are the cases that libraries disagree about, not all of Ed25519.

## Run it yourself

Each program reads `../ed25519-odd-cases.json` and prints a result to standard output. Run only the ones you have the tools for, then merge what you got. In this folder:

```
npm install --no-save tweetnacl libsodium-wrappers @noble/curves @noble/ed25519 elliptic
pip install pynacl pycryptodome
node run.js > node-results.json            # JavaScript libraries (Node 18 or later)
python3 run.py > py-results.json           # PyNaCl and PyCryptodome
go run run.go > go-results.json            # Go standard library, nothing to install
php run.php > php-results.json             # PHP with the sodium extension
java Run.java > java-results.json          # JDK 15 or later, nothing to install
(cd rust && cargo run --release > ../rust-results.json)   # three Rust crates, versions pinned in Cargo.lock
python3 analyze.py --merge node-results.json py-results.json go-results.json php-results.json java-results.json rust-results.json > results.json
python3 analyze.py
```

`results.json` is the recorded output of the runs described above. `analyze.py` needs only the Python standard library and reads the expected results from [`../../python/make-ed25519-vectors.py`](../../python/make-ed25519-vectors.py). `npm install --no-save`, the `pip` line and `cargo` install into your own machine only; nothing is added to the repository except what you choose to commit (the `rust/target/` folder is ignored).
