# Milestone plan (draft v0.1)

Status: **draft for review.** This turns the build roadmap in [CONTRIBUTING.md](../CONTRIBUTING.md) into outcomes that a reviewer, a contributor or a funder can check. CIP is a research proposal, not a live voting system, and every design here is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html). No dates are promised: a milestone is done when its checks pass.

Nothing in this plan may collect or monetize user behavior data. That is a core principle of the project, and each milestone is checked against it.

## Where the project stands

| Area | What exists |
|---|---|
| Overview and contributor guide | Live (Phase 0) |
| Draft specs | Threat model, voting rules, ranked-choice rules, halt-power limits, data-collection policy in `/docs` (Phase 1, in progress) |
| Simulators | Four browser models: one person one vote versus quadratic voting, liquid delegation, ranked-choice tie-breaks, ledger fork and halt power (Phase 2) |
| Prototype | Phase 3 has started: a tamper-evident test log for proposals, signatures and comment periods, with two verifiers and corrupted test logs, in `/prototype` (test data only; a viewer page checks a log in the browser, and a draft test plan lists what must pass before any real vote) |
| Quality checks | Engine tests for the ranked-choice counter run automatically when that page or the tests change; accessibility checks with automated tools |
| Starter issues | Seven starter issues open for newcomers (#8 to #14), none claimed yet |

## Low outcome: specs people can review

The smallest useful result. A reader can see exactly what CIP would do and challenge it.

- Every draft in `/docs` has had at least one outside review, recorded on its issue (#3, #4, #12, #13 and the threat model in #8).
- A proposal and ballot data schema exists (#9).
- A plain-language glossary exists (#10).
- Every placeholder number in the drafts is either backed by a source or marked as a placeholder.
- The oversight-body numbers are settled and the wording in the paper and the docs agrees (#2).

**Check:** a newcomer can read `/docs` without the paper and say what each rule is, where it came from, and which parts are undecided.

## Medium outcome: models that have been tested by people

- All four simulators have been tried with real assistive technology (screen reader and keyboard only) and the findings are fixed or logged (#7, #11).
- At least two contributors outside the maintainer have merged a change.
- The simulators cover the main open questions in the drafts: the delegation cap, loops, topic limits and renewal, tie-breaks, and the halt-power thresholds. Each result is labeled illustrative.
- A one-page pilot brief exists for a community group (#14).

**Check:** someone who did not build a simulator can use it, understand its limits, and point to the rule it informs.

## Large outcome: a prototype that can be inspected

Phase 3 of the roadmap, planned in [phase-3-plan.md](phase-3-plan.md). Open source, under Apache-2.0 for code.

- A prototype of proposals, signatures, comment periods and a tamper-evident log, runnable from the repository by someone who did not write it.
- A published test plan, with the checks that must pass before any real vote is run.
- A design for the privacy layer (Phase 4) with an outside cryptography review scheduled or completed.
- A pilot design (Phase 5): a small advisory vote with a willing community, with its consent, data and accessibility plans written down first. A first draft is in [pilot-design.md](pilot-design.md); it names no community.

**Check:** an independent reviewer can build the prototype, run its tests, and confirm it stores no behavior data beyond what verification needs.

## What is not promised

- No live deployment, no binding votes, and no claim that CIP works at national scale. Every figure is a proposal from the paper.
- No telemetry, tracking or analytics beyond what the data-collection policy allows.
- No partnership, endorsement or funding is assumed by this plan.

## Open questions

1. Funding handling: whether funds, if any are ever received, are held in a public multi-signature wallet or through a fiscal host is not decided.
2. How project contributors and reviewers are credited publicly while respecting each person's privacy.
3. Which community group, if any, would host a Phase 5 pilot.

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
