# Test log format and verification rules (draft v0.1)

Status: **draft for review.** This is the written definition of the test log in `prototype/`. It is the contract that the two verifiers (`node/cip-log.js` and `python/verify.py`) are both written from. It covers the proposal flow of paper §4.4.1 on **test data only**. CIP is a research proposal, not a live voting system; every design here is a proposal. The numbers are placeholders.

## 1. The file

One JSON file:

```json
{ "format": "cip-test-log/0", "entries": [ ... ], "checkpoints": [ ... ] }
```

Exactly those three keys. Anything else is `BAD_FORMAT` (location `log`) and verification stops.

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

[`schema/cip-test-log.schema.json`](schema/cip-test-log.schema.json) (JSON Schema draft 2020-12) describes the **shape** of everything in sections 1 to 5: which keys, which types, which lengths, which hex strings. A log passes the schema exactly when every entry, record body and checkpoint has the right shape under sections 1 to 5, which is what the verifiers' `BAD_FORMAT`, `BAD_BODY` and `CP_BAD_FORMAT` checks look at (the tests compare the two on every test log and every edited log). The schema cannot check anything that needs computing or comparing: hashes, signatures, the chain, canonical form beyond the number rule, the `test-` label rule, or any rule of section 6. If the schema and the text of this spec ever disagree, the spec wins and the schema has a bug. Examples that pass and fail, each with the reason, are in [`schema/examples/`](schema/examples/).

### 4.2 Checking a signature and its key

Every signature in a log (a record's `sig`, a checkpoint's `sig`, the `sig` of a trusted checkpoint) is checked the same way. It passes only if all four rules hold. If any one fails, the signature does not verify, and the error is the one named in section 6 for that place (`BAD_SIG`, `CP_BAD_SIG`, `TRUSTED_BAD_SIG` or `CMP_BAD_SIG`); no other error is added for it.

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

4. **The signature equation.** As in RFC 8032 section 5.1.7, **without** the cofactor. `S` (the last 32 bytes, little-endian) must be less than L = 2^252 + 27742317777372353535851937790883648493. `R` (the first 32 bytes) must be the canonical encoding of a point. And `[S]B = R + [k]A`, where `A` is the key and `k` is SHA-512 of `R`, `A` and the message, read little-endian, modulo L. The check with the cofactor (`[8][S]B = [8]R + [8][k]A`) is not allowed: a signature whose `R` carries an order-8 component passes it and fails this one, and honest signers never produce one.

