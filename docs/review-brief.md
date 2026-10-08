# Brief for outside reviewers: a third verifier and a security review (draft v0.1)

Status: **draft for review.** This is the plan for gates G1 and G8 of the [Phase 3 test plan](phase-3-test-plan.md). G1 asks for a verifier written by someone other than the main author. G8 asks for an independent review of the threat model and the cryptography. Neither can be met by the people who wrote the work. This page says what an outside person would be asked to do, what they get, and what happens to what they find. CIP is a research proposal, not a live voting system, and nothing here is decided until reviewers agree. No dates are promised and no funding is assumed.

Nothing here collects or monetizes user behavior data. A review needs no account, no personal details and nothing run on your own accounts or devices beyond the commands below.

## Why we are asking

- The two verifiers in [`prototype/`](../prototype/) were written by one person from one document. That catches slips, not a shared misreading of the spec.
- The threat model and every design draft were written by a small project with no outside review so far.
- The public site credits the authors as one independent researcher, publishing under a pseudonym, and an AI model. That is a reason to check the work carefully, not to trust it.

Nothing is live. Everything is files, programs that read files, and a static site, so there is nothing to attack and nothing to break. Findings may be public.

## Two jobs, which can be done separately

### Job A: write a third verifier (gate G1)

**The task.** Write a program that checks a CIP test log, using only [`prototype/SPEC.md`](../prototype/SPEC.md), in any language you like.

**Please do this first pass without reading the existing verifiers** (`prototype/node/cip-log.js` and `prototype/python/verify.py`). The value is that you read the spec cold. If you have already read them, say so in your report.

**What it must do.** Read a log file, and print the JSON result described in SPEC section 7: `ok`, `integrity_errors`, `rule_errors` and `summary`. For a log checked against an earlier saved checkpoint, the optional trusted checkpoint (SPEC section 6) is passed separately. Checking, in order, covers the file format, canonical form, entries, records, checkpoints and the rule checks in SPEC sections 1 to 6.

**What it is checked against.** There are 20 test logs in [`prototype/testdata/`](../prototype/testdata/). Three are valid and 17 are broken on purpose. Two more files there are saved checkpoints, used with `--trusted` for `rewritten-history.json` and `truncated.json`. The full expected output for every log, as plain JSON, is in [`prototype/answer-key/expected.json`](../prototype/answer-key/expected.json): 23 cases (the 20 logs, and the two saved-checkpoint logs again without a checkpoint), each with the command's exit code. You can compare your verifier with that one file and run no program from this repository. A test fails if the file and the reference programs drift apart, and the file is also checked against the hand-written table of `ok` values and error codes in section 3 of [`tests/prototype.test.js`](../tests/prototype.test.js). Neither holds any verifier logic.

**What "agree" means.** Your output and the reference output parse to the same JSON value. Key order does not matter. The answer key below is that reference output, saved. The reference output is what this prints:

```
node prototype/node/cip-log.js verify prototype/testdata/good.json
node prototype/node/cip-log.js verify prototype/testdata/rewritten-history.json --trusted prototype/testdata/good.checkpoint-21.json
```

**Also check the odd cases.** [`prototype/vectors/ed25519-odd-cases.json`](../prototype/vectors/ed25519-odd-cases.json) holds 40 public key, message and signature cases that Ed25519 libraries can treat differently, each with the result [SPEC section 4.2](../prototype/SPEC.md) requires. A verifier that passes the 20 logs but gives a different result on any of these cases has not followed 4.2. If your library gives a different result and you think the spec is wrong, say so: that is a Job B finding too.

**Then go further.** Make your own edits to `good.json` (change a value, remove an entry, swap two, repeat one, add whitespace around a hex value, use odd Unicode) and compare your verifier with both existing ones. The project's own tests do 600 random single edits and 750 whitespace cases ([`tests/prototype.test.js`](../tests/prototype.test.js)). Yours are worth more because they come from a different mind.

**The most useful result is not a green run.** For each place where your output differs from the reference, say which it is:

1. a bug in your program,
2. a bug in a reference program, or
3. a place where the spec is unclear, silent or wrong.

