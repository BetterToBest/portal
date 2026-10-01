# CIP Data Collection Policy (proposal v0.1)

Status: **draft proposal for review.** It answers issue #3 (telemetry versus the no-behavior-data rule). Nothing here is decided until the group agrees, and none of it is the paper's own design except where a section is cited.

## The conflict

- The project rule ([CONTRIBUTING.md](../CONTRIBUTING.md)): nothing may collect or monetize user behavior data.
- Paper §4.6.2 (Privacy Protection): no surveillance or tracking beyond necessary verification.
- Paper §4.5.2 lists data collection on system usage patterns, user experience research, A/B testing of interface improvements, and performance metrics. Paper §7.3.3 adds quarterly metrics and real-time dashboards, and §9.4.2 lists longitudinal studies of participants.

Read literally, some of those items would track individuals. The proposal below keeps the goals (a system that improves with evidence) and drops the tracking.

## Proposed rule: three tiers

**Tier 1: never collected, by design.** Enforced by the software not having the code, not by a promise.
- Per-person clickstreams, session recordings, or "who looked at what".
- Device fingerprints, advertising identifiers, cross-session identifiers.
- Any link between a person's identity and how they voted, browsed, or deliberated.
- Third-party analytics or tracking scripts in any client.
- Anything sold, shared for advertising, or used to profile people.

**Tier 2: allowed, with no identifiers.**
- Numbers already public on the ledger by design: proposals filed, signatures counted, ballots counted per vote (participation).
- Operational counters per node, not per person: request counts, error rates, latency. IP addresses are not stored beyond the short-lived memory that rate limiting needs.
- Crash and error counts with no user content attached.

**Tier 3: opt-in only, with consent that can be withdrawn.**
- Usability studies with volunteer panels.
- Satisfaction and feedback surveys (anonymous, optional).
- Longitudinal research on participants (§9.4.2), under a published protocol, a stated retention limit, and deletion on request.
- A "diagnostic report" a person reviews and chooses to send.

## What replaces A/B testing

Splitting live users into groups and measuring behavior is tracking by another name. Proposed replacements:

1. Usability tests with consenting volunteer panels.
2. An opt-in preview channel: people who choose it get changes early and can say what broke.
3. Gradual rollout by node or region (already in §4.5.2), judged on Tier 2 numbers and on published feedback, not on individual behavior.

**Ballots get a stricter rule.** Nobody may test different ballot layouts, wordings, or option orders on different voters to see what changes their choices. A ballot design that nudges votes is a manipulation channel, and the paper's own threat list includes micro-targeting (§3.2). Ballot presentation follows one published rule for everyone. If option order is randomized to reduce position bias, the rule and the method are published and auditable.

## How the paper's items would map

| Paper item | Proposed treatment |
|---|---|
| Data collection on usage patterns (§4.5.2) | Tier 2 aggregates only |
| User experience research (§4.5.2) | Tier 3, volunteer panels |
| A/B testing of interface (§4.5.2) | Replaced by panels and opt-in preview; forbidden for ballots |
| Performance metrics (§4.5.2, §7.3.3) | Participation from the public ledger; satisfaction from opt-in surveys |
| Longitudinal participant studies (§9.4.2) | Tier 3 only |

## Aggregates can still leak

- **Small groups.** A count for a group of three people identifies them. Suggested starting point: suppress or merge any published breakdown with fewer than 20 people. The number is a placeholder to be tuned.
- **Timing.** If ballot timestamps are public, the time someone votes may be matched to network activity outside the system. Batching ballots before publication is one possible answer. This needs cryptography review.

## Enforcement ideas for the prototype

- A repository check that fails the build if client code contacts any address not on a published list.
- A content security policy that blocks third-party requests.
- Independent audits (§4.5.1) that include a "no telemetry" review of client and node code.

## Suggested wording changes to the paper (not edits, for the errata list)

- §4.5.2: replace "Data collection on system usage patterns" with "Aggregate, non-identifying system metrics".
- §4.5.2: replace "A/B testing of interface improvements" with "Usability testing with consenting volunteer panels and opt-in preview releases".
- §4.5.2: add a sentence that ballot presentation is never varied between voters.

## Open questions for reviewers

1. Is the Tier 2 list minimal enough? What else leaks?
2. Who audits the Tier 1 promise, and how often?
3. Is a preview channel a fair sample, or does it bias what gets fixed?
4. Are ballot timestamps and batching compatible with the verifiable-receipt design (§4.3)?
5. Fonts: resolved. The project's own pages now serve their fonts from `assets/fonts/` (see the README there), so visiting them sends nothing to a font service. Open for reviewers: should the repository check in Enforcement ideas also cover fonts and images?
