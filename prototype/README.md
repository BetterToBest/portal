# CIP prototype (Phase 3, early)

A small, runnable piece of the [Phase 3 plan](../docs/phase-3-plan.md): a tamper-evident log for proposals, signatures, comments and amendments, with two programs that check it. It follows the proposal flow in paper §4.4.1.

**This is a research prototype on test data. It is not a voting system, and CIP is not live.** There are no real identities, no ballots, no network and no operator other than the one in the test files. Every rule and number is a proposal for review.

Nothing here collects or monetizes user behavior data. The programs read the files you give them and print a result. They make no network connections and store nothing (the one exception is the checkpoint command, which writes a file only when you pass `--out`), and a test fails the build if network code or tracking code appears in this folder.

## What is here

| Path | What it is |
|---|---|
| [`SPEC.md`](SPEC.md) | The written rules: file format, canonical form, checks, states. Both verifiers are written from this. |
| `node/cip-log.js` | Reference implementation: builds records, entries and checkpoints, and verifies a log. Built-in Node modules only. |
| `node/make-test-logs.js` | Builds every test log from fixed test identities and fixed times, so the files never change between runs. |
| `python/verify.py` | A second verifier, written from the spec. Needs the `cryptography` package. |
| `checkpoint` and `compare` commands | In both programs: save one checkpoint from a log as its own file, and compare two saved checkpoints with no log. See [checkpoints.md](../docs/checkpoints.md) and SPEC section 5.1. |
| `viewer/index.html` | A single page that checks a log in your browser and shows proposals, signatures and anything that failed, in plain words. It makes no network requests and stores nothing, and the browser is told to block them. Its example logs are copied in by `node/build-viewer.js`. |
| `node/build-viewer.js` | Copies the example logs from `testdata/` into the viewer page, or with `--check` tells you if the page is out of date. |
| `testdata/` | One good log, two saved checkpoints (one from a different history of the same length), two more valid logs, and 17 logs that are corrupted or break a rule on purpose. |
| `schema/cip-test-log.schema.json` | The format of the log, its entries, records and checkpoints as a JSON Schema (draft 2020-12). Shape only: it cannot check hashes, signatures or rules. See SPEC section 4.1. |
| `schema/examples/` | 15 examples that pass and 42 that fail the schema, each failing for one stated reason (`expected-errors.json`). Built by `node/make-schema-examples.js`. |
| `node/schema-check.js` | A small checker for the schema: `node prototype/node/schema-check.js <file.json> [--def record]`. It implements only the parts of JSON Schema the schema uses and refuses the rest. |
| [`../tests/prototype.test.js`](../tests/prototype.test.js) | Runs every test log through both verifiers and checks they agree. Also tries 600 random single edits (changed values, wrong types, removed, swapped or repeated entries) and 750 logs with whitespace around one hex value, which must all be rejected. The same logs and edits are run through the viewer page's logic, and through the schema, which must agree with the verifiers' format checks (and with Python's `jsonschema` package, when installed). |

## Try it

You need Node 18 or later. For the Python verifier you also need Python 3 and `pip install cryptography`.

```
node prototype/node/cip-log.js verify prototype/testdata/good.json
python3 prototype/python/verify.py prototype/testdata/good.json

node prototype/node/cip-log.js verify prototype/testdata/tamper-text.json
node prototype/node/cip-log.js verify prototype/testdata/rewritten-history.json --trusted prototype/testdata/good.checkpoint-21.json

node prototype/node/schema-check.js prototype/testdata/good.json
node prototype/node/schema-check.js prototype/schema/examples/invalid/record-genesis-threshold-zero.json --def record

node prototype/node/cip-log.js checkpoint prototype/testdata/good.json --out my-checkpoint.json
node prototype/node/cip-log.js compare prototype/testdata/good.checkpoint-21.json prototype/testdata/split-view.checkpoint-21.json

node tests/prototype.test.js
```

Or open the [log viewer](https://bettertobest.github.io/portal/prototype/viewer/), pick an example or choose a log file, and read the result. It needs a recent Chrome, Firefox or Safari, because it uses the browser's own Ed25519 support.

Each command prints the result as JSON and exits with 0 if the log passes, 1 if not.

## What the test logs show

- **`good.json`**: three proposals in three states (closed, still collecting signatures, in its comment period), one of them amended once.
- **`tamper-text.json`, `delete-entry.json`, `reorder.json`, `forged-sig.json`, `tamper-time.json`, `bad-format.json`, `bad-checkpoint.json`**: edits made without the operator's help. Each is caught.
- **`rewritten-history.json` and `truncated.json`**: the operator rebuilds the log from the start and signs new checkpoints. The log passes every check on its own. It fails only against `good.checkpoint-21.json`, a checkpoint saved before the change. This is why checkpoints are meant to be copied and kept by other people.
- **`rule-*.json`**: every record is signed and chained correctly, but a rule is broken: a signature after the comment period, an unregistered author, a duplicate or stale signature, an amendment by someone who did not propose, a label without `test-`, time running backwards, a comment on a proposal that does not exist. (`rule-ok-new-signer.json` is the one valid log among them: a new person signs a proposal.)
- **`split-view.checkpoint-21.json`**: a checkpoint of the same size as `good.checkpoint-21.json` but from a log where one comment differs. Both are validly signed, so comparing them proves the operator signed two histories.
- **`unicode.json`**: odd characters (control characters, line separators, emoji) that both verifiers must write in the same canonical form.

## Limits you should know about

- **Test identities are not secret.** A key is derived from its label (`test-alice`), so anyone can recompute it. That is deliberate, so no one mistakes this for a live system. Never reuse the method for real keys.
- **A signature here does not show that a real, unique person signed.** Checking identity is outside this prototype.
- **Same author, same spec.** Both verifiers were written by the same person from the same document. That catches slips, not a shared misreading. A third verifier written by someone else from [`SPEC.md`](SPEC.md) alone would be the real test, and is welcome.
- **One operator.** The log has one operator who adds entries and signs checkpoints. There is no network and no consensus. The questions about colluding operators and guardians are in the [fork simulator](https://bettertobest.github.io/portal/simulator/fork/) and [halt-power.md](../docs/halt-power.md).
- **A watcher who saved a checkpoint can only detect changes inside the part of the log it covered.** Who should keep checkpoints, and how many, is a proposal in [checkpoints.md](../docs/checkpoints.md), not something the software enforces.
- **The no-network test is a coarse tripwire.** It looks for obvious network and tracking code. It does not prove the absence of anything.

## Ways to help

- Check the schema with a validator you trust (for example Ajv, or Python's `jsonschema`) against the examples in `schema/examples/`, and tell us if one disagrees. It was checked with both of those here, but a second pair of eyes is the point.
- Write a third verifier from `SPEC.md` in a language you like, and check that it agrees with the test logs. The [review brief](../docs/review-brief.md) says how to do it so that it counts as an independent check.
- Find a case where the two verifiers disagree, or where the spec is unclear.
- Review the rules in `SPEC.md` and the open questions at the end of it and in the [plan](../docs/phase-3-plan.md).

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
