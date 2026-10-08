# Do other Ed25519 libraries agree with SPEC section 4.2? (evidence, not a verifier)

Status: **evidence for reviewers, and the reason for rule 5.** The two verifiers in this repository, and the browser viewer, all sit on OpenSSL or BoringSSL. [SPEC section 4.2](../../SPEC.md) says exactly which public keys and signatures a verifier must accept, and [`ed25519-odd-cases.json`](../ed25519-odd-cases.json) holds 41 cases with the required result for each, computed from RFC 8032 arithmetic and not from any library. This folder runs those 41 cases through libraries that do **not** use OpenSSL or BoringSSL, and records what each one says. No verifier here uses any of them, and nothing in the project depends on this folder.

The first run was made against rules 1 to 4 of section 4.2, with 40 cases. It showed that libraries disagree on keys and signatures with a small-order component, and that a prime-order-subgroup check in front of any of them removes the disagreement. Rule 5 was added to section 4.2 because of that, and the one expected result it changes was updated in the vector file. The raw answers in `results.json` are what each library said, and do not depend on the rule; the table is computed against the current expected results. A 41st case (a key and `R` whose small-order components cancel, so that the plain equation holds) was added afterwards and every library was run again.

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

Each case is a public key, a message and a signature. A library that raises an error counts as having refused the case. The versions are the ones that installed from the standard package registries in October 2026.

## Results

Counts are out of 41 cases. "Agrees" means the library's yes or no matched what SPEC 4.2 requires (only one case must pass: the ordinary valid signature). "After the checks" means the library's yes counts only if the checks of section 4.2 that a program adds in front of any library also hold: the key rules (2 and 3), `S` below the group order, and the key and `R` in the prime-order subgroup (rule 5). Reproduce the table with `python3 analyze.py`.

| Library | Agrees on its own | Accepts what 4.2 refuses | Agrees after the checks |
|---|---|---|---|
| PyNaCl (libsodium) | 39 | 2 | 41 |
| libsodium-wrappers | 39 | 2 | 41 |
| @noble/curves, zip215 off | 37 | 4 | 41 |
| @noble/ed25519, zip215 off | 37 | 4 | 41 |
| elliptic | 27 | 14 | 41 |
| PyCryptodome | 26 | 15 | 41 |
| tweetnacl | 24 | 17 | 41 |
| @noble/curves, default | 10 | 31 | 41 |
| @noble/ed25519, default | 10 | 31 | 41 |

No library refused a signature that 4.2 requires to be accepted.

## What this shows

1. **No library follows 4.2 on its own.** libsodium comes closest: it differs on two cases, both with an order-8 component that rule 5 refuses and libsodium accepts (a key with such a component whose plain equation holds, and a key and `R` whose small-order components cancel).
2. **The other libraries accept many cases 4.2 refuses**, mostly keys of small order or non-canonical spellings. A verifier built on one of them would disagree with this prototype about the same log, unless its author adds the checks.
3. **Some gaps need more than a key filter.** `tweetnacl` accepts signatures whose `S` is not below the group order (the cases "S + L" and "S + 8L"). `@noble/*` and `PyCryptodome` accept a signature with an order-8 component in `R`, and a key with an order-8 component where the plain equation fails. They appear to use the cofactored equation, which is a different but common reading of RFC 8032. Rule 4 forbids both cases.
4. **The checks close every gap.** With the key rules, an `S` check and the prime-order-subgroup check (rule 5) in front, all nine variants agree on all 41 cases. Honest keys and signatures lie in the prime-order subgroup, so honest participants notice nothing. The cost is one multiplication by the group order for each new key and each signature, which the two programs and the viewer cache.

## What this does not show

- It does not cover Firefox, Safari, Go, Rust (`ed25519-dalek` and others), Java or .NET. They could not be run here. If you can run `../ed25519-odd-cases.json` through one of them, a result is welcome in [Discussions](https://github.com/BetterToBest/portal/discussions) or as an issue.
- Library behavior changes between versions. These results are for the versions in the table only.
- Rule 5 is a proposal for reviewers to challenge (SPEC section 9, question 5), not a settled standard.
- Passing these 41 cases does not make a verifier correct. They are the cases that libraries disagree about, not all of Ed25519.

## Run it yourself

You need Node 18 or later and Python 3. In this folder:

```
npm install --no-save tweetnacl libsodium-wrappers @noble/curves @noble/ed25519 elliptic
pip install pynacl pycryptodome
node run.js > node-results.json
python3 run.py > py-results.json
python3 analyze.py --merge node-results.json py-results.json > results.json
python3 analyze.py
```

`results.json` is the recorded output of the run described above. `analyze.py` needs only the Python standard library and reads the expected results from [`../../python/make-ed25519-vectors.py`](../../python/make-ed25519-vectors.py). `npm install --no-save` and the `pip` line install into your own machine only; nothing is added to the repository.
