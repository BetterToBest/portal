# Test log format and verification rules (draft v0.1)

Status: **draft for review.** (A first cold read of this spec by an AI helper, and what it changed here, is in [`../docs/spec-cold-read.md`](../docs/spec-cold-read.md).) This is the written definition of the test log in `prototype/`. It is the contract that the two verifiers (`node/cip-log.js` and `python/verify.py`) are both written from. It covers the proposal flow of paper §4.4.1 on **test data only**. CIP is a research proposal, not a live voting system; every design here is a proposal. The numbers are placeholders.

## 1. The file

One JSON file:

```json
{ "format": "cip-test-log/0", "entries": [ ... ], "checkpoints": [ ... ] }
```

Exactly those three keys, `format` is the string `cip-test-log/0`, and `entries` and `checkpoints` are arrays. Anything else is `BAD_FORMAT` (location `log`) and verification stops. That includes a file that is not valid JSON: one that is not valid UTF-8, one that starts with a byte-order mark, one with a trailing comma or a bare `NaN`, and one that is valid JSON but not an object (`null`, a list). The same goes for the other two files a verifier reads: a trusted checkpoint that is not valid JSON is `TRUSTED_BAD_FORMAT`, and a checkpoint given to `compare` is `CMP_BAD_FORMAT`. A file that cannot be read at all (it does not exist, or is not allowed to be opened) is not a result: see section 7. Two keys with the same name in one object are not defined: see section 9, question 6.

## 2. Canonical form

Everything that is hashed or signed is first written in canonical form: the subset of RFC 8785 for strings, integers, arrays and objects. Object keys are sorted by UTF-16 code units, there is no whitespace, strings are UTF-8 with only the minimal escapes (`\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`, and `\u00xx` in lowercase hex for other control characters), and integers are written in plain decimal. A number whose value is a whole number inside the safe range (absolute value at most 2^53 - 1) is read as that integer however it was written (`1.0` and `1e3` count as `1` and `1000`), so that every JSON parser sees the same value. **Not allowed anywhere:** any other number (fractions, larger values), booleans, `null`, and strings with unpaired surrogates. A hex string means lowercase `0-9a-f` only.

## 3. Entries

```json
{ "index": 0, "prev": "<64 hex>", "time": 1790900000, "record": { ... }, "hash": "<64 hex>" }
```

- Exactly the keys `index`, `prev`, `time`, `record`, `hash`. `index` and `time` are integers, `time >= 0`. `prev` and `hash` are 64 hex characters.
- `time` is assigned by the log operator (seconds, test values). It is covered by the hash, not by the author's signature.
- `hash` = SHA-256 (lowercase hex) of the canonical form of `{"index", "prev", "record", "time"}`.
- Entry 0 has `prev` of 64 zeros. Every other entry has `prev` equal to the **stored** `hash` of the entry before it.
- `index` equals the entry's position in the list.

## 4. Records

```json
{ "type": "...", "author": "<64 hex Ed25519 public key>", "body": { ... }, "sig": "<128 hex>" }
```

Exactly those four keys. `sig` is an Ed25519 signature (RFC 8032) by `author` over the canonical form of `{"type", "author", "body"}`. `body` is an object.

Body shapes (exactly these keys; strings are measured in Unicode code points):

| type | body |
|---|---|
| `genesis` | `threshold` (integer >= 1), `comment_seconds` (integer >= 0) |
| `register_key` | `public_key` (64 hex), `label` (1 to 40 characters) |
| `propose` | `title` (1 to 120), `text` (1 to 20000) |
| `amend` | `proposal` (64 hex), `title`, `text` (same limits) |
| `sign` | `proposal` (64 hex), `version` (64 hex) |
| `comment` | `proposal` (64 hex), `text` (1 to 2000) |

Derived values:

- **Proposal id**: the recomputed entry hash of the `propose` entry.
- **Version hash** of a proposal text: SHA-256 hex of the canonical form of `{"title", "text"}`. A proposal has one version when proposed and a new one for each `amend`.

### 4.1 The format as a JSON Schema