**Why these rules are written down.** RFC 8032 lets implementations differ on exactly these points, so a log that one verifier accepts another may refuse. Rules 1 and 4 are what the common libraries already do. Rules 2 and 3 are not: they accept keys that are not canonical and keys of small order. On Node 22 (OpenSSL 3.5), Python 3.13 with the `cryptography` package (OpenSSL 4.0) and headless Chromium 141 (the browser's own Ed25519), all three gave identical answers on the 40 cases in [`vectors/ed25519-odd-cases.json`](vectors/ed25519-odd-cases.json). All three accepted the same 15 of them, and 13 of those break rule 2 or rule 3. A verifier built on a stricter library would refuse those and so disagree with this prototype about the same log. A small-order key is a key that anyone can sign for, so refusing it costs an honest participant nothing.

With rule 2, a usable key has exactly one spelling, so `DUPLICATE_KEY` (section 6) cannot be dodged by writing the same key two ways.

**The test cases.** [`vectors/ed25519-odd-cases.json`](vectors/ed25519-odd-cases.json) holds 40 cases: a public key, a message and a signature, and the result this section requires (2 must pass, 38 must fail). The results are computed from RFC 8032 arithmetic by [`python/make-ed25519-vectors.py`](python/make-ed25519-vectors.py), not taken from any library, and the same script derives the eight small-order points by arithmetic and checks them against the list above. A verifier that gives a different result on any case has not followed this section.

**What this does not cover.** A key that is a valid point with a small-order component, but is not itself of small order, is not refused by rule 3. The equation in rule 4 decides, and the test cases include one such key that passes and one that fails. Whether to require keys to lie in the prime-order subgroup is open (section 9, question 5).

## 5. Checkpoints

```json
{ "operator": "<64 hex>", "root": "<64 hex>", "size": 12, "time": 1790900400, "sig": "<128 hex>" }
```

Exactly those keys; `size` and `time` are integers. `sig` is by `operator` over the canonical form of `{"operator", "root", "size", "time"}`. `root` is the Merkle tree hash (RFC 6962 section 2.1) of the first `size` entries, where leaf `i` is `SHA-256(0x00 || recomputed entry hash i as 32 bytes)` and an inner node is `SHA-256(0x01 || left || right)`, splitting at the largest power of two smaller than the count. The **operator** is the author of entry 0 when entry 0 is a valid `genesis` record.

### 5.1 Saving and comparing checkpoints

A checkpoint is useful to others only as a file they keep. Two operations are defined on checkpoint files, and both verifiers provide them:

- **Save.** Take one checkpoint out of a log as a standalone file: exactly the five keys of section 5, nothing else. A program may do this only for a log with no integrity errors, so that a corrupted log never produces a "saved" checkpoint. Rule errors do not stop it, because they say nothing about whether the checkpoint is intact.
- **Compare.** Check two saved checkpoints against each other with no log at all. The errors, in order, are `CMP_BAD_FORMAT` (`where` is `a` or `b`; per checkpoint), `CMP_DIFFERENT_OPERATOR` (`where` is `both`), `CMP_BAD_SIG` (per checkpoint). If there are none, the checkpoints have a **relation**: `identical` (same size and root), `different-size` (the two cover logs of different lengths, so they cannot be compared without the log), or `conflict` (same size, different roots; reported as `CMP_CONFLICT`, `where` `both`). A `conflict` between two validly signed checkpoints is proof that the operator signed two different histories of the same length. The output is JSON with `ok` (true only when there are no errors), `errors`, `relation` (null when a format, operator or signature error stops the comparison) and `operator` (null in the same case).

Comparing different sizes needs the log: check the log against the older checkpoint with `--trusted` (section 6).

## 6. Checks, in order

The verifier reports errors as `{code, where, index}`. It does not stop at the first error. Two kinds:

**Integrity errors** (is this the log that was written?). For each entry in order:

1. `BAD_FORMAT`: the entry or its record breaks section 3 or 4, or contains something not allowed by section 2. The entry's remaining integrity checks are skipped, and its recomputed hash is treated as 64 zeros.
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

**Trusted checkpoint** (optional, `where` is `trusted`, `index` 0): a checkpoint you saved earlier, passed separately. Checks: `TRUSTED_BAD_FORMAT` (stops), `TRUSTED_WRONG_OPERATOR`, `TRUSTED_BAD_SIG`, `TRUSTED_TRUNCATED` (size is below 1 or above the number of entries; stops), `TRUSTED_MISMATCH` (root differs). This is the only check that can expose a log the operator has rewritten and re-signed from the start.

**Rule errors** (did the people and the operator follow the rules?). Entries that have any integrity error are skipped. For each remaining entry in order:

1. `TIME_REVERSED`: the previous entry's `time` is an integer and this entry's `time` is smaller. The check goes on.
2. Entry 0 must be `genesis`, otherwise `NO_GENESIS`. A `genesis` anywhere else is `DUPLICATE_GENESIS` and the entry is done. Entry 0's genesis sets the settings and makes its author the operator. (The checks go on from here, except where a step says it ends the entry.)
3. `BAD_BODY`: the body does not match section 4. The entry is done.
4. Nothing else is checked until a genesis has set the settings.
5. `register_key`: `SELF_REGISTER_MISMATCH` if `public_key` is not the author; `DUPLICATE_KEY` if already registered; `BAD_LABEL` if the label does not start with `test-`. Each ends the entry. Otherwise the key is registered.
6. Every other type: `UNREGISTERED_AUTHOR` if the author key is not registered (the operator counts as registered). Ends the entry.
7. `propose` creates a proposal (its id is from section 4) with one version and no signatures.
8. `amend`, `sign`, `comment`: `UNKNOWN_PROPOSAL` if the id is unknown; then `PROPOSAL_CLOSED` if the proposal is closed at this entry's time (below). Each ends the entry.
9. `amend`: `NOT_PROPOSER` unless the author proposed it. Otherwise adds a version and **clears all signatures**.
10. `sign`: `STALE_VERSION` unless `version` is the current version; `DUPLICATE_SIGNATURE` if this author already signed it. Otherwise records the signature. When the count of signatures reaches the threshold, this entry's `time` becomes the threshold time.

**States.** For a proposal at a time `t`: **collecting** while the signatures on the current version are fewer than the threshold; **comment** from the threshold time until `threshold time + comment_seconds` (not including that moment); **closed** from then on. Comments are allowed while collecting or in comment; amendments in the same states.

## 7. Output

Both verifiers print the same JSON: `ok` (true only when there are no errors), `integrity_errors`, `rule_errors`, and `summary` (null when there is no usable genesis), which holds `entries`, `registered` (registered keys, not counting the operator), `comments` (valid comments), and `proposals` in log order with `id`, `title` (current), `versions`, `version` (current version hash), `signatures` (on the current version) and `state`. States in the summary are judged at the `time` of the last entry that passed the integrity checks. Errors are listed integrity first, in the order above.

## 8. What this does not do

- It does not check that a real, unique person holds a key. Identities are test labels that anyone can recompute from the label. See [phase-3-plan.md](../docs/phase-3-plan.md).
- It does not run an operator, a network or any consensus. One operator signs the checkpoints.
- A hash chain alone cannot expose an operator who rewrites the whole log. Only a checkpoint saved earlier by someone else can (`TRUSTED_MISMATCH`). A rewrite that changes an early entry also tends to break later records, because proposal ids depend on position, but the operator cannot re-sign other people's records, so what is left to rewrite is the tail.
- A watcher who saved a checkpoint can only detect changes inside the part of the log that checkpoint covers. Two watchers can compare their checkpoints (section 5.1) but only a `conflict` at the same size proves anything; a checkpoint nobody else holds proves nothing to anyone else.

## 9. Open questions

1. Is clearing signatures on every amendment the right rule? It protects people from having their signature attached to text they did not see, but it makes any amendment restart the count.
2. `time` is set by the operator and trusted for ordering and for the comment period. Who checks it?
3. Should a signer be able to withdraw?
4. What should happen at the exact moment a comment period ends?
5. Section 4.2 refuses small-order keys but accepts a valid key that has a small-order component. Should keys be required to lie in the prime-order subgroup, at the cost of one more scalar multiplication per new key and a check that few libraries offer? Evidence from seven other libraries is in [`vectors/other-libraries/`](vectors/other-libraries/README.md): with that check, the 4.2 key rules and a check that `S` is below the group order in front of any of them, all nine variants tested agree on all 40 cases; without it, the libraries that use the cofactored equation cannot follow rule 4.
