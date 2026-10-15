# CIP Glossary

Plain-language definitions of the terms the [CIP paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html)
introduces, one or two sentences each, for a reader who has not read the paper.
Each entry links to where the paper explains the term. CIP is a research proposal,
not a live system, so the definitions say what each piece **would** do.

- **Ledger** — the shared record of every proposal, amendment, vote, and signature
  that the platform keeps. The paper proposes running it on several independent
  blockchain implementations that can be checked against one another, so that
  rewriting or deleting the record would be obvious. Explained in
  [§4.2](https://bettertobest.github.io/research-hub/citizens-internet-portal.html)
  and sketched in [docs/halt-power.md](halt-power.md) and the
  [ledger fork and halt-power simulator](https://bettertobest.github.io/portal/simulator/fork/).

- **Zero-knowledge proof** — a way for the platform to verify that a ballot was cast
  by a real, registered citizen without revealing who cast it, so that votes stay
  checkable but cannot be linked back to a person. The paper proposes pairing this
  with encryption to keep voting private while stopping vote buying. Explained in
  [§4.3](https://bettertobest.github.io/research-hub/citizens-internet-portal.html)
  and summarized in [docs/threat-model.md](threat-model.md).

- **Liquid delegation** — the option to pass your vote to someone else you trust,
  limited to a topic and limited to a cap of about 1% of the population, so one
  person cannot accumulate too much influence. You can always take the vote back
  and cast it yourself instead. Explained in
  [§4.4](https://bettertobest.github.io/research-hub/citizens-internet-portal.html)
  and worked through in [docs/voting-rules.md](voting-rules.md) and the
  [liquid-delegation simulator](https://bettertobest.github.io/portal/simulator/liquid/).

- **Quadratic voting** — a budget-style vote where each person gets the same number
  of credits and the cost of voting rises with the square of the count (1 vote
  costs 1, 2 cost 4, 3 cost 9), so expressing a strong preference is possible but
  gets progressively more expensive. It is proposed mainly for decisions about
  spending. Explained in [§4.4](https://bettertobest.github.io/research-hub/citizens-internet-portal.html)
  and in [docs/voting-rules.md](voting-rules.md).

- **Judicial Guard** — a group of guardians, spread across many regions, who are
  proposed to pause a suspected attack while it is investigated, and who would
  follow public prosecution paths instead of deciding outcomes themselves. The
  paper gives the guard powers but no limits, so the draft limits are recorded in
  [docs/halt-power.md](halt-power.md). Explained in
  [§4.2.3 safeguard 6](https://bettertobest.github.io/research-hub/citizens-internet-portal.html)
  and [§5](https://bettertobest.github.io/research-hub/citizens-internet-portal.html).

These are working definitions, not a reference standard; where a term's details are
still open, they are tracked in the linked draft documents rather than settled here.
