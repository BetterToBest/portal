# Contributing to the Citizens Internet Portal

CIP is a proposed open-source platform for transparent democratic participation. The research is done; this repository is where it becomes software people can try. Read the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) first, or start with the [overview page](https://bettertobest.github.io/portal/).

You do not need to be a developer. Every contribution below matters.

## Ways to help

- **Developers:** prototype the components in the roadmap below.
- **Security and cryptography reviewers:** challenge the architecture and threat model.
- **Designers and accessibility experts:** make participation easy for everyone.
- **Legal and policy thinkers:** map the statutory questions raised by the Judicial Guard.
- **Writers and organizers:** improve docs, explain the project, find pilot communities.

## Build roadmap (prototype phases)

| Phase | Goal | Status |
|---|---|---|
| 0 | Overview page and contributor guide | Done |
| 1 | Specs: threat model, data model, voting rules in `/docs` | In progress: drafts in `/docs` |
| 2 | Simulator: browser demo of direct, liquid and quadratic voting | Four models live in `/simulator` (voting, liquid delegation, ranked-choice, ledger fork); more welcome |
| 3 | Prototype: proposals, signatures, comment periods, tamper-evident log | Started: [plan](docs/phase-3-plan.md); first pieces (test log and two verifiers, test data only) in [prototype/](prototype/) |
| 4 | Privacy layer: verifiable ballots without revealing votes | Open |
| 5 | Pilot design: a small advisory vote with a real community | Started: first draft in [docs/pilot-design.md](docs/pilot-design.md); no community approached |

Phases 1 and 2 are the best places to start.

## How to start

1. Say hello in [Discussions](https://github.com/BetterToBest/portal/discussions).
2. Pick an open issue (starter ideas are in `docs/good-first-issues.md`), or propose one.
3. Fork, make a small change, open a pull request. Short pull requests get reviewed fastest.

## Ground rules

- Be kind and assume good faith.
- Claims need sources. Label proposals as proposals.
- Nothing may collect or monetize user behavior data. This is a core design principle.
- Contributions are licensed **CC BY 4.0** for docs and research, and the [Apache License 2.0](LICENSE) for code.
