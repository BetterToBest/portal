# Keeping keys with the person: generation, storage and recovery (draft v0.1)

Status: **draft for review.** This is the design for gate G4 of the [Phase 3 test plan](phase-3-test-plan.md): "keys stay with the person." It is a written proposal, not software and not a security review. CIP is a research proposal, not a live voting system, and every design here is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) or a suggestion for reviewers to challenge. Every number is a placeholder. Nothing is decided until reviewers agree, and no dates are promised.

Nothing here collects or monetizes user behavior data. A key design that needs the project to hold, see or back up anyone's private key is out of bounds by this document's first rule below.

## What the paper says, and what it leaves open

Paper §4.3.2 says four things about keys:

- Public keys are registered on the ledger.
- Private keys never leave the citizen's possession.
- Votes are signed with the private key and checked with the public key.
- Recovery has three parts: social recovery (trusted contacts can help restore access), Judicial Guard assistance for extreme cases, and time-locked recovery to prevent hasty theft.

It gives **no parameters**: not how many trusted contacts, how they are chosen, how many must agree, how long the time lock lasts, what happens to the old key, or how a key is revoked. It also says each citizen-node is linked to a verified identity (§4.2.3), and does not say how. Everything below that fills those gaps is a proposal from this repository, not from the paper.

## Rules that any design must meet

1. **The project never holds a private key.** Not on a server, not in a backup, not in a recovery escrow. If a design needs that, it is rejected.
2. **Keys are made on the person's own device,** from the system's secure random source, and never sent anywhere.
3. **Losing a key must not mean losing the person's place,** and stealing a key must not be quick or quiet. Both failures are expected, so recovery is part of the design from the start.
4. **No one's participation may depend on one brand of device, a biometric, or a particular ability.** A person using a screen reader, a keyboard alone or an old phone must be able to create, keep and recover a key. This ties to gate G7.
5. **Recovery must not become a way to take over someone else's place,** and must not give any single body, including the Judicial Guard, the power to do so.
6. **No behavior data.** Key creation and recovery log only what the ledger needs, and nothing about how or when a person uses the software beyond that.

## Generation

Proposal: the client makes an Ed25519 key pair (the scheme the prototype already uses) from the platform's secure random source. The public key is registered in the ledger. The private key is never shown unless the person asks for a backup, and is never transmitted.

Open: whether signing and recovery should use separate keys, so that the key used every day is not also the one that controls recovery.

## Storage: the choices and what each risks

| Option | Helps with | Risks and costs |
|---|---|---|
| Key held by the browser or operating system and marked non-exportable | Easy, no extra device, hard to copy off the device | Lost with the device; any code running in the same page or app can still ask it to sign; support for Ed25519 varies by browser and version |
| Hardware security key | Hard to steal remotely; the key cannot be copied out | Costs money; not everyone has one or can use one; lost or broken keys need recovery |
| Encrypted key file, opened with a passphrase | Works on any device; easy to back up | Only as strong as the passphrase; a stolen file can be attacked offline; people forget passphrases |
| Printed or written backup of the key or its recovery data | Survives a dead device | Anyone who finds it may use it; hard to use with a screen reader; easy to misplace |

No option is right for everyone. The proposal is to **offer more than one** and be plain about the risks of each, rather than to pick a single "secure" path that excludes people. Which options a first test should support is an open question.

## Recovery

The paper's three parts, with the questions each one leaves. Two ways to build **social recovery** are described, because the choice changes what is stored where.

**Option A: guardians approve a new key on the ledger.** The person names trusted contacts in advance, each by public key. To recover, the person registers a new key and asks for approval; when enough contacts have signed, the ledger links the new key to the same place. No secret is split or stored. It fits the signed-record design of the prototype. It exposes, on the ledger, which keys act as trusted contacts for which place, unless that is hidden by design, which is an open question.

