# Good first issues

Each is small and self-contained. Suggested labels are in brackets. These are now open as GitHub issues: pick one there and say you are working on it.

1. **Extract paper §4.2.3 (51% attacks) into the threat model** [documentation, good first issue]
   Done. See the section on 51% attacks in [threat-model.md](threat-model.md). No issue was opened for it.
2. **[Review the threat model for gaps](https://github.com/BetterToBest/portal/issues/8)** [review, security] (#8)
   Read `docs/threat-model.md` and post threats or mitigations we missed. The [review brief](review-brief.md) says what a fuller review would cover and how findings are published.
3. **[Draft a ballot and proposal data schema](https://github.com/BetterToBest/portal/issues/9)** [spec] (#9)
   Propose a JSON shape for a proposal, a signature, and a sealed ballot. Keep it minimal. Partly done: the proposal, signature, comment and amendment shapes for the Phase 3 test log are a [JSON Schema](../prototype/schema/cip-test-log.schema.json) with examples. Still open: the sealed ballot, and any change you think the existing shapes need.
4. **[Write a plain-language glossary of CIP terms](https://github.com/BetterToBest/portal/issues/10)** [documentation, good first issue] (#10)
   One or two sentences each for ledger, zero-knowledge proof, liquid delegation, quadratic voting, Judicial Guard.
5. **[Accessibility check of the landing page](https://github.com/BetterToBest/portal/issues/11)** [a11y, good first issue] (#11)
   Test keyboard navigation, contrast and a screen reader. Report or fix what you find.
6. **[Document the delegation cycle and cap rules in voting-rules.md](https://github.com/BetterToBest/portal/issues/12)** [documentation, spec] (#12)
   The cycle handling is built in the liquid demo. What remains is writing the rule down and reviewing it. A draft is in [voting-rules.md](voting-rules.md).
7. **[Propose ranked-choice tie-break rules](https://github.com/BetterToBest/portal/issues/13)** [spec] (#13)
   A draft is in [ranked-choice.md](ranked-choice.md). It needs review before anything is built on it.
8. **[Draft a one-page pilot brief for a community group](https://github.com/BetterToBest/portal/issues/14)** [outreach, good first issue] (#14)
   Explain what a small advisory vote on CIP would involve, in plain language. Write it from the [pilot design](pilot-design.md) once that has been reviewed, and say only what the design says. Use the wording in the [advisory notice](advisory-notice.md) draft for what the vote is and is not.

Larger open items are in the [issue list](https://github.com/BetterToBest/portal/issues) too, for example the oversight-body numbers (#2), telemetry (#3), the halt power (#4), the ranked-choice simulator (#5), the ledger fork simulation (#6) and the accessibility pass on both simulators (#7).
