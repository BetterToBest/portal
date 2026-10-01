# CIP Voting Rules (draft v0.1)

Status: **draft for review.** Rules below come from the [CIP paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) §4.4 unless noted. Try simplified versions on the [overview page](https://bettertobest.github.io/portal/#how) and in the [simulator](https://bettertobest.github.io/portal/simulator/).

## Direct proposals

- Any citizen can submit a proposal once it reaches a minimum signature threshold. The initial proposed threshold is **1,000 signatures**, from the companion Medium article. It is a starting point for initiating proposals and may change in the future as the system is tested.
- Public comment period of 30 to 90 days, then an amendment process.
- Advisory referenda pass on a simple majority.
- Binding policy changes need a 60 to 67% supermajority plus geographic distribution requirements.

## Liquid delegation

- Delegation is revocable and can be limited to a topic.
- No delegate may represent more than 1% of the population.
- Citizens can always vote directly, overriding their delegate.

### Proposed handling of loops and the cap (draft, from the [liquid simulator](https://bettertobest.github.io/portal/simulator/liquid/))

The paper does not say what happens in these two cases. The simulator models the rules below so people can see their effects. They are proposals, not decisions (issue #12).

**Delegation loops (A to B to A).**
1. Prevent them when they are created: the system refuses a delegation that would close a loop and tells the person why.
2. If a loop forms anyway (for example two people changing delegations at the same time, or topic settings differing), everyone in the loop **votes directly**. People who delegated into the loop follow the loop member they reach.
3. The alternative the simulator also offers, where every vote that reaches a loop is lost, silently removes people from the count. That is why it is not the proposed default.

**Delegations above the cap.**
1. A delegate stops accepting votes at the cap (1% of the population in the paper).
2. A voter whose delegation would go over the cap is **returned to direct voting**, notified, and given time to vote or choose another delegate before the vote closes.
3. When a delegate is full, **which voters are turned away is decided by a random draw**: a seeded shuffle in the simulator, and a verifiable public random draw in a real system. First come first served was considered and set aside because it rewards racing to sign people up. How the draw is made verifiable, and when it runs, is open question 2 below.

Not modeled: topic-specific delegation, expiry, and delegate competence. Whether the delegation graph is public is also open, because public delegations can show how a person's vote was cast.

## Quadratic voting (budgets)

- Every participant gets equal credits.
- Votes cost credits quadratically: 1 vote = 1 credit, 2 = 4, 3 = 9.
- Intended for participatory budgeting, so strong preferences can be expressed at a rising cost.

## Ranked choice

Listed on the Research Hub among the voting configurations CIP would support. The paper does not specify tie-break or elimination details. A draft is in [ranked-choice.md](ranked-choice.md): counting rules, an ordered tie-break cascade, and separate handling for advisory votes and elections (issue #13).

## Open questions (not answered by the paper)

1. Delegation cycles (A to B to A): a draft rule is proposed above; needs review.
2. Delegations that exceed the cap: the draft returns the voter to direct voting, chosen by random draw. How the draw is made verifiable, when it runs, and how turned-away voters are told in time are still open.
3. What quorum, if any, applies to advisory votes?
4. How is collusion in quadratic voting (splitting identities, coordinating) detected?
5. How many credits per person, and how often do they refresh?
6. Which system fits which decision type?

New systems can be proposed too. Open a Discussion.