**Option B: the private key, or a recovery secret, is split among contacts** (for example by Shamir's secret sharing, where any chosen number of pieces rebuild the secret). Contacts hold pieces, and a quorum can rebuild access. This keeps the ledger free of any list of contacts. It puts a real secret in other people's hands, and a quorum of colluding contacts can rebuild it without any ledger trace.

**Time lock (both options).** Recovery takes effect only after a delay, during which the **old key can cancel it** and the person is told through every channel they have registered. This is the paper's "time-locked recovery preventing hasty theft." The length of the delay is open: long enough that a person who has not lost their key can stop a thief, short enough that a person who has lost theirs is not locked out for long. Placeholder range for review: days, not hours or months.

**Judicial Guard assistance for extreme cases.** The paper names it and does not define "extreme." Any role here is a concentration of power over who counts as a participant, so it should be the narrowest possible and checkable. Starting questions: what triggers it, how many guardians must agree, what they can and cannot do (never choose or hold a key, only extend a time lock or confirm that a person exists), and how it is published and challenged. The same questions are worked through for the halt power in [halt-power.md](halt-power.md), and the structure there is a starting point.

**Rotation and revocation.** The paper is silent. Proposal: a person with a working key can replace it at any time with a record signed by the old key, and can mark a key as lost; a lost-key record signed by the person's recovery route takes effect only after the same time lock. Neither exists in the prototype's record types ([SPEC.md](../prototype/SPEC.md)).

## What can go wrong

| Threat | What helps | What is still open |
|---|---|---|
| Device stolen or infected | Non-exportable or hardware-held keys; passphrase on the file; the time lock gives the person time to cancel a recovery started with a stolen device | A signing key on an infected device can be used to sign, even if it cannot be copied |
| Tricked into signing or recovering (phishing) | Plain-language screens that say exactly what is being signed; recovery requests visible on every registered channel | How to teach this without behavior tracking |
| Key lent, sold or demanded (vote buying, coercion) | The paper's unlinkable ballots (§4.3); a person can replace their key | Replacing a key does not undo a vote already cast; coercion at the moment of voting is outside this document |
| Trusted contacts collude, or are pressured | A threshold, not a single contact; a time lock; the old key can cancel | How many, and how people choose contacts who are independent of each other |
| Recovery used to take over a place | Time lock; the old key can cancel; contacts must be named in advance | A person who has lost all keys and cannot reach contacts: the narrow Judicial Guard route above |
| A person with no contacts, no device or no support | More than one storage option; recovery paths that do not need technical skill | Who helps, and how, without becoming a point of control or of data collection |
| Key lost and no recovery set up | Prompting people to set recovery up when they register | Whether a place with no recovery is simply lost, and whether that is acceptable |
| Test keys mistaken for real ones | Prototype keys are derived from a label so anyone can recompute them | See below |

## What the prototype shows and does not show

The prototype's identities (`test-alice` and so on) are derived from their labels and are **not secret**. That is deliberate, so no one mistakes the prototype for a live system. It shows that records can be signed and checked and that tampering is detected. It shows **nothing** about key generation, storage, recovery or revocation. G4 stays "not met" until there is something real to review.

## What would count as meeting G4 (a proposal)

For a first advisory test, all of the following, each with public evidence (the commit, the date, who did it, the result):

1. Rules 1 to 6 above checked against the actual key code by someone other than its author.
2. Each row of the threat table above has a written answer in the design, even if the answer is "accepted limitation" with a stated reason (see the test plan's open question 4).
3. A recovery drill on test data: a key is "lost," recovered through the chosen route, a recovery attempted with a "stolen" device is cancelled by the old key within the time lock, and the log shows each step.
4. A test with people who use a screen reader and a keyboard alone, to create, back up and recover a key. This needs people the project does not have yet, the same gap as #7 and #11.

## Open questions

1. Should signing and recovery use separate keys?
2. Social recovery: guardians approving on the ledger (A), or a secret split among contacts (B)? Or a first test that supports neither and uses a simpler route?
3. How many trusted contacts, and how many must agree? What stops people choosing contacts who are not independent?
4. How long should the time lock be, and through which channels is the person warned, without the project collecting contact details?
5. What is the narrowest Judicial Guard role that still helps someone who has lost everything?
6. Which storage options must a first test support so that nobody is excluded?
7. Is it acceptable that a place with no recovery set up is lost if its key is?

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
