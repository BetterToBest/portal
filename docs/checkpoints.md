# Keeping checkpoints: who saves them, where, and what that proves (draft v0.1)

Status: **draft for review.** This is the design for gate G2 of the [Phase 3 test plan](phase-3-test-plan.md): "a log rebuilt and re-signed by its operator is exposed by a checkpoint saved earlier." It describes a process and the small commands in [prototype/](../prototype/) that support it. CIP is a research proposal, not a live voting system, and every design here is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html). The numbers are placeholders. Nothing is decided until reviewers agree, and no dates are promised.

Nothing here collects or monetizes user behavior data. A watcher who keeps checkpoints needs no account, no identity and no personal details, and a checkpoint contains none: it is a size, a fingerprint of the log and a signature (see [SPEC.md](../prototype/SPEC.md) section 5).

## The problem in one paragraph

The log links every entry to the one before it, so a change to one entry is easy to see. But the **operator**, who adds the entries, could throw the whole log away and rebuild a different one, signing everything again from the start. Checked by itself, the new log looks perfectly healthy. The only thing that can expose it is a fingerprint of the old log that someone else saved earlier. That fingerprint is a **checkpoint**. A checkpoint nobody else holds proves nothing to anyone else, so the design question is who keeps them and how they are compared.

## What a checkpoint is

A signed statement by the operator: "the first `size` entries of my log have this fingerprint (`root`)." It is five fields in one small JSON file ([SPEC.md](../prototype/SPEC.md) section 5). Anyone can check the operator's signature and, with the log in hand, recompute the fingerprint.

## The proposed process

1. **The operator publishes a checkpoint regularly.** For example after every 50 new entries or once a day, whichever comes first. Both numbers are placeholders. Publishing means putting the file somewhere the operator cannot quietly change after the fact, ideally more than one place (the repository, a mirror, a public post).
2. **Watchers keep every checkpoint they see.** A watcher is anyone: a volunteer, a journalist, a researcher, a participant. A watcher can be pseudonymous. Keeping a checkpoint means saving the file, not trusting it. Name files by size (`checkpoint-0120.json`) so the newest is easy to find.
3. **Watchers check new logs against the latest checkpoint they hold.** `verify <log> --trusted <checkpoint>` (see below). A log that does not contain the history the checkpoint committed to fails.
4. **Watchers compare notes.** Two watchers who hold checkpoints of the same size compare them with `compare`. Different fingerprints at the same size, both validly signed, are proof that the operator signed two different histories. This is the "split view" attack: telling different audiences different stories. Comparing needs no log and no trust in anyone, only the two files.
5. **A failure is published as evidence.** The evidence is just files: the two checkpoints, or the old checkpoint plus the log that fails against it. Anyone can re-run the commands.

### How many keepers, and where?

A starting proposal, for review: **at least three watchers who do not know each other, holding checkpoints from at least two different publication places,** before G2 can be called met for a real run. Three is a proposal, not a derived number. One watcher can be silenced or fooled; several independent ones are much harder to fool all at once. The test plan's open question 3 asks reviewers whether this is the right bar.

## Try it

You need Node 18 or later (Python 3 with `pip install cryptography` for the second program). Run from the repository root. These are test logs, not real data.

Save a checkpoint from a log (the last one in the log, or `--index N` for a different one). The log is checked first: if it has integrity errors, nothing is saved.

```
node prototype/node/cip-log.js checkpoint prototype/testdata/good.json --out my-checkpoint.json
python3 prototype/python/verify.py checkpoint prototype/testdata/good.json --out my-checkpoint.json
```

Check a log against a checkpoint you saved earlier:

```
node prototype/node/cip-log.js verify prototype/testdata/rewritten-history.json --trusted prototype/testdata/good.checkpoint-21.json
```

This fails with `TRUSTED_MISMATCH`: the log passes every check by itself, but it is not the history the saved checkpoint committed to. The same command on `truncated.json` fails with `TRUSTED_TRUNCATED`: the log has been cut back to fewer entries than the checkpoint covered.

Compare two checkpoints of the same size, without any log:

```
node prototype/node/cip-log.js compare prototype/testdata/good.checkpoint-21.json prototype/testdata/split-view.checkpoint-21.json
```

This reports `CMP_CONFLICT`: two validly signed checkpoints of the same size with different fingerprints. Comparing a checkpoint with itself reports `identical`, and two checkpoints of different sizes report `different-size`, which means "cannot tell from these two alone; check the longer log against the shorter checkpoint with `verify --trusted`."

The two programs give the same results. [`tests/prototype.test.js`](../tests/prototype.test.js) checks that for saving a checkpoint on every test log and on 600 randomly edited logs, and for comparing on a set of good and bad pairs.

## What each action catches

| What the operator does | What exposes it |
|---|---|
| Changes, deletes or reorders an entry | The log's own checks (`verify`), with no checkpoint needed. |
| Rebuilds and re-signs the whole log, or cuts it back | A checkpoint saved earlier, with `verify --trusted`. |
| Shows two audiences different histories of the same length | Two watchers comparing checkpoints with `compare`. |
| Rewrites only entries added after the newest checkpoint | Nothing yet. That part of the log is covered by no checkpoint. It becomes covered when the next checkpoint is published and kept. |
| Stops publishing checkpoints | Watchers noticing the gap. Nothing in the software forces it. |

## What this does not solve

- **A checkpoint covers only the log up to its size.** Anything after it can be rewritten until a later checkpoint is kept. The shorter the gap between checkpoints, the smaller that window, and the more often watchers must look.
- **A watcher is only as good as what they were shown.** A checkpoint saved from a log the operator served only to that watcher is evidence of what the operator showed that watcher. That is why watchers compare with each other.
- **Watchers must actually look.** The commands make it cheap. They cannot make anyone run them. Nothing here automates watching, and an automated, always-on watcher is an obvious thing to build later, not part of this draft.
- **If every watcher is fooled or silent, nothing is exposed.** More independent watchers lower this risk. They do not remove it.
- **No witnesses yet.** Some logs elsewhere let independent parties co-sign checkpoints so a split view is caught before anyone has to compare by hand. That is an option to consider for a later phase. It is not built or designed here.
- **Time is the operator's word.** The `time` in a checkpoint is set by the operator ([SPEC.md](../prototype/SPEC.md) open question 2).
- **Test identities are not secret.** Anyone can recompute the operator's key in the test data. These tests show that the commands and checks work, not that a real operator would be safe.

## Open questions

1. Is "three watchers, two places" the right bar for G2, or too low or too high for a small advisory test?
2. How often should checkpoints be published: by number of entries, by time, or both? What is a gap small enough to accept?
3. Where should the operator publish, given a pseudonymous project with few contributors? What counts as a place the operator cannot quietly change?
4. How should evidence of a conflict be published so a stranger can check it in minutes? A fixed file layout, a standard issue template, or something else?
5. Should the next step be a small always-on watcher program, witness co-signing, or neither before Phase 4?

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
