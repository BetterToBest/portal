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
- Overturned holds appear on a public scorecard next to each signer, in the same spirit as the referral and declination scorecard in Appendix A.8. Signers of repeatedly overturned holds lose eligibility to concur in holds.

## Public log

Every flag, hold, pause, extension, and lift is published at once on all chains and on a public mirror: scope, reason code, evidence hash, signers, expiry, and outcome. Sensitive evidence may be released later, but the existence, scope, and signers never wait. The log cannot live only on the chain being halted.

## Abuse scenarios

| Attack | Why it is hard under this proposal |
|---|---|
| Captured guardians freeze an inconvenient vote | Needs 5 signers across 3 regions plus checkable evidence; expires in 72 hours; window extended; public log; open to challenge |
| Attacker fakes a chain disagreement to force a hold | The evidence must be reproducible by any node; false submissions cost the submitter stake (§4.2.3 slashing) |
| Repeated short holds to stall a decision | Fresh signers needed for each extension; 14-day cap; scorecard |
| Guardians in several regions collude | Still expires, still public, still challengeable, and cannot alter or discard ballots |

## Open questions

1. Can a hold be tested against real attack strategies? A first model is the [ledger fork and halt-power simulator](https://bettertobest.github.io/portal/simulator/fork/) (issue #6). It tests colluding guardians against these thresholds, but the thresholds above are still guesses.
2. A community vote on whether to continue past the cap runs on the very system that is partly halted. Is that circular?
3. How do guardians authenticate evidence without one trusted verifier?
4. Should a Flag from one guardian carry any cost, to deter spam?

## Suggested wording change to the paper (not an edit)

§4.2.3, safeguard 6: "Judicial Guard hold, limited by the trigger, concurrence, expiry, challenge, and public-log rules in the halt-power proposal."
