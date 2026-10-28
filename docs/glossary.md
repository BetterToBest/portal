# Glossary of CIP terms (draft v0.1)

Status: **draft for review.** It answers issue #10. CIP is a research proposal, not a live voting system. Every term below describes something the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) proposes or something a draft in this repository proposes. Nothing here is built, except where an entry says the Phase 3 test prototype has it, and the prototype handles test data only. Every number is a placeholder.

Each entry gives the paper section it comes from, checked against the paper text. Where a term is not in the paper but was introduced by a draft in this repository, the entry says so and points to that draft. Plain wording was the aim; if an entry is still unclear, say so in [Discussions](https://github.com/BetterToBest/portal/discussions).

## Terms

**Advisory vote.** A vote whose result binds no one; it only records what the people who took part said. The paper proposes a simple majority for advisory referenda (§4.4.1). The wording a screen would carry is drafted in [advisory-notice.md](advisory-notice.md).

**Amendment.** A change the proposer makes to a proposal after feedback. The paper lists an amendment process in §4.4.1. In the test prototype, an amendment would clear the signatures given so far, because people signed the old text ([SPEC.md](../prototype/SPEC.md)). Signatures on an earlier version are called stale. The clearing rule is a prototype choice, not in the paper.

**Cap (delegation cap).** A limit on how many votes one delegate may hold. The paper proposes that no delegate represent more than 1% of the population (§4.4.2). What happens to people over the cap is not in the paper; [voting-rules.md](voting-rules.md) proposes returning them to direct voting.

**Checkpoint.** Not in the paper. A short signed statement by the log's operator: "my log has this many entries and this fingerprint." Someone who saved it earlier can use it to show that the operator later rewrote the log. See [checkpoints.md](checkpoints.md). The paper's nearest idea is tamper-evidence (§4.2.1).

**Comment period.** The time a proposal is open to public comment before voting. The paper proposes 30 to 90 days (§4.4.1). The test prototype uses short, made-up periods.

**Digital signature.** A value made with a person's private key that anyone can check with the matching public key, showing the signer approved a message. The paper proposes that votes be signed with a private key and verified with a public key (§4.3.2). The prototype uses Ed25519 signatures.

**Eligibility.** Whether a person is allowed to take part in a particular vote. The paper links each citizen-node to a verified identity (§4.2.3) but does not say how. Options for checking eligibility without linking a person to a ballot are drafted in [identity-linking.md](identity-linking.md).

**Fork.** A split in which two copies of the shared record disagree about what happened. The paper's concern is what happens when independent implementations disagree (§4.2.1, §4.2.3). The [fork simulator](https://bettertobest.github.io/portal/simulator/fork/) models it with made-up numbers.

**Genesis.** Not in the paper. The first entry of a Phase 3 test log. It would set the log's settings (such as the signature threshold) and name its operator ([SPEC.md](../prototype/SPEC.md)).

**Guardian (Judicial Guard).** The Judicial Guard is a proposed body of 500 to 2,000 or more independent investigators, called guardians, each with individual authority to monitor the portal and investigate suspected manipulation (§5.2, §5.3). Its job would be to protect the integrity of democratic participation (§5.1). It has no operating power over votes in the prototype.

**Halt (hold, pause, flag).** The paper says detected attacks "can be halted pending investigation" (§4.2.3, safeguard 6) and gives no limits. [halt-power.md](halt-power.md) proposes three levels: a flag (an alert only), a scoped hold (certification of one result or region pauses) and a full pause (new writes pause everywhere). These levels, the signer counts and the time limits are the draft's, not the paper's.

**Hash and hash chain.** A hash is a fixed-length fingerprint of some data; changing the data changes the fingerprint. In a hash chain each entry includes the fingerprint of the one before it, so changing an old entry breaks every later link. The paper's version is immutability, "once recorded, votes cannot be altered without detection" (§4.2.1). The prototype log is hash-chained.

**Instant-runoff (ranked-choice voting).** Voters rank candidates; the one with fewest first choices is dropped and those ballots move to their next choice, until one candidate has a majority. The paper uses ranked-choice voting to elect Oversight Board members (Appendix A.3). Tie-break rules are not in the paper; a draft is in [ranked-choice.md](ranked-choice.md), with a [simulator](https://bettertobest.github.io/portal/simulator/ranked/).

**Ledger.** The shared, append-only record that everyone can read and check. The paper proposes a blockchain for it, used for distributed consensus and not for cryptocurrency (§4.2.1). The Phase 3 prototype is a much smaller thing: a tamper-evident log run by one operator, for test data.

**Liquid delegation (liquid democracy).** A person may hand their vote to a trusted delegate on a topic, take it back at any time, or vote directly and override the delegate. The paper proposes topic-specific, revocable and limited transitive delegation, with yearly renewal (§4.4.2). Loops and the cap are drafted in [voting-rules.md](voting-rules.md). Try the [liquid simulator](https://bettertobest.github.io/portal/simulator/liquid/).

**Log (test log).** Not in the paper. The Phase 3 prototype's tamper-evident list of signed entries: proposals, signatures, comments and amendments. It is checked by two separate verifiers. See [prototype/](../prototype/).

**Node.** A computer that holds a copy of the shared record and helps check it. The paper proposes nodes in all 50 U.S. states and abroad, run by universities, libraries, non-profits and individual citizens, with no more than 10% in one place (§4.2.2).

**Operator.** Not in the paper. In the prototype, the party that adds entries to the log and signs its checkpoints. The log's rules treat the author of the genesis entry as the operator.

**Oversight Board.** A proposed 7-member board that would oversee the Judicial Guard for accountability but could not direct investigations (§5.4, Appendix A.3). The draft halt limits keep it from triggering or lifting holds ([halt-power.md](halt-power.md)).

**Proof-of-stake with slashing.** A way of securing a shared record in which node operators put up a stake that is lost if they cheat. The paper lists it as the first safeguard against a 51% attack (§4.2.3).

**Public and private key.** A key pair a person generates. The public key is registered and can be shared; the private key never leaves the person (§4.3.2). A signature made with the private key is checked with the public key. See [key-handling.md](key-handling.md).

**Quadratic voting.** Everyone gets equal voice credits and extra votes on one item cost more: 1 vote costs 1 credit, 2 cost 4, 3 cost 9. The paper proposes it for budget decisions (§4.4.3). Try the [voting simulator](https://bettertobest.github.io/portal/simulator/).

**Recovery (social recovery, time lock).** Ways to regain access after losing a key. The paper proposes social recovery (trusted contacts help restore access), Judicial Guard help in extreme cases, and a time-locked recovery to prevent hasty theft (§4.3.2). It gives no parameters; options and open questions are in [key-handling.md](key-handling.md).

**Sealed ballot.** A ballot that is recorded in a form that does not show how the person voted. Phase 3 has none. The paper proposes an encrypted vote with a proof it is valid (§4.3.1). The design is Phase 4 work and is not written ([phase-3-plan.md](phase-3-plan.md)).

**Signature threshold.** The number of signatures a proposal needs before it can go further. The paper gives 1,000 as an example (§4.4.1). That figure is an accepted starting point and may change as the system is tested.

**Stale signature.** Not in the paper. In the prototype, a signature on an older version of a proposal that has since been amended. It does not count ([SPEC.md](../prototype/SPEC.md)).

**Supermajority.** A larger share than a simple majority. The paper proposes 60 to 67% for binding policy changes (§4.4.1), and a supermajority for major architectural changes (§4.5.2).

**Tamper-evident.** Not tamper-proof: a change cannot be prevented, but it would show. The paper's phrasing is that records cannot be altered "without detection" (§4.2.1).

**Tiers (of data).** Not in the paper. [data-collection.md](data-collection.md) proposes three: tier 1 is never collected (for example per-person clickstreams); tier 2 is allowed with no identifiers (for example per-node counters); tier 3 is opt-in only (for example volunteer usability studies). The paper's data-collection ideas are in §4.5.2.

**Verifier.** Not in the paper. A program that reads a test log and checks its hashes, signatures and rules. The prototype has two, written separately from the same written rules, so that they can be compared ([prototype/SPEC.md](../prototype/SPEC.md)).

**Watcher.** Not in the paper. Anyone who keeps the checkpoints they see and compares them with others, so a rewritten log can be exposed. A watcher needs no account and may be pseudonymous ([checkpoints.md](checkpoints.md)).

**Zero-knowledge proof.** A way to prove a statement is true without revealing why. The paper proposes using it so a voter can check their vote was recorded and anyone can check the totals without learning how an individual voted (§4.3.1). It is not built; Phase 4 would design it ([phase-3-plan.md](phase-3-plan.md)).

## Not defined here

The paper also uses names for other parts of the Compassionism Framework: Creative Currency Octaves (CCO), Public Trust Foundations (PTF) and Social Zone Harmonization (SZH) (§6.1). They are outside what this repository builds and are not explained here.
