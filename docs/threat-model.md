# CIP Threat Model (draft v0.1)

Status: **draft for review.** Everything here traces to the [CIP paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) (section numbers in brackets) and is a proposal, not a tested design. Challenges and gaps are the most valuable contributions you can make.

## Security goals (paper §4.1)

No single point of failure. Transparent operations. Cryptographic verification instead of trust in authorities. Economic independence for participants. Community consensus for system changes. Graceful degradation. Accessible participation.

## Who we defend against (paper §3.2)

- Wealthy interests using financial capture (campaign money, lobbying)
- Insiders and officials using regulatory or judicial capture
- Coordinated influence networks using narrative capture (bots, micro-targeting)
- Well-resourced actors, including nation-states (the paper's cost analysis targets these)
- Corrupt or captured prosecutors who decline to act (paper §5.3, Appendix A.8)

## Threats and proposed mitigations

| Threat | Proposed mitigation | Status |
|---|---|---|
| Rewriting or deleting records | Multiple independent blockchain implementations with cross-chain verification (§4.2.1) | Proposed |
| Capturing the operators | Nodes in all 50 states, at most 10% in one location, no funder above 5%, mixed institutional operators (§4.2.2) | Proposed |
| 51% attack | Six overlapping safeguards: proof-of-stake with slashing, verified identity, geographic and institutional consensus, time delays, Judicial Guard halt (§4.2.3; see below) | Proposed |
| Single implementation bug | Several implementations so one flaw does not compromise the whole (§4.2.1) | Proposed |
| Vote buying or coercion | Verifiable but unlinkable ballots (§4.3); reduced incentive when basic needs are met (§6) | Proposed |
| Learning how someone voted | Zero-knowledge proofs, homomorphic encryption (§4.3) | Proposed |
| Lost or stolen keys | Keys stay with the citizen; social recovery through trusted contacts (§4.3) | Proposed |
| Insecure software | Regular independent audits and transparent disclosure (§4.5.1) | Proposed |
| Excluding people without devices or skills | Multiple access channels, literacy support, no mandatory participation (§4.6) | Proposed |
| Blocked accountability | Distributed Judicial Guard with concurrent prosecution paths and a public referral dashboard (§5, A.8) | Proposed |

## How the paper proposes to prevent a 51% attack (paper §4.2.3)

The paper names the classic risk: if attackers control more than half the nodes, they can manipulate consensus. It proposes six overlapping safeguards. All are proposals, not tested designs.

1. **Proof-of-stake with slashing.** Malicious behavior costs the attacker their stake, so attacks are expensive.
2. **Identity verification.** Each citizen-node is linked to a verified identity rather than being anonymous.
3. **Geographic requirements.** Consensus needs a majority across several regions at the same time.
4. **Institutional diversity.** Consensus needs agreement across types of operator (universities, libraries, non-profits, individuals).
5. **Time delays.** Major changes need consensus sustained over days or weeks.
6. **Judicial Guard override.** Detected attacks can be halted pending investigation.

### Gaps and questions for reviewers

- **Stake and wealth.** Safeguard 1 makes attacks expensive, but a stake requirement can also favor wealthy operators. How does this fit the 5% funder cap and the "economic independence" goal (§4.1)?
- **Identity versus privacy.** Safeguard 2 asks for verified, non-anonymous nodes. Open question 1 above asks how to establish one-person-one-identity without a surveillance database. These pull against each other and need an explicit answer.
- **Halt power.** Safeguard 6 lets the Judicial Guard halt the system on a detected attack. What limits it? Suggested starting points: a stated trigger, automatic expiry, and public logging of every halt. A halt power that is easy to trigger is itself an attack surface.
- **Unspecified numbers.** The paper does not give the delay lengths in safeguard 5 or the region and institution quotas in safeguards 3 and 4. A simulator could test which values actually hold.

## Security process (paper §4.5)

- **Audits (§4.5.1):** quarterly independent code audits, annual full system reviews, bug bounties, penetration testing, and publication of findings after mitigation.
- **Continuous improvement (§4.5.2):** the paper lists data collection on usage patterns and A/B testing of interface changes. This sits uneasily with the goal of no behavior data. Reviewers should settle exactly what, if anything, is collected, and whether it can be done without tracking individuals.
- **Governance of changes (§4.5.2):** technical changes go to a community vote, major architectural changes need a supermajority, and rollouts are gradual with the ability to revert.

## Inconsistencies in the paper (tracked as issues)

- **Oversight body size.** A 7-member board with a 5-of-7 supermajority appears in §5.4 and Appendix A.3. A "6/9" supermajority and tripartite appointment appear in §8.3.2 and §9.6. These need to be reconciled.
- **Telemetry versus privacy.** See §4.5.2 above.
- **Halt-power limits.** The Judicial Guard override (§4.2.3) has no stated limits.

## Notes on thresholds

- The **1,000-signature threshold for initiating a proposal** is an accepted starting point taken from the author's earlier Medium article. It may change, so keep this caveat wherever the number appears.
- Appendix A.8 uses a separate pair of figures (1,000 versus 5,000 signatures) for citizen grand jury cases. That is a different mechanism from proposal initiation.

## Out of scope for the first prototype

Real elections, legal authority, and the Judicial Guard institution. The prototype targets advisory, low-stakes votes only.

## Open questions

1. How is one-person-one-identity established without creating a surveillance database?
2. How does the design behave when connectivity or nodes partially fail?
3. What is the incident-response process when a flaw is found in a live pilot?
4. Which threats above can be tested in a simulator before any real deployment?