[`schema/cip-test-log.schema.json`](schema/cip-test-log.schema.json) (JSON Schema draft 2020-12) describes the **shape** of everything in sections 1 to 5: which keys, which types, which lengths, which hex strings. A log passes the schema exactly when every entry, record body and checkpoint has the right shape under sections 1 to 5, which is what the verifiers' `BAD_FORMAT`, `BAD_BODY`, `CP_BAD_FORMAT`, `TRUSTED_BAD_FORMAT` and `CMP_BAD_FORMAT` checks look at (the tests compare the two on every test log and every edited log). The schema cannot check anything that needs computing or comparing: hashes, signatures, the chain, canonical form beyond the number rule, the `test-` label rule, or any rule of section 6. If the schema and the text of this spec ever disagree, the spec wins and the schema has a bug. Examples that pass and fail, each with the reason, are in [`schema/examples/`](schema/examples/).

### 4.2 Checking a signature and its key

Every signature in a log (a record's `sig`, a checkpoint's `sig`, the `sig` of a trusted checkpoint) is checked the same way. It passes only if all five rules hold. If any one fails, the signature does not verify, and the error is the one named in section 6 for that place (`BAD_SIG`, `CP_BAD_SIG`, `TRUSTED_BAD_SIG` or `CMP_BAD_SIG`); no other error is added for it.

1. **Shape.** The public key is 64 lowercase hex characters and the signature is 128 (sections 3 to 5).
2. **A canonical key.** Read the 32 bytes of the key as a little-endian integer. Clear bit 255 (the sign bit) and call the rest `y`. `y` must be less than 2^255 - 19. If `y` is 1 or 2^255 - 20 (the two values for which x is 0), the sign bit must be 0.
3. **Not a key of small order.** The key must not be one of these eight canonical encodings, the points whose order divides 8:

```
0100000000000000000000000000000000000000000000000000000000000000
ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f
0000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000080
c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a
c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa
26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05
26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85
```

4. **The signature equation.** As in RFC 8032 section 5.1.7, **without** the cofactor. `S` (the last 32 bytes, little-endian) must be less than L = 2^252 + 27742317777372353535851937790883648493. `R` (the first 32 bytes) must be the canonical encoding of a point. And `[S]B = R + [k]A`, where `A` is the key and `k` is SHA-512 of `R`, `A` and the message, read little-endian, modulo L. The check with the cofactor (`[8][S]B = [8]R + [8][k]A`) is not allowed: a signature whose `R` carries an order-8 component passes it and fails this one, and honest signers never produce one. (With rule 5 in force the two checks agree on every signature that gets that far, but a verifier still must not rely on the cofactored one alone.)
5. **Prime-order subgroup.** Both `A` (the key) and `R` must lie in the prime-order subgroup: [L]`A` and [L]`R` must each be the identity point. This is checked in addition to rules 2 to 4, after the equation, and a key or `R` that fails it makes the signature fail. Rules 2 and 3 are not made redundant by it. The identity point passes this rule but is refused by rule 3, and a non-canonical spelling of a point in the prime-order subgroup passes this rule but is refused by rule 2. Rule 2 also says only what a canonical spelling is; whether a `y` that is below 2^255 - 19 is the `y` of a point on the curve is part of reading the key as a point, and a key or `R` that is not a point fails.

