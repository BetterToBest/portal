# Phase 4 privacy layer: options for a sealed ballot (draft v0.1)

Status: **draft for review. Nothing in it is built, and no cryptographer has reviewed it.** This is a design note for Phase 4 of the [build roadmap](../CONTRIBUTING.md), "privacy layer: verifiable ballots without revealing votes". (That is the repository's Phase 4, not Phase 4 of the paper's own roadmap, which is about years 16 to 25.) It works on the ballot part of [issue #9](https://github.com/BetterToBest/portal/issues/9) and does not close it. CIP is a research proposal, not a live voting system, and every design here is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) or a suggestion for reviewers to challenge. Every number is a placeholder. Nothing is decided until reviewers agree, and no dates are promised.

Nothing here collects or monetizes user behavior data. A ballot design that needs the project, an operator or anyone else to keep a record of who cast which ballot, or when and from where, is out of bounds by the rules below.

Claims from outside the paper carry a number in square brackets, such as [3], that points to the [sources](#sources) at the end. Only sources that were opened are cited, and each says how much of it was read. Others that a reviewer may want are listed there as unchecked.

## What the paper says, and what it leaves open

Paper §4.3.1 sets the goal. The voter receives an "encrypted ballot receipt". The ledger holds an "encrypted vote + proof of validity". The voter can verify their vote was recorded, the public can verify the totals are accurate, and "no one can determine" how any individual voted. It names three tools: zk-SNARKs, Bulletproofs for range proofs ("preventing negative or excessive votes") and homomorphic encryption. §4.6.2 repeats that voting records are private through zero-knowledge proofs, with "no surveillance or tracking beyond necessary verification".

It does not say how the tools fit together, who holds any decryption key, or what the receipt contains. Five points in the paper pull against each other or against the research:

1. **Signed votes and secret votes.** §4.3.2 says "votes signed with private key, verified with public key", where the public key is the one registered on the ledger. A ballot signed with a registered key is tied to that key in public, for as long as the ledger is kept. Then only the encryption keeps the vote secret, and encryption that is safe today may not be in fifty years (Cramer, Gennaro and Schoenmakers raise exactly this, about "fifty-year old votes" [5]). [identity-linking.md](identity-linking.md) already relies on the opposite: "the ballot must not reveal which key cast it."
2. **The receipt.** A receipt that only shows "this encrypted ballot was recorded" is what verifiable voting systems give [2]. A receipt that lets a voter show someone else what is inside is a tool for selling votes [19].
3. **One tool does not fit every vote.** Adding encrypted votes works for yes/no, pick-one and approval questions. It is usually not suitable for ranked ballots, where a shuffle (a mix-net) is more appropriate [6]. Quadratic voting (§4.4.3) needs range proofs. The "geographic distribution requirements" of §4.4.1 need to know where each ballot came from, and a region written on a ballot shrinks the crowd it hides in.
4. **Delegation in public.** §4.4.2 lists "all delegation relationships visible" as a safeguard. A public delegation can show how a person's vote was cast ([voting-rules.md](voting-rules.md) already treats this as open).
5. **Blockchains.** §4.2.1 proposes several blockchains. Research on blockchain voting finds that a blockchain adds nothing for voting beyond being a public bulletin board, and does not fix the main weaknesses of online voting [3]; the ElectionGuard authors write that a permissionless blockchain "may be more problematic than helpful" for publishing election records [6]. The Phase 3 test log, a hash chain with signed checkpoints, is a public bulletin board in this sense, and the designs below use it as one.

## Words used in this document

- **Roll:** the list of keys allowed to vote in one vote. Here, every key registered in the log before the vote is opened.
- **Token:** a one-use permission to cast one ballot, issued to a key on the roll.
- **Tally trustees:** the people or bodies who together hold the key that opens the result. ElectionGuard calls them guardians [6]; this draft does not, because the CIP docs use that word for the Judicial Guard ([halt-power.md](halt-power.md)).
- **Quorum (k of n):** how many of the n trustees must take part to open the result.
- **One-vote tag:** a value that is the same every time one voter acts in one vote, so a second ballot can be spotted, but that does not reveal the voter. Semaphore calls it a nullifier [11].

## Properties a design must have

| Property | What it means in plain words | Where from |
|---|---|---|
| Eligibility | Only a key on the roll can cast a ballot that is counted, and anyone can check that | §4.2.3, §4.3.2 |
| One person, one ballot | At most one counted ballot per roll entry. A privacy layer can give one ballot per **key**; one key per **person** is gate G5 ([identity-linking.md](identity-linking.md)) | Implied by §4.2.3 and §4.4; the paper does not state it as a rule |
| Secrecy | Nobody (an operator, an issuer, fewer than k trustees, other voters, the project) can learn how a given key or person voted, from the log or from anything kept | §4.3.1, §4.6.2 |
| Receipt-freeness | A voter cannot prove to someone else how they voted, even if they want to [19] | Implied by §4.3 and the threat model's "vote buying or coercion" row |
| Coercion resistance | A coercer cannot tell whether a voter obeyed, whether the demand was to vote a certain way, abstain or hand over keys [17] | Same |
| Verifiability | **Cast as intended:** the voter can get evidence that the encrypted ballot holds their choice. **Recorded as cast:** the voter can find it on the public list. **Tallied as recorded:** anyone can check that the result counts every recorded ballot [2]. Also: anyone can check that no more ballots were counted than keys were allowed to vote | §4.3.1 |
| No behavior data | A ballot holds only what the checks need. Nothing about the device, network, time of day or how the person used the software is kept ([data-collection.md](data-collection.md), tier 1) | §4.6.2; project rule |

Precise definitions of these properties differ between papers, and new ones are still being proposed [22]. A reviewer should say which definition each claim uses.

Verifiability only means something if people verify. "A verifiable election that nobody bothers to verify does not produce any meaningful evidence" [2].

## Rules that any design must meet

1. **No record joins a key or a person to the content of a ballot,** readable now or later. A counted ballot does not carry the voter's registered key.
2. **Secrecy never rests on one party.** No operator, issuer, trustee or institution, the Judicial Guard included, can open a single ballot alone.
3. **Every ballot and the result can be checked from a written spec** by programs written by different people, in the way the two Phase 3 verifiers check the test log (gate G1).
4. **No optional fields.** Every ballot in one vote has the same fields and the same size. An optional field, a free-text field or a version string can mark a ballot as someone's.
5. **No claim beyond what is met.** If receipt-freeness is not met, no screen says or implies that a vote cannot be sold ([advisory-notice.md](advisory-notice.md), rule 8).
6. **No behavior data.** Whoever receives ballots keeps no record of where or when each one came from, beyond what the log itself shows.
7. **Too small to keep secret means not opened.** A vote with fewer ballots than a minimum is not decrypted and no count is shown, only the process report ([pilot-design.md](pilot-design.md), placeholder 20).
8. **Nobody is required to check anything.** Casting a ballot works by keyboard and screen reader (gate G7). Checking a receipt is offered, never required, and needs no special software of the voter's own.

## The design families

Five families, from the research on voting by computer. The paper's tools belong to the second (homomorphic encryption) and the fifth (zk-SNARKs are one kind of proof it would use); the others are added here because they solve parts the paper leaves open. They can be combined, and most real systems combine two.

### 1. Mix-nets: shuffle, then open

**How it works.** Each voter posts an encrypted ballot. A series of servers each shuffle the whole list and re-encrypt it, so the order no longer matches who sent what. At the end the ballots are opened one by one and counted. Chaum's 1981 design hides "who a participant communicates with" and can be "compromised only by subversion or conspiracy of all of a set of authorities" [7]. Each server proves that its shuffle changed no vote [2]. Helios, as described in 2008, used a mix-net, with the Helios server as the only trustee: "trust Helios for privacy" [4].

- **Gives:** any ballot shape, including ranked ballots [6]. The final ballots carry no link to their senders.
- **Costs:** several independent servers must run after voting closes. Proofs like these are hard to implement correctly: in the SwissPost system, flawed implementations of the cryptography made it possible to build "proofs" of a correct result that passed verification although votes had been manipulated [16]. Every opened ballot is published, so a rare ballot (for example an unusual full ranking) can point at its voter, more so in a small group.
- **Assumes:** at least one shuffling server is honest [7]; the proofs are sound; secrecy is only as long-lived as the encryption [5].

### 2. Homomorphic tallying: add the sealed ballots, open only the total

**How it works.** Each ballot is encrypted with a scheme in which multiplying two encrypted values adds the votes inside. Anyone can combine all ballots into one encrypted total, and the trustees together open only that total. A voter posts "a single encrypted message accompanied by a compact proof that it contains a valid vote", and threshold decryption keeps individual votes private while tolerating the failure of some authorities [5]. ElectionGuard works this way, and has been used in public elections in several U.S. states [6].

- **Gives:** no single ballot is ever opened. ElectionGuard's authors found that being able to promise this was "a powerful tool to assuage concerns" [6]. Checking is simple enough that writing a verifier is meant to be a reasonable first programming project [6], which suits this repository's use of independent verifiers.
- **Costs:** only for counting votes: yes/no, pick-one, approval. Not for ranked ballots [6]. Trustees must take part at the end. In the classic design each ballot is posted with its voter's identity [2], and the proof is tied to that identity to stop copying [5], so who voted is public and how they voted is hidden only by the encryption.
- **Assumes:** fewer than k trustees collude (ElectionGuard's encryption is proved secure against up to k − 1 corrupted guardians [6]); the proofs hash the full statement and context, because with the weaker variant, malicious parties could tamper with a Helios result [15]; the difficulty of a math problem (discrete logarithms) holds for as long as anyone cares about the votes [5].

### 3. Blind signatures: permission that cannot be traced back

**How it works.** Chaum's 1983 paper explains it with envelopes lined with carbon paper. The voter puts a ballot slip in a carbon-lined envelope; the trustee signs the outside, which signs the slip through the carbon, without seeing it; the voter later posts the signed slip "without a return address". The trustee "can not know" which slip was whose, and anyone can count the signed slips [8]. RFC 9474 specifies one such scheme today: the signer "learns nothing about the client input and output", and a signer's work cannot be stretched into more signatures than it made [9]. Chaum calls that last property conservation of signatures [8].

- **Gives:** an issuer can allow one ballot per key on the roll without being able to match the permission to the ballot. Signature checks are ordinary RSA-PSS checks [9], which the libraries both Phase 3 verifiers already use can do. It is option C in [identity-linking.md](identity-linking.md), there called blind issuance.
- **Costs:** the issuer must be online while tokens are issued. RFC 9474's scheme "is not post-quantum ready" [9]. A token works for whoever holds it, so it can be given away or sold. The voter can recognize their own ballot, as Chaum notes ("they can check that their ballot is on display" [8]), which is good for checking and also lets them show it to a buyer.
- **Assumes:** ballots arrive without revealing the sender (Chaum's "without a return address"; on a network, an anonymous channel); permissions are issued well before ballots are cast, so timing does not link them; the issuer's signing key is used for nothing else [9].

### 4. Anonymous credentials: show you are allowed, many times, without being followed

**How it works.** A person receives a credential once and can then prove they hold it, again and again, without the showings being linked to each other or needing the issuer [10].

- **Gives:** one enrolment can cover many votes or several groups, without a new issuance each time. Camenisch and Lysyanskaya add a deterrent to sharing: lending one credential gives away all of them [10].
- **Costs:** more complex than blind signatures, with fewer standard libraries. One ballot per person needs an extra one-vote tag on top, since showings are unlinkable by design. Their scheme offers "optional anonymity revocation" [10]; CIP must not use it, because that is a built-in way to join a person to a ballot (rule 1).
- **Assumes:** the strong RSA and decisional Diffie-Hellman assumptions [10]; an anonymous channel, as above.

### 5. Zero-knowledge membership proofs: "I am on the roll, and I have not voted yet"

**How it works.** Each person registers a commitment (a sealed value derived from a secret only they hold). The roll is published as a Merkle tree of commitments. To vote, the person proves in zero knowledge that their commitment is in the tree, and attaches a one-vote tag: a hash of their secret and the vote's id. A second ballot with the same tag is refused. Semaphore lets a person "cast a message (for example, a vote...) as a provable group member without revealing your identity", with this tag mechanism to prevent double-signaling [11].

- **Gives:** no issuer at voting time, and nothing per key is posted when a person votes, so even who took part is hidden. This is closest to the paper's own choice of zk-SNARKs (§4.3.1).
- **Costs:** a zero-knowledge circuit and proof system, which are hard to write and to review. Some proof systems need public parameters made in a one-time setup: Semaphore's were made in a "Trusted Setup Ceremony" with over 400 participants [11]. Groth's pairing-based system is described as "preprocessing" [14]. Bulletproofs need no trusted setup, but checking time grows linearly with the size of what is proved [13]. A verifier would need new arithmetic (pairings, for pairing-based systems) and a proof checker. The Phase 3 verifiers have only the Ed25519 arithmetic that SPEC section 4.2 needs, and the Node one may use built-in modules only (CLAUDE.md). As with families 3 and 4, a voter who keeps their secret can prove which ballot is theirs.
- **Assumes:** the proof system is sound and, where there is a setup, that it was not subverted; an anonymous channel.

### Two things no family here gives on its own

**Receipt-freeness when people vote from their own devices.** Without the privacy of a voting booth, "a coercer or vote buyer can look over the shoulder of a voter" [3]. Benaloh notes that voters using their own devices "are subject to coercion as well as the risk of viruses" [18]. Helios does "not attempt to solve the coercion problem" and is meant for settings where "coercion is not a serious concern" [4]. Designs that aim for coercion resistance [17] need a complex registration and, in the view of Park and others, rest on the "unrealistic assumption" that voters' devices are uncompromised [3]. Estonia lets voters vote again, with only the last vote counted, which gives "relatively strong protection against in-person, individual coercion" but not against spyware or the servers [20]. MACI hides votes so a voter cannot prove their choice to a briber, but it "can provide collusion resistance only if the coordinator is honest", and the coordinator can decrypt votes [12]. The receipt-free schemes known in 1997 all relied on a physical assumption, such as a private channel, or else on a tamper-proof device [5].

**Protection from a compromised device.** Software that controls the device can read or change the vote before any encryption. A security review of the Voatz app found that an attacker with root access to a phone could learn the voter's choices and alter the vote [19]. A "Benaloh challenge" helps with changed votes: the device encrypts a ballot, and the voter may ask it to prove what is inside instead of casting it, so a device that cheats risks being caught [2] [18]. It cannot stop a device from leaking the vote.

### Summary

| Family | Who cannot learn how a key voted | Hides who took part | Ballot types | Needs at the end | Main extra assumption |
|---|---|---|---|---|---|
| 1. Mix-net | Anyone, if one shuffler is honest | No | Any | Shufflers, then trustees | One honest shuffler; correct shuffle proofs |
| 2. Homomorphic | Anyone short of k trustees acting together | No | Counting only | Trustees | Fewer than k collude; encryption holds for decades |
| 3. Blind signatures | Anyone, if ballots arrive anonymously and timing does not link them | Only if issuance is kept off the log; the issuer knows | Any (combine with 1 or 2) | Nothing extra | Anonymous channel; issuance and voting kept apart in time |
| 4. Anonymous credentials | Same as 3 | At voting time, yes | Any (combine with 1 or 2) | Nothing extra | Anonymous channel; newer assumptions |
| 5. Membership proofs | Same as 3 | Yes | Any (combine with 1 or 2) | Nothing extra | Sound proof system and setup; anonymous channel |

Families 3 to 5 hide **which key** cast a ballot, but on their own leave the choice readable to anyone who finds that link. Families 1 and 2 hide **what is in a sealed ballot**, but post it under its voter's key. Neither half alone meets rule 1 for good: an anonymous ballot in plain text is exposed the moment the anonymity fails (by timing, by network records), and an encrypted ballot under a registered key is exposed the moment the encryption fails. The proposal below therefore combines one of each.

## How each would sit on the Phase 3 log

**What would stay the same.** The test log of [prototype/SPEC.md](../prototype/SPEC.md) would hold ballots like any other entry. Canonical form (section 2) applies; large numbers are written as lowercase hex strings, because the spec allows only integers up to 2^53 − 1. Entries chain by hash (section 3), every record has a `type`, `author`, `body` and Ed25519 `sig` checked under the five rules of section 4.2, and checkpoints (section 5) cover ballots like everything else. That gives "recorded as cast" for free: a voter who keeps their ballot's entry hash and a checkpoint saved after it can show that the ballot was in the log, and anyone holding a later checkpoint can detect its removal (`TRUSTED_MISMATCH`, [checkpoints.md](checkpoints.md)).

**What would change.** New record types (so a new format string, for example `cip-test-log/1`, since the current one rejects unknown types as `BAD_BODY`), new rule checks and error codes, and arithmetic in both verifiers. Today, rule 6 of SPEC section 6 refuses any record whose author is not a registered key. A ballot that must not carry a registered key needs another way to show it is allowed.

| Family | What goes in the log | What the public can see | What verifiers would add |
|---|---|---|---|
| 1. Mix-net | Ballots signed by registered keys; one entry per shuffle, with its proof; decryption entries | Which keys voted; each opened ballot, unlinked | Shuffle proofs; decryption proofs; the count |
| 2. Homomorphic | Ballots signed by registered keys, with validity proofs; trustees' partial decryptions; the result | Which keys voted; totals only | Validity proofs; the combined total; decryption proofs |
| 3. Blind signatures | Token requests signed by registered keys; issuer's blind signatures; ballots signed by one-use keys, each carrying a token | Which keys asked for a token; ballots, unlinked to keys | RSA-PSS token checks; one ballot per token; ballots ≤ tokens issued |
| 4. Credentials | Credential issuance (on or off the log); ballots with a showing proof and a one-vote tag | Ballots, unlinked to keys | Showing proofs; one-vote tags unique |
| 5. Membership proofs | A commitment beside each registered key; the roll's Merkle root at vote opening; ballots with a membership proof and a one-vote tag | Ballots, unlinked to keys; not who voted | The roll root; membership proofs; one-vote tags unique |

## A proposed ballot shape, for review

This is a suggestion for reviewers to challenge, not a decision. It is for a first advisory test with a yes/no or pick-one question, on test data.

**Proposal: a blind-signed token for permission (family 3) and an encrypted choice added up by trustees (family 2).** The token keeps the ballot from naming a key, and the encryption keeps the choice hidden even if the token's anonymity fails. Only the total is ever opened, and only above the minimum count. Reasons for these two over the others: blind signatures are option C in [identity-linking.md](identity-linking.md); RFC 9474 is a published scheme [9] whose signatures both verifiers' existing libraries can check; and homomorphic counting is the family whose checks are meant to be simple to write [6]. Membership proofs (family 5) are the main alternative: no issuer, and participation stays hidden, at the cost of a proof system and perhaps a setup ceremony. Ranked ballots would need a mix-net (family 1), and quadratic voting range proofs; both are later work.

### The steps, as log entries

All record names and error codes below are illustrative.

1. **`vote_open`** (by the operator). Names the proposal id and the exact version being voted on (the proposal must be closed: its comment period is over), the options, and the windows for issuance and for voting (log time). It fixes the roll: every key registered before this entry. It names the token issuer's public key, the tally trustees (registered keys), the quorum k, the joint encryption key, a named parameter set, and the minimum number of ballots for opening.
2. **`token_request`** (by a key on the roll, during the issuance window). Holds the vote's id and a blinded value. One per key per vote.
3. **`token_grant`** (by the issuer). Points to the request and holds the blind signature.
4. A **gap** between the end of issuance and the start of voting, so that the time a token was granted does not line up with the time a ballot is cast.
5. **`ballot`** (by a one-use key, during the voting window). See below. The operator publishes ballots in batches, and every ballot in a batch gets the batch's time.
6. **`tally_share`** (by each trustee, after voting closes and only if the minimum count was reached). A partial decryption of each option's total, with a proof.
7. **`result`** (by the operator). The number of ballots counted and the count for each option, or a plain statement that the minimum was not reached. Verifiers recompute everything and do not trust this entry.

### The ballot record

```json
{
  "type": "ballot",
  "author": "<64 hex: an Ed25519 key made for this one ballot>",
  "body": {
    "vote": "<64 hex: entry hash of the vote_open entry>",
    "token_rand": "<64 hex: the 32 random bytes the RFC 9474 randomized variants add>",
    "token_sig": "<hex: the issuer's signature over the vote id and the author key>",
    "choices": [ { "a": "<hex>", "b": "<hex>", "proof": { "...": "fixed keys, set by the spec" } } ],
    "sum_proof": { "...": "fixed keys, set by the spec" }
  },
  "sig": "<128 hex: Ed25519 signature by the author key, as in SPEC section 4>"
}
```

| Field | Required | What it is | Why it cannot point at the voter |
|---|---|---|---|
| `author` | Yes | A fresh key made for this ballot only, not registered | Made after the token was blinded; never used anywhere else |
| `vote` | Yes | Which vote | Same for every ballot in the vote |
| `token_rand`, `token_sig` | Yes | Permission to cast one ballot: the issuer's signature over `vote` and `author` | Blind: the issuer never saw these values [9] |
| `choices` | Yes | One encrypted 0 or 1 per option (`a`, `b` are the two numbers of an ElGamal ciphertext), each with a proof that it holds 0 or 1 | Encrypted to the trustees' joint key; the encryption adds randomness, so equal votes look different [2] |
| `sum_proof` | Yes | Proof that the choices add up to exactly one (pick-one) | Reveals only that the ballot is valid |
| `sig` | Yes | Signature by `author` over the record | Ties the record to the one-use key only |

**Optional fields: none** (rule 4). With a 4096-bit group like ElectionGuard's [6], each of `a` and `b` is 1,024 hex characters, so every ballot in a vote has the same size, a few kilobytes per option.

**Never in a ballot:** a registered key, a name or label, a region or other trait (see the open questions on geographic rules), a device, browser or client version, a language, a time chosen by the client, free text, or anything else that could differ between voters except the randomness the cryptography needs.

### What a verifier would check, beyond SPEC sections 1 to 6

- `vote_open` names a closed proposal and its current version, and the trustee and issuer keys are registered.
- Each `token_request` is by a key on the roll, inside the issuance window, and the first from that key for this vote.
- Each `ballot` is inside the voting window; its `token_sig` verifies under the issuer key for exactly this `vote` and `author` (so one token cannot be reused with another key); no other counted ballot has the same `author`; every proof verifies. Every proof's hash includes the vote id and the author key, so a ballot's encryptions cannot be copied into another ballot ([5], [6], [15]).
- The number of counted ballots is no more than the number of `token_grant` entries for this vote. A voter cannot turn one grant into two tokens (conservation of signatures [8], one-more-forgery security [9]). An issuer that signs extra tokens outside the log is caught only once ballots outnumber logged grants: it could still cast ballots up to the number of tokens that were granted and never used, and nothing on the log tells those apart (open question 1).
- If the ballot count reaches the minimum: the encrypted totals are recomputed from the counted ballots, each `tally_share` proof verifies, at least k trustees took part, and the counts in `result` match. If not: no `tally_share` exists.

### The receipt

Once the ballot is logged, the voter keeps its entry hash, a hash that covers the encrypted ballot like ElectionGuard's confirmation code [6], and can check it against any checkpoint saved later. This is the paper's "encrypted ballot receipt" (§4.3.1). It shows that the ballot was recorded unchanged. It does not show the content, but a voter who keeps the randomness used to encrypt it, or their token, can prove the content to a buyer. **This design is therefore not receipt-free,** and nothing may say otherwise (rule 5).

### Who would have to do what to learn how someone voted

| To learn | They would need |
|---|---|
| How a given key voted | **Both:** link the key to its ballot (break the token's blindness, or match times or network records of issuance and casting) **and** open that one ballot (k trustees colluding, or breaking the encryption) |
| Which keys asked to take part | Nothing: `token_request` entries are public. This is a cost of putting issuance on the log (open question 4) |
| A vote's total early | k trustees colluding before voting closes |
| How a person voted | All of the above, plus the match between person and key that enrolment may leave ([identity-linking.md](identity-linking.md)) |

## What this design does not give

- **Receipt-freeness and coercion resistance** for ballots cast from people's own devices. None of the families here gives them (see above). This limits the design to low-stakes, advisory tests, the setting Helios was made for [4]. If anything with higher stakes were ever considered, the research points to supervised, in-person voting first: "The only responsible path forward for Internet voting is to implement polling-place E2E-V voting and gradually experiment" [2]. A national study recommends that marked ballots not be returned over the Internet at all [21]. CIP tests are not elections, but their ballots have the same weaknesses.
- **Protection from a compromised device** [19].
- **Protection from network records.** Whoever receives ballots sees where they come from. Rule 6 forbids keeping that, and nobody outside can check that it was not kept. In one real app, a passive observer of network traffic could potentially recover a voter's ballot [19].
- **Protection from an issuer who votes for people who did not.** See the count check above: the issuer could cast ballots in place of tokens that were granted and never used.
- **Protection from refusal.** An operator can decline to log a ballot. The voter can see that it is missing, but cannot prove they sent it.
- **One person, one ballot.** Only one ballot per key. One key per person is gate G5.
- **Privacy that lasts forever.** The log is kept as the record. Ballots in it are protected by encryption that may weaken with time, and RFC 9474 is "not post-quantum ready" [9]. Designs with "everlasting privacy" exist and have not been checked here (see the unchecked list).
- **Secrecy in a very small group.** A total of 12 to 1 says a lot about the one. Rule 7 and the pilot design's minimum count are the only defense.

## How this connects to the gates

- **G4, keys:** each ballot uses a one-use key; whether people can manage that, and what happens to a token if a key is recovered mid-vote, is open ([key-handling.md](key-handling.md)).
- **G5, one person one key:** item 6 there asks that the ballot design show that a key cannot be tied to a ballot. This draft is a starting point for that, not evidence of it.
- **G6, no behavior data:** rules 4 and 6 above.
- **G7, people can use it:** casting and checking must pass the same checks as every page, then testing by people.
- **G8, outside review:** nothing in this document may be called private, secret or anonymous until an outside cryptography review has happened ([advisory-notice.md](advisory-notice.md), "How to word a claim"). [review-brief.md](review-brief.md) says how that review would be asked for.
- **G10, what the result means:** a result with fewer ballots than the minimum is reported as a process only.

## What an outside reviewer would check

1. Whether the property definitions above are the right ones, and which formal definition each claim relies on [22].
2. Whether combining a blind token with an encrypted choice gives what the "who would have to do what" table says, and nothing less.
3. Every zero-knowledge proof: that it hashes the full statement and its context (strong Fiat-Shamir [15]), and that it cannot be satisfied by a cheating prover. In SwissPost's system the failures came from how the cryptography was implemented [16].
4. The RFC 9474 variant chosen (the RFC recommends two randomized variants and warns that a signing key must not be reused for another protocol [9]), what the issuer can do with timing, and how many unused tokens an issuer could vote with.
5. The count rule "ballots ≤ grants ≤ roll": whether any path lets an issuer or operator add ballots unseen.
6. The parameter set, and how ciphertexts and proofs are encoded in canonical form, so that two verifiers cannot read the same ballot two ways (the Phase 3 lesson of SPEC section 4.2).
7. The trustees' key generation and the quorum k: what fewer than k can learn, what happens if trustees refuse to take part, and who they are.
8. Metadata: batch times, entry sizes, the gap between windows, and whether anything in a ballot can differ between voters beyond randomness.
9. What stays in the public log forever, and what a future break of the encryption would expose.
10. Whether any screen or document claims more than this (receipt-freeness, coercion resistance, "anonymous").
11. That two verifiers written by different people agree on valid and corrupted ballots, as for the Phase 3 log (gate G1).

## What would count as this design being ready to build (a proposal)

1. An outside cryptographer has reviewed this document and the threat model, and the findings are published with a status ([review-brief.md](review-brief.md)).
2. The record types are written into a spec as exactly as SPEC.md, with test vectors whose expected results are computed from the arithmetic, not from a library.
3. The open questions below have answers, even if an answer is "accepted limitation" with a reason.

## What this document does not claim

- It does not claim that any design here makes remote voting safe for elections. Several of the sources it cites warn against that [2] [3] [21].
- It does not claim the paper's three tools are wrong. It says what each one does and does not do.
- It has not been reviewed by a cryptographer, and the record shapes are sketches.
- It names no community, promises no partner or funding, and gives no dates.

## Open questions

1. Blind token (family 3) or membership proof (family 5) for permission? The first is simpler to check. The second needs no issuer, hides who took part, and leaves no issuer able to vote with unused tokens. If tokens, should several issuers each have to sign, so that no single one can make tokens?
2. Is homomorphic counting enough for a first test, or should a first test wait for a mix-net so ranked ballots are possible?
3. Who are the tally trustees, how many, and what quorum? Should any institution named in the paper (universities, libraries, the Judicial Guard) be one?
4. Should token requests be on the log (the count can be audited, but who took part is public per key) or off it (participation private, count taken on the issuer's word)?
5. Should a voter be able to replace their ballot, with the last one counted, as in Estonia [20]? With a token, a buyer holding the token could replace it too.
6. How are ballots sent so the receiver cannot see who sent them, without a third-party service, an outside address or behavior data?
7. How long is the gap between issuance and voting, and how large is a batch? Do they protect anything in a small group, or only look as if they do?
8. Geographic rules (§4.4.1): can region be counted without writing it on the ballot, for example one roll and one token issuer per region with a minimum size for each?
9. Delegation (§4.4.2): can a delegate's weight be counted when ballots are sealed and delegations are visible, without showing how delegators voted?
10. Quadratic voting (§4.4.3): which range proof, and can both verifiers check it with few dependencies?
11. The log is permanent and the encryption is not. Should encrypted ballots live outside the log with only their hashes inside, so they can be deleted after the check period, at the cost of later re-checking?
12. Should mail-in and in-person ballots (§4.6.1) go into the same tally, and how would they be checked?
13. What is the right minimum count before a total is opened, and should it depend on the number of options?
14. The one-use key per ballot: is it a burden people can carry, and should the client delete it after voting?

## Sources

Opened on 28 October 2026. "Full text" means the document was read; "abstract" means only the abstract or summary page was read, and the claim cited is from that page.

- [1] Duke Johnson and Claude (Anthropic), *Citizens Internet Portal: Structural Incorruptibility Through Distributed Democratic Architecture*, dated 29 December 2025. PDF from the research-hub repository; read §4.2 to §4.6 and the roadmap. Cited by section number in the text.
- [2] J. Benaloh, R. Rivest, P. Y. A. Ryan, P. Stark, V. Teague, P. Vora, "End-to-end verifiability", 2015, arXiv:1504.03778. Full text.
- [3] S. Park, M. Specter, N. Narula, R. L. Rivest, "Going from bad to worse: from Internet voting to blockchain voting", *Journal of Cybersecurity* 7(1), tyaa025, 2021. Journal page and the authors' November 2020 draft, full text.
- [4] B. Adida, "Helios: Web-based open-audit voting", 17th USENIX Security Symposium, 2008. Full text.
- [5] R. Cramer, R. Gennaro, B. Schoenmakers, "A secure and optimally efficient multi-authority election scheme", EUROCRYPT 1997, LNCS 1233, pp. 103 to 118. Author's copy, full text.
- [6] J. Benaloh, M. Naehrig, O. Pereira, D. S. Wallach, "ElectionGuard: a cryptographic toolkit to enable verifiable elections", 33rd USENIX Security Symposium, 2024. Full text.
- [7] D. Chaum, "Untraceable electronic mail, return addresses, and digital pseudonyms", *Communications of the ACM* 24(2), February 1981. Full text (scan).
- [8] D. Chaum, "Blind signatures for untraceable payments", *Advances in Cryptology* (Crypto '82 proceedings), pp. 199 to 203. Full text (scan).
- [9] F. Denis, F. Jacobs, C. A. Wood, *RSA Blind Signatures*, RFC 9474 (Informational, IRTF CFRG), 2023. Abstract and sections 5 to 7.
- [10] J. Camenisch, A. Lysyanskaya, "An efficient system for non-transferable anonymous credentials with optional anonymity revocation", EUROCRYPT 2001; Cryptology ePrint Archive 2001/019. Abstract.
- [11] Semaphore documentation, version 4: "What is Semaphore?" and the circuits reference, docs.semaphore.pse.dev.
- [12] MACI documentation, version 3: "What is MACI?", maci.pse.dev.
- [13] B. Bünz, J. Bootle, D. Boneh, A. Poelstra, P. Wuille, G. Maxwell, "Bulletproofs: short proofs for confidential transactions and more", IEEE S&P 2018; ePrint 2017/1066. Abstract.
- [14] J. Groth, "On the size of pairing-based non-interactive arguments", EUROCRYPT 2016; ePrint 2016/260. Abstract.
- [15] D. Bernhard, O. Pereira, B. Warinschi, "How not to prove yourself: pitfalls of the Fiat-Shamir heuristic and applications to Helios", ASIACRYPT 2012; revised as ePrint 2016/771. Abstract.
- [16] T. Haines, S. J. Lewis, O. Pereira, V. Teague, "How not to prove your election outcome", IEEE S&P 2020. Abstract (openprivacy.ca).
- [17] A. Juels, D. Catalano, M. Jakobsson, "Coercion-resistant electronic elections", ePrint 2002/165. Abstract.
- [18] J. Benaloh, "Ballot casting assurance via voter-initiated poll station auditing", USENIX EVT 2007. Full text.
- [19] M. A. Specter, J. Koppel, D. Weitzner, "The ballot is busted before the blockchain: a security analysis of Voatz, the first Internet voting application used in U.S. federal elections", 29th USENIX Security Symposium, 2020. Full text.
- [20] D. Springall, T. Finkenauer, Z. Durumeric, J. Kitcat, H. Hursti, M. MacAlpine, J. A. Halderman, "Security analysis of the Estonian Internet voting system", ACM CCS 2014. Full text.
- [21] National Academies of Sciences, Engineering, and Medicine, *Securing the Vote: Protecting American Democracy*, 2018. Summary page only.
- [22] V. Cortier, D. Galindo, R. Küsters, J. Müller, T. Truderung, "Verifiability notions for e-voting protocols", IEEE S&P 2016; ePrint 2016/287. Abstract.

**Not opened (unchecked).** Listed because a reviewer would expect them; nothing above relies on them: A. Fujioka, T. Okamoto, K. Ohta, voting with blind signatures (AUSCRYPT 1992); J. Benaloh, D. Tuinstra, receipt-free elections (STOC 1994); K. Sako, J. Kilian, receipt-free mix-net voting (EUROCRYPT 1995); T. Moran, M. Naor, voting with everlasting privacy (CRYPTO 2006); M. Clarkson, S. Chong, A. Myers, Civitas (IEEE S&P 2008); P. Iovino and others, Selene; R. Rivest, software independence (2008); the ElectionGuard specification; and the full texts of [10] and [13] to [17], [21] and [22].

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
