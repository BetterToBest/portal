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
| 51% attack | Addressed in §4.2.3 (details to be extracted here) | Open |
| Single implementation bug | Several implementations so one flaw does not compromise the whole (§4.2.1) | Proposed |
| Vote buying or coercion | Verifiable but unlinkable ballots (§4.3); reduced incentive when basic needs are met (§6) | Proposed |
| Learning how someone voted | Zero-knowledge proofs, homomorphic encryption (§4.3) | Proposed |
| Lost or stolen keys | Keys stay with the citizen; social recovery through trusted contacts (§4.3) | Proposed |
| Insecure software | Regular independent audits and transparent disclosure (§4.5.1) | Proposed |
| Excluding people without devices or skills | Multiple access channels, literacy support, no mandatory participation (§4.6) | Proposed |
| Blocked accountability | Distributed Judicial Guard with concurrent prosecution paths and a public referral dashboard (§5, A.8) | Proposed |

## Out of scope for the first prototype

Real elections, legal authority, and the Judicial Guard institution. The prototype targets advisory, low-stakes votes only.

## Open questions

1. How is one-person-one-identity established without creating a surveillance database?
2. How does the design behave when connectivity or nodes partially fail?
3. What is the incident-response process when a flaw is found in a live pilot?
4. Which threats above can be tested in a simulator before any real deployment?
