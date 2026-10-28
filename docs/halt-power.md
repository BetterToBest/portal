# Judicial Guard Halt Power: Limits (proposal v0.1)

Status: **draft proposal for review.** It answers issue #4. The paper says "detected attacks can be halted pending investigation" (§4.2.3, safeguard 6) and gives no limits. Everything below is a starting design for people to attack. The numbers are placeholders for a simulator to test, not figures from the paper.

## The risk

A halt power that is easy to trigger is itself an attack. A captured Guard, or an attacker who fakes an emergency, could freeze a vote it does not like. The design goal is a halt that is rare, narrow, short, visible, contestable, and never able to decide an outcome.

## What a halt is

A halt **holds** certification of results and new writes in a defined scope. It never deletes, edits, or reorders records, and it never discards ballots already cast. Reading and verifying stay open to everyone.

| Level | Effect | Who must agree |
|---|---|---|
| Flag | Public alert, no functional effect | Any one guardian (individual authority is kept, per Appendix A) |
| Scoped hold | Pauses certification of one result, or writes on one chain or region | 5 guardians from at least 3 regions, all attaching the same evidence |
| Full pause | Pauses new writes on all chains | At least 1% of the corps (minimum 15) from at least 5 regions, with notice to the Oversight Board |

The Oversight Board does not trigger or lift holds. The paper bars it from directing or ending specific investigations (Appendix A.3), and this keeps that line. It receives notice and publishes review.

## Allowed triggers: evidence anyone can check

- Independent chain implementations disagree about a finalized state (§4.2.1).
- Signed conflicting records from one node (the equivocation that slashing targets, §4.2.3).
- A tally proof fails cryptographic verification (§4.3).
- Evidence that one operator group crosses a consensus limit (§4.2.2, §4.2.3).

**Not triggers:** an unpopular result, an unverified fraud claim, outside pressure, or a general appeal to security. If a trigger cannot be checked by an independent node, it is not enough.

## Duration and expiry

- Scoped hold: expires after 72 hours. Full pause: expires after 24 hours.
- Ends early and automatically once independent implementations confirm the trigger no longer holds.
- An extension needs new evidence and a fresh concurrence from guardians who did not sign the first one.
- Hard cap of 14 days in total. Past the cap, continuing needs a community supermajority vote on chains still running (§4.5.2 sends major changes to a vote).

## Votes already under way

- Ballots cast stay sealed and valid.
- The voting window is extended by exactly the length of the hold, so a halt cannot run out the clock on a vote.
- Results are not published during the hold, and the counting rule cannot change because of it.
- A hold on a vote is limited to the chain or region where the evidence is.

## Challenge and review

- Any verified citizen or node operator can challenge a hold.
- A review panel, drawn by lottery from guardians in regions other than the signers' (using verifiable public randomness), must decide within 24 hours. It can lift a hold. It cannot extend one.
- Overturned holds appear on a public scorecard next to each signer, in the same spirit as the public dashboard of referrals and declinations in Appendix A.6. Signers of repeatedly overturned holds lose eligibility to concur in holds.

## Public log

Every flag, hold, pause, extension, and lift is published at once on all chains and on a public mirror: scope, reason code, evidence hash, signers, expiry, and outcome. Sensitive evidence may be released later, but the existence, scope, and signers never wait. The log cannot live only on the chain being halted.

## Abuse scenarios

| Attack | Why it is hard under this proposal |
|---|---|
| Captured guardians freeze an inconvenient vote | Needs 5 signers across 3 regions plus checkable evidence; expires in 72 hours; window extended; public log; open to challenge |
| Attacker fakes a chain disagreement to force a hold | The evidence must be reproducible by any node; false submissions cost the submitter stake (§4.2.3 slashing) |
| Repeated short holds to stall a decision | Fresh signers needed for each extension; 14-day cap; scorecard |
| Guardians in several regions collude | Still expires, still public, still challengeable, and cannot alter or discard ballots |

## What the model shows

*Illustrative model output, not a prediction; every threshold is a placeholder.*

