# Do other Ed25519 libraries agree with SPEC section 4.2? (evidence, not a verifier)

Status: **evidence for reviewers.** The two verifiers in this repository, and the browser viewer, all sit on OpenSSL or BoringSSL. [SPEC section 4.2](../../SPEC.md) says exactly which public keys and signatures a verifier must accept, and [`ed25519-odd-cases.json`](../ed25519-odd-cases.json) holds 40 cases with the required result for each, computed from RFC 8032 arithmetic and not from any library. This folder runs those 40 cases through libraries that do **not** use OpenSSL or BoringSSL, and records what each one says. No verifier here uses any of them, and nothing in the project depends on this folder.

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

Counts are out of 40 cases. "Agrees with 4.2" means the library's yes or no matched what SPEC 4.2 requires. The last two columns are explained below the table. Reproduce the table with `python3 analyze.py`.

| Library | Agrees with 4.2 on its own | Accepts what 4.2 refuses | Agrees with 4.2 after the key rules (2 and 3) | Agrees with the subgroup rule after the checks |
|---|---|---|---|---|
| PyNaCl (libsodium) | 40 | 0 | 40 | 40 |
| libsodium-wrappers | 40 | 0 | 40 | 40 |
| @noble/curves, zip215 off | 38 | 2 | 38 | 40 |
| @noble/ed25519, zip215 off | 38 | 2 | 38 | 40 |
| elliptic | 28 | 12 | 40 | 40 |
| PyCryptodome | 27 | 13 | 38 | 40 |
| tweetnacl | 25 | 15 | 38 | 40 |
| @noble/curves, default | 11 | 29 | 38 | 40 |
| @noble/ed25519, default | 11 | 29 | 38 | 40 |

No library refused a signature that 4.2 requires to be accepted.

## What this shows

1. **libsodium agrees with 4.2 on all 40 cases with no extra code.** It is the only library tested that does.
2. **The other libraries accept cases that 4.2 refuses, mostly keys of small order or non-canonical spellings.** A verifier built on one of them would disagree with this prototype about the same log, unless its author adds the key rules of 4.2 (rules 2 and 3). With those two rules in front, `elliptic` agrees on all 40.
3. **Two things a key filter does not fix.** `tweetnacl` accepts signatures whose `S` is not below the group order (the cases "S + L" and "S + 8L"), so a verifier on it also needs its own check of `S`. `@noble/*` and `PyCryptodome` accept a signature with an order-8 component in `R`, and a key with an order-8 component where the plain equation fails. 4.2 rule 4 forbids both, because it uses the equation without the cofactor. These libraries appear to use the cofactored equation, which is a different but common reading of RFC 8032. A third verifier written on one of them needs more than a key filter to follow 4.2.
4. **A prime-order-subgroup rule would close the gap.** [SPEC section 9, question 5](../../SPEC.md) asks whether keys (and `R`) should be required to lie in the prime-order subgroup. The last column adds three checks in front of each library: the 4.2 key rules, `S` below the group order, and key and `R` both in the prime-order subgroup. With them, **all nine variants agree on all 40 cases**. The cost is one expectation changing: the case "public key has an order-8 component, hash multiple of 8 is true" passes under 4.2 today and would fail under the subgroup rule. Honest keys and signatures are in the subgroup, so honest participants would notice nothing. The libraries that agree with 4.2 on their own (libsodium) would agree with the subgroup rule on 39 of 40 cases.

None of this changes any verifier in this repository. It is the evidence behind a decision on question 5, which is still open.

## What this does not show

- It does not cover Firefox, Safari, Go, Rust (`ed25519-dalek` and others), Java or .NET. They could not be run here. If you can run `../ed25519-odd-cases.json` through one of them, a result is welcome in [Discussions](https://github.com/BetterToBest/portal/discussions) or as an issue.
- Library behavior changes between versions. These results are for the versions in the table only.
- The "subgroup rule" column is a proposal being tested, not a rule in the spec.
- Passing these 40 cases does not make a verifier correct. They are the cases that libraries disagree about, not all of Ed25519.

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