Kind 3 is what this job exists to find. A spec that two careful readers read differently has not met G1, however many tests pass.

**Optional.** If you want, offer your verifier as a pull request under `prototype/<language>/`, with a line in the test that runs it. Code contributions are under the [Apache License 2.0](../LICENSE), as in [CONTRIBUTING.md](../CONTRIBUTING.md). Nothing requires it: a written report of differences and unclear spots is a complete contribution.

### Job B: review the threat model and the cryptography (gate G8)

**Scope, in order of how much we want it:**

1. **The threat model** ([`threat-model.md`](threat-model.md), issue #8): threats that are missing, mitigations that do not hold, claims that go beyond the paper, and anything in the "Inconsistencies in the paper" section that you read differently.
2. **The prototype's cryptography**, as written in [`SPEC.md`](../prototype/SPEC.md) and as done in the code: the canonical form (a subset of RFC 8785), the entry hash and chain, Ed25519 signatures (RFC 8032), the checkpoint Merkle tree (RFC 6962 section 2.1), the checkpoint rules, and the way a rewritten log is caught only by a checkpoint saved earlier ([`checkpoints.md`](checkpoints.md)).
3. **The five design drafts**, which are written proposals and not code: [`checkpoints.md`](checkpoints.md), [`key-handling.md`](key-handling.md), [`identity-linking.md`](identity-linking.md), [`pilot-design.md`](pilot-design.md) and [`advisory-notice.md`](advisory-notice.md). Look for options that fail, rules that conflict, and threats a table does not cover.

**Questions we cannot answer ourselves.**

- Both programs delegate Ed25519 verification to a library: Node's own `crypto` module, and Python's `cryptography` package. We tried 40 odd cases ourselves (signatures that are not in the canonical form, keys that are not canonical, keys of small order, a signature with an extra order-8 component), on Node, Python and headless Chromium. All three gave identical answers, which means the libraries do not disagree with each other here. They do disagree with a strict reading of RFC 8032: all three accept 13 cases it would refuse, all of them non-canonical or small-order public keys. [SPEC section 4.2](../prototype/SPEC.md) now says what a verifier must do, and both programs and the viewer apply it. We then ran the same 40 cases through seven libraries outside OpenSSL and BoringSSL (libsodium in two forms, tweetnacl, @noble/curves, @noble/ed25519, elliptic and PyCryptodome; results and how to rerun them are in [`prototype/vectors/other-libraries/`](../prototype/vectors/other-libraries/README.md)). Only libsodium agrees with 4.2 on all 40 on its own; the rest accept cases 4.2 refuses, and the libraries that use the cofactored equation cannot follow rule 4 even with a key filter. A prime-order-subgroup check in front of any of them makes all nine variants agree (SPEC section 9, question 5, still open). What we have not done: tried the libraries in Firefox, Safari, Go, Rust, Java or .NET. Is 4.2 the right rule, should it also require the subgroup check, and is anything missing from the 40 cases?
- Is the canonical form precise enough that two independent programs always write the same bytes, including for strange Unicode and for numbers near the safe-integer limit?
- Does the split-view check in [`checkpoints.md`](checkpoints.md) prove what it says it proves, and no more?
- Does anything in the prototype leak, store or send data that it should not? The project's tripwire test is coarse and, as the README says, does not prove the absence of anything.
- What would you want to see before trusting a design for [`key-handling.md`](key-handling.md) or [`identity-linking.md`](identity-linking.md)?

**Out of scope.** The paper's economics, the legal questions about the Judicial Guard, funding, and any real election. There is no system to test against, and please do not scan or probe anyone's servers on this project's behalf.

## What you get

| Thing | Where |
|---|---|
| The written rules | [`prototype/SPEC.md`](../prototype/SPEC.md) |
| 20 test logs and 2 saved checkpoints | [`prototype/testdata/`](../prototype/testdata/) |
| The answer key: expected output for every test log, 23 cases | [`prototype/answer-key/expected.json`](../prototype/answer-key/expected.json) |
| 40 odd key and signature cases, with required results | [`prototype/vectors/ed25519-odd-cases.json`](../prototype/vectors/ed25519-odd-cases.json) |
| The format as a JSON Schema, with 15 examples that pass and 42 that fail, each with the reason | [`prototype/schema/`](../prototype/schema/) |
| The gate table and what counts as met | [`phase-3-test-plan.md`](phase-3-test-plan.md) |
| What the prototype does not do | [`prototype/README.md`](../prototype/README.md), "Limits you should know about" |
| Reference programs, for comparing after your first pass | `prototype/node/cip-log.js`, `prototype/python/verify.py` |

To run the project's own tests you need Node 18 or later, and Python 3 with `pip install cryptography`:

```
node tests/prototype.test.js
```

## What we need from you, and what we do not

We do not need your name, your employer, your qualifications or any personal detail. The project is pseudonymous and keeps personal details off public pages, and a reviewer may do the same.

We do need your report to say enough for a reader to judge it:

- **What you reviewed**: which job, which files, and the commit hash you worked from.
- **Whether you wrote any of it**: a plain line that you did not write any part of the code or documents under review.
- **What you read first**: for Job A, whether you read the existing verifiers before your first pass.
- **How you wish to be shown**: a name, a handle, an organization, or nothing.

The project cannot check who anyone is. The test plan asks who counts as independent for G1 and G8 (its open question 2) and that is not settled. Until it is, each report is published labeled with what the reviewer chose to say about themselves, and the label is part of the evidence. A reader can weigh a named reviewer with a public record differently from an anonymous one.

## How findings are reported and published

- **Where.** A public issue in the repository, or a comment on the existing issue (#8 for the threat model). Because nothing is live, public is the default. Whether to offer a private route for a serious finding is an open question below.
- **What to include.** What you looked at (the commit), what you found, how to reproduce it (a command or a file, where possible), how serious you think it is and why, and a fix if you have one.
- **What the project does.** Every finding gets a public status: **fixed** (with the commit), **accepted as a limitation** (with the reason, which is the route the test plan's open question 4 asks about), or **disputed** (with the reasoning, so you can reply). Findings are not deleted. The only thing removed from a published finding is a private detail about a person.
- **Credit.** As you choose: a name, a handle, or none. No deadline is promised for a response, and no payment is offered. The project has no money, and says so.

## What a review does and does not do

A review is evidence about one commit. It is not a certification, and it does not make CIP safe at national scale. A gate that was met on an earlier commit is checked again if the code it covers changes (test plan, "What a run must publish"). A reviewer who finds nothing has found nothing in what they read, and the report should say what that was.

## What would count as meeting G1 and G8 (a proposal)

**G1.** At least three verifiers, at least one by someone who did not write the other two and who read the spec cold. They agree on all 20 shared test logs and on a large set of edited logs that includes edits the third author made. Every difference found is closed either by fixing a program or by changing the spec in public, with the spec change recorded.

**G8.** A written review of the threat model and of the cryptography by someone independent, on a named commit, with every finding carrying a public status as above, and with the questions in Job B answered or marked as accepted limitations with reasons. The review's label says what the reviewer chose to say about themselves.

Both, like every gate, need public evidence: the commit, the date, who did it, the command or procedure, and the result.

## Open questions

1. Who counts as independent for G1 and G8, given a pseudonymous project with few contributors and reviewers who may also be pseudonymous?
2. Should there be a private route for a serious finding? GitHub's private vulnerability reporting is one option the maintainer can turn on. Is it worth having when nothing is live?
3. The answer key is now one file ([`prototype/answer-key/expected.json`](../prototype/answer-key/expected.json)). It was produced by the Node program, so it can repeat a mistake the Node program makes; the test checks it against the Python program, the command lines and a hand-written table, but a reviewer who disagrees with an entry is exactly the evidence G1 wants. Is the file easy enough to use, and is anything else missing from it (for example the expected result of the 600 random edits)?
4. How many outside reviewers are enough for G8, and does the answer change because the code was written with an AI model's help?
5. SPEC section 4.2 refuses non-canonical and small-order public keys, which common libraries accept. Is that the right rule, or should the spec accept whatever the libraries accept and list the cases as known differences? Should it go further and require keys in the prime-order subgroup?
6. How are reviewers thanked and credited when the project has no money and some reviewers want no public mention?

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