[tests/fork-sweep.js](../tests/fork-sweep.js) runs the guardian part of the [fork simulator](https://bettertobest.github.io/portal/simulator/fork/) against the thresholds above, for corps of 500, 1,000 and 2,000 guardians (the paper's range). Guardians are split evenly over 50 regions, and the review panel has 7 members, of whom 4 can lift a hold; the panel size is a placeholder of the simulator, not of this draft. Each cell is the smallest colluding group, over the two placements the simulator offers (spread evenly, or packed into as few regions as possible). The model gives the colluders their best case: it assumes they can produce the evidence a hold needs, which the draft says must be checkable by any independent node, and for a real halt it assumes the honest signers come from the regions with the fewest colluders, which leaves the most colluders in the panel pool. Each hold gets one challenge and one panel. [tests/fork.test.js](../tests/fork.test.js) fails if this table falls out of step with the simulator.

<!-- fork-sweep:start -->
| Smallest colluding group that can | 500 guardians | 1,000 guardians | 2,000 guardians |
|---|---|---|---|
| Force a false scoped hold (72 hours) | 5 (1.0%) | 5 (0.5%) | 5 (0.3%) |
| Force a false full pause (24 hours) | 15 (3.0%) | 15 (1.5%) | 20 (1.0%) |
| Stall to the 14-day cap with scoped holds | 25 (5.0%) | 25 (2.5%) | 25 (1.3%) |
| Stall to the 14-day cap with full pauses | 210 (42.0%) | 210 (21.0%) | 280 (14.0%) |
| Keep a false scoped hold past review, 1 in 100 chance | 71 (14.2%) | 141 (14.1%) | 284 (14.2%) |
| Keep a false scoped hold past review, even odds | 251 (50.2%) | 501 (50.1%) | 997 (49.9%) |
| Block a real scoped hold by lifting it in review, 1 in 100 chance | 68 (13.6%) | 135 (13.5%) | 269 (13.4%) |
| Block a real scoped hold by lifting it in review, even odds | 236 (47.2%) | 471 (47.1%) | 940 (47.0%) |
| Block a real full pause by lifting it in review, even odds | 226 (45.2%) | 450 (45.0%) | 900 (45.0%) |
| Block a real scoped hold by refusing to sign | 480 (96.0%) | 960 (96.0%) | 1,920 (96.0%) |
| Block a real full pause by refusing to sign | 460 (92.0%) | 920 (92.0%) | 1,840 (92.0%) |
<!-- fork-sweep:end -->

What this suggests, if the model is right:

- **Signing a false hold is cheap.** 5 colluding guardians in 3 regions can sign a scoped hold at any corps size, and 25 can chain holds with fresh signers up to the 14-day cap. The signer counts do not stop a small captured group; the evidence test, expiry, the extended voting window and review do. The evidence test carries the most weight, and the model does not test it.
- **The minimum of 15 decides the full pause for smaller corps.** At 500 and 1,000 guardians, 1% would be 5 and 10, so the floor of 15 applies and the share needed falls from 3% to 1% as the corps grows.
- **Review cuts both ways.** About 13 to 14% of the corps gives colluders a 1 in 100 chance of holding a 7-member panel: enough to keep a false hold in place or to lift a real one. About half the corps gives even odds. A packed group does a little better at lifting a real halt (45 to 47%), because the honest signers' regions are left out of the pool.
- **Refusing to sign is not a practical way to block a real halt.** It needs 92 to 96% of the corps, all but 2 or 4 regions' worth of guardians. Lifting a real hold in review is the weaker point.

Not modelled: repeated challenges (the draft does not say whether a hold can be challenged again; if each challenge draws a new panel, a 1 in 100 chance adds up over draws), the scorecard and loss of eligibility, slashing, bribes to honest guardians, regions of unequal size, and real evidence checks.

## Open questions

1. Can a hold be tested against real attack strategies? A first model is the [ledger fork and halt-power simulator](https://bettertobest.github.io/portal/simulator/fork/) (issue #6), and its first numbers are in [What the model shows](#what-the-model-shows). They suggest three questions: should the scoped-hold signer count grow with the corps, should a hold get only one challenge, and how large should the review panel be? The thresholds above are still guesses.
2. A community vote on whether to continue past the cap runs on the very system that is partly halted. Is that circular?
3. How do guardians authenticate evidence without one trusted verifier?
4. Should a Flag from one guardian carry any cost, to deter spam?

## Suggested wording change to the paper (not an edit)

§4.2.3, safeguard 6: "Judicial Guard hold, limited by the trigger, concurrence, expiry, challenge, and public-log rules in the halt-power proposal."
