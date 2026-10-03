# Phase 3 prototype plan (draft v0.1)

Status: **draft for review.** This plans Phase 3 of the [build roadmap](../CONTRIBUTING.md): a prototype of proposals, signatures, comment periods and a tamper-evident log. It is the "large outcome" in the [milestone plan](milestone-plan.md). CIP is a research proposal, not a live voting system, and every design here is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html). Nothing is decided until reviewers agree. No dates are promised.

Nothing in the prototype may collect or monetize user behavior data. That is a core principle of the project, and [data-collection.md](data-collection.md) says what that means in practice.

## What the prototype is for

To let someone who did not write it run the proposal flow from paper §4.4.1 end to end, on test data, and check that the record of what happened cannot be quietly changed. It is a learning and review tool. It is not a product, and no real person's identity, key or vote goes into it.

## What is in scope

The flow in paper §4.4.1, reduced to its smallest checkable form:

1. A proposer files a proposal.
2. People sign it until it reaches the signature threshold.
3. A public comment period runs, with threaded discussion.
4. The proposer may amend it in response.
5. Every step above is written to an append-only log that anyone can verify.

## What is out of scope

- **Ballots and voting.** Verifiable but unlinkable ballots (paper §4.3.1) are Phase 4. The prototype stops where voting would begin.
- **Real identity verification.** The paper links each participant to a verified identity (§4.2.3). The prototype uses clearly labeled test identities and does not claim one person holds one key. This is the largest gap between the prototype and the proposal, and it is stated on every page.
- **A distributed network.** No consensus among many operators and no proof-of-stake. The ledger-fork questions are explored in the [fork simulator](https://bettertobest.github.io/portal/simulator/fork/) and [halt-power.md](halt-power.md), not built here.
- **Delegation, ranked-choice and quadratic voting.** These stay in the simulators for now.
- **Binding effect of any kind.** Everything the prototype produces is advisory test data.

## Components and how each is checked

| # | Component | Proposed approach | Check |
|---|---|---|---|
| C1 | Record format | One JSON shape for a proposal, an amendment, a signature and a comment, starting from the schema work in #9. Records are serialized in a canonical form (for example RFC 8785) so two programs hash the same bytes. | A schema file and a set of valid and invalid example records; a validator rejects every invalid one. |
| C2 | Signatures | Test keys generated in the client, public keys registered in the log, private keys never sent anywhere (paper §4.3.2). A standard signature scheme such as Ed25519 (RFC 8032). | Tampering with any signed field makes verification fail; a signature from an unregistered key is rejected. |
| C3 | Threshold and comment period | The signature threshold and the comment period length are settings, not constants. The paper's examples are 1,000 signatures and 30 to 90 days (§4.4.1); both are accepted starting points that may change. | A proposal moves between states only when its settings are met, and a test run with a tiny threshold and a short period shows every state. |
| C4 | Tamper-evident log | An append-only log in which each entry commits to the one before it, with periodic signed checkpoints over a Merkle tree, in the style of Certificate Transparency logs (RFC 6962 and RFC 9162). | Changing, deleting or reordering any entry is detected by a verifier that holds only an earlier checkpoint. |
| C5 | Independent verifier | A second, separately written program that reads the log and checks it, in a different language from the first. This mirrors the paper's idea of several independent implementations (§4.2.1). | Both programs agree on a shared set of test logs, including logs that were deliberately corrupted. |
| C6 | No behavior data | The client contacts no address outside a published list, loads no third-party scripts, fonts or images, and stores no per-person usage data (Tier 1 in [data-collection.md](data-collection.md)). | A repository check fails the build if any of those appear. |
| C7 | Accessibility | Any interface works by keyboard alone, has labeled controls and meets contrast needs. | Automated checks in light and dark, then testing with a screen reader by a person who uses one (the same gap as #7 and #11). |

## Suggested order of work

Each step is small enough for one pull request and can be reviewed alone.

1. **Schema and examples (C1).** Needs agreement on #9 first.
2. **Log and verifier core (C4, C5).** No interface, just two programs and shared test logs.
3. **Signatures (C2).** Test keys only.
4. **State rules (C3).** Proposal states, thresholds, comment periods, amendments.
5. **Behavior-data checks (C6).** Added early, so later work cannot drift.
6. **A plain interface (C7).** Static pages where possible, so it can be hosted without a server.
7. **Test plan.** A published list of the checks that must pass before any real vote is run, even an advisory one.

## Progress

Started in [`prototype/`](../prototype/). It is early, it runs on test data only, and nothing in it is a voting system.

- **Log and verifier core (C4, C5): built.** A hash-chained log with signed Merkle checkpoints, a Node verifier and a Python verifier, both written from the written rules in [prototype/SPEC.md](../prototype/SPEC.md). A log that was rewritten and re-signed by its operator passes every check except one against a checkpoint someone saved earlier, which is the point of publishing checkpoints.
- **Signatures (C2): built for test keys.** Ed25519, with test identities that anyone can recompute from their label, so nobody can mistake them for real ones.
- **State rules (C3): built.** Thresholds, comment periods, amendments, duplicate and stale signatures.
- **Behavior-data tripwire (C6): started.** A test that fails if the prototype code contains network calls, outside addresses or tracking code. It is a coarse check, not a proof.
- **Record format (C1): partly done.** The format is defined in the spec and checked by the verifiers. A formal JSON Schema is not written; that waits on #9.
- **Interface (C7) and the test plan: not started.**

A caveat on C5: both verifiers were written by the same person from the same spec. That catches slips but not a shared misreading. A third verifier written by someone else from the spec alone would be the real test.

## Threats the prototype should be tried against

From the [threat model](threat-model.md), and only the ones a prototype this small can honestly test:

- Rewriting or deleting records (C4, C5).
- A forged or replayed signature (C2).
- Changing a proposal's text after people have signed it (C1, C2, C4): signatures must cover the exact text they were given.
- A proposer rewriting history through "amendments" (C3, C4).
- Usage data becoming tracking (C6).

Threats it cannot test, such as capture of the operators, a 51% attack and vote buying, are named in the threat model and left to later phases.

## Placeholders and assumptions

- 1,000 signatures and a 30 to 90 day comment period are the paper's examples, not settled numbers. Appendix A.8 uses 1,000 versus 5,000 signatures for citizen grand jury cases, which is a separate mechanism.
- The choices of Ed25519, a hash-chained log and RFC 8785 are suggestions to review. Reviewers may prefer others.
- A signature does not show that a real, unique person signed. See the identity note above.

## Open questions

1. Language and tooling: which two languages for the main program and the verifier, keeping dependencies few and easy to audit?
2. Where does the log live in a prototype with no network: files in a repository, a small server, or both?
3. How should test identities be shown so nobody mistakes the prototype for a live system?
4. Is a hash-chained log with signed checkpoints enough for Phase 3, or should it wait for the privacy layer design?
5. Who reviews the cryptography, and when? Phase 4 plans an outside review. Should Phase 3 get a lighter one?
6. Amendments: the prototype clears all signatures when a proposal is amended, so nobody ends up signed to text they did not see, at the cost of restarting the count. Is that the right rule?
7. Who checks the `time` the operator puts on each entry, given that comment periods depend on it?
8. Should a signer be able to withdraw a signature, and what would that do to a proposal already in its comment period?

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
