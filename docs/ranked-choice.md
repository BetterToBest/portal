# Ranked-Choice Tie-Break Rules (proposal v0.1)

Status: **draft proposal for review.** It answers issue #13. The paper uses ranked-choice voting to elect Oversight Board members (Appendix A.3) and the Research Hub lists it among the voting configurations CIP would support, but neither gives counting or tie-break rules. Everything below is a proposal. A [simulator](../simulator/ranked/) applies these rules to ballots you type or choose (issue #5).

## Scope

Single-winner instant-runoff counting. Multi-seat elections are an open question: A.3 gives the guardians 3 board seats with staggered terms, which could mean three separate single-winner elections or one multi-seat count. The paper does not say.

## Counting rules

1. Each ballot ranks any number of candidates. Partial ranking is allowed.
2. A ballot counts for its highest-ranked candidate still in the race. Skipped ranks are ignored. A candidate ranked twice counts once.
3. If a candidate holds more than half of the **continuing** ballots, that candidate wins.
4. Otherwise the candidate with the fewest votes is eliminated and their ballots move on. A ballot with no candidates left is **exhausted**.
5. Always publish the exhausted count next to the winner's share, so people can see how many ballots ended up not counting.

Small electorates matter here. Some Board electorates are small (for example the 50 State Governors), so exact ties are far more likely than in a mass election.

## Ties: an ordered cascade

Apply these in order and stop at the first that settles it.

**Step 0. Batch elimination.** If the lowest candidates' combined votes are still fewer than the next candidate's, eliminate all of them at once. No tie-break is needed.

**Step 1. Does the tie matter?** Re-run the count once for each tied candidate eliminated. If every run elects the same winner, declare that winner and record that the tie did not change the outcome.

**Step 2. Look-back.** Compare the tied candidates in the most recent earlier round where their totals differ. The one with fewer votes then is eliminated. This can reach back to the first round.

**Step 3. Head-to-head.** Compare the tied candidates pairwise across all ballots. The one who loses the pairwise comparison is eliminated.

**Step 4. Verifiable random draw.** Only as a last resort, and only for elections that must produce one winner. The draw uses public randomness committed before the count.

## Which rule for which decision

| Decision | If the tie matters after Step 1 |
|---|---|
| Advisory vote | Publish the result as **tied**, with the count for each branch. No random winner. An advisory vote can honestly say "split" |
| Election to an office | Continue with Steps 2, 3 and 4 |

An exact tie between the final two candidates follows the same table: "tied" for advisory votes, the cascade for elections.

## Worked examples

These were checked with a small script. The ballot counts are illustrative.

**Example 1: batch elimination.** First choices are A 30, B 28, C 3, D 3. C and D together have 6, fewer than B's 28, so both go at once. No tie-break is needed. Result: A 30, B 28, with 6 exhausted ballots.

**Example 2: a tie that matters.** 100 ballots: 34 rank A only; 30 rank B only; 20 rank C then B; 12 rank D then C; 2 rank D then B; 2 rank D then A.
- Round 1: A 34, B 30, C 20, D 16. D is eliminated.
- Round 2: A 36, B 32, C 32. B and C tie for last.
- Eliminating B leads to A winning (A 36, C 32). Eliminating C leads to B winning (B 52, A 36). The tie decides the winner.
- Advisory vote: publish "tied between A and B, depending on the tie". Election: look-back finds C had 20 to B's 30 in round 1, so C is eliminated and B wins.

**Example 3: a tie that does not matter.** 100 ballots: 40 rank A only; 25 rank B only; 15 rank C then A; 15 rank D then A; 5 rank E then A. After E goes, C and D tie at 15. Eliminating either sends 15 ballots to A, and A wins with 60 either way. Declare A and note the tie.

**Example 4: exact final tie.** 50 ballots rank A only and 50 rank B only. Advisory vote: tied. Election: no earlier round separates them, so Step 4 applies.

## Privacy and tallying

Publishing every full ranking lets a buyer or coercer demand a rare, recognizable ranking and check for it, which undercuts the vote-buying protections of §4.3. The proposal is to publish aggregates only: counts per round and the pairwise comparison table, not individual rankings, computed under the ballot-privacy design. This needs cryptography review.

## Open questions

1. Multi-seat elections: three staggered single-winner counts, or one multi-seat count?
2. Which public randomness source is safe from grinding? Options include values from several independent chains, committed in advance.
3. Should a voter be allowed to rank all candidates, or is a cap on rankings better for accessibility?
4. Is "tied" acceptable for advisory votes that feed into a legislative process?
5. Can the pairwise table be produced without exposing rankings?
