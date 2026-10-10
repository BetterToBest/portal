# Cold-read test of the spec (Oct 2026)

Status: **a result, not a gate.** This is **not gate G1** of the [Phase 3 test plan](phase-3-test-plan.md). An AI helper of the same model family as the one that helped write the project read [`prototype/SPEC.md`](../prototype/SPEC.md) and wrote a verifier from it. That is not an outside person, and it does not replace one. What it does is find places where the spec was unclear before a real reviewer has to. CIP is a research proposal, not a live voting system, and this tests a file format on test data.

## What was done

1. A fresh helper was given **only** `SPEC.md` (as it stood at commit `8744817`) and the 22 files from [`prototype/testdata/`](../prototype/testdata/). It was not shown `cip-log.js`, `verify.py`, the viewer, the answer key or the 41 Ed25519 cases, and was told to choose the most natural reading wherever the spec was unclear, and to log each such choice as it went.
2. It wrote a third verifier in **Rust** (about 1,100 lines, its own Ed25519 point arithmetic, no library verify). The source, its decision log and its outputs are in [`prototype/cold-read/`](../prototype/cold-read/README.md).
3. Afterwards, and not by the helper: its output was compared with the [answer key](../prototype/answer-key/expected.json), its `sigcheck` command was run on the 41 odd cases, and 53 more cases were built to probe each place it had flagged (empty log, byte-order mark, repeated keys, damaged first entry, stale and repeated signatures, half-broken compare pairs). Both reference programs and the Rust one were run on all of them.

## Results

| Test | Result |
|---|---|
| The 41 odd Ed25519 cases (`sigcheck`, SPEC 4.2) | **41 of 41** as required. |
| The answer key (23 cases: 20 logs, with and without a saved checkpoint) | **22 of 23** identical output. The one difference is below (stale and repeated signature). |
| 53 further edge cases, Rust against Node and Python | 33 identical, 14 differ **only in the shape of `index`**, 6 differ in the errors. |
| The helper's own log | 51 places where the spec was unclear, silent, contradictory or hard to implement. |

A reader with only the spec got the same answer on the 41 odd cases and on 22 of the 23 logs. That is a good sign for sections 2 to 5, and it says little about the places the answer key and the 41 cases do not reach, which is where the 53 extra cases came from.

## Where the output differed (the useful part)

Each of these is now written into the spec, with a test in [`tests/prototype.test.js`](../tests/prototype.test.js) (section 3d). Where the helper chose differently from the two programs, the spec was changed to say what the programs do, so that the programs, the answer key and the spec agree.

| # | What was unclear | Helper's reading | The programs did | Now |
|---|---|---|---|---|
| 1 | A signature that is both stale and a repeat (section 6, step 10 did not say that `STALE_VERSION` ends the entry). Found in the answer key itself: `rule-stale-version.json`. | Report both errors | Report `STALE_VERSION` only | Step 10 says it ends the entry. |
| 2 | Who is the operator when entry 0 is damaged (section 5 said "a valid genesis record"). | A damaged entry 0 means no operator, so every checkpoint also gets `CP_WRONG_OPERATOR` | Entry 0 only has to be a `genesis` record with a 64-hex author, so the damage is reported once | Section 5 says so. |
| 3 | `where` and `index` of an error (section 6 only gave them for checkpoints). Log-level `BAD_FORMAT`: `index` null or 0? Compare errors: `index` null or absent? | null; present and null | 0; absent | Section 6 and 5.1 say so. |
| 4 | A file that is not valid JSON, starts with a byte-order mark or is not UTF-8. | `BAD_FORMAT` (or `TRUSTED_BAD_FORMAT`, `CMP_BAD_FORMAT`) | **Both programs crashed with a stack trace.** This was a bug in the programs, not only a gap in the spec. | Section 1 says so; both programs fixed; a missing file now exits 2 with a message. |
| 5 | Two keys with the same name in one object. | Reject as `BAD_FORMAT` | Accept (the JSON parsers keep the last one) | **Not settled.** Section 9, question 6. |
| 6 | Exit codes, key order, whether the summary fields are counts or lists, which previous entry `TIME_REVERSED` looks at, whether the operator registering itself is `DUPLICATE_KEY`, what `BAD_FORMAT` covers against `BAD_BODY` (the two overlapped as written), what "usable genesis" means, which checkpoint Save takes. | Different guesses, mostly the same as the programs by luck | Fixed behavior | Section 1, 5.1, 6 and 7 now say each. |

Number 4 is the one that mattered most: the cold reader's behavior was better than the reference's.

## All 51 places the helper logged

The raw, unedited log is [`prototype/cold-read/DECISIONS.md`](../prototype/cold-read/DECISIONS.md) (D1 to D51). It was written against the spec **before** the changes above, so some entries describe text that has since changed. The status of each, from this review:

- **Spec changed, output had differed or could differ:** D1, D2, D3, D4, D5, D6, D7, D11, D13, D14, D15, D16, D17, D18, D23, D31, D36, D38, D40, D41, D48, D50.
- **Spec wording fixed, no difference seen:** D22 (section 9, question 4 was already answered by section 6), D32, D33, D44 and D45 (what rule 2 and "a canonical point" mean), D51 items 1, 3, 5, 6, 7 and 8 (a list of codes, "40 cases", a stale question, Save, "usable genesis", the "ends the entry" wording).
- **Left open, written as questions in section 9:** D8 (repeated keys, question 6) and D12 (an empty log passes, question 7).
- **Read the same as the programs on the cases tried, so no change:** D9 (numbers such as `2.0`, `1e3`, above 2^53 - 1), D10 (negative `index`, `time`), D20 and D21 (state before the threshold time; an amendment restarts collecting), D26 (an identical amendment), D28, D29, D30 and D47 (checkpoint checks, size 0, negative time, another operator), D35, D42 and D43, D46 (follow-on errors are all reported), D49.
- **Not separately tested:** D19, D24, D25, D27 (covered only by the answer key), D34, D37 (links that point outside the folder it was given), D39 (command line shape, a free choice), D51 items 2, 4, 9 and 10.

## What this does not show

- It is the same model family as the project's other work, on the same project, so a shared misreading is possible. Treat it as a first pass, as the [review brief](review-brief.md) says for any single reader.
- The helper never saw the 41 Ed25519 cases while it worked, so its section 4.2 was written from the text alone. It passed all 41 afterwards, which is a stronger result for 4.2 than for the rest of the spec.
- The spec has since been changed, and the helper has **not** read the new version. Whether the new wording is clear would need a second cold read.
- The Rust verifier is slow (it uses big-integer arithmetic and no caching) and was only run on the test logs (up to 22 entries). It is evidence, not a tool. It is not part of the project's tests, and the tests do not need Rust.
- Choices such as `index` 0 for a file-level error are arbitrary; they were set to match the programs so that nothing else had to change.

## Run it yourself

```
cd prototype/cold-read/rust && cargo build --release
./target/release/cip-verify verify ../../testdata/good.json
./target/release/cip-verify sigcheck <64 hex key> <message> <128 hex signature>
```

`outputs.json` holds what it printed for the files in `prototype/testdata/` when it was written. Needs a Rust toolchain with edition 2024 support and the crates `hex`, `num-bigint`, `num-traits`, `serde_json` and `sha2` from crates.io.
