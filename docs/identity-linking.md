# One person, one key: linking a key to a verified person without recording how they vote (draft v0.1)

Status: **draft for review.** This is the design for gate G5 of the [Phase 3 test plan](phase-3-test-plan.md): "one real person, one key." It is a written proposal, not software and not a security review. CIP is a research proposal, not a live voting system, and every design here is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) or a suggestion for reviewers to challenge. Every number is a placeholder. Nothing is decided until reviewers agree, and no dates are promised. It names no community and no real person.

Nothing here collects or monetizes user behavior data. A design that makes the project hold a list of participants, or any link between a person and how they voted, is out of bounds by the first rule below.

## What the paper says, and what it leaves open

The paper touches identity in a few places and never says how a person is checked.

- **§4.2.3, safeguard 2 of 6 against a 51% attack:** each citizen-node is linked to a verified identity, "not anonymous." The text sits in a list about consensus. It does not say whether it covers every participant or only those who run nodes.
- **§4.3.2:** citizens generate key pairs, public keys are registered on the ledger, private keys never leave the citizen. Multi-factor authentication lists a biometric as an optional "something you are" for signing in, not as a way to prove that a person is unique.
- **§4.3.1:** ballots are meant to be verifiable but unlinkable: a voter can check their vote was recorded, and no one can determine how any individual voted.
- **§4.6.1:** several ways in: web, phone, in person at libraries and community centers, and mail-in paper ballots "with digital verification." Each would need its own identity check.
- **§4.6.2:** participation is always optional, discussion can be pseudonymous, and there is "no surveillance or tracking beyond necessary verification." What counts as necessary is not defined. That sentence is the gap this document tries to narrow.
- **The roadmap's later years** mention integrating with existing federal systems for identity verification. No method, no records policy and no fallback for people without documents is given.

So the paper asks for verified, non-anonymous people and for votes nobody can trace to them, and gives no mechanism that does both. The [threat model](threat-model.md) already names this tension. Everything below that fills the gap is a proposal from this repository, not from the paper.

## Three questions that must be kept apart

1. **Eligibility:** is this person allowed to take part in this vote?
2. **Uniqueness:** has this person already been given a key?
3. **The vote:** how did this person vote?

The design goal is that whoever answers 1 and 2 never learns 3, and nothing in the ballot reveals the answers to 1 and 2. The check is done once, when a key is enrolled. Nothing at voting time touches identity.

## Rules that any design must meet

1. **No record joins a person to a ballot.** Not in the log, not at the party that checks eligibility, not in the project's hands. If a design needs that, it is rejected.
2. **The project never holds a list of participants.** Who took part in a civic process can itself be sensitive. Any list that must exist is held by the party that already knows those people (a host group, a local attester), is as short as it can be, and is deleted when its job is done.
3. **One key per person is a goal with a stated error rate, not a promise.** The design says how a person could end up with two keys or none, and how often that is expected, rather than claiming it cannot happen.
4. **No single route may exclude people.** No route may require one document, one brand of device, a biometric, a bank account or a particular ability. At least one route works for someone with no identity document, no smartphone and no helper. This ties to gate G7, to [key-handling.md](key-handling.md) rule 4 and to paper §4.6.
5. **A wrong or missing check can be challenged and fixed by the person, with no penalty.** Being refused, or told you are a duplicate, has a way back.
6. **The number of keys is public, the names are not.** Anyone can compare how many keys were enrolled with an independent count, so an issuer cannot quietly create keys for people who do not exist.
7. **Recovery replaces a key, never adds one.** A person who "loses" a key must not end up holding two ([key-handling.md](key-handling.md), recovery and revocation).
8. **No behavior data.** Enrolment records only what the check needs. Nothing about how a person later uses the software is gathered.

## The options, and what each risks

