# Phase 3 test plan (draft v0.1)

Status: **draft for review.** This lists the checks that must pass before any real vote is run with CIP software, even an advisory one with a willing community. It belongs to the [Phase 3 plan](phase-3-plan.md) and the "large outcome" in the [milestone plan](milestone-plan.md). CIP is a research proposal, not a live voting system, and every design here is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html). Nothing is decided until reviewers agree, and no dates are promised.

Nothing the software does may collect or monetize user behavior data. That is a core principle of the project, and [data-collection.md](data-collection.md) says what it means in practice.

## How to read this plan

Each check is a gate: if it fails, no real vote happens until it passes. "Status today" says honestly where the project stands. Most gates are **not met yet**, because the prototype so far is a test log with two verifiers and a viewer, on test data only (see [prototype/](../prototype/)).

A gate is only met when the evidence is public: the commit it was run on, the date, the command, and the result, recorded in the repository.

## The gates

| # | Gate | How it is checked | Status today |
|---|---|---|---|
| G1 | The written rules and the programs agree | At least three verifiers, at least one written by someone other than the main author, agree on every shared test log and on thousands of random single edits. | Partly met: two verifiers, same author, agree on 20 test logs (also saved as a language-neutral [answer key](../prototype/answer-key/expected.json)), 600 random edits and 40 odd Ed25519 key and signature cases (SPEC 4.2). The third, outside one is missing. How an outside person would write it, from the spec alone, is in [review-brief.md](review-brief.md); nobody has been asked. |
| G2 | Any change to the record is detected | Every single edit to a good log is rejected. A log rebuilt and re-signed by its operator is exposed by a checkpoint saved earlier. | Partly met: tested on test data, and there are now commands to save and compare checkpoints and a written proposal for who keeps them ([checkpoints.md](checkpoints.md)). No real watchers exist yet, and the bar for "enough" watchers is a proposal. |
| G3 | A signature covers the exact text it was given | Signing an old version, signing twice and editing text after signing are all rejected. | Met on test data (rule logs and edit tests). |
| G4 | Keys stay with the person | A review of key generation, storage and recovery (paper §4.3.2). | Not met: the prototype has no real key handling, only test identities that anyone can recompute. A written proposal for generation, storage and recovery, with open questions, is in [key-handling.md](key-handling.md); nothing in it is built or reviewed. |
| G5 | One real person, one key | A tested way to link a key to one verified person without recording how they vote. | Not met: outside the prototype. The paper's identity layer (§4.2.3) is not built. A written proposal with options, a threat table and open questions is in [identity-linking.md](identity-linking.md); nothing in it is built or reviewed, and it cannot be fully met before the Phase 4 ballot design exists. |
| G6 | No behavior data | Nothing in tier 1 of [data-collection.md](data-collection.md) is collected. An automated check fails the build on network or tracking code. An independent "no telemetry" review of client and node code. | Partly met: a coarse automated check exists for the prototype. No independent review. |
| G7 | People can use it | Automated accessibility checks in light and dark, then testing by people who use a screen reader, a keyboard alone and a small screen. | Partly met: automated checks and scripted keyboard tests pass on the viewer and simulators. Testing with real assistive technology has not happened (#7, #11). |
| G8 | Outside security review | An independent review of the threat model (#8) and of the cryptography, with findings fixed or published. | Not met. What an outside reviewer would be asked to do, what they get and how findings are published is in [review-brief.md](review-brief.md); nobody has been asked, and it has not been reviewed. |
| G9 | The community agrees to what is being tested | A pilot design written first: consent, what data exists and for how long, an accessibility plan, how a result is reported, and who can stop it. | Not met: Phase 5. A written proposal for consent, data, access, result reporting and who can stop a pilot, with open questions, is in [pilot-design.md](pilot-design.md); it has not been reviewed. No community has been approached and none has agreed. |
| G10 | It is clear what the result means | Every screen and every result says that the vote is advisory, what it does not show, and where the rules are written. | Not met: no vote interface exists. A written proposal of wording rules, a template notice and examples is in [advisory-notice.md](advisory-notice.md); no volunteer has read it and nothing is built or reviewed. |

## What a run must publish

For each gate, when it is checked: the commit, the date, who ran it, the exact command or procedure, the result, and any failure left open. A gate that was met on an earlier commit is checked again before a vote if the code it covers changed.

## What this plan does not claim

- It is not a certification, and passing every gate would not make CIP safe at national scale. It is the minimum before a small advisory test.
- It does not set a date, name a pilot community or promise funding.
- The gates and their wording are proposals. Reviewers may add, merge or drop them.

## Open questions

1. Is ten gates the right set? What is missing, for example resilience when an operator goes offline, or a way to withdraw a result?
2. Who counts as independent for G1 and G8, given a pseudonymous project with few contributors?
3. How many people must keep checkpoints, and where should they publish them, for G2 to mean something? [checkpoints.md](checkpoints.md) proposes three watchers and two places as a starting point; is that right?
4. Should a gate be allowed to be met by a documented, accepted limitation rather than a fix? If so, who accepts it?

Comments and corrections are welcome in [Discussions](https://github.com/BetterToBest/portal/discussions).