**Why these rules are written down.** RFC 8032 lets implementations differ on exactly these points, so a log that one verifier accepts another may refuse. Rule 1 is what every library does, and rule 4 is what the libraries that use OpenSSL, BoringSSL or libsodium do. Rules 2 and 3 are not: they accept keys that are not canonical and keys of small order. On Node 22 (OpenSSL 3.5), Python 3.13 with the `cryptography` package (OpenSSL 4.0) and headless Chromium 141 (the browser's own Ed25519), all three gave identical answers on the 40 cases that [`vectors/ed25519-odd-cases.json`](vectors/ed25519-odd-cases.json) held when this was first run (the 41st was added later, with rule 5; the file now has 41). All three accepted the same 15 of those 40, and 13 of those break rule 2 or rule 3. A verifier built on a stricter library would refuse those and so disagree with this prototype about the same log. A small-order key is a key that anyone can sign for, so refusing it costs an honest participant nothing. Rule 5 exists because of a second set of tests. Thirteen other Ed25519 libraries and wrappers (libsodium in three forms, tweetnacl, @noble, elliptic, PyCryptodome, and those in Go, Java, PHP and Rust) were run on the same 41 cases ([`vectors/other-libraries/`](vectors/other-libraries/README.md)). Libraries that check the signature equation with the cofactor accept a signature whose `R` or key carries a small-order component, which rule 4 refuses, and no check on the key alone can fix that. With the subgroup check in front of any of them (and the key rules and an `S` check), all sixteen variants tested agree on all 41 cases. Honest keys and signatures are always in the prime-order subgroup, so rule 5 costs an honest participant nothing; it costs a verifier one multiplication by L for each new key and each signature, which a program can cache.

With rule 2, a usable key has exactly one spelling, so `DUPLICATE_KEY` (section 6) cannot be dodged by writing the same key two ways.

**The test cases.** [`vectors/ed25519-odd-cases.json`](vectors/ed25519-odd-cases.json) holds 41 cases: a public key, a message and a signature, and the result this section requires (1 must pass, 40 must fail). The results are computed from RFC 8032 arithmetic by [`python/make-ed25519-vectors.py`](python/make-ed25519-vectors.py), not taken from any library, and the same script derives the eight small-order points by arithmetic and checks them against the list above. A verifier that gives a different result on any case has not followed this section.

**What this does not cover.** The 41 cases are the ones libraries are known to disagree about, not all of Ed25519. Libraries outside the ones listed above (for example those in Firefox, Safari and .NET) have not been run, and neither have other libraries in the same languages (Bouncy Castle, third-party Go packages, Rust's `ring`).

## 5. Checkpoints

```json
{ "operator": "<64 hex>", "root": "<64 hex>", "size": 12, "time": 1790900400, "sig": "<128 hex>" }
```

Exactly those keys; `size` and `time` are integers. `sig` is by `operator` over the canonical form of `{"operator", "root", "size", "time"}`. `root` is the Merkle tree hash (RFC 6962 section 2.1) of the first `size` entries, where leaf `i` is `SHA-256(0x00 || recomputed entry hash i as 32 bytes)` and an inner node is `SHA-256(0x01 || left || right)`, splitting at the largest power of two smaller than the count. The **operator** is the author of entry 0 when entry 0's record has type `genesis` and its `author` is 64 hex characters. Nothing else about entry 0 matters for this: a first entry with a wrong hash, a bad signature or a bad body is reported once, as its own error, and does not also make every checkpoint `CP_WRONG_OPERATOR`. A log whose entry 0 is not a `genesis` has no operator.

### 5.1 Saving and comparing checkpoints

A checkpoint is useful to others only as a file they keep. Two operations are defined on checkpoint files, and both verifiers provide them:

- **Save.** Take one checkpoint out of a log as a standalone file: exactly the five keys of section 5, nothing else. It is the last checkpoint in the log's `checkpoints` list unless the caller names another by its position (counted from 0); a log with no checkpoints, or a position that does not exist, saves nothing. A program may do this only for a log with no integrity errors, so that a corrupted log never produces a "saved" checkpoint. Rule errors do not stop it, because they say nothing about whether the checkpoint is intact.
- **Compare.** Check two saved checkpoints against each other with no log at all. A file that is not valid JSON is `CMP_BAD_FORMAT` for that checkpoint (section 1). A checkpoint with a format error is not looked at further, but the other one still is. Each compare error is an object with `code` and `where` only; unlike the errors of section 6, it has no `index`. The errors, in order, are `CMP_BAD_FORMAT` (`where` is `a` or `b`; per checkpoint), `CMP_DIFFERENT_OPERATOR` (`where` is `both`; only when both are well formed), `CMP_BAD_SIG` (per well-formed checkpoint; checked even when the operators differ, each against the operator named in its own checkpoint). If there are none, the checkpoints have a **relation**: `identical` (same size and root), `different-size` (the two cover logs of different lengths, so they cannot be compared without the log), or `conflict` (same size, different roots; reported as `CMP_CONFLICT`, `where` `both`). A `conflict` between two validly signed checkpoints is proof that the operator signed two different histories of the same length. The output is JSON with `ok` (true only when there are no errors), `errors`, `relation` (null when a format, operator or signature error stops the comparison) and `operator` (null in the same case).

Comparing different sizes needs the log: check the log against the older checkpoint with `--trusted` (section 6).

## 6. Checks, in order

The verifier reports errors as `{code, where, index}`. It does not stop at the first error. `where` and `index` say where: for an error about an entry (integrity or rule), `where` is `entry` and `index` is the entry's position in the file; for a problem with the file as a whole (`BAD_FORMAT`, section 1), `where` is `log` and `index` is 0; for a checkpoint of the log, `where` is `checkpoint` and `index` its position in the `checkpoints` list; for the trusted checkpoint, `where` is `trusted` and `index` is 0. Two kinds:

**Integrity errors** (is this the log that was written?). For each entry in order:

1. `BAD_FORMAT`: the entry or its record breaks the shape of section 3 or the shape of the record in section 4 (the keys, the types, the lengths of the hex strings, `time >= 0`, `body` being an object, `type` being a string), or contains something not allowed by section 2. The body's shape for the record's type is not part of this: that is `BAD_BODY` in the rule checks below, so a record with a `type` that is not in the table of section 4 is `BAD_BODY`, not `BAD_FORMAT`. The entry's remaining integrity checks are skipped, and its recomputed hash is treated as 64 zeros.
2. `BAD_INDEX`: `index` is not the position.
3. `BAD_PREV`: `prev` does not match section 3.
4. `BAD_HASH`: stored `hash` differs from the recomputed one.
5. `BAD_SIG`: the record signature does not verify under section 4.2 (an invalid key or signature counts as failing).

Then for each checkpoint, in order (`where` is `checkpoint`, `index` is its position in the list):

1. `CP_BAD_FORMAT`: stops the checks for that checkpoint.
2. `CP_WRONG_OPERATOR`: `operator` is not the log's operator (or the log has none).
3. `CP_BAD_SIG`.
4. `CP_BAD_SIZE`: `size` is below 1 or above the number of entries. Stops the checks for that checkpoint.
5. `CP_BAD_ROOT`: `root` differs from the root recomputed over the first `size` recomputed entry hashes.

**Trusted checkpoint** (optional, `where` is `trusted`, `index` 0): a checkpoint you saved earlier, passed separately. Its errors are listed with the integrity errors, after those of the log's own checkpoints. If the log's file is itself `BAD_FORMAT` (section 1), verification stops before the trusted checkpoint is looked at. Checks: `TRUSTED_BAD_FORMAT` (stops), `TRUSTED_WRONG_OPERATOR`, `TRUSTED_BAD_SIG`, `TRUSTED_TRUNCATED` (size is below 1 or above the number of entries; stops), `TRUSTED_MISMATCH` (root differs). This is the only check that can expose a log the operator has rewritten and re-signed from the start.

**Rule errors** (did the people and the operator follow the rules?). Entries that have any integrity error are skipped. For each remaining entry in order:

1. `TIME_REVERSED`: the entry just before this one in the file (even one that is skipped for an integrity error) has a `time` that is an integer, and this entry's `time` is smaller. Equal times are fine. The check goes on.
2. Entry 0 must be `genesis`, otherwise `NO_GENESIS`. A `genesis` anywhere else is `DUPLICATE_GENESIS` and the entry is done. Entry 0's genesis sets the settings and makes its author the operator. (The checks go on from here, except where a step says it ends the entry.)
3. `BAD_BODY`: the body does not match section 4. The entry is done.
4. Nothing else is checked until a genesis has set the settings.
5. `register_key`: `SELF_REGISTER_MISMATCH` if `public_key` is not the author; `DUPLICATE_KEY` if already registered (the operator counts as registered, so the operator registering its own key is `DUPLICATE_KEY`); `BAD_LABEL` if the label does not start with `test-`. Each ends the entry. Otherwise the key is registered.
6. Every other type: `UNREGISTERED_AUTHOR` if the author key is not registered (the operator counts as registered). Ends the entry.
7. `propose` creates a proposal (its id is from section 4) with one version and no signatures.
8. `amend`, `sign`, `comment`: `UNKNOWN_PROPOSAL` if the id is unknown; then `PROPOSAL_CLOSED` if the proposal is closed at this entry's time (below). Each ends the entry.
9. `amend`: `NOT_PROPOSER` unless the author proposed it. Otherwise adds a version and **clears all signatures**.
10. `sign`: `STALE_VERSION` unless `version` is the current version, and that ends the entry (so a signature that is both stale and a repeat is reported as `STALE_VERSION` only). Then `DUPLICATE_SIGNATURE` if this author already signed the current version, which ends the entry. Otherwise records the signature. When the count of signatures reaches the threshold, this entry's `time` becomes the threshold time.

**States.** For a proposal at a time `t`: **collecting** while the signatures on the current version are fewer than the threshold; **comment** from the threshold time until `threshold time + comment_seconds` (not including that moment); **closed** from then on. Comments are allowed while collecting or in comment; amendments in the same states.

## 7. Output

Both verifiers print the same JSON (key order and spacing do not matter): `ok` (true only when there are no errors), `integrity_errors`, `rule_errors`, and `summary` (null when there is no usable genesis: entry 0 has no integrity error, is a `genesis` and has a body that matches section 4), which holds `entries` (the number of entries in the file, including any with integrity errors), `registered` (the number of keys registered, not counting the operator), `comments` (the number of valid comments), and `proposals` in log order with `id`, `title` (current), `versions` (the number of versions), `version` (current version hash), `signatures` (the number on the current version) and `state` (`collecting`, `comment` or `closed`). Every count is an integer. States in the summary are judged at the `time` of the last entry that passed the integrity checks. Errors are listed integrity first, in the order above. Both programs exit with 0 when `ok` is true and 1 when it is false. A file they cannot read at all (missing, or not allowed to be opened) is not a result: they print a message on standard error, print no JSON and exit with 2, and so does a command line they do not understand. An empty log (`entries` is `[]`) has no integrity or rule errors, so it passes with a `summary` of null; whether it should is section 9, question 7.

## 8. What this does not do

- It does not check that a real, unique person holds a key. Identities are test labels that anyone can recompute from the label. See [phase-3-plan.md](../docs/phase-3-plan.md).
- It does not run an operator, a network or any consensus. One operator signs the checkpoints.
- A hash chain alone cannot expose an operator who rewrites the whole log. Only a checkpoint saved earlier by someone else can (`TRUSTED_MISMATCH`). A rewrite that changes an early entry also tends to break later records, because proposal ids depend on position, but the operator cannot re-sign other people's records, so what is left to rewrite is the tail.
- A watcher who saved a checkpoint can only detect changes inside the part of the log that checkpoint covers. Two watchers can compare their checkpoints (section 5.1) but only a `conflict` at the same size proves anything; a checkpoint nobody else holds proves nothing to anyone else.

## 9. Open questions

1. Is clearing signatures on every amendment the right rule? It protects people from having their signature attached to text they did not see, but it makes any amendment restart the count.
2. `time` is set by the operator and trusted for ordering and for the comment period. Who checks it?
3. Should a signer be able to withdraw?
4. What should happen at the exact moment a comment period ends? (Section 6 answers it: the proposal is closed at that moment. The question stays so that a reviewer can say if they would draw the line the other way.)
5. Section 4.2 rule 5 requires the key and `R` to lie in the prime-order subgroup, because libraries that check the equation with the cofactor cannot otherwise follow rule 4 (evidence in [`vectors/other-libraries/`](vectors/other-libraries/README.md)). Is the cost acceptable (one multiplication by L per new key and per signature, cacheable), and does any real use of the log need a key or `R` that the rule refuses?
6. Two keys with the same name in one JSON object. Section 2 wants every JSON parser to see the same value, but most parsers (including the two in this repository) quietly keep the last one, and the check for "exactly those keys" cannot see the repeat. The two programs therefore accept such a file, and a verifier that rejects it (as a stricter reading of section 1 would) disagrees with them. Should a repeated key be `BAD_FORMAT`? That needs a parser that can see it, in every language.
7. Should an empty log (no entries, no checkpoints) pass? Today it does, with a `summary` of null, because the rules of section 6 only fire on entries (a log with no entry 0 has no `NO_GENESIS`). A checkpoint in an empty log gets `CP_WRONG_OPERATOR` (there is no operator) and `CP_BAD_SIZE`.