| Option | Helps with | Risks and costs |
|---|---|---|
| **A. The host group's own list.** A group that already knows its members vouches for them and hands each an enrolment code in person or by its usual channels | No new database, no government document, fits a small advisory test | The group learns who enrolled. The group can issue extra codes. It excludes non-members. Small groups make anonymity thin ([pilot-design.md](pilot-design.md)). Only as fair as the group |
| **B. In-person attestation by trusted people** (at places such as libraries and community centers, which §4.6.1 names for in-person voting). A person shows up, an attester checks what the host's rule accepts, and gives a one-time code | Works with no device and no document, if the rule allows. Spreads trust over many attesters | The attester sees the person. Attesters can be pressured or corrupt. Costs time and money. Codes can be sold |
| **C. Blind issuance** (a cryptographic method such as blind signatures, where an issuer signs a credential without being able to match it to the key it is later used with) | Cuts the link between the check and the key by mathematics, not by promise | Complex, and a Phase 4 matter needing outside cryptography review. A lost credential needs recovery. The issuer still learns who enrolled. Does not stop buying or lending |
| **D. Vouching by existing participants** | No central authority | Rings of colluding vouchers. Who vouched for whom becomes a map of relationships, which is itself surveillance data. Leaves out the isolated |
| **E. Government or other document check** (the roadmap's later years point this way) | Strong uniqueness for those who hold the documents | Excludes those who do not. Ties civic participation to state records. One agency could switch people off. The sharpest conflict with rule 1 and with "no surveillance" (§4.6.2) |
| **F. Biometric uniqueness** | Hard to hold two | Needs someone to keep biometric data, which cannot be changed if leaked. Excludes some bodies. The paper lists biometrics only as an optional sign-in factor |

No option is right for everyone. Proposal for a first advisory test: **A, with B for people the list cannot reach.** E and F are not proposed. C is the aim for a later phase, once the privacy layer has been designed and reviewed. This is a suggestion for reviewers to challenge, not a decision.

## Where the link is cut

A sketch, to be reviewed:

1. **Check, outside the log.** The host or attester decides eligibility under a written rule, and notes only that a code was given to a person.
2. **One-time code.** A random code, not derived from a name.
3. **Key on the person's device.** The person makes a key as in [key-handling.md](key-handling.md) and redeems the code by registering the public key in the log. The log shows "a key was enrolled," with no name and no label that points to a person.
4. **After the window,** the list of who received codes is deleted (placeholder: 30 days, as in the pilot design).

An honest limit: with plain codes, the party that handed out the codes may be able to match a code to a key by timing or by watching the redemption. Delay-and-batch tricks may blunt that and may be theatre; that is open (question 5). What the design relies on is the next link: even if someone could match a person to a key, **the ballot must not reveal which key cast it.** That is the sealed ballot of Phase 4, not yet designed. This is why G5 cannot be fully met before Phase 4.

## What can go wrong

| Threat | What helps | What is still open |
|---|---|---|
| One person enrols several times | One code per person; public key count compared with an independent count | No method stops every case. The expected error rate must be stated |
| An insider issues keys for people who do not exist | Public key count; independent audit of issuance totals | Who audits without seeing names, in a small group |
| Keys bought or lent | Unlinkable ballots mean a buyer cannot check what was cast (paper §4.3); a person can replace their key | Coercion at the moment of voting is outside this document |
| An eligible person is turned away | More than one route; a way to challenge | Who decides appeals without becoming a new point of control |
| The issuer learns who enrolled, or matches code to key | Short-lived records; no names in the log; blind issuance later | Plain codes may still be matchable |
| The list of participants leaks | Held by the party that already knows the people; deleted early | What the host does with its own list is outside the project's control |
| The check is used to pressure or screen people out | A written, public eligibility rule; a second route; a way to challenge | Who enforces fairness |
| Recovery is used to get a second key | Recovery replaces the old key after a time lock the old key can cancel | See [key-handling.md](key-handling.md) |
| One key links a person's activity across several votes or groups | A separate key per vote or per community | Whether people will cope with several keys |
| Test identities mistaken for real ones | Prototype keys come from labels starting `test-` that anyone can recompute | See below |

## What the prototype shows and does not show

The prototype can register a key and refuses the **same key** twice (`DUPLICATE_KEY`). It cannot tell whether the **same person** holds two keys. Its identities are labeled `test-` and can be recomputed by anyone, on purpose. It shows nothing about how a person is checked, how a code is issued or how a refusal is challenged. G5 stays "not met" until there is something real to review.

## What would count as meeting G5 (a proposal)

For a first advisory test, all of the following, each with public evidence (commit, date, who did it, the result):

1. Rules 1 to 8 checked against the actual enrolment design by someone other than its author.
2. Each row of the threat table has a written answer, even if the answer is "accepted limitation" with a stated reason (test plan, open question 4).
3. A stated error rate for the chosen method: how many people could hold two keys or none, and why that is acceptable for an advisory test.
4. A drill on test data: a role-played cheater tries to enrol twice, a role-played insider tries to issue keys for people who do not exist, and a role-played person with no document tries the second route. Each is caught or recorded as an accepted limitation, and the log shows each step.
5. A check by people who cannot use the default route (screen reader, keyboard alone, no device, no document). This needs people the project does not have yet, the same gap as #7 and #11.
6. The Phase 4 ballot design shows that a key cannot be tied to a ballot, with outside cryptography review.

## What this document does not claim

- It does not say any option works at national scale, and it does not claim to have solved the problem of proving one person holds one key. No known method does that without costs, and the costs fall on someone.
- It does not choose a legal or administrative route, and it has not checked what the law allows in any place.
- It names no community, promises no partner or funding, and gives no dates.

## Open questions

1. Is the host group's own list enough for a first test, and what does a group with no list do?
2. How much uniqueness error is acceptable for an advisory test, and how is it measured?
3. Can issuance be audited by count without revealing names? Who audits (test plan, open question 2)?
4. Does a person get one key for everything, or a separate key per vote or per community? How long does an enrolment last?
5. Would delay-and-batch redemption of codes blunt matching until blind issuance exists, or only look like protection?
6. Who hears appeals when someone is refused or flagged as a duplicate, without becoming a new point of control?
7. What is the narrowest meaning of "necessary verification" (§4.6.2) that still lets the check work?
8. Is a document check ever acceptable as one option among several, or does it break rule 1 by itself?
9. Phone and mail-in channels (§4.6.1) need their own checks. Are they in scope for a first test?

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
