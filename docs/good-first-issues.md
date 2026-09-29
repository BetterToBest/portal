# Good first issues (ready to copy into GitHub Issues)

Each is small and self-contained. Suggested labels are in brackets.

1. **Extract paper §4.2.3 (51% attacks) into the threat model** [docs, good first issue]
   Read the section and add a short, sourced summary to `docs/threat-model.md`.
2. **Review the threat model for gaps** [review, security]
   Read `docs/threat-model.md` and post threats or mitigations we missed.
3. **Draft a ballot and proposal data schema** [spec]
   Propose a JSON shape for a proposal, a signature, and a sealed ballot. Keep it minimal.
4. **Write a plain-language glossary of CIP terms** [docs, good first issue]
   One or two sentences each for ledger, zero-knowledge proof, liquid delegation, quadratic voting, Judicial Guard.
5. **Accessibility check of the landing page** [a11y, good first issue]
   Test keyboard navigation, contrast and a screen reader. Report or fix what you find.
6. **Handle delegation cycles in the liquid demo** [dev]
   A delegates to B and B to A. Detect it and show what happens. Document the rule in `docs/voting-rules.md`.
7. **Propose ranked-choice tie-break rules** [spec]
   Compare two or three common approaches and recommend one for advisory votes.
8. **Draft a one-page pilot brief for a community group** [outreach, good first issue]
   Explain what a small advisory vote on CIP would involve, in plain language.
